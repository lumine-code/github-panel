/** @babel */
/** @jsx h */
import { h, flushViews, createViewHost } from "./helpers/etch";
import { Range } from "lumine";

describe("review markers", () => {
  let container, root, editor, Marker;

  beforeEach(async () => {
    const markerModule = require("../lib/lumine/marker");
    Marker = markerModule.default || markerModule;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createViewHost(container);
    editor = await lumine.workspace.open();
    editor.setText("first\ncommented\nlast\n");
  });

  afterEach(async () => {
    await flushViews(async () => root.destroy());
    container.remove();
  });

  it("reports editor buffer ranges when an edit moves a comment marker", async () => {
    const changes = [];
    await flushViews(async () =>
      root.update(
        <Marker
          editor={editor}
          bufferRange={Range.fromObject([
            [1, 0],
            [1, 9],
          ])}
          onDidChange={(event) => changes.push(event)}
          exclusive={true}
          invalidate="surround"
        />,
      ),
    );

    editor.setTextInBufferRange(
      [
        [0, 0],
        [0, 0],
      ],
      "inserted\n",
    );

    expect(changes.length).toBe(1);
    expect(changes[0].oldRange instanceof Range).toBe(true);
    expect(changes[0].newRange instanceof Range).toBe(true);
    expect(changes[0].oldRange.start).toEqual(jasmine.objectContaining({ row: 1, column: 0 }));
    expect(changes[0].newRange.start).toEqual(jasmine.objectContaining({ row: 2, column: 0 }));
  });
});
