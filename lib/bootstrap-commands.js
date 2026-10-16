module.exports = function registerGlobalCommands(
  commands,
  getPackage,
  getCachedPackage = () => null,
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
      description: "Create a repository on GitHub from a local folder.",
      isAvailable: () =>
        getCachedPackage()?.loginModel?.hasCredential?.("https://api.github.com") !== false,
      didDispatch: () => getPackage().invokeRootController("openCreateDialog"),
    },
  });
};
