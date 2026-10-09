/** @babel */
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");

describe("GitHub review pane URI working-directory spelling", () => {
  let scratch, scratchParent, coreRepository, pack;

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
      Promise.reject(new Error("Unexpected network request")),
    );
    await lumine.packages.activatePackage("patch-view");
    await lumine.packages.activatePackage("github-panel");
    pack = lumine.packages.getActivePackage("github-panel");
    await pack.mainModule.ensureRootController();
    scratchParent = await fs.realpath(os.tmpdir());
    scratch = await fs.realpath(await fs.mkdtemp(path.join(scratchParent, "github-percent-pane-")));
  });

  afterEach(async () => {
    await lumine.packages.deactivatePackage("github-panel");
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
    scratch = coreRepository = pack = null;
  });

  async function openReviews(directoryName) {
    const workdir = path.join(scratch, directoryName);
    await fs.mkdir(workdir);
    coreRepository = await lumine.repositories.initialize(workdir, { initialBranch: "main" });
    const loaded = require(path.join(pack.path, "lib/items/reviews-item"));
    const ReviewsItem = loaded.default || loaded;
    const uri = ReviewsItem.buildURI({
      host: "github.com",
      owner: "owned",
      repo: "fixture",
      number: 1,
      workdir,
    });
    const item = await lumine.workspace.open(uri, { pending: false });
    expect(typeof item?.getHydrationState).toBe("function");
    if (typeof item?.getHydrationState !== "function") return;
    const view = await item.whenHydrated();
    expect(view?.props.workdir).toBe(workdir);
    expect(item.getURI()).toBe(uri);
    expect(lumine.workspace.paneForItem(item)).not.toBeNull();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  }

  it("opens a repository whose name contains a literal percent character", async () => {
    await openReviews("percent%project");
  });

  it("keeps literal percent-encoded text in the directory name", async () => {
    await openReviews("literal%2Fproject");
  });

  it("keeps ordinary Unicode, spaces and plus signs in a repository path", async () => {
    await openReviews("zażółć + project");
  });
});
