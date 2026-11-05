/** @babel */
/** @jsx h */
import { h, flushViews, createViewHost } from "./helpers/etch.js";

import LumineTextEditor from "../lib/lumine/lumine-text-editor.js";

describe("LumineTextEditor", () => {
  let container, root;

  beforeEach(async () => {
    await lumine.packages.activatePackage("language-text");
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createViewHost(container);
  });

  afterEach(async () => {
    await flushViews(async () => root.destroy());
    container.remove();
  });

  it("uses Plain Text for an editor whose buffer it owns", async () => {
    await flushViews(async () => root.update(<LumineTextEditor />));

    expect(container.querySelector("lumine-text-editor").getModel().getGrammar().scopeName).toBe(
      "text.plain",
    );
  });

  it("keeps explicit wrap bounds when scoped settings change", async () => {
    await flushViews(async () =>
      root.update(
        <LumineTextEditor softWrapped={true} softWrapMinColumn={80} softWrapMaxColumn={80} />,
      ),
    );
    const editor = container.querySelector("lumine-text-editor").getModel();
    expect(editor.getSoftWrapColumn()).toBe(80);

    lumine.config.set("editor.softWrapMinColumn", 10, { scopeSelector: ".text.plain" });
    lumine.config.set("editor.softWrapMaxColumn", 20, { scopeSelector: ".text.plain" });
    await globalThis.flushMicrotasks();

    expect(editor.getSoftWrapColumn()).toBe(80);
  });
});
