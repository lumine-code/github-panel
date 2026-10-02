/** @babel */
/** @jsx h */
import { h, flushViews, createViewHost } from "./helpers/etch";

import LumineTextEditor from "../lib/lumine/lumine-text-editor";

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
});
