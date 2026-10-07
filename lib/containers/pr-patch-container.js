/** @babel */
/** @jsx h */
import { provideEnvironment } from "../graphql/environment";
import View, { h } from "../etch/view";
import { toNativePathSep } from "../helpers";
import { getPatchView, onDidChangePatchView } from "../patch-view";
export default class PullRequestPatchContainer extends View {
  constructor(props, children) {
    super(props, children);
    this.ownedPatches = new Set();
    this.patchProviders = new WeakMap();
    this.acceptedDiff = null;
    this.patchViewSubscription = onDidChangePatchView(() => {
      this.refreshPatchView().catch((error) =>
        console.error("Unable to rebuild pull request diff", error),
      );
    });
    this.initialize();
  }
  state = {
    multiFilePatch: null,
    error: null,
    last: {
      url: null,
      token: null,
      patch: null,
      etag: null,
    },
  };
  didMount() {
    this.mounted = true;
    this.fetchDiff(this.state.last);
  }
  didUpdate(prevProps) {
    const explicitRefetch = this.props.refetch && !prevProps.refetch;
    const requestedURLChange = this.getDiffURL(prevProps) !== this.getDiffURL();
    const tokenChange = prevProps.token !== this.props.token;
    if (explicitRefetch || requestedURLChange || tokenChange) {
      this.fetchDiff(this.state.last);
    }
  }
  willDestroy() {
    this.mounted = false;
    this.patchViewSubscription.dispose();
    this.acceptedDiff = null;
    this.diffRequest?.controller.abort();
    this.diffRequest = null;
    for (const patch of this.ownedPatches) patch.dispose();
    this.ownedPatches.clear();
    this.state = {
      ...this.state,
      multiFilePatch: null,
      last: { url: null, token: null, patch: null, etag: null },
    };
  }
  render() {
    return (
      <span
        style={{
          display: "contents",
        }}
      >
        {provideEnvironment(
          this.props.children(this.state.error, this.state.multiFilePatch),
          this.props.environment,
        )}
      </span>
    );
  }

  // Generate a v3 GitHub API REST URL for the pull request resource.
  // Example: https://api.github.com/repos/example/project/pulls/1829
  getDiffURL(props = this.props) {
    return props.endpoint.getRestURI("repos", props.owner, props.repo, "pulls", props.number);
  }
  buildPatch(rawDiff) {
    const bridge = getPatchView();
    if (!bridge) throw new Error("The patch-view service is inactive.");
    const { filtered, removed } = bridge.filterDiff(rawDiff);
    // The patch-view parser already strips the a/ and b/ diff prefixes; the API
    // diff uses *nix-style separators, so convert to native paths for the editor.
    const diffs = bridge.parseDiff(filtered).map((diff) => ({
      ...diff,
      newPath: diff.newPath ? toNativePathSep(diff.newPath) : diff.newPath,
      oldPath: diff.oldPath ? toNativePathSep(diff.oldPath) : diff.oldPath,
    }));
    const options = {
      preserveOriginal: true,
      removed,
    };
    if (this.props.largeDiffThreshold !== undefined) {
      options.largeDiffThreshold = this.props.largeDiffThreshold;
    }
    return bridge.buildMultiFilePatch(diffs, options);
  }
  currentAcceptedDiff() {
    const accepted = this.acceptedDiff;
    return accepted && accepted.url === this.getDiffURL() && accepted.token === this.props.token
      ? accepted
      : null;
  }
  buildOwnedPatch(rawDiff, provider = getPatchView()) {
    if (!provider) return null;
    const patch = this.buildPatch(rawDiff);
    this.ownedPatches.add(patch);
    this.patchProviders.set(patch, provider);
    return patch;
  }
  async refreshPatchView() {
    if (!this.mounted) return null;
    const provider = getPatchView();
    const accepted = this.currentAcceptedDiff();
    const patch = accepted ? this.buildOwnedPatch(accepted.rawDiff, provider) : null;
    try {
      await this.updateState(() =>
        this.mounted && provider === getPatchView() && accepted === this.currentAcceptedDiff()
          ? {
              multiFilePatch: patch,
              last: { ...this.state.last, patch },
            }
          : null,
      );
    } finally {
      this.releaseUnusedPatches();
    }
    return this.state.multiFilePatch;
  }
  async fetchDiff(last) {
    const url = this.getDiffURL();
    const token = this.props.token;
    this.diffRequest?.controller.abort();
    const request = {
      url,
      token,
      controller: new AbortController(),
    };
    this.diffRequest = request;
    const sameResource = url === last.url && token === last.token;
    if (!sameResource) this.acceptedDiff = null;
    const loading = this.updateState({
      error: null,
      // Keep this PR's accepted snapshot mounted during refreshes. A new PR or
      // credential still clears the old resource before its request completes.
      ...(!sameResource
        ? {
            multiFilePatch: null,
            last: { url: null, token: null, patch: null, etag: null },
          }
        : {}),
    });
    // Old children may still read the previous snapshot until this frame
    // commits. Network work can proceed while that ownership barrier settles.
    Promise.resolve(loading).then(
      () => this.releaseUnusedPatches(),
      () => this.releaseUnusedPatches(),
    );
    if (!this.isCurrentRequest(request)) return null;
    let response;
    try {
      const headers = {
        Accept: "application/vnd.github.v3.diff",
        Authorization: `bearer ${token}`,
      };
      if (
        url === last.url &&
        token === last.token &&
        last.etag !== null &&
        (last.patch !== null || this.currentAcceptedDiff())
      ) {
        headers["If-None-Match"] = last.etag;
      }
      response = await fetch(url, {
        headers,
        signal: request.controller.signal,
      });
    } catch (err) {
      return this.reportDiffError(
        request,
        `Network error encountered fetching the patch: ${err.message}.`,
        err,
      );
    }
    if (!this.isCurrentRequest(request)) {
      return null;
    }
    if (response.status === 304) {
      // Not modified.
      const provider = getPatchView();
      const reuse =
        last.patch &&
        this.patchProviders.get(last.patch) === provider &&
        !last.patch.isDisposed?.();
      const accepted = this.currentAcceptedDiff();
      const patch = reuse
        ? last.patch
        : accepted
          ? this.buildOwnedPatch(accepted.rawDiff, provider)
          : null;
      return this.setDiffState(
        request,
        {
          multiFilePatch: patch,
          error: null,
          last: { ...last, patch },
        },
        provider,
      );
    }
    if (!response.ok) {
      return this.reportDiffError(
        request,
        `Unable to fetch the diff for this pull request: ${response.statusText}.`,
      );
    }
    try {
      const etag = response.headers.get("ETag");
      const rawDiff = await response.text();
      if (!this.isCurrentRequest(request)) {
        return null;
      }
      this.acceptedDiff = { url, token, rawDiff, etag };
      const provider = getPatchView();
      const multiFilePatch = this.buildOwnedPatch(rawDiff, provider);
      return await this.setDiffState(
        request,
        {
          multiFilePatch,
          error: null,
          last: {
            url,
            token,
            patch: multiFilePatch,
            etag,
          },
        },
        provider,
      );
    } catch (err) {
      return this.reportDiffError(request, "Unable to parse the diff for this pull request.", err);
    }
  }
  isCurrentRequest(request) {
    return (
      this.mounted &&
      this.diffRequest === request &&
      request.url === this.getDiffURL() &&
      request.token === this.props.token
    );
  }
  async setDiffState(request, state, provider = getPatchView()) {
    if (!this.isCurrentRequest(request)) {
      this.releaseUnusedPatches();
      return null;
    }
    if (provider !== getPatchView()) {
      this.releaseUnusedPatches();
      return this.refreshPatchView();
    }
    try {
      await this.updateState(() =>
        this.isCurrentRequest(request) && provider === getPatchView() ? state : null,
      );
    } finally {
      this.releaseUnusedPatches();
    }
    return this.isCurrentRequest(request) ? this.state.multiFilePatch : null;
  }
  releaseUnusedPatches() {
    const current = new Set([this.state.multiFilePatch, this.state.last.patch]);
    for (const patch of this.ownedPatches) {
      if (current.has(patch)) continue;
      this.ownedPatches.delete(patch);
      patch.dispose();
    }
  }
  reportDiffError(request, message, error) {
    if (!this.isCurrentRequest(request)) {
      return null;
    }
    if (error) {
      console.error(error);
    }
    return this.setDiffState(request, {
      error: message,
    });
  }
}
