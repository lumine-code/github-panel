/** @babel */
/** @jsx React.createElement */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { Range } from "lumine";

describe("review markers", () => {
  let container, root, editor, Marker, wasActEnvironment;

  beforeEach(async () => {
    wasActEnvironment = global.IS_REACT_ACT_ENVIRONMENT;
    global.IS_REACT_ACT_ENVIRONMENT = true;
    const markerModule = require("../lib/lumine/marker");
    Marker = markerModule.default || markerModule;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    editor = await lumine.workspace.open();
    editor.setText("first\ncommented\nlast\n");
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    global.IS_REACT_ACT_ENVIRONMENT = wasActEnvironment;
  });

  it("reports editor buffer ranges when an edit moves a comment marker", async () => {
    const changes = [];
    await act(async () =>
      root.render(
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
