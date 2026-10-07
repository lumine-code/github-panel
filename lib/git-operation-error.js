/** @babel */
export function reportGitOperationError(error, title) {
  if (error.code === "ERR_GIT_OPERATION_CANCELLED") return;
  if (error.outcome === "not-started") {
    lumine.notifications.addWarning(error.message, { dismissable: true });
  } else {
    lumine.notifications.addError(title, {
      detail: error.stderr || error.message,
      dismissable: true,
    });
  }
}
