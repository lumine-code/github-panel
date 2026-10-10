/** @babel */
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");

describe("GitHub commit navigation into the Git panel", () => {
  let scratch, scratchParent, coreRepository, view;

  beforeEach(async () => {
    for (const method of ["openExternal", "openPath", "showItemInFolder", "openApplication"])
      spyOn(lumine.shell, method).and.returnValue(Promise.resolve());
    spyOn(lumine.application, "openWindow").and.returnValue(Promise.resolve());
    spyOn(lumine.secrets, "get").and.returnValue(Promise.resolve(null));
    spyOn(lumine.secrets, "set").and.callFake(() => {
      throw new Error("Unexpected credential write");
    });
    spyOn(lumine.secrets, "delete").and.callFake(() => {
      throw new Error("Unexpected credential removal");
    });
    spyOn(globalThis, "fetch").and.callFake(() =>
      Promise.reject(new Error("Unexpected HTTP request")),
    );
    await lumine.packages.activatePackage("git-panel");
    await lumine.packages.activatePackage("git-panel");
    const gitPack = lumine.packages.getActivePackage("git-panel");
    const authorModule = require(path.join(gitPack.path, "lib/models/author"));
    const Author = authorModule.default || authorModule;
    spyOn(Author.prototype, "getAvatarUrl").and.returnValue("");
    await gitPack.mainModule.ensureRootController();
    await lumine.packages.activatePackage("github-panel");
    scratchParent = await fs.realpath(os.tmpdir());
    scratch = await fs.realpath(await fs.mkdtemp(path.join(scratchParent, "github-commit-route-")));
    const hooksDirectory = path.join(scratch, "empty-hooks");
    await fs.mkdir(hooksDirectory);
    coreRepository = await lumine.repositories.initialize(scratch, { initialBranch: "main" });
    const operations = coreRepository.getOperations();
    await operations.setConfig("core.hooksPath", hooksDirectory);
    await operations.setConfig("commit.gpgSign", "false");
    await operations.setConfig("core.autocrlf", "false");
    await operations.setConfig("user.name", "Owned Fixture");
    await operations.setConfig("user.email", "owned@example.invalid");
    await fs.writeFile(path.join(scratch, "payload.txt"), "owned commit\n");
    await operations.stageFiles(["payload.txt"]);
    await operations.commit("Create owned commit navigation source");
    const githubPack = lumine.packages.getActivePackage("github-panel");
    const module = require(
      path.join(githubPack.path, "lib/controllers/issueish-detail-controller"),
    );
    view = new module.BareIssueishDetailController({
      repository: null,
      workdirPath: scratch,
      workspace: lumine.workspace,
    });
  });

  afterEach(async () => {
    await view?.destroy();
    await lumine.packages.deactivatePackage("github-panel");
    await lumine.packages.deactivatePackage("git-panel");
    if (coreRepository) lumine.repositories.forget(coreRepository);
    if (scratch) {
      const resolved = await fs.realpath(scratch);
      const relative = path.relative(scratchParent, resolved);
      if (
        !relative ||
        relative === ".." ||
        relative.startsWith(`..${path.sep}`) ||
        path.isAbsolute(relative)
      )
        throw new Error("Fixture cleanup escaped its owned temporary root.");
      await fs.rm(resolved, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
    scratch = coreRepository = view = null;
  });

  it("opens the selected local commit in the registered commit-detail pane", async () => {
    const status = await coreRepository.refreshStatusSnapshot();
    const sha = status.head.oid;
    const gitPack = lumine.packages.getActivePackage("git-panel");
    const itemModule = require(path.join(gitPack.path, "lib/items/commit-detail-item"));
    const CommitDetailItem = itemModule.default || itemModule;
    const expectedURI = CommitDetailItem.buildURI(scratch, sha);
    await view.openCommit({ sha });
    const item = lumine.workspace
      .getPaneItems()
      .find((candidate) => candidate.getURI?.() === expectedURI);
    expect(typeof item?.whenHydrated).toBe("function");
    if (typeof item?.whenHydrated !== "function") return;
    const detail = await item.whenHydrated();
    expect(detail.getWorkingDirectory()).toBe(scratch);
    expect(detail.getSha()).toBe(sha);
    expect(lumine.workspace.paneForItem(item)).not.toBeNull();
  });
});
