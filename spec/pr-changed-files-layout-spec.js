/** @babel */
/** @jsx h */
import { Disposable } from "lumine";
import { h, flushViews, createViewHost } from "./helpers/etch";

function deferred() {
  let resolve;
  const promise = new Promise((yes) => (resolve = yes));
  return { promise, resolve };
}

function diff(version = 1) {
  return [
    "diff --git a/example.txt b/example.txt",
    "--- a/example.txt",
    "+++ b/example.txt",
    "@@ -1,3 +1,3 @@",
    " context",
    "-old value",
    `+new value ${version}`,
    " tail",
    "",
  ].join("\n");
}

describe("PR Changed Files diff layouts", () => {
  let host, element, view, props, bridge, setPatchView, requests, patches, navigation;
  let ChangedFiles, PatchContainer, RefHolder, fetches;

  beforeEach(async () => {
    await lumine.packages.activatePackage("language-text");
    const git = await lumine.packages.startPackage("patch-view");
    bridge = git.mainModule.providePatchView();
    ({ setPatchView } = require("../lib/patch-view"));
    setPatchView(bridge);
    const changedFilesModule = require("../lib/containers/pr-changed-files-container");
    ChangedFiles = changedFilesModule.default || changedFilesModule;
    const patchContainerModule = require("../lib/containers/pr-patch-container");
    PatchContainer = patchContainerModule.default || patchContainerModule;
    const refHolderModule = require("../lib/models/ref-holder");
    RefHolder = refHolderModule.default || refHolderModule;
    requests = [];
    patches = [];
    navigation = new Set();
    const build = bridge.buildMultiFilePatch;
    spyOn(bridge, "buildMultiFilePatch").and.callFake((...args) => {
      const patch = build(...args);
      patches.push(patch);
      return patch;
    });
    spyOn(window, "fetch").and.callFake(() => {
      const request = deferred();
      requests.push(request);
      return request.promise;
    });
    fetches = spyOn(PatchContainer.prototype, "fetchDiff").and.callThrough();
    props = {
      owner: "owner",
      repo: "repo",
      number: 1,
      endpoint: { getRestURI: (...parts) => `https://api.github.com/${parts.join("/")}` },
      token: "token",
      workspace: lumine.workspace,
      commands: lumine.commands,
      config: lumine.config,
      keymaps: lumine.keymaps,
      tooltips: lumine.tooltips,
      localRepository: {
        stageFiles: jasmine.createSpy("stageFiles"),
        unstageFiles: jasmine.createSpy("unstageFiles"),
        applyPatchToIndex: jasmine.createSpy("applyPatchToIndex"),
      },
      refEditor: new RefHolder(),
      refPatchController: new RefHolder(),
      onOpenFilesTab: (callback) => {
        navigation.add(callback);
        return new Disposable(() => navigation.delete(callback));
      },
      ref: (value) => {
        if (value) view = value;
      },
    };
    element = document.createElement("div");
    element.style.height = "500px";
    element.style.width = "900px";
    document.body.appendChild(element);
    host = createViewHost(element);
    await flushViews(() => host.update(h(ChangedFiles, props)));
  });

  afterEach(async () => {
    await flushViews(() => host?.destroy());
    element?.remove();
    patches.forEach((patch) => patch.dispose());
    setPatchView(null);
  });

  async function finish(index, version = 1, status = 200) {
    const pending = fetches.calls.all()[index].returnValue;
    requests[index].resolve({
      status,
      ok: status === 200,
      statusText: status === 304 ? "Not Modified" : "OK",
      headers: { get: () => "etag" },
      text: () => Promise.resolve(diff(version)),
    });
    await pending;
    await flushViews(() => {});
    return patches[patches.length - 1];
  }

  async function setLayout(mode) {
    await flushViews(() => element.querySelector(`[data-diff-view="${mode}"]`).click());
  }

  async function refresh() {
    props = { ...props, shouldRefetch: true };
    await flushViews(() => host.update(h(ChangedFiles, props)));
  }

  function editor(side) {
    return element.querySelector(`[data-diff-side="${side}"] lumine-text-editor`).getModel();
  }

  function mutationCommands() {
    const target = element.querySelector("lumine-text-editor");
    return lumine.commands
      .findCommands({ target })
      .map(({ name }) => name)
      .filter((name) =>
        /^(?:patch-view:(?:discard-selected-lines|stage-file-mode-change|unstage-file-mode-change|stage-symlink-change|unstage-symlink-change)|core:confirm)$/.test(
          name,
        ),
      );
  }

  it("offers the shared header control and keeps remote diffs read-only in both layouts", async () => {
    await finish(0);
    expect(element.querySelector(".patch-view-ChangesView-title").textContent).toBe(
      "Changed Files",
    );
    expect(element.querySelector('[data-diff-view="unified"]').classList.contains("selected")).toBe(
      true,
    );
    expect(element.querySelector(".patch-view-HunkHeaderView-stageButton")).toBeNull();
    expect(
      element.querySelector('button[title="Stage File"], button[title="Unstage File"]'),
    ).toBeNull();
    expect(mutationCommands()).toEqual([]);
    expect(props.refPatchController.get().getDiffView()).toBe("unified");

    await setLayout("side-by-side");
    expect(props.refPatchController.get().getDiffView()).toBe("side-by-side");
    expect(editor("old").getText()).toBe("context\nold value\ntail");
    expect(editor("new").getText()).toBe("context\nnew value 1\ntail");
    expect(editor("old").isReadOnly()).toBe(true);
    expect(editor("new").isReadOnly()).toBe(true);
    expect(
      element.querySelectorAll(".patch-view-SideBySidePatchView-sharedHeader--file").length,
    ).toBe(1);
    expect(element.querySelector(".patch-view-HunkHeaderView-stageButton")).toBeNull();
    expect(mutationCommands()).toEqual([]);
    expect(props.localRepository.applyPatchToIndex).not.toHaveBeenCalled();
  });

  it("keeps Side by Side and its native buffers through a refresh", async () => {
    const firstPatch = await finish(0);
    await setLayout("side-by-side");
    const previousEditors = [editor("old"), editor("new")];
    const previousBuffers = previousEditors.map((model) => model.getBuffer());
    await refresh();
    expect(previousEditors.every((model) => model.isDestroyed())).toBe(false);
    expect(previousBuffers.every((buffer) => buffer.isDestroyed())).toBe(false);
    expect([editor("old"), editor("new")]).toEqual(previousEditors);
    expect(navigation.size).toBe(1);
    const nextPatch = await finish(1, 2);
    expect(firstPatch.isDisposed()).toBe(true);
    expect([editor("old"), editor("new")]).toEqual(previousEditors);
    expect(previousEditors.map((model) => model.getBuffer())).toEqual(previousBuffers);
    expect(editor("new").getText()).toContain("new value 2");
    expect(props.refPatchController.get().getDiffView()).toBe("side-by-side");
    expect(navigation.size).toBe(1);
    const currentBuffers = [editor("old").getBuffer(), editor("new").getBuffer()];
    await flushViews(() => host.update(null));
    expect(nextPatch.isDisposed()).toBe(true);
    expect(currentBuffers.every((buffer) => buffer.isDestroyed())).toBe(true);
    expect(navigation.size).toBe(0);
    expect(props.refPatchController.getOr(null)).toBeNull();
    expect(view.destroyed).toBe(true);
  });

  it("navigates from review Open Diff to the comment's current column", async () => {
    await finish(0);
    await setLayout("side-by-side");
    for (const callback of navigation)
      callback({ changedFilePath: "example.txt", changedFilePosition: 3 });
    await flushViews(() => {});
    expect(editor("new").getCursorBufferPosition().row).toBe(1);
    expect(props.refEditor.get()).toBe(editor("new"));

    await setLayout("unified");
    for (const callback of navigation)
      callback({ changedFilePath: "example.txt", changedFilePosition: 2 });
    await flushViews(() => {});
    expect(props.refEditor.get().getCursorBufferPosition().row).toBe(1);
    expect(navigation.size).toBe(1);
  });

  it("preserves the selected layout when the PR is not modified", async () => {
    const patch = await finish(0);
    await setLayout("side-by-side");
    await refresh();
    await finish(1, 1, 304);
    expect(patches.length).toBe(1);
    expect(patch.isDisposed()).toBe(false);
    expect(editor("new").getText()).toContain("new value 1");
    expect(props.refPatchController.get().getDiffView()).toBe("side-by-side");
  });
});
