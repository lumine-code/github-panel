/** @babel */
import { createViewModel } from "./helpers/etch.js";
import DialogsController, { dialogRequests } from "../lib/controllers/dialogs-controller.js";
import GitHubRootController from "../lib/controllers/github-root-controller.js";

describe("GitHub dialog request lifetime", () => {
  let dialogs, root;
  afterEach(async () => {
    await dialogs?.destroy();
    await root?.destroy();
  });

  it("prevents cancellation/replacement while opening and keeps a newer forced request intact", async () => {
    let finish;
    root = createViewModel(GitHubRootController, {
      repository: { getWorkingDirectoryPath: () => "" },
      workspace: { open: () => new Promise((resolve) => (finish = resolve)) },
    });
    root.openIssueishDialog();
    const first = root.state.dialogRequest;
    dialogs = createViewModel(DialogsController, { request: first });
    const wrapped = dialogs.getCommonProps().request;
    const pending = wrapped.accept("https://github.com/lumine-code/lumine/issues/1");
    await globalThis.flushMicrotasks();
    expect(first.pending).toBe(true);
    wrapped.cancel();
    root.closeDialog();
    root.openIssueishDialog();
    root.openCreateDialog();
    root.openPublishDialog();
    expect(root.state.dialogRequest).toBe(first);

    const replacement = dialogRequests.create();
    root.updateState({ dialogRequest: replacement });
    dialogs.update({ request: replacement });
    finish({});
    await pending;
    expect(root.state.dialogRequest).toBe(replacement);
    expect(first.pending).toBe(false);
  });

  it("does not let a retired rejection clear another request's busy state or error", async () => {
    let rejectFirst, finishSecond;
    const first = dialogRequests.create();
    first.onProgressingAccept(() => new Promise((_resolve, reject) => (rejectFirst = reject)));
    dialogs = createViewModel(DialogsController, { request: first });
    const pendingFirst = dialogs.getCommonProps().request.accept({});
    const second = dialogRequests.publish();
    second.onProgressingAccept(() => new Promise((resolve) => (finishSecond = resolve)));
    dialogs.update({ request: second });
    const pendingSecond = dialogs.getCommonProps().request.accept({});
    rejectFirst(new Error("Retired request failed"));
    await pendingFirst;
    expect(dialogs.getCommonProps().inProgress).toBe(true);
    expect(dialogs.getCommonProps().error).toBeNull();
    finishSecond();
    await pendingSecond;
    expect(dialogs.getCommonProps().inProgress).toBe(false);
  });
});
