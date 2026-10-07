/** @babel */
import { createViewModel } from "./helpers/etch";

function deferred() {
  let resolve, reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function response(rawDiff, { status = 200, statusText = "OK", etag = "etag" } = {}) {
  return {
    status,
    statusText,
    ok: status >= 200 && status < 300,
    headers: { get: () => etag },
    text: jasmine.createSpy("text").and.returnValue(Promise.resolve(rawDiff)),
  };
}

describe("PullRequestPatchContainer fetching", () => {
  let container, requests, holder, previousProvider;

  function applyState(update, callback) {
    const state = typeof update === "function" ? update(container.state, container.props) : update;
    if (state) {
      container.state = { ...container.state, ...state };
      container.didUpdate(container.props);
    }
    if (callback) {
      callback();
    }
  }

  function latestFetch() {
    return container.fetchDiff.calls.mostRecent().returnValue;
  }

  function updateProps(props) {
    const previous = container.props;
    container.props = { ...previous, ...props };
    container.didUpdate(previous);
    return latestFetch();
  }

  async function finish(index, rawDiff) {
    const fetchPromise = latestFetch();
    requests[index].resolve(response(rawDiff));
    await fetchPromise;
    return container.state.multiFilePatch;
  }

  beforeEach(() => {
    const loaded = require("../lib/containers/pr-patch-container");
    const PullRequestPatchContainer = loaded.default || loaded;
    holder = require("../lib/patch-view");
    previousProvider = holder.getPatchView();
    // Parsing is stubbed below; this fixture still declares a live renderer edge.
    holder.setPatchView({});
    requests = [];
    spyOn(window, "fetch").and.callFake(() => {
      const request = deferred();
      requests.push(request);
      return request.promise;
    });
    spyOn(console, "error");
    container = createViewModel(PullRequestPatchContainer, {
      owner: "owner",
      repo: "repo",
      number: 1,
      token: "token",
      endpoint: { getRestURI: (...parts) => `https://api.github.com/${parts.join("/")}` },
      children: () => null,
    });
    // Control state commits directly so network and native update ordering can
    // be exercised without a rendered PR view or a live GitHub connection.
    spyOn(container, "updateState").and.callFake(applyState);
    spyOn(container, "buildPatch").and.callFake((rawDiff) => ({ rawDiff, dispose() {} }));
    spyOn(container, "fetchDiff").and.callThrough();
    container.didMount();
  });

  afterEach(() => {
    container.willDestroy();
    holder.setPatchView(previousProvider);
  });

  it("reuses the ETag for the same URL and settles a 304 with its cached patch", async () => {
    const patch = await finish(0, "initial");
    const fetchPromise = updateProps({ refetch: true });
    expect(window.fetch.calls.mostRecent().args[1].headers["If-None-Match"]).toBe("etag");
    expect(container.state.multiFilePatch).toBe(patch);

    requests[1].resolve(response(null, { status: 304 }));
    await fetchPromise;
    expect(container.state.multiFilePatch).toBe(patch);
    expect(container.state.error).toBeNull();
    expect(container.state.last.patch).toBe(patch);
  });

  it("fetches a changed PR once and omits the previous PR's ETag", async () => {
    await finish(0, "initial");
    updateProps({ number: 2 });
    expect(window.fetch.calls.count()).toBe(2);
    expect(window.fetch.calls.mostRecent().args[0]).toBe(
      "https://api.github.com/repos/owner/repo/pulls/2",
    );
    expect(window.fetch.calls.mostRecent().args[1].headers["If-None-Match"]).toBeUndefined();

    await finish(1, "new PR");
    expect(window.fetch.calls.count()).toBe(2);
    expect(container.state.multiFilePatch.rawDiff).toBe("new PR");
  });

  it("refetches after a token change without the old token's ETag", async () => {
    await finish(0, "initial");
    updateProps({ token: "new-token" });
    const headers = window.fetch.calls.mostRecent().args[1].headers;
    expect(headers.Authorization).toBe("bearer new-token");
    expect(headers["If-None-Match"]).toBeUndefined();
    await finish(1, "new token");
    expect(container.state.last.token).toBe("new-token");
  });

  it("discards a previous PR response before reading its body", async () => {
    const oldFetch = latestFetch();
    updateProps({ number: 2 });
    const patch = await finish(1, "new PR");
    const oldResponse = response("old PR");
    requests[0].resolve(oldResponse);
    await oldFetch;

    expect(oldResponse.text).not.toHaveBeenCalled();
    expect(container.state.multiFilePatch).toBe(patch);
    expect(container.state.last.url).toMatch(/\/2$/);
  });

  it("discards a body that completes after a refetch of the same PR", async () => {
    const oldFetch = latestFetch();
    const body = deferred();
    const oldResponse = response(null);
    oldResponse.text.and.returnValue(body.promise);
    requests[0].resolve(oldResponse);
    await Promise.resolve();
    expect(oldResponse.text).toHaveBeenCalled();

    updateProps({ refetch: true });
    const patch = await finish(1, "refetched");
    body.resolve("old body");
    await oldFetch;
    expect(container.state.multiFilePatch).toBe(patch);
    expect(container.buildPatch.calls.count()).toBe(1);
  });

  it("does not restore an obsolete cached patch from a late 304", async () => {
    await finish(0, "initial");
    const oldFetch = updateProps({ refetch: true });
    updateProps({ refetch: false });
    updateProps({ refetch: true });
    const patch = await finish(2, "refetched");

    requests[1].resolve(response(null, { status: 304 }));
    await oldFetch;
    expect(container.state.multiFilePatch).toBe(patch);
    expect(container.state.last.patch).toBe(patch);
  });

  it("ignores an obsolete network failure", async () => {
    const oldFetch = latestFetch();
    updateProps({ number: 2 });
    const patch = await finish(1, "new PR");
    requests[0].reject(new Error("offline"));
    await oldFetch;

    expect(container.state.multiFilePatch).toBe(patch);
    expect(container.state.error).toBeNull();
    expect(console.error).not.toHaveBeenCalled();
  });

  it("ignores an obsolete HTTP failure", async () => {
    const oldFetch = latestFetch();
    updateProps({ number: 2 });
    const patch = await finish(1, "new PR");
    requests[0].resolve(response(null, { status: 403, statusText: "Forbidden" }));
    await oldFetch;

    expect(container.state.multiFilePatch).toBe(patch);
    expect(container.state.error).toBeNull();
  });

  it("ignores an obsolete response body failure", async () => {
    const oldFetch = latestFetch();
    const body = deferred();
    const oldResponse = response(null);
    oldResponse.text.and.returnValue(body.promise);
    requests[0].resolve(oldResponse);
    await Promise.resolve();
    updateProps({ number: 2 });
    const patch = await finish(1, "new PR");

    body.reject(new Error("body interrupted"));
    await oldFetch;
    expect(container.state.multiFilePatch).toBe(patch);
    expect(container.state.error).toBeNull();
    expect(console.error).not.toHaveBeenCalled();
  });

  it("reports a current network failure and settles the fetch", async () => {
    const fetchPromise = latestFetch();
    requests[0].reject(new Error("offline"));
    await fetchPromise;
    expect(container.state.error).toMatch(/Network error.*offline/);
    expect(console.error).toHaveBeenCalled();
  });

  it("reports a current HTTP failure", async () => {
    const fetchPromise = latestFetch();
    requests[0].resolve(response(null, { status: 403, statusText: "Forbidden" }));
    await fetchPromise;
    expect(container.state.error).toMatch(/Unable to fetch.*Forbidden/);
  });

  it("reports a current parse failure", async () => {
    const fetchPromise = latestFetch();
    container.buildPatch.and.callFake(() => {
      throw new Error("invalid diff");
    });
    requests[0].resolve(response("invalid"));
    await fetchPromise;
    expect(container.state.error).toBe("Unable to parse the diff for this pull request.");
    expect(console.error).toHaveBeenCalled();
  });

  it("does not read a response after unmounting", async () => {
    const fetchPromise = latestFetch();
    const fetchedResponse = response("unmounted");
    container.willDestroy();
    const stateCalls = container.updateState.calls.count();
    requests[0].resolve(fetchedResponse);
    await fetchPromise;
    expect(fetchedResponse.text).not.toHaveBeenCalled();
    expect(container.updateState.calls.count()).toBe(stateCalls);
  });

  it("does not parse or report a response body after unmounting", async () => {
    const fetchPromise = latestFetch();
    const body = deferred();
    const fetchedResponse = response(null);
    fetchedResponse.text.and.returnValue(body.promise);
    requests[0].resolve(fetchedResponse);
    await Promise.resolve();
    container.willDestroy();
    body.reject(new Error("body interrupted"));
    await fetchPromise;
    expect(container.buildPatch).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it("rechecks request identity when the view commits a queued state update", async () => {
    const queued = [];
    const stateQueued = deferred();
    container.updateState.and.callFake((update, callback) => {
      if (typeof update === "function") {
        const committed = deferred();
        queued.push({ update, callback, resolve: committed.resolve });
        stateQueued.resolve();
        return committed.promise;
      } else {
        applyState(update, callback);
      }
    });
    const oldFetch = latestFetch();
    requests[0].resolve(response("old PR"));
    await stateQueued.promise;

    updateProps({ number: 2 });
    applyState(queued[0].update, queued[0].callback);
    queued[0].resolve();
    await oldFetch;
    expect(container.state.multiFilePatch).toBeNull();
    expect(container.state.last.url).toBeNull();

    container.updateState.and.callFake(applyState);
    await finish(1, "new PR");
    expect(container.state.multiFilePatch.rawDiff).toBe("new PR");
  });
});
