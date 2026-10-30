/** @babel */
import GithubPackage from "../lib/github-package.js";
import path from "node:path";
import os from "node:os";
import GitHubBlankNoLocal from "../lib/views/github-blank-nolocal.js";
import GitHubBlankUninitialized from "../lib/views/github-blank-uninitialized.js";
import { flushViews } from "./helpers/etch.js";

describe("GitHub optional repository setup services", () => {
  it("routes local setup through its service and preserves a replacement provider", async () => {
    const owner = {
      openGitPanel: jasmine.createSpy("Git panel"),
      notificationManager: { addWarning: jasmine.createSpy("warning") },
      rerender: jasmine.createSpy("rerender"),
    };
    const first = { openCloneDialog: jasmine.createSpy("first").and.resolveTo("first") };
    const replacement = { openCloneDialog: jasmine.createSpy("replacement").and.resolveTo("next") };
    const retired = GithubPackage.prototype.consumeRepositorySetup.call(owner, first);
    const active = GithubPackage.prototype.consumeRepositorySetup.call(owner, replacement);
    retired.dispose();
    expect(owner.rerender).toHaveBeenCalledTimes(2);
    const options = { destinationPath: "/chosen" };
    expect(
      await GithubPackage.prototype.openRepositorySetup.call(owner, "openCloneDialog", options),
    ).toBe("next");
    expect(replacement.openCloneDialog).toHaveBeenCalledOnceWith(options);
    expect(owner.openGitPanel).not.toHaveBeenCalled();
    active.dispose();
    expect(owner.rerender).toHaveBeenCalledTimes(3);
    expect(
      await GithubPackage.prototype.openRepositorySetup.call(owner, "openCloneDialog"),
    ).toBeNull();
    expect(owner.notificationManager.addWarning).not.toHaveBeenCalled();
    const returned = GithubPackage.prototype.consumeRepositorySetup.call(owner, first);
    expect(owner.repositorySetup).toBe(first);
    expect(owner.rerender).toHaveBeenCalledTimes(4);
    returned.dispose();
  });

  it("disables generic clone and initialize while their provider is absent and restores them", async () => {
    const cloneView = new GitHubBlankNoLocal({ repositorySetupAvailable: false });
    const initializeView = new GitHubBlankUninitialized({ repositorySetupAvailable: false });
    try {
      expect(cloneView.element.querySelector(".icon-repo-clone").disabled).toBe(true);
      expect(cloneView.element.querySelector(".icon-repo-create").disabled).toBe(false);
      expect(initializeView.element.querySelector(".github-panel-Blank-tabLink").disabled).toBe(
        true,
      );
      await flushViews(async () => {
        cloneView.update({ repositorySetupAvailable: true });
        initializeView.update({ repositorySetupAvailable: true });
      });
      expect(cloneView.element.querySelector(".icon-repo-clone").disabled).toBe(false);
      expect(initializeView.element.querySelector(".github-panel-Blank-tabLink").disabled).toBe(
        false,
      );
    } finally {
      await cloneView.destroy();
      await initializeView.destroy();
    }
  });

  it("drops exactly the retiring tree selection edge", () => {
    const owner = {};
    const previous = GithubPackage.prototype.consumeTreeViewSelection.call(owner, { id: "old" });
    const selection = { id: "current" };
    const current = GithubPackage.prototype.consumeTreeViewSelection.call(owner, selection);
    previous.dispose();
    expect(owner.treeSelection).toBe(selection);
    current.dispose();
    expect(owner.treeSelection).toBeNull();
  });

  it("opens publication for its captured directory without following the pinned repository", async () => {
    const directory = path.join(os.tmpdir(), "github-context-directory");
    const resolve = spyOn(lumine.repositories, "resolveForPath").and.resolveTo(null);
    const active = spyOn(lumine.repositories, "getActiveRepositoryContext").and.throwError(
      "Publication must not use the pinned context",
    );
    const owner = {
      activated: true,
      activationGeneration: 1,
      invokeRootController: jasmine.createSpy("dialog").and.resolveTo(),
      notificationManager: { addError: jasmine.createSpy("error") },
    };
    await GithubPackage.prototype.openPublishFromContext.call(owner, {
      entries: [{ path: directory, kind: "directory" }],
    });
    expect(resolve).toHaveBeenCalledOnceWith(directory, { refresh: false });
    expect(owner.invokeRootController).toHaveBeenCalledOnceWith("openPublishDialog", {
      localDir: directory,
      directories: [directory],
      pathEditable: false,
    });
    expect(active).not.toHaveBeenCalled();
  });

  it("does not reopen a publication dialog after the package is deactivated during discovery", async () => {
    let finish;
    spyOn(lumine.repositories, "resolveForPath").and.returnValue(
      new Promise((resolve) => (finish = resolve)),
    );
    const owner = {
      activated: true,
      activationGeneration: 1,
      invokeRootController: jasmine.createSpy("dialog"),
      notificationManager: { addError: jasmine.createSpy("error") },
    };
    const pending = GithubPackage.prototype.openPublishFromContext.call(owner, {
      entries: [{ path: path.join(os.tmpdir(), "late-discovery"), kind: "directory" }],
    });
    await globalThis.flushMicrotasks();
    owner.activated = false;
    finish(null);
    expect(await pending).toBeNull();
    expect(owner.invokeRootController).not.toHaveBeenCalled();
  });
});
