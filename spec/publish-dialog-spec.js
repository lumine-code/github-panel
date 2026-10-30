/** @babel */
import path from "node:path";
import os from "node:os";
import { createViewModel } from "./helpers/etch.js";
import CreateDialogController from "../lib/controllers/create-dialog-controller.js";
import { dialogRequests } from "../lib/controllers/dialogs-controller.js";

describe("GitHub publish folder choice", () => {
  let controller;
  const root = path.join(os.tmpdir(), "github-publish-dialog");

  function dialog(params) {
    controller = createViewModel(CreateDialogController, {
      config: lumine.config,
      request: dialogRequests.publish(params),
      user: { id: "owner" },
    });
    return controller;
  }

  afterEach(() => {
    controller?.destroy();
    for (const buffer of [
      controller?.repoName,
      controller?.localPath,
      controller?.sourceRemoteName,
    ])
      buffer?.destroy();
  });

  it("requires an explicit choice when several folders were selected", () => {
    const directories = [path.join(root, "first"), path.join(root, "second")];
    const view = dialog({ directories });
    view.repoName.setText("remote-name");
    expect(view.localPath.isEmpty()).toBe(true);
    expect(view.acceptIsEnabled()).toBe(false);
    view.didSelectPublishDirectory({ value: directories[1] });
    expect(view.localPath.getText()).toBe(directories[1]);
    expect(view.repoName.getText()).toBe("remote-name");
    expect(view.acceptIsEnabled()).toBe(true);
  });

  it("keeps the explicit local folder when the remote repository is renamed", () => {
    const directory = path.join(root, "selected");
    const view = dialog({ localDir: directory });
    view.repoName.setText("different-github-name");
    expect(view.localPath.getText()).toBe(directory);
    expect(view.render().props.pathEditable).toBe(false);
  });

  it("makes the local path editable only for a manual folder choice", () => {
    const view = dialog({ pathEditable: true });
    expect(view.render().props.pathEditable).toBe(true);
    view.localPath.setText(path.join(root, "manual"));
    expect(view.repoName.getText()).toBe("manual");
  });
});
