/** @babel */
/** @jsx React.createElement */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import EditorCommentDecorationsController from "../lib/controllers/editor-comment-decorations-controller";
import ReviewsView from "../lib/views/reviews-view";
import { checkoutStates } from "../lib/controllers/pr-checkout-controller";

describe("review comments positioned in an editor", () => {
  let editor, container, root, props, wasActEnvironment;

  beforeEach(() => {
    wasActEnvironment = global.IS_REACT_ACT_ENVIRONMENT;
    global.IS_REACT_ACT_ENVIRONMENT = true;
    editor = lumine.workspace.buildTextEditor();
    editor.setText("first\nsecond\nthird\nfourth\nfifth\n");
    editor.addGutter({ name: "github-comment-icon" });
    jasmine.attachToDOM(editor.getElement());
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    props = {
      editor,
      workspace: lumine.workspace,
      threadsForPath: [{ rootCommentID: "comment", threadID: "thread", position: 1 }],
      commentTranslationsForPath: {
        diffToFilePosition: new Map([[1, 2]]),
        fileTranslations: null,
        removed: false,
        digest: null,
      },
    };
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    editor.destroy();
    container.remove();
    global.IS_REACT_ACT_ENVIRONMENT = wasActEnvironment;
  });

  async function render(nextProps = props) {
    props = nextProps;
    await act(async () => root.render(<EditorCommentDecorationsController {...props} />));
  }

  function commentMarkers() {
    return editor
      .getDecorations({ class: "github-panel-editorCommentHighlight" })
      .map((d) => d.getMarker());
  }

  it("keeps a comment on its tracked line after an unsaved edit and a review rerender", async () => {
    await render();
    expect(commentMarkers()[0].getBufferRange().start.row).toBe(1);

    await act(async () => editor.getBuffer().insert([0, 0], "inserted\n"));
    await render({ ...props, number: 2 });

    expect(commentMarkers()[0].getBufferRange().start.row).toBe(2);
    const gutter = editor
      .getDecorations({ type: "gutter" })
      .find((decoration) =>
        decoration.getProperties().class.includes("github-panel-editorCommentGutterIcon"),
      );
    expect(gutter.getMarker().getBufferRange().start.row).toBe(2);
  });

  it("repositions the comment when a refreshed diff changes its file row", async () => {
    await render();
    props.commentTranslationsForPath.diffToFilePosition.set(1, 4);
    await render();

    expect(commentMarkers()[0].getBufferRange().start.row).toBe(3);
  });

  it("removes decorations when the thread disappears without a digest change", async () => {
    await render();
    const original = commentMarkers()[0];
    await render({ ...props, threadsForPath: [] });

    expect(commentMarkers()).toEqual([]);
    expect(original.isDestroyed()).toBe(true);
  });

  it("omits a comment whose local file translation is unavailable", async () => {
    props.commentTranslationsForPath.fileTranslations = new Map();
    await render();

    expect(commentMarkers()).toEqual([]);
  });

  it("omits a comment whose source line was deleted locally", async () => {
    props.commentTranslationsForPath.fileTranslations = new Map([
      [2, { newPosition: 1, invalidated: true }],
    ]);
    await render();

    expect(commentMarkers()).toEqual([]);
  });
});

describe("review comment navigation positions", () => {
  const rootComment = { path: "a.txt", position: 1 };

  function view(translations) {
    return new ReviewsView({
      commentTranslations: translations,
      checkoutOp: { why: () => checkoutStates.CURRENT },
    });
  }

  it("marks a comment outdated when its file no longer has a diff translation", () => {
    expect(view(new Map()).getTranslatedPosition(rootComment)).toEqual({
      lineNumber: null,
      positionText: "outdated",
    });
  });

  it("does not navigate to a locally deleted comment line", () => {
    const translations = new Map([
      [
        "a.txt",
        {
          diffToFilePosition: new Map([[1, 2]]),
          fileTranslations: new Map([[2, { newPosition: 1, invalidated: true }]]),
        },
      ],
    ]);

    expect(view(translations).getTranslatedPosition(rootComment)).toEqual({
      lineNumber: null,
      positionText: "outdated",
    });
  });
});
