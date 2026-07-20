/** @babel */
import React from "react";

import { toNativePathSep } from "../helpers";
import { getGitBridge } from "../git-bridge";

export default class PullRequestPatchContainer extends React.Component {
  state = {
    multiFilePatch: null,
    error: null,
    last: { url: null, patch: null, etag: null },
  };

  componentDidMount() {
    this.mounted = true;
    this.fetchDiff(this.state.last);
  }

  componentDidUpdate(prevProps) {
    const explicitRefetch = this.props.refetch && !prevProps.refetch;
    const requestedURLChange = this.state.last.url !== this.getDiffURL();

    if (explicitRefetch || requestedURLChange) {
      const { last } = this.state;
      this.setState({
        multiFilePatch: null,
        error: null,
        last: { url: this.getDiffURL(), patch: null, etag: null },
      });
      this.fetchDiff(last);
    }
  }

  componentWillUnmount() {
    this.mounted = false;
  }

  render() {
    return this.props.children(this.state.error, this.state.multiFilePatch);
  }

  // Generate a v3 GitHub API REST URL for the pull request resource.
  // Example: https://api.github.com/repos/atom/github/pulls/1829
  getDiffURL() {
    return this.props.endpoint.getRestURI(
      "repos",
      this.props.owner,
      this.props.repo,
      "pulls",
      this.props.number,
    );
  }

  buildPatch(rawDiff) {
    const bridge = getGitBridge();
    const { filtered, removed } = bridge.filterDiff(rawDiff);
    // git-panel's parser already strips the a/ and b/ diff prefixes; the API
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
    if (this.props.largeDiffThreshold) {
      options.largeDiffThreshold = this.props.largeDiffThreshold;
    }
    return bridge.buildMultiFilePatch(diffs, options);
  }

  async fetchDiff(last) {
    const url = this.getDiffURL();
    let response;

    try {
      const headers = {
        Accept: "application/vnd.github.v3.diff",
        Authorization: `bearer ${this.props.token}`,
      };

      if (url === last.url && last.etag !== null) {
        headers["If-None-Match"] = last.etag;
      }

      response = await fetch(url, { headers });
    } catch (err) {
      return this.reportDiffError(
        `Network error encountered fetching the patch: ${err.message}.`,
        err,
      );
    }

    if (response.status === 304) {
      // Not modified.
      if (!this.mounted) {
        return null;
      }

      return new Promise((resolve) =>
        this.setState({
          multiFilePatch: last.patch,
          error: null,
          last,
        }),
      );
    }

    if (!response.ok) {
      return this.reportDiffError(
        `Unable to fetch the diff for this pull request: ${response.statusText}.`,
      );
    }

    try {
      const etag = response.headers.get("ETag");
      const rawDiff = await response.text();
      if (!this.mounted) {
        return null;
      }

      const multiFilePatch = this.buildPatch(rawDiff);
      return new Promise((resolve) =>
        this.setState(
          {
            multiFilePatch,
            error: null,
            last: { url, patch: multiFilePatch, etag },
          },
          resolve,
        ),
      );
    } catch (err) {
      return this.reportDiffError("Unable to parse the diff for this pull request.", err);
    }
  }

  reportDiffError(message, error) {
    if (!this.mounted) {
      return null;
    }

    return new Promise((resolve) => {
      if (error) {
        // eslint-disable-next-line no-console
        console.error(error);
      }

      if (!this.mounted) {
        resolve();
        return;
      }

      this.setState({ error: message }, resolve);
    });
  }
}
