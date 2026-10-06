/** @babel */
import { h, flushViews } from "./helpers/etch";
import PullRequestPatchContainer from "../lib/containers/pr-patch-container";
import { setGitBridge } from "../lib/git-bridge";

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function diff(version) {
  return `diff --git a/example.txt b/example.txt\nindex 1234567..abcdef0 100644\n--- a/example.txt\n+++ b/example.txt\n@@ -1 +1 @@\n-old value\n+new value ${version}\n`;
}

describe("mounted PR patch snapshot ownership", () => {
  let container, requests, patches, bridge, build, fetches, ChangesView, props;

  beforeEach(async () => {
    await lumine.packages.activatePackage("language-text");
    const git = await lumine.packages.startPackage("git-panel");
    bridge = git.mainModule.provideGitPanel();
    setGitBridge(bridge);
    ChangesView = bridge.ChangesView;
    patches = [];
    requests = [];
    const actualBuild = bridge.buildMultiFilePatch;
    build = spyOn(bridge, "buildMultiFilePatch").and.callFake((...args) => {
      const patch = actualBuild(...args);
      patches.push(patch);
      return patch;
    });
    spyOn(window, "fetch").and.callFake((_url, options) => {
      const response = deferred();
      requests.push({ ...response, signal: options.signal });
      return response.promise;
    });
    fetches = spyOn(PullRequestPatchContainer.prototype, "fetchDiff").and.callThrough();
    props = {
      owner: "owner",
      repo: "repo",
      number: 1,
      token: "token",
      endpoint: { getRestURI: (...parts) => `https://api.github.com/${parts.join("/")}` },
      children: (_error, patch) =>
        patch
          ? h(ChangesView, {
              multiFilePatch: patch,
              readOnly: true,
              workspace: lumine.workspace,
              commands: lumine.commands,
              config: lumine.config,
              keymaps: lumine.keymaps,
              tooltips: { add: () => ({ dispose() {} }), addComposite: () => ({ dispose() {} }) },
              stagingStatus: "unstaged",
              selectedRows: new Set(),
              selectionMode: "hunk",
              selectedRowsChanged() {},
              toggleRows() {},
              discardRows() {},
              toggleFile() {},
              toggleModeChange() {},
              toggleSymlinkChange() {},
              openFile() {},
              surface() {},
              undoLastDiscard() {},
              diveIntoMirrorPatch() {},
            })
          : h("span", {}, "loading"),
    };
    container = new PullRequestPatchContainer(props);
    jasmine.attachToDOM(container.element);
  });

  afterEach(async () => {
    await container?.destroy();
    await flushViews(() => {});
    for (const patch of patches) patch.dispose();
    setGitBridge(null);
  });

  async function finish(index, text, status = 200) {
    const pending = fetches.calls.all()[index].returnValue;
    requests[index].resolve({
      status,
      ok: status === 200,
      statusText: status === 304 ? "Not Modified" : "OK",
      headers: { get: () => "etag" },
      text: () => Promise.resolve(text),
    });
    await pending;
    await flushViews(() => {});
    return container.state.multiFilePatch;
  }

  async function refresh() {
    await flushViews(() => container.update({ ...props, refetch: false }));
    await flushViews(() => container.update({ ...props, refetch: true }));
  }

  it("releases superseded snapshots over 20 refreshes and closes the final native buffer", async () => {
    await finish(0, diff(0));
    const editor = container.element.querySelector("lumine-text-editor").getModel();
    const buffer = editor.getBuffer();
    for (let cycle = 1; cycle <= 20; cycle++) {
      await refresh();
      await finish(cycle, diff(cycle));
      expect(patches.filter((patch) => !patch.isDisposed()).length).toBe(1);
      expect(container.ownedPatches.size).toBe(1);
      expect(container.element.querySelector("lumine-text-editor").getModel()).toBe(editor);
      expect(editor.getBuffer()).toBe(buffer);
      expect(container.element.querySelector("lumine-text-editor").getModel().getText()).toContain(
        `new value ${cycle}`,
      );
    }
    await container.destroy();
    expect(editor.isDestroyed()).toBe(true);
    expect(buffer.isDestroyed()).toBe(true);
    expect(patches.every((patch) => patch.isDisposed())).toBe(true);
    expect(patches.every((patch) => patch.getBuffer().isDestroyed())).toBe(true);
    expect(container.ownedPatches.size).toBe(0);
  }, 15000);

  it("preserves the cached snapshot through a 304 and a failed refresh", async () => {
    const first = await finish(0, diff(0));
    await refresh();
    const reused = await finish(1, null, 304);
    expect(reused).toBe(first);
    expect(first.isDisposed()).toBe(false);
    expect(build).toHaveBeenCalledTimes(1);
    await refresh();
    const pending = fetches.calls.mostRecent().returnValue;
    requests[2].resolve({ status: 503, ok: false, statusText: "Unavailable" });
    await pending;
    await flushViews(() => {});
    expect(container.state.last.patch).toBe(first);
    expect(first.isDisposed()).toBe(false);
    expect(container.ownedPatches.size).toBe(1);
    await container.destroy();
    expect(first.getBuffer().isDestroyed()).toBe(true);
  });

  it("releases the old resource before a changed PR finishes loading", async () => {
    const first = await finish(0, diff(0));
    props = { ...props, number: 2 };
    await flushViews(() => container.update(props));
    expect(first.getBuffer().isDestroyed()).toBe(true);
    expect(container.state.last.patch).toBeNull();
    await finish(1, diff(1));
    expect(patches.filter((patch) => !patch.isDisposed()).length).toBe(1);
  });

  it("releases a built snapshot rejected by a context switch before publication", async () => {
    const original = build.and.originalFn;
    build.and.callFake((...args) => {
      const patch = original(...args);
      patches.push(patch);
      props = { ...props, number: 2 };
      void container.update(props);
      return patch;
    });
    await finish(0, diff(0));
    expect(patches.length).toBe(1);
    expect(patches[0].isDisposed()).toBe(true);
    expect(patches[0].getBuffer().isDestroyed()).toBe(true);
    expect(container.state.multiFilePatch).toBeNull();
    await finish(1, diff(1));
  });

  it("retains a mounted consumer until it releases its independent lease", async () => {
    const patch = await finish(0, diff(0));
    const lease = patch.retain();
    await container.destroy();
    expect(patch.isDisposed()).toBe(false);
    expect(patch.getBuffer().isDestroyed()).toBe(false);
    lease.dispose();
    expect(patch.isDisposed()).toBe(true);
    expect(patch.getBuffer().isDestroyed()).toBe(true);
  });

  it("aborts a body after destruction without constructing a retained snapshot", async () => {
    const pending = fetches.calls.mostRecent().returnValue;
    const body = deferred();
    requests[0].resolve({
      status: 200,
      ok: true,
      headers: { get: () => "etag" },
      text: () => body.promise,
    });
    await globalThis.flushMicrotasks();
    await container.destroy();
    expect(requests[0].signal.aborted).toBe(true);
    body.resolve(diff(0));
    await pending;
    expect(build).not.toHaveBeenCalled();
    expect(container.ownedPatches.size).toBe(0);
  });

  it("respects an explicit zero rendering threshold", async () => {
    props = { ...props, largeDiffThreshold: 0 };
    container.props = props;
    const patch = await finish(0, diff(0));
    expect(patch.getFilePatches()[0].getRenderStatus().isVisible()).toBe(false);
  });
});
