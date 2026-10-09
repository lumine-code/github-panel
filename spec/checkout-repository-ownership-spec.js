/** @babel */
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { pathToFileURL } = require("node:url");

describe("accepted pull-request checkout repository ownership", () => {
  let scratch, scratchParent, coreRepositories, locals, view, Controller, release;

  beforeEach(async () => {
    for (const method of ["openExternal", "openPath", "showItemInFolder", "openApplication"])
      spyOn(lumine.shell, method).and.returnValue(Promise.resolve());
    spyOn(lumine.application, "openWindow").and.returnValue(Promise.resolve());
    spyOn(lumine.secrets, "get").and.returnValue(Promise.resolve(null));
    spyOn(globalThis, "fetch").and.callFake(() =>
      Promise.reject(new Error("Unexpected HTTP request")),
    );
    await lumine.packages.activatePackage("github-panel");
    const pack = lumine.packages.getActivePackage("github-panel");
    const controllerModule = require(
      path.join(pack.path, "lib/controllers/pr-checkout-controller"),
    );
    Controller = controllerModule.BarePullRequestCheckoutController;
    const localModule = require(path.join(pack.path, "lib/local-repository"));
    const LocalRepository = localModule.default || localModule;
    scratchParent = await fs.realpath(os.tmpdir());
    scratch = await fs.realpath(
      await fs.mkdtemp(path.join(scratchParent, "github-owned-checkout-")),
    );
    const hooksDirectory = path.join(scratch, "empty-hooks");
    await fs.mkdir(hooksDirectory);
    coreRepositories = [];
    locals = [];
    for (const name of ["source.git", "original", "replacement"]) {
      const directory = path.join(scratch, name);
      await fs.mkdir(directory);
      const core = await lumine.repositories.initialize(directory, { initialBranch: "main" });
      await core.getOperations().setConfig("core.autocrlf", "false");
      await core.getOperations().setConfig("core.hooksPath", hooksDirectory);
      await core.getOperations().setConfig("commit.gpgSign", "false");
      coreRepositories.push(core);
      locals.push(new LocalRepository(directory, core));
    }
    const source = coreRepositories[0];
    await source.getOperations().setConfig("user.name", "Owned Fixture");
    await source.getOperations().setConfig("user.email", "owned@example.invalid");
    await fs.writeFile(path.join(source.getWorkingDirectory(), "payload.txt"), "owned source\n");
    await source.getOperations().stageFiles(["payload.txt"]);
    await source.getOperations().commit("Create owned checkout source");
    const sourceURL = pathToFileURL(source.getWorkingDirectory()).href;
    await locals[2].addRemote("owned", sourceURL);
    view = new Controller(await propsFor(locals[1], sourceURL));
  });

  afterEach(async () => {
    release?.();
    await view?.destroy();
    for (const local of locals || []) local.destroy();
    for (const core of coreRepositories || []) lumine.repositories.forget(core);
    await lumine.packages.deactivatePackage("github-panel");
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
    scratch = view = release = null;
  });

  async function propsFor(localRepository, sourceURL) {
    return {
      repository: { id: "owned-repository", name: "fixture", owner: { login: "owned" } },
      pullRequest: {
        number: 1,
        headRefName: "main",
        headRepository: { name: "fixture", owner: { login: "owned" }, url: sourceURL.slice(0, -4) },
      },
      localRepository,
      branches: await localRepository.getBranches(),
      remotes: await localRepository.getRemotes(),
      isAbsent: false,
      isLoading: false,
      isPresent: true,
      isMerging: false,
      isRebasing: false,
      children: () => null,
    };
  }

  async function checkout(changeView) {
    let entered;
    const waiting = new Promise((resolve) => {
      entered = resolve;
    });
    const held = new Promise((resolve) => {
      release = resolve;
    });
    const original = locals[1].addRemote.bind(locals[1]);
    spyOn(locals[1], "addRemote").and.callFake(async (...args) => {
      const remote = await original(...args);
      entered();
      await held;
      return remote;
    });
    const operation = view.nextCheckoutOp().run();
    await waiting;
    if (changeView) await changeView();
    release();
    await operation;
    const originalStatus = await coreRepositories[1].refreshStatusSnapshot();
    const replacementStatus = await coreRepositories[2].refreshStatusSnapshot();
    expect(originalStatus.head.name).toBe("pr-1/owned/main");
    expect(replacementStatus.head.name).toBe("main");
    expect(replacementStatus.head.unborn).toBe(true);
    expect(await fs.readFile(path.join(scratch, "original/payload.txt"), "utf8")).toBe(
      "owned source\n",
    );
    expect(globalThis.fetch).not.toHaveBeenCalled();
  }

  it("finishes in the original repository when the view selects another repository", async () => {
    const sourceURL = pathToFileURL(coreRepositories[0].getWorkingDirectory()).href;
    await checkout(async () => view.update(await propsFor(locals[2], sourceURL)));
  });

  it("finishes accepted checkout after its frontend is destroyed", async () => {
    await checkout(() => view.destroy());
  });

  it("keeps ordinary accepted checkout behavior", async () => {
    await checkout();
  });
});
