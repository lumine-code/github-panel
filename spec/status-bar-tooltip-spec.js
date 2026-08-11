/** @babel */
/** @jsx React.createElement */
import React, { act } from "react";
import { createRoot } from "react-dom/client";

import StatusBarTileView from "../lib/views/status-bar-tile-view";

describe("the GitHub status bar tile", () => {
  let container, root, tooltipManager, keyBindingTarget, wasActEnvironment;

  beforeEach(() => {
    wasActEnvironment = global.IS_REACT_ACT_ENVIRONMENT;
    global.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    tooltipManager = {
      addComposite: jasmine
        .createSpy("addComposite")
        .and.returnValue({ dispose: jasmine.createSpy("dispose") }),
    };
    keyBindingTarget = document.createElement("div");
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    global.IS_REACT_ACT_ENVIRONMENT = wasActEnvironment;
  });

  it("advertises its mouse action and toggle-focus key binding", async () => {
    await act(async () =>
      root.render(
        <StatusBarTileView tooltipManager={tooltipManager} keyBindingTarget={keyBindingTarget} />,
      ),
    );

    const [tile, entries] = tooltipManager.addComposite.calls.mostRecent().args;
    expect(tile).toBe(container.querySelector(".github-panel-StatusBarTile"));
    expect(entries).toEqual([
      { title: "Toggle GitHub panel", keyBindingExtra: "LMB" },
      {
        title: "Toggle focus",
        keyBindingCommand: "github-panel:toggle-focus",
        keyBindingTarget,
      },
    ]);
  });
});
