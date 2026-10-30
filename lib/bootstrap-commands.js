const { parseGitRemote } = require("lumine");
const { capturePublishContext, canPublishContext } = require("./publish-context");

module.exports = function registerGlobalCommands(
  commands,
  getPackage,
  getCachedPackage = () => null,
  getTreeSelection = () => getCachedPackage()?.treeSelection,
) {
  return commands.add("lumine-workspace", {
    // The dock opener is registered before these cold handlers run, so the
    // tracker can reveal a host without waiting for the optional git-panel
    // bridge or the lazy view tree. The tree hydrates the host on idle.
    "github-panel:toggle": () => getPackage().githubTabTracker.toggle(),
    "github-panel:toggle-focus": () => getPackage().githubTabTracker.toggleFocus(),
    "github-panel:logout": {
      description: "Forget the GitHub token this window is signed in with.",
      isAvailable: () =>
        getCachedPackage()?.loginModel?.hasCredential?.("https://api.github.com") !== false,
      didDispatch: () => getPackage().invokeRootController("clearGithubToken"),
    },
    "github-panel:show-rate-limit": {
      description: "Report how much of the GitHub API quota is left.",
      didDispatch: () => getPackage().invokeRootController("showRateLimit"),
    },
    "github-panel:open-issue-or-pull-request": {
      description: "Open an issue or pull request by the URL you paste.",
      didDispatch: () => getPackage().invokeRootController("openIssueishDialog"),
    },
    "github-panel:create-repository": {
      description: "Create a repository on GitHub and clone it to a new local folder.",
      isAvailable: () =>
        getCachedPackage()?.loginModel?.hasCredential?.("https://api.github.com") !== false,
      didDispatch: () => getPackage().invokeRootController("openCreateDialog"),
    },
    "github-panel:publish-repository": {
      description: "Publish the selected folder or center document's repository on GitHub.",
      isAvailable: (event) =>
        getCachedPackage()?.loginModel?.hasCredential?.("https://api.github.com") !== false &&
        canPublishContext(
          capturePublishContext(event, getTreeSelection(), lumine.workspace),
          lumine.repositories,
          parseGitRemote,
        ),
      didDispatch: (event) => {
        const context = capturePublishContext(event, getTreeSelection(), lumine.workspace);
        return getPackage().openPublishFromContext(context);
      },
    },
  });
};
