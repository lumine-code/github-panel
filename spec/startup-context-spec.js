/** @babel */
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const { Disposable } = require("lumine");
const exec = promisify(execFile);
const PACKAGE_PATH = path.join(__dirname, "..");

function deferred() {
  let resolve;
  const promise = new Promise((finish) => (resolve = finish));
  return { promise, resolve };
}

describe("GitHub initial repository context", () => {
  let loaded, scratch, editor;

  beforeEach(async () => {
    jasmine.attachToDOM(lumine.views.getView(lumine.workspace));
    if (lumine.packages.isPackageLoaded("github-panel"))
      await lumine.packages.unloadPackage("github-panel");
    lumine.config.set("github-panel.openGitHubTabOnStart", false);
    spyOn(lumine.secrets, "get").and.resolveTo(null);
    spyOn(lumine.secrets, "onDidChange").and.callFake(() => new Disposable());
    loaded = deferred();
    spyOn(lumine.window, "whenLoaded").and.returnValue(loaded.promise);
  });

  afterEach(async () => {
    if (lumine.packages.isPackageLoaded("github-panel"))
      await lumine.packages.unloadPackage("github-panel");
    editor?.destroy();
    editor = null;
    if (scratch) {
      lumine.project.setPaths([]);
      const relative = path.relative(await fs.realpath(os.tmpdir()), scratch);
      if (!relative || relative.startsWith("..") || path.isAbsolute(relative))
        throw new Error("Unsafe startup-context fixture cleanup");
      await fs.rm(scratch, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
      scratch = null;
    }
  });

  async function runtime() {
    const pack = await lumine.packages.startPackage(PACKAGE_PATH);
    const main = pack.mainModule;
    expect(main.startupContextPending).toBe(true);
    return main;
  }

  it("settles an empty window after restoration without starting discovery", async () => {
    spyOn(lumine.project, "getPaths").and.returnValue([]);
    spyOn(lumine.repositories, "getActiveRepositoryContext").and.returnValue({
      workingDirectory: null,
    });
    spyOn(lumine.workspace.getCenter(), "getActivePaneItem").and.returnValue(null);
    const discover = spyOn(lumine.repositories, "resolveForPath").and.resolveTo(null);
    const main = await runtime();
    expect(discover).not.toHaveBeenCalled();

    loaded.resolve();
    await main.startupContextReadyPromise;

    expect(main.startupContextPending).toBe(false);
    expect(discover).not.toHaveBeenCalled();
  });

  it("waits for project roots and the restored active file before automatically opening", async () => {
    const roots = [path.join(PACKAGE_PATH, "first"), path.join(PACKAGE_PATH, "second")];
    const activeFile = path.join(PACKAGE_PATH, "outside", "example.js");
    spyOn(lumine.project, "getPaths").and.returnValue(roots);
    spyOn(lumine.repositories, "getActiveRepositoryContext").and.returnValue({
      workingDirectory: roots[0],
    });
    spyOn(lumine.workspace.getCenter(), "getActivePaneItem").and.returnValue({
      getPath: () => activeFile,
    });
    spyOn(lumine.repositories, "add").and.resolveTo(null);
    const gates = new Map([...roots, activeFile].map((p) => [p, deferred()]));
    const discover = spyOn(lumine.repositories, "resolveForPath").and.callFake(
      (p) => gates.get(p).promise,
    );
    const open = spyOn(lumine.workspace, "open").and.callThrough();
    lumine.config.set("github-panel.openGitHubTabOnStart", true);
    const main = await runtime();
    loaded.resolve();
    await globalThis.flushMicrotasks();

    expect(discover.calls.allArgs()).toEqual(
      [...roots, activeFile].map((p) => [p, { refresh: false }]),
    );
    for (const root of roots) gates.get(root).resolve(null);
    await globalThis.flushMicrotasks();
    expect(main.startupContextPending).toBe(true);
    expect(open).not.toHaveBeenCalled();

    gates.get(activeFile).resolve(null);
    await main.startupContextReadyPromise;
    await globalThis.conditionPromise(() => open.calls.count() === 1);

    expect(main.startupContextPending).toBe(false);
    await globalThis.conditionPromise(() => main.controller.props.startupContextPending === false);
  });

  it("includes a newer active directory selected while discovery is pending", async () => {
    const first = path.join(PACKAGE_PATH, "first");
    const next = path.join(PACKAGE_PATH, "next");
    const context = { workingDirectory: first };
    spyOn(lumine.project, "getPaths").and.returnValue([]);
    spyOn(lumine.repositories, "getActiveRepositoryContext").and.callFake(() => context);
    spyOn(lumine.workspace.getCenter(), "getActivePaneItem").and.returnValue(null);
    const gates = new Map([first, next].map((p) => [p, deferred()]));
    const discover = spyOn(lumine.repositories, "resolveForPath").and.callFake(
      (p) => gates.get(p).promise,
    );
    const main = await runtime();
    loaded.resolve();
    await globalThis.flushMicrotasks();
    context.workingDirectory = next;
    gates.get(first).resolve(null);
    await globalThis.flushMicrotasks();

    expect(discover).toHaveBeenCalledWith(next, { refresh: false });
    expect(main.startupContextPending).toBe(true);
    gates.get(next).resolve(null);
    await main.startupContextReadyPromise;
    expect(main.startupContextPending).toBe(false);
  });

  it("does not release a new activation when an earlier discovery completes", async () => {
    const oldDiscovery = deferred();
    const newDiscovery = deferred();
    const nextLoaded = deferred();
    lumine.window.whenLoaded.and.returnValues(loaded.promise, nextLoaded.promise);
    spyOn(lumine.project, "getPaths").and.returnValue([PACKAGE_PATH]);
    spyOn(lumine.repositories, "getActiveRepositoryContext").and.returnValue({
      workingDirectory: null,
    });
    spyOn(lumine.workspace.getCenter(), "getActivePaneItem").and.returnValue(null);
    spyOn(lumine.repositories, "resolveForPath").and.returnValues(
      oldDiscovery.promise,
      newDiscovery.promise,
    );
    const main = await runtime();
    const oldReady = main.startupContextReadyPromise;
    loaded.resolve();
    await globalThis.flushMicrotasks();
    await lumine.packages.deactivatePackage("github-panel");
    await lumine.packages.startPackage("github-panel");
    const reactivated = lumine.packages.getLoadedPackage("github-panel").mainModule;
    oldDiscovery.resolve(null);
    await oldReady;
    expect(reactivated.startupContextPending).toBe(true);

    nextLoaded.resolve();
    await globalThis.flushMicrotasks();
    expect(reactivated.startupContextPending).toBe(true);
    newDiscovery.resolve(null);
    await reactivated.startupContextReadyPromise;
    expect(reactivated.startupContextPending).toBe(false);
  });

  it("lets core adopt the initial project repository before releasing its startup gate", async () => {
    jasmine.useRealClock();
    scratch = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "github-startup-")));
    await exec("git", ["init", scratch]);
    lumine.project.setPaths([scratch]);
    const filePath = path.join(scratch, "example.js");
    await fs.writeFile(filePath, "const startup = true;\n");
    editor = await lumine.workspace.open(filePath);
    const discover = spyOn(lumine.repositories, "resolveForPath").and.callThrough();
    const select = spyOn(lumine.repositories, "setActiveRepositoryForPath").and.callThrough();
    const main = await runtime();
    loaded.resolve();
    await main.startupContextReadyPromise;

    expect(discover).toHaveBeenCalledWith(scratch, { refresh: false });
    expect(
      path.normalize(
        lumine.repositories.getActiveRepositoryContext().repository.getWorkingDirectory(),
      ),
    ).toBe(path.normalize(scratch));
    expect(main.startupContextPending).toBe(false);
    expect(select).not.toHaveBeenCalled();
  });
});
