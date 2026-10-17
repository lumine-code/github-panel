/** @babel */
const path = require("node:path");
const { Disposable } = require("lumine");
const requireCurrent = require("node:module").createRequire(__filename);

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

  it("opens its startup panel after restoring a layout without one", async () => {
    let loaded;
    lumine.window.whenLoaded.and.returnValue(new Promise((resolve) => (loaded = resolve)));
    lumine.config.set("github-panel.openGitHubTabOnStart", true);
    const open = spyOn(lumine.workspace, "open").and.callThrough();
    const saved = JSON.parse(JSON.stringify(lumine.workspace.serialize()));
    lumine.workspace.beginInitialDockRestore(saved);

    await lumine.packages.startPackage(PACKAGE_PATH);
    expect(open).not.toHaveBeenCalled();
    expect(lumine.workspace.paneForURI(GITHUB_URI)).toBeUndefined();
    lumine.workspace.deserialize(saved, lumine.deserializers);
    lumine.workspace.endInitialDockRestore();
    loaded();
    await globalThis.conditionPromise(() => lumine.workspace.paneForURI(GITHUB_URI));

    const item = lumine.workspace.paneForURI(GITHUB_URI).itemForURI(GITHUB_URI);
    expect(item.isHydrated()).toBe(true);
    expect(item.isDestroyed()).toBe(false);
    expect(open).toHaveBeenCalledTimes(1);
    expect(item.serialize()).toEqual({ deserializer: "GithubDockItem", uri: GITHUB_URI });
  });

  it("leaves a restored hidden startup panel and its selected sibling unchanged", async () => {
    let loaded;
    lumine.window.whenLoaded.and.returnValue(new Promise((resolve) => (loaded = resolve)));
    lumine.config.set("github-panel.openGitHubTabOnStart", true);
    const open = spyOn(lumine.workspace, "open").and.callThrough();
    const saved = JSON.parse(JSON.stringify(lumine.workspace.serialize()));
    const reviewURI = "lumine-github://reviews/github.com/owner/repo/1?workdir=";
    const left = saved.paneContainers.left;
    left.visible = false;
    left.size = 387;
    left.paneContainer.root = {
      deserializer: "Pane",
      items: [
        { deserializer: "GithubDockItem", uri: GITHUB_URI },
        { deserializer: "ReviewsStub", uri: reviewURI },
      ],
      activeItemIndex: 1,
    };
    lumine.workspace.beginInitialDockRestore(saved);

    await lumine.packages.startPackage(PACKAGE_PATH);
    lumine.workspace.deserialize(saved, lumine.deserializers);
    lumine.workspace.endInitialDockRestore();
    const pane = lumine.workspace.paneForURI(GITHUB_URI);
    const item = pane.itemForURI(GITHUB_URI);
    loaded();
    await globalThis.flushMicrotasks();

    expect(open).not.toHaveBeenCalled();
    expect(pane.itemForURI(GITHUB_URI)).toBe(item);
    expect(item.isDestroyed()).toBe(false);
    expect(pane.getActiveItem().getURI()).toBe(reviewURI);
    expect(pane.getContainer().getLocation()).toBe("left");
    expect(lumine.workspace.getLeftDock().isVisible()).toBe(false);
    expect(lumine.workspace.getLeftDock().serialize().size).toBe(387);
  });

  it("cancels automatic opening when its activation ends before the window loads", async () => {
    let loaded;
    lumine.window.whenLoaded.and.returnValue(new Promise((resolve) => (loaded = resolve)));
    lumine.config.set("github-panel.openGitHubTabOnStart", true);
    const open = spyOn(lumine.workspace, "open").and.callThrough();
    await lumine.packages.startPackage(PACKAGE_PATH);
    await lumine.packages.deactivatePackage(PACKAGE_NAME);
    loaded();
    await globalThis.flushMicrotasks();

    expect(open).not.toHaveBeenCalled();
    expect(lumine.workspace.paneForURI(GITHUB_URI)).toBeUndefined();
  });

  it("keeps restored panels alive while the initial repository becomes available", async () => {
    const context = { workingDirectory: null };
    spyOn(lumine.repositories, "getActiveRepositoryContext").and.callFake(() => context);
    let repositoryReady;
    spyOn(lumine.repositories, "add").and.returnValue(
      new Promise((resolve) => (repositoryReady = resolve)),
    );
    const pack = await lumine.packages.startPackage(PACKAGE_PATH);
    const { flushViews } = requireCurrent("./helpers/etch");
    const states = [
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
    ];
    const restored = [];
    for (const state of states) {
      const item = lumine.deserializers.deserialize(state);
      const location = state.deserializer === "IssueishDetailItem" ? "center" : "left";
      await lumine.workspace.open(item, { location, activatePane: false, activateItem: false });
      restored.push({ item, location, state });
    }
    await flushViews(() => {});
    const main = pack.mainModule;
    for (const entry of restored) entry.view = entry.item.getHydratedView();
    expect(main.controller.repositoryObservation.isReady).toBe(true);

    context.workingDirectory = PACKAGE_PATH;
    await flushViews(() => main.rerender());

    expect(main.controller.repositoryObservation.isReady).toBe(false);
    for (const { item, location, view } of restored) {
      expect(item.isDestroyed()).toBe(false);
      expect(lumine.workspace.paneForItem(item)?.getContainer().getLocation()).toBe(location);
      expect(item.getHydratedView()).toBe(view);
    }
    expect(restored[0].item.getElement().querySelector(".github-panel-Loader")).not.toBeNull();

    await flushViews(() => repositoryReady(null));

    expect(main.controller.repositoryObservation.isReady).toBe(true);
    for (const { item, state, view } of restored) {
      expect(item.isDestroyed()).toBe(false);
      expect(lumine.workspace.paneForURI(state.uri).itemForURI(state.uri)).toBe(item);
      expect(item.getHydratedView()).toBe(view);
      expect(item.serialize()).toEqual(state);
    }
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
