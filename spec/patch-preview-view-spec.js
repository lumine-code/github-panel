/** @babel */
/** @jsx React.createElement */
import React, { act } from "react";
import { createRoot } from "react-dom/client";

describe("review patch previews", () => {
  let container, root, bridge, PatchPreviewView, patches, wasActEnvironment;

  beforeEach(async () => {
    wasActEnvironment = global.IS_REACT_ACT_ENVIRONMENT;
    global.IS_REACT_ACT_ENVIRONMENT = true;
    patches = [];
    root = null;
    container = null;
    const pkg = await lumine.packages.activatePackage("git-panel");
    bridge = pkg.mainModule.provideGitPanel();
    const previewModule = require("../lib/views/patch-preview-view");
    PatchPreviewView = previewModule.default || previewModule;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    if (root) await act(async () => root.unmount());
    container?.remove();
    for (const patch of patches) {
      if (!patch.getBuffer().isDestroyed()) patch.getBuffer().release();
    }
    global.IS_REACT_ACT_ENVIRONMENT = wasActEnvironment;
  });

  function replacementPatch(oldText = "prefix old suffix", newText = "prefix new suffix") {
    const rawDiff = [
      "diff --git a/example.txt b/example.txt",
      "--- a/example.txt",
      "+++ b/example.txt",
      "@@ -1,3 +1,3 @@",
      " context",
      `-${oldText}`,
      `+${newText}`,
      " tail",
      "",
    ].join("\n");
    const { filtered, removed } = bridge.filterDiff(rawDiff);
    const patch = bridge.buildMultiFilePatch(bridge.parseDiff(filtered), {
      removed,
      preserveOriginal: true,
    });
    patches.push(patch);
    return patch;
  }

  async function renderPreview(patch, maxRowCount = 2) {
    await act(async () =>
      root.render(
        <PatchPreviewView
          multiFilePatch={patch}
          fileName="example.txt"
          diffRow={3}
          maxRowCount={maxRowCount}
          config={lumine.config}
        />,
      ),
    );
    return container.querySelector("lumine-text-editor").getModel();
  }

  function wordRanges(editor, kind) {
    const className = `git-panel-FilePatchView-word--${kind}`;
    const ranges = [];
    for (const [layer, decorations] of editor.decorationManager.layerDecorationsByMarkerLayer) {
      if ([...decorations].some((decoration) => decoration.getProperties().class === className)) {
        ranges.push(...layer.getMarkers().map((marker) => marker.getBufferRange().serialize()));
      }
    }
    return ranges;
  }

  it("renders the word layers supplied by the current git-panel bridge", async () => {
    const patch = replacementPatch();
    const editor = await renderPreview(patch);

    expect(editor.getText()).toBe("prefix old suffix\nprefix new suffix");
    expect(wordRanges(editor, "deleted")).toEqual([
      [
        [0, 7],
        [0, 10],
      ],
    ]);
    expect(wordRanges(editor, "added")).toEqual([
      [
        [1, 7],
        [1, 10],
      ],
    ]);
  });

  it("clips word markers to the preview window when its context changes", async () => {
    const patch = replacementPatch();
    const editor = await renderPreview(patch);

    const sameEditor = await renderPreview(patch, 1);

    expect(sameEditor).toBe(editor);
    expect(editor.getText()).toBe("prefix new suffix");
    expect(wordRanges(editor, "deleted")).toEqual([]);
    expect(wordRanges(editor, "added")).toEqual([
      [
        [0, 7],
        [0, 10],
      ],
    ]);

    await renderPreview(patch, 3);

    expect(editor.getText()).toBe("context\nprefix old suffix\nprefix new suffix");
    expect(wordRanges(editor, "deleted")).toEqual([
      [
        [1, 7],
        [1, 10],
      ],
    ]);
    expect(wordRanges(editor, "added")).toEqual([
      [
        [2, 7],
        [2, 10],
      ],
    ]);
  });

  it("replaces the word ranges when a refreshed patch reuses the preview buffer", async () => {
    const initialPatch = replacementPatch();
    const editor = await renderPreview(initialPatch);
    const buffer = editor.getBuffer();
    const nextPatch = replacementPatch("prefix old suffix", "prefix old changed");

    await renderPreview(nextPatch);

    expect(editor.getBuffer()).toBe(buffer);
    expect(wordRanges(editor, "deleted")).toEqual([
      [
        [0, 11],
        [0, 17],
      ],
    ]);
    expect(wordRanges(editor, "added")).toEqual([
      [
        [1, 11],
        [1, 18],
      ],
    ]);

    await renderPreview(replacementPatch("prefix old suffix", "prefix old suffix"));
    expect(wordRanges(editor, "deleted")).toEqual([]);
    expect(wordRanges(editor, "added")).toEqual([]);
  });

  it("releases temporary slices and its owned preview without destroying the source patch", async () => {
    const patch = replacementPatch();
    const slices = [];
    const getPreview = patch.getPreviewPatchBuffer.bind(patch);
    spyOn(patch, "getPreviewPatchBuffer").and.callFake((...args) => {
      const slice = getPreview(...args);
      slices.push(slice.getBuffer());
      return slice;
    });
    const editor = await renderPreview(patch);
    const ownedBuffer = editor.getBuffer();

    await renderPreview(patch, 3);

    expect(slices.length).toBe(2);
    expect(slices[1].isDestroyed()).toBe(true);
    expect(ownedBuffer.isDestroyed()).toBe(false);

    await act(async () => root.render(null));

    expect(editor.isDestroyed()).toBe(true);
    expect(ownedBuffer.isDestroyed()).toBe(true);
    expect(patch.getBuffer().isDestroyed()).toBe(false);
    expect(patch.getWordAdditionLayer().getMarkerCount()).toBe(1);
  });
});
