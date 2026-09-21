/** @babel */
import { setGitBridge, getGitBridge } from "../lib/git-bridge";
import GithubPackage from "../lib/github-package";

describe("github-panel git bridge consumption", () => {
  afterEach(() => setGitBridge(null));

  it("holds and returns the consumed git bridge", () => {
    expect(getGitBridge()).toBe(null);
    const bridge = { marker: true };
    setGitBridge(bridge);
    expect(getGitBridge()).toBe(bridge);
    setGitBridge(null);
    expect(getGitBridge()).toBe(null);
  });

  it("registers cold global commands without waiting for the React root", async () => {
    let commands;
    const packageInstance = {
      commands: {
        add: jasmine.createSpy("add").and.callFake((_selector, entries) => {
          commands = entries;
          return { dispose() {} };
        }),
      },
      subscriptions: { add: jasmine.createSpy("add") },
      githubTabTracker: {
        toggle: jasmine.createSpy("toggle"),
        toggleFocus: jasmine.createSpy("toggleFocus"),
      },
      ensureRootController: jasmine
        .createSpy("ensureRootController")
        .and.returnValue(Promise.resolve()),
      invokeRootController: jasmine
        .createSpy("invokeRootController")
        .and.returnValue(Promise.resolve()),
    };

    GithubPackage.prototype.registerGlobalCommands.call(packageInstance);
    await commands["github-panel:toggle-focus"]();
    await commands["github-panel:create-repository"].didDispatch();

    expect(packageInstance.githubTabTracker.toggleFocus).toHaveBeenCalled();
    expect(commands["github-panel:create-repository"].description).toBe(
      "Create a repository on GitHub from a local folder.",
    );
    expect(packageInstance.invokeRootController).toHaveBeenCalledWith("openCreateDialog");
  });

  it("loads every rewired module without reaching into git-panel internals", () => {
    // These modules previously used requireFromGitPanel/getGitPanel; importing
    // them verifies their new sources (the bridge holder, `lumine`'s GitError, the
    // local patch-preview view) all resolve.
    const modules = [
      "../lib/git-bridge",
      "../lib/github-package",
      "../lib/views/patch-preview-view",
      "../lib/controllers/github-tab-header-controller",
      "../lib/controllers/pr-checkout-controller",
      "../lib/containers/pr-patch-container",
      "../lib/containers/pr-changed-files-container",
      "../lib/items/reviews-item",
      "../lib/items/issueish-detail-item",
    ];
    for (const modulePath of modules) {
      expect(() => require(modulePath)).not.toThrow();
    }
  });
});
