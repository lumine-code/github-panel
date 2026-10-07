/** @babel */
import path from "path";
import { Disposable } from "lumine";
import { h, flushViews, createViewHost } from "./helpers/etch";
import PullRequestPatchContainer from "../lib/containers/pr-patch-container";
import ChangedFiles from "../lib/containers/pr-changed-files-container";
import RefHolder from "../lib/models/ref-holder";
import { setPatchView } from "../lib/patch-view";

function deferred() {
  let resolve;
  const promise = new Promise((finish) => (resolve = finish));
  return { promise, resolve };
}

function diff(version) {
  const lines = [
    "diff --git a/example.txt b/example.txt",
    "index 1234567..abcdef0 100644",
    "--- a/example.txt",
    "+++ b/example.txt",
  ];
  for (const section of [0, 1, 2]) {
    const start = section * 300 + 1;
    lines.push(`@@ -${start},40 +${start},40 @@ section ${section}`);
    for (let row = 0; row < 40; row++) {
      const suffix = "long content ".repeat(25);
      lines.push(`-old ${section}:${row} ${suffix}`);
      lines.push(`+new ${section}:${row} v${section === 1 ? version : 0} ${suffix}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

describe("mounted PR diff refreshes through the shared ChangesView", () => {
  let host,
    element,
    props,
    requests,
    patches,
    fetches,
    build,
    bridge,
    stylesheet,
    previousScrollPastEnd;
  let frame;

  beforeEach(async () => {
    patches = [];
    previousScrollPastEnd = lumine.config.inspect("editor.scrollPastEnd");
    await lumine.packages.activatePackage("language-text");
    const git = await lumine.packages.startPackage("patch-view");
    bridge = git.mainModule.providePatchView();
    setPatchView(bridge);
    stylesheet = lumine.themes.requireStylesheet(path.join(git.path, "styles", "main.css"));
    lumine.config.set("editor.scrollPastEnd", true);
    requests = [];
    const actualBuild = bridge.buildMultiFilePatch;
    build = spyOn(bridge, "buildMultiFilePatch").and.callFake((...args) => {
      const patch = actualBuild(...args);
      patches.push(patch);
      return patch;
    });
    spyOn(window, "fetch").and.callFake((url, options) => {
      const request = deferred();
      requests.push({ ...request, url, options });
      return request.promise;
    });
    fetches = spyOn(PullRequestPatchContainer.prototype, "fetchDiff").and.callThrough();
    props = {
      owner: "owner",
      repo: "repo",
      number: 1,
      token: "token",
      endpoint: { getRestURI: (...parts) => `https://api.github.com/${parts.join("/")}` },
      workspace: lumine.workspace,
      commands: lumine.commands,
      config: lumine.config,
      keymaps: lumine.keymaps,
      tooltips: { add: () => new Disposable(), addComposite: () => new Disposable() },
      refEditor: new RefHolder(),
      refPatchController: new RefHolder(),
      localRepository: {},
    };
    element = document.createElement("div");
    element.style.cssText = "display: flex; width: 1000px; height: 340px;";
    jasmine.attachToDOM(element);
    host = createViewHost(element);
    await flushViews(() => host.update(h(ChangedFiles, props)));
  });

  afterEach(async () => {
    cancelAnimationFrame(frame);
    await host?.destroy();
    element?.remove();
    for (const patch of patches) patch.dispose();
    stylesheet?.dispose();
    if (previousScrollPastEnd.overrideValue !== undefined)
      lumine.config.set("editor.scrollPastEnd", previousScrollPastEnd.overrideValue);
    else lumine.config.unset("editor.scrollPastEnd");
    setPatchView(null);
  });

  function editors() {
    return Array.from(element.querySelectorAll("lumine-text-editor"), (node) => node.getModel());
  }

  async function settle() {
    for (let pass = 0; pass < 4; pass++) {
      await flushViews(() => {});
      const nodes = Array.from(element.querySelectorAll("lumine-text-editor"));
      const updates = nodes.map((node) => node.getNextUpdatePromise());
      for (const node of nodes) node.getComponent().scheduleUpdate();
      await Promise.all(updates);
    }
  }

  async function finish(index, version, status = 200) {
    const pending = fetches.calls.all()[index].returnValue;
    requests[index].resolve({
      status,
      ok: status === 200,
      statusText: status === 304 ? "Not Modified" : "OK",
      headers: { get: () => `etag-${version}` },
      text: () => Promise.resolve(diff(version)),
    });
    await pending;
    await settle();
  }

  async function refresh() {
    props = { ...props, shouldRefetch: false };
    await flushViews(() => host.update(h(ChangedFiles, props)));
    props = { ...props, shouldRefetch: true };
    await flushViews(() => host.update(h(ChangedFiles, props)));
  }

  async function prepare(mode) {
    await finish(0, 1);
    if (mode === "side-by-side") {
      await flushViews(() => element.querySelector('[data-diff-view="side-by-side"]').click());
      await settle();
      props.refPatchController.get().refView.get().refSideBySide.get().releaseInitialScrollAnchor();
    }
    for (const editor of editors()) editor.setSoftWrapped(false);
    await settle();
    const editor = props.refEditor.get();
    const node = editor.getElement();
    const row = mode === "side-by-side" ? 50 : 100;
    node.setScrollTop(node.getComponent().pixelPositionBeforeBlocksForRow(row) + 7);
    node.setScrollLeft(180);
    await settle();
    return editors().map((editor) => ({
      editor,
      element: editor.getElement(),
      buffer: editor.getBuffer(),
      component: editor.getElement().getComponent(),
      top: editor.getElement().getScrollTop(),
      left: editor.getElement().getScrollLeft(),
    }));
  }

  function expectStable(previous, mode) {
    const current = editors();
    expect(current.length).toBe(previous.length);
    previous.forEach((before, index) => {
      expect(current[index] === before.editor).toBe(true);
      expect(before.editor.isDestroyed()).toBe(false);
      if (!current[index]) return;
      expect(current[index].getElement() === before.element).toBe(true);
      expect(current[index].getBuffer() === before.buffer).toBe(true);
      expect(current[index].isReadOnly()).toBe(true);
      expect(current[index].getScrollPastEnd()).toBe(true);
      expect(current[index].getElement().getScrollTop()).toBeCloseTo(before.top, 0);
      expect(current[index].getElement().getScrollLeft()).toBeCloseTo(before.left, 0);
    });
    expect(props.refPatchController.getOr(null)?.getDiffView()).toBe(mode);
    expect(element.querySelector(".github-panel-Loader")).toBeNull();
  }

  function monitorPaints(previous) {
    const frames = [];
    const sample = () => {
      frames.push({
        editors: editors(),
        loading: Boolean(element.querySelector(".github-panel-Loader")),
        offsets: previous.map(({ component }) => [
          component.renderedScrollTop,
          component.renderedScrollLeft,
        ]),
      });
      frame = requestAnimationFrame(sample);
    };
    frame = requestAnimationFrame(sample);
    return () => {
      cancelAnimationFrame(frame);
      expect(frames.length).toBeGreaterThan(0);
      expect(frames.every((paint) => !paint.loading)).toBe(true);
      previous.forEach((before, index) => {
        expect(frames.every((paint) => paint.editors[index] === before.editor)).toBe(true);
        expect(
          Math.max(...frames.map((paint) => Math.abs(paint.offsets[index][0] - before.top))),
        ).toBeLessThanOrEqual(1);
        expect(
          Math.max(...frames.map((paint) => Math.abs(paint.offsets[index][1] - before.left))),
        ).toBeLessThanOrEqual(1);
      });
    };
  }

  for (const mode of ["unified", "side-by-side"]) {
    // The full initial/held/304/200 cycle waits on several native paint barriers.
    // Keep the viewport assertions intact while allowing layout on loaded CI hosts.
    it(`keeps ${mode} editors and both offsets through held, 304 and changed 200 refreshes`, async () => {
      const previous = await prepare(mode);
      const first = patches[0];
      expect(previous.every((entry) => entry.top > 0 && entry.left > 0)).toBe(true);
      const finishPaints = monitorPaints(previous);
      const changed = jasmine.createSpy("unchanged PR diff text");
      const subs = previous.map(({ buffer }) => buffer.onDidChangeText(changed));
      await refresh();
      await settle();
      expectStable(previous, mode);
      expect(requests[1].options.headers["If-None-Match"]).toBe("etag-1");
      await finish(1, 1, 304);
      expectStable(previous, mode);
      expect(changed).not.toHaveBeenCalled();
      expect(build).toHaveBeenCalledTimes(1);
      expect(first.isDisposed()).toBe(false);
      for (const sub of subs) sub.dispose();

      await refresh();
      await settle();
      expectStable(previous, mode);
      await finish(2, 2);
      expectStable(previous, mode);
      finishPaints();
      expect(props.refEditor.get().getText()).toContain("new 1:0 v2");
      expect(props.refEditor.get().getText()).not.toContain("new 1:0 v1");
      expect(first.isDisposed()).toBe(true);
      expect(patches.filter((patch) => !patch.isDisposed()).length).toBe(1);
      expect(element.querySelectorAll(".patch-view-HunkHeaderView").length).toBe(3);
    }, 15000);
  }

  for (const changedContext of ["PR", "token"]) {
    it(`clears the prior resource on a changed ${changedContext} and rejects a late old response body`, async () => {
      const previous = await prepare("side-by-side");
      const first = patches[0];
      await refresh();
      const oldFetch = fetches.calls.all()[1].returnValue;
      const oldBody = deferred();
      requests[1].resolve({
        status: 200,
        ok: true,
        headers: { get: () => "late-etag" },
        text: () => oldBody.promise,
      });
      await globalThis.flushMicrotasks();
      props = {
        ...props,
        ...(changedContext === "PR" ? { number: 2 } : { token: "replacement-token" }),
      };
      await flushViews(() => host.update(h(ChangedFiles, props)));
      await settle();
      expect(editors().length).toBe(0);
      expect(element.querySelector(".github-panel-Loader") !== null).toBe(true);
      expect(
        previous.every(({ editor, buffer }) => editor.isDestroyed() && buffer.isDestroyed()),
      ).toBe(true);
      expect(first.isDisposed()).toBe(true);
      expect(requests[1].options.signal.aborted).toBe(true);
      expect(requests[2].options.headers["If-None-Match"]).toBeUndefined();
      await finish(2, 2);
      const latest = props.refEditor.get();
      oldBody.resolve(diff(3));
      await oldFetch;
      await settle();
      expect(props.refEditor.get() === latest).toBe(true);
      expect(latest.getText()).toContain("new 1:0 v2");
      expect(latest.getText()).not.toContain("new 1:0 v3");
      expect(build).toHaveBeenCalledTimes(2);
      expect(patches.filter((patch) => !patch.isDisposed()).length).toBe(1);
    });
  }
});
