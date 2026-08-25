/** @babel */
import path from "path";

describe("editor comment styles", () => {
  it("tints comment lines without hiding selections underneath", () => {
    const stylesheet = lumine.themes.requireStylesheet(
      path.join(__dirname, "..", "styles", "editor-comment.css"),
    );
    const editor = document.createElement("lumine-text-editor");
    editor.style.setProperty("--background-color-info", "rgb(40, 120, 200)");
    const line = document.createElement("div");
    line.className = "line github-panel-editorCommentHighlight";
    editor.appendChild(line);
    jasmine.attachToDOM(editor);

    try {
      const background = getComputedStyle(line).backgroundColor;
      const alpha = /[,/]\s*([\d.]+)\s*\)$/.exec(background);

      expect(background).not.toBe("rgba(0, 0, 0, 0)");
      expect(alpha).not.toBeNull();
      expect(Number(alpha[1])).toBeGreaterThan(0);
      expect(Number(alpha[1])).toBeLessThan(1);
    } finally {
      editor.remove();
      stylesheet.dispose();
    }
  });
});
