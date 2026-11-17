/** @babel */
import { reportGitOperationError } from "../lib/git-operation-error.js";

describe("Git operation error notifications", () => {
  beforeEach(() => {
    spyOn(lumine.notifications, "addWarning");
    spyOn(lumine.notifications, "addError");
  });

  it("keeps the operation context when a command could not start", () => {
    const detail = String.raw`Cannot run Git in C:\data\[project]\_worktree_`;
    reportGitOperationError({ outcome: "not-started", message: detail }, "Unable to pull");
    expect(lumine.notifications.addWarning).toHaveBeenCalledOnceWith("Unable to pull", {
      detail,
      dismissable: true,
    });
    expect(lumine.notifications.addError).not.toHaveBeenCalled();
  });

  it("preserves process diagnostics for a failed operation", () => {
    reportGitOperationError(
      { message: "exit 1", stderr: "<b>literal stderr</b>" },
      "Unable to push",
    );
    expect(lumine.notifications.addError).toHaveBeenCalledOnceWith("Unable to push", {
      detail: "<b>literal stderr</b>",
      dismissable: true,
    });
  });

  it("keeps a user cancellation silent", () => {
    reportGitOperationError({ code: "ERR_GIT_OPERATION_CANCELLED" }, "Unable to pull");
    expect(lumine.notifications.addWarning).not.toHaveBeenCalled();
    expect(lumine.notifications.addError).not.toHaveBeenCalled();
  });
});
