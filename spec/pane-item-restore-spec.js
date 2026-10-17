/** @babel */
const path = require("node:path");
const { Disposable } = require("lumine");

const PACKAGE_NAME = "github-panel";
const PACKAGE_PATH = path.join(__dirname, "..");
const GITHUB_URI = "lumine-github://dock-item/github";

describe("GitHub pane item restoration", () => {
  beforeEach(async () => {
    jasmine.attachToDOM(lumine.views.getView(lumine.workspace));
    if (lumine.packages.isPackageLoaded(PACKAGE_NAME))
      await lumine.packages.unloadPackage(PACKAGE_NAME);
    lumine.config.set("github-panel.openGitHubTabOnStart", false);
    spyOn(lumine.secrets, "get").and.resolveTo(null);
    spyOn(lumine.secrets, "onDidChange").and.callFake(() => new Disposable());
    spyOn(lumine.window, "whenLoaded").and.returnValue(new Promise(() => {}));
  });

  afterEach(async () => {
    if (lumine.packages.isPackageLoaded(PACKAGE_NAME))
      await lumine.packages.unloadPackage(PACKAGE_NAME);
  });

  it("restores the GitHub panel before initial activation and hydrates the same item", async () => {
    spyOn(lumine.packages, "hasActivatedInitialPackages").and.returnValue(false);
    lumine.packages.loadPackage(PACKAGE_PATH);
    const initial = lumine.deserializers.deserialize({
      deserializer: "GithubDockItem",
      uri: GITHUB_URI,
    });
    const state = JSON.parse(JSON.stringify(initial.serialize()));
    initial.destroy();
    const item = lumine.deserializers.deserialize(state);
    expect(item.serialize()).toEqual(state);
    expect(item.getHydrationState()).toBe("pending");
    await lumine.workspace.open(item, { location: "left", activatePane: false });

    await lumine.packages.startPackage(PACKAGE_NAME);
    await globalThis.conditionPromise(() => item.isHydrated());

    expect(lumine.workspace.paneForURI(GITHUB_URI).itemForURI(GITHUB_URI)).toBe(item);
    expect(lumine.workspace.paneForItem(item).getContainer().getLocation()).toBe("left");
    expect(item.serialize()).toEqual(state);
    const controller = lumine.packages.getLoadedPackage(PACKAGE_NAME).mainModule.controller;
    expect(controller).toBeDefined();
    expect(item.getHydratedView()).not.toBeNull();
  });

  for (const state of [
    { deserializer: "GithubDockItem", uri: GITHUB_URI },
    {
      deserializer: "IssueishDetailItem",
      uri: "lumine-github://issueish/github.com/owner/repo/1?workdir=",
      selectedTab: 3,
    },
    {
      deserializer: "ReviewsStub",
      uri: "lumine-github://reviews/github.com/owner/repo/1?workdir=",
    },
  ]) {
    it(`restores ${state.deserializer} after bootstrap and survives another workspace round trip`, async () => {
      await lumine.packages.startPackage(PACKAGE_PATH);
      const serialized = JSON.parse(JSON.stringify(lumine.workspace.serialize()));
      const location = state.deserializer === "IssueishDetailItem" ? "center" : "left";
      const dock = serialized.paneContainers[location];
      const container = location === "center" ? (dock.main ?? dock) : dock.paneContainer;
      container.root = { deserializer: "Pane", items: [state], activeItemIndex: 0 };
      if (location !== "center") Object.assign(dock, { visible: true, size: 387 });
      lumine.workspace.deserialize(serialized, lumine.deserializers);
      const item = lumine.workspace.paneForURI(state.uri).itemForURI(state.uri);
      await globalThis.conditionPromise(() => item.isHydrated());
      expect(item.serialize()).toEqual(state);
      expect(lumine.workspace.paneForItem(item).getContainer().getLocation()).toBe(location);

      const hydratedState = JSON.parse(JSON.stringify(lumine.workspace.serialize()));
      await lumine.packages.unloadPackage(PACKAGE_NAME);
      if (state.deserializer === "GithubDockItem")
        lumine.config.set("github-panel.openGitHubTabOnStart", true);
      await lumine.packages.startPackage(PACKAGE_PATH);
      if (state.deserializer === "GithubDockItem")
        await globalThis.conditionPromise(() => lumine.workspace.paneForURI(GITHUB_URI));
      lumine.workspace.deserialize(hydratedState, lumine.deserializers);
      const restored = lumine.workspace.paneForURI(state.uri).itemForURI(state.uri);
      await globalThis.conditionPromise(() => restored.isHydrated());

      expect(restored).not.toBe(item);
      expect(restored.serialize()).toEqual(state);
      expect(lumine.workspace.paneForItem(restored).getContainer().getLocation()).toBe(location);
      expect(
        lumine.workspace.getPaneItems().filter((item) => item.getURI?.() === state.uri),
      ).toEqual([restored]);
      if (state.selectedTab != null)
        expect(restored.getHydratedView().state.selectedTab).toBe(state.selectedTab);
    });
  }

  it("restores the selected pull request tab through its registered deserializer", async () => {
    spyOn(lumine.packages, "hasActivatedInitialPackages").and.returnValue(false);
    lumine.packages.loadPackage(PACKAGE_PATH);
    const state = {
      deserializer: "IssueishDetailItem",
      uri: "lumine-github://issueish/github.com/owner/repo/1?workdir=",
      selectedTab: 3,
    };
    const item = lumine.deserializers.deserialize(state);
    expect(item.getHydrationProps().initSelectedTab).toBe(3);
    expect(item.serialize()).toEqual(state);
    item.destroy();
  });

  it("keeps a closed panel lazy and ignores the previous activation's window load", async () => {
    let loaded;
    lumine.window.whenLoaded.and.returnValues(
      new Promise((resolve) => (loaded = resolve)),
      new Promise(() => {}),
    );
    const schedule = spyOn(globalThis, "requestIdleCallback").and.returnValue(1);
    const pack = await lumine.packages.startPackage(PACKAGE_PATH);
    const main = pack.mainModule;
    expect(main.startupComplete).toBe(false);
    expect(main.controller).toBeUndefined();

    await lumine.packages.deactivatePackage(PACKAGE_NAME);
    await lumine.packages.startPackage(PACKAGE_NAME);
    const reactivated = lumine.packages.getLoadedPackage(PACKAGE_NAME).mainModule;
    loaded();
    await Promise.resolve();

    expect(schedule).not.toHaveBeenCalled();
    expect(reactivated.startupComplete).toBe(false);
    expect(reactivated.controller).toBeNull();
  });
});
