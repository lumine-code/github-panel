/** @babel */
/** @jsx h */
import { h, flushViews, createViewHost } from "./helpers/etch";

describe("review patch previews", () => {
  let container, root, bridge, PatchPreviewView, patches, setGitBridge;

  beforeEach(async () => {
    patches = [];
    root = null;
    container = null;
    const pkg = await lumine.packages.activatePackage("git-panel");
    bridge = pkg.mainModule.provideGitPanel();
    ({ setGitBridge } = require("../lib/git-bridge"));
    setGitBridge(bridge);
    const previewModule = require("../lib/views/patch-preview-view");
    PatchPreviewView = previewModule.default || previewModule;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createViewHost(container);
  });

  afterEach(async () => {
    if (root) await flushViews(async () => root.destroy());
    container?.remove();
    for (const patch of patches) {
      patch.dispose();
    }
    setGitBridge(null);
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
    await flushViews(async () =>
      root.update(
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

  async function setLayout(mode) {
    await flushViews(() => container.querySelector(`[data-diff-view="${mode}"]`).click());
  }

  function editorsBySide() {
    return Object.fromEntries(
      [...container.querySelectorAll("[data-diff-side]")].map((column) => [
        column.dataset.diffSide,
        column.querySelector("lumine-text-editor").getModel(),
      ]),
    );
  }

  it("defaults to Unified and switches review context to read-only aligned columns", async () => {
    const patch = replacementPatch();
    await renderPreview(patch, 4);
    const preview = container.querySelector(".github-panel-PatchPreviewView");
    expect(preview.hasAttribute("data-context-menu-boundary")).toBe(true);
    expect(
      container.querySelector('[data-diff-view="unified"]').classList.contains("selected"),
    ).toBe(true);
    expect(container.querySelector(".git-panel-FilePatchView-controlBlock")).toBeNull();

    await setLayout("side-by-side");
    const editors = editorsBySide();
    expect(editors.old.getText()).toBe("context\nprefix old suffix");
    expect(editors.new.getText()).toBe("context\nprefix new suffix");
    expect(editors.old.isReadOnly()).toBe(true);
    expect(editors.new.isReadOnly()).toBe(true);
    expect(
      container.querySelector('button[title="Stage File"], button[title="Unstage File"]'),
    ).toBeNull();
    expect(container.querySelectorAll(".git-panel-SideBySidePatchView-sharedHeader").length).toBe(
      0,
    );
    const oldBuffer = editors.old.getBuffer();
    const newBuffer = editors.new.getBuffer();
    await setLayout("unified");
    expect(oldBuffer.isDestroyed()).toBe(true);
    expect(newBuffer.isDestroyed()).toBe(true);
    expect(container.querySelector("lumine-text-editor").getModel().getText()).toBe(
      "context\nprefix old suffix\nprefix new suffix",
    );
  });

  it("preserves layout while changing review context and a refreshed patch", async () => {
    const patch = replacementPatch();
    await renderPreview(patch, 4);
    await setLayout("side-by-side");
    await renderPreview(patch, 1);
    expect(editorsBySide().old.getText()).toBe("");
    expect(editorsBySide().new.getText()).toBe("prefix new suffix");
    const next = replacementPatch("prefix old suffix", "prefix changed suffix");
    await renderPreview(next, 2);
    expect(editorsBySide().old.getText()).toBe("prefix old suffix");
    expect(editorsBySide().new.getText()).toBe("prefix changed suffix");
    expect(
      container.querySelector('[data-diff-view="side-by-side"]').classList.contains("selected"),
    ).toBe(true);
    const buffers = Object.values(editorsBySide()).map((editor) => editor.getBuffer());
    await flushViews(() => root.update(null));
    expect(buffers.every((buffer) => buffer.isDestroyed())).toBe(true);
    expect(next.getBuffer().isDestroyed()).toBe(false);
  });

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
    const getPreview = patch.createPreviewPatch.bind(patch);
    spyOn(patch, "createPreviewPatch").and.callFake((...args) => {
      const slice = getPreview(...args);
      slices.push(slice.getBuffer());
      return slice;
    });
    const editor = await renderPreview(patch);
    const ownedBuffer = editor.getBuffer();

    await renderPreview(patch, 3);

    expect(slices.length).toBe(2);
    expect(slices[0].isDestroyed()).toBe(true);
    expect(slices[1].isDestroyed()).toBe(false);
    expect(ownedBuffer.isDestroyed()).toBe(false);

    await flushViews(async () => root.update(null));

    expect(editor.isDestroyed()).toBe(true);
    expect(ownedBuffer.isDestroyed()).toBe(true);
    expect(slices[1].isDestroyed()).toBe(true);
    expect(patch.getBuffer().isDestroyed()).toBe(false);
    expect(patch.getWordAdditionLayer().getMarkerCount()).toBe(1);
  });

  it("keeps a borrowed source alive through re-windowing after its creator releases it", async () => {
    const patch = replacementPatch();
    const editor = await renderPreview(patch);
    patch.dispose();
    expect(patch.isDisposed()).toBe(false);
    await renderPreview(patch, 4);
    expect(editor.getText()).toContain("prefix new suffix");
    await flushViews(() => root.update(null));
    expect(patch.isDisposed()).toBe(true);
    expect(patch.getBuffer().isDestroyed()).toBe(true);
  });
});
