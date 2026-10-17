/** @babel */
/** @jsx h */
import { createRequire } from "node:module";
import { CompositeDisposable, Disposable } from "lumine";
import { autobind } from "./helpers.js";
import GithubLoginModel from "./models/github-login-model.js";
import TabTracker from "./controllers/tab-tracker.js";
import { setDiffService } from "./diff-service.js";
import RepositoryPool from "./repository-pool.js";
import dockItemLocation from "./items/dock-item-location.js";
import PaneItemHost from "./items/pane-item-host.js";
import registerGlobalCommands from "./bootstrap-commands.js";

const require = import.meta.require ?? createRequire(import.meta.url);
const { location, allowedLocations } = dockItemLocation;
const GITHUB_TAB_URI = "lumine-github://dock-item/github";
const CENTER_ONLY = Object.freeze(["center"]);
function isGithubPaneItem(item) {
  const uri = item?.getURI?.();
  return (
    uri === GITHUB_TAB_URI ||
    uri?.startsWith("lumine-github://issueish/") ||
    uri?.startsWith("lumine-github://reviews/")
  );
}
function waitForSignal(promise, signal) {
  const source = Promise.resolve(promise);
  if (!signal) return source;
  if (signal.aborted) {
    source.catch(() => {});
    return Promise.reject(signal.reason || new Error("Activation cancelled"));
  }
  return new Promise((resolve, reject) => {
    let settled = false;
    let aborted;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", aborted);
      callback(value);
    };
    aborted = () => finish(reject, signal.reason || new Error("Activation cancelled"));
    signal.addEventListener("abort", aborted, {
      once: true,
    });
    source.then(
      (value) => finish(resolve, value),
      (error) => finish(reject, error),
    );
  });
}
let h;
let mount;
let GitHubRootController;
function ensureRenderer() {
  if (!h) {
    ({ h, mount } = require("./etch/view"));
    const controllerModule = require("./controllers/github-root-controller");
    GitHubRootController = controllerModule.default || controllerModule;
  }
}
export default class GithubPanelPackage {
  constructor({
    workspace,
    project,
    commands,
    notificationManager,
    tooltips,
    grammars,
    keymaps,
    config,
    deserializers,
    confirm,
    loginModel,
    renderFn,
  }) {
    autobind(
      this,
      "createIssueishPaneItemStub",
      "createIssueishPaneItem",
      "createGitHubPaneItem",
      "createDockItemStub",
      "createReviewsPaneItem",
      "createReviewsStub",
      "destroyGithubTabItem",
    );
    this.workspace = workspace;
    this.project = project;
    this.commands = commands;
    this.deserializers = deserializers;
    this.notificationManager = notificationManager;
    this.tooltips = tooltips;
    this.config = config;
    this.grammars = grammars;
    this.keymaps = keymaps;
    this.confirm = confirm;
    this.activated = false;
    this.ownsLoginModel = !loginModel;
    this.loginModel = loginModel || new GithubLoginModel();
    this.activationGeneration = 0;
    this.startupComplete = false;
    this._roots = new WeakMap();
    this.repositoryPool = new RepositoryPool();
    this.gitPanel = null;
    this.controllerReadyReject = null;
    this.renderFn =
      renderFn ||
      ((component, node, callback) => {
        let root = this._roots.get(node);
        if (!root) {
          root = mount(component, node);
          this._roots.set(node, root);
          if (callback) callback();
          return;
        }
        const update = root.update(component);
        if (callback) Promise.resolve(update).then(callback);
      });
    this.subscriptions = new CompositeDisposable();
    this.activationDisposed = false;
  }
  restoreActivationState() {
    this.subscriptions = new CompositeDisposable();
    this.startupComplete = false;
    this.repositoryPool = new RepositoryPool();
    this.controllerReadyPromise = null;
    this.controllerReadyReject = null;
    this.controller = null;
    this.githubTabPaneItem = null;
    this.activationDisposed = false;
    if (this.ownsLoginModel) this.loginModel = new GithubLoginModel();
  }
  registerGlobalCommands() {
    this.subscriptions.add(
      registerGlobalCommands(
        this.commands,
        () => this,
        () => this,
      ),
    );
  }
  registerDockItemOpener() {
    this.subscriptions.add(
      this.workspace.addOpener((uri) => {
        if (uri !== GITHUB_TAB_URI) return undefined;
        return this.createGitHubPaneItem({
          uri,
        });
      }),
    );
  }
  async ensureRootController() {
    if (!this.activated) throw new Error("GitHub panel is inactive");
    if (this.controller) return this.controller;
    if (!this.controllerReadyPromise) {
      const generation = this.activationGeneration;
      this.controllerReadyPromise = new Promise((resolve, reject) => {
        this.controllerReadyReject = reject;
        this.startupComplete = true;
        this.rerender(() => {
          if (!this.activated || generation !== this.activationGeneration)
            return reject(new Error("GitHub panel activation was cancelled"));
          this.controllerReadyReject = null;
          if (this.controller) resolve(this.controller);
          else reject(new Error("GitHub panel root did not mount"));
        });
      }).finally(() => {
        this.controllerReadyPromise = null;
      });
    }
    return this.controllerReadyPromise;
  }
  invokeRootController(method, ...args) {
    return this.ensureRootController().then((controller) => controller[method](...args));
  }
  activate({ signal, entryPointsRegistered = false } = {}) {
    signal?.throwIfAborted();
    const generation = ++this.activationGeneration;
    if (this.activationDisposed) {
      this.restoreActivationState();
    }
    this.startOpenGitHubTab = this.config.get("github-panel.openGitHubTabOnStart");
    this.githubTabTracker = new TabTracker("github", {
      uri: GITHUB_TAB_URI,
      getWorkspace: () => this.workspace,
    });
    if (!entryPointsRegistered) {
      this.registerDockItemOpener();
      this.registerGlobalCommands();
    }
    this.activated = true;

    // The active-repository selection and its pin (lock) live in core. Follow
    // core directly so the lock control reacts to locks toggled elsewhere (the
    // git tab or the API), even when the active repository itself stays the same.
    this.subscriptions.add(lumine.repositories.onDidChangeActiveRepository(() => this.rerender()));

    // Hosts restored before activation already belong to the workspace. Hosts
    // opened afterwards need the same renderer even while the window is still
    // loading; waiting for the idle callback leaves those pane items empty.
    const startRendering = () => {
      if (!this.activated || generation !== this.activationGeneration || this.startupComplete)
        return;
      this.startupComplete = true;
      this.rerender();
    };
    this.subscriptions.add(
      this.workspace.onDidAddPaneItem(({ item }) => {
        if (isGithubPaneItem(item)) startRendering();
      }),
    );

    // The independent git-panel.diff service arrives via consumeDiff; render
    // now in case it is already available, and again when it is consumed.
    if (this.startOpenGitHubTab || this.workspace.getPaneItems().some(isGithubPaneItem)) {
      startRendering();
    } else {
      // The root mounts the GitHub status tile, commands, dialogs, and pane-item
      // controllers. None of them is needed to finish opening the editor when
      // the GitHub tab is closed, so keep the renderer and controller graph off
      // the startup critical path.
      lumine.window.whenLoaded().then(() => {
        if (!this.activated || generation !== this.activationGeneration || this.startupComplete)
          return;
        const schedule = globalThis.requestIdleCallback || ((callback) => setTimeout(callback, 0));
        this.startupRenderHandle = schedule(
          () => {
            if (!this.activated || generation !== this.activationGeneration) return;
            this.startupRenderHandle = null;
            startRendering();
          },
          {
            timeout: 2000,
          },
        );
      });
    }
    if (this.startOpenGitHubTab) {
      // Layout restoration destroys items opened during package activation.
      // Wait for that layout, and leave an already restored panel untouched.
      void waitForSignal(lumine.window.whenLoaded(), signal)
        .then(() => {
          if (
            !this.activated ||
            generation !== this.activationGeneration ||
            signal?.aborted ||
            this.githubTabTracker.isRendered()
          )
            return;
          return this.githubTabTracker.ensureRendered({ signal });
        })
        .catch((error) => {
          if (this.activated && generation === this.activationGeneration && !signal?.aborted)
            console.error(`Failed to open GitHub panel: ${error.message}`);
        });
    }
  }
  consumeGitPanel(service) {
    const generation = this.activationGeneration;
    this.gitPanel = service;
    this.rerender();
    return new Disposable(() => {
      if (this.activationGeneration !== generation || this.gitPanel !== service) return;
      this.gitPanel = null;
      this.rerender();
    });
  }
  consumeDiff(service) {
    const edge = { service };
    this.diffServiceEdge = edge;
    setDiffService(service);
    this.rerender();
    return new Disposable(() => {
      if (this.diffServiceEdge !== edge) return;
      this.diffServiceEdge = null;
      setDiffService(null);
      if (this.activated) this.rerender();
    });
  }
  openGitPanel(method) {
    if (this.gitPanel) return this.gitPanel[method]();
    this.notificationManager.addWarning("The Git panel is inactive.", { dismissable: true });
    return Promise.resolve();
  }
  rerender(callback) {
    if (this.workspace.isDestroyed()) {
      return;
    }
    const context = lumine.repositories.getActiveRepositoryContext();
    const currentWorkDir = context.repository?.getWorkingDirectory() || context.workingDirectory;
    const repository = this.repositoryPool.add(currentWorkDir).getRepository();
    if (context.repository) repository.setCore(context.repository);
    if (!this.activated || !this.startupComplete) {
      return;
    }
    ensureRenderer();
    if (!this.element) {
      this.element = document.createElement("div");
      this.subscriptions.add(
        new Disposable(() => {
          const root = this._roots.get(this.element);
          if (root) {
            this._roots.delete(this.element);
            root.destroy();
          }
          delete this.element;
        }),
      );
    }
    this.renderFn(
      <GitHubRootController
        ref={(c) => {
          this.controller = c;
        }}
        workspace={this.workspace}
        commands={this.commands}
        notificationManager={this.notificationManager}
        tooltips={this.tooltips}
        keymaps={this.keymaps}
        config={this.config}
        confirm={this.confirm}
        workdirContextPool={this.repositoryPool}
        repository={repository}
        loginModel={this.loginModel}
        clone={async (url, directory, remoteName) => {
          await lumine.repositories.clone(url, directory, { sourceRemoteName: remoteName });
          this.project.addPath(directory);
        }}
        currentWorkDir={currentWorkDir}
        contextLocked={lumine.repositories.isActiveRepositoryPinned()}
        // Core owns the shared active-repository selection and its pin, so all
        // repository views route their switches and locks through this registry.
        changeWorkingDirectory={(p) =>
          lumine.repositories.setActiveRepositoryForPath(p, {
            pin: lumine.repositories.isActiveRepositoryPinned(),
          })
        }
        setContextLock={(p, lock) =>
          lumine.repositories.setActiveRepositoryForPath(p, {
            pin: lock,
          })
        }
        githubTabTracker={this.githubTabTracker}
        createGitHubPaneItem={this.createGitHubPaneItem}
        createIssueishPaneItem={this.createIssueishPaneItem}
        createReviewsPaneItem={this.createReviewsPaneItem}
        openGitTab={() => this.openGitPanel("openGitTab")}
        openCloneDialog={() => this.openGitPanel("openCloneDialog")}
        openInitializeDialog={() => this.openGitPanel("openInitializeDialog")}
      />,
      this.element,
      callback,
    );
  }
  async deactivate() {
    this.activated = false;
    this.activationGeneration++;
    this.controllerReadyReject?.(new Error("GitHub panel deactivated"));
    this.controllerReadyReject = null;
    if (this.startupRenderHandle != null) {
      if (globalThis.cancelIdleCallback) {
        cancelIdleCallback(this.startupRenderHandle);
      } else {
        clearTimeout(this.startupRenderHandle);
      }
      this.startupRenderHandle = null;
    }
    const items = this.workspace.getPaneItems().filter(isGithubPaneItem);
    for (const item of items) {
      const pane = this.workspace.paneForItem(item);
      if (pane) {
        // Dock items are permanent outside the center pane; force teardown so
        // an update cannot leave the old generation visible and hydrated.
        await pane.destroyItem(item, true);
      }
    }
    this.subscriptions.dispose();
    this.repositoryPool.clear();
    if (this.ownsLoginModel) this.loginModel.destroy();
    this.controller = null;
    this.controllerReadyPromise = null;
    this.activationDisposed = true;
  }
  createIssueishPaneItemStub(options) {
    return GithubPanelPackage.prototype.createIssueishPaneItem.call(this, options);
  }
  createIssueishPaneItem({ uri, selectedTab, deserialized = {} } = {}) {
    const initialSelectedTab = selectedTab ?? deserialized.initSelectedTab;
    return PaneItemHost.create("issueish-detail-item", {
      classPrefix: "github-panel",
      title: "Issueish",
      uri,
      hydrationProps: {
        ...deserialized,
        initSelectedTab: initialSelectedTab,
      },
      allowedLocations: CENTER_ONLY,
      copyFactory: (options) =>
        GithubPanelPackage.prototype.copyPaneItemHost.call(this, "createIssueishPaneItem", options),
      serializeFallback: () => ({
        deserializer: "IssueishDetailItem",
        uri,
        ...(initialSelectedTab == null
          ? {}
          : {
              selectedTab: initialSelectedTab,
            }),
      }),
    });
  }
  createGitHubPaneItem({ uri, deserialized = {} } = {}) {
    if (uri !== GITHUB_TAB_URI) {
      throw new Error(`Invalid GitHub pane item URI: ${uri}`);
    }
    const item = PaneItemHost.create("github", {
      classPrefix: "github-panel",
      title: "GitHub",
      iconName: "mark-github",
      copyable: false,
      singletonKey: "github-panel:github",
      defaultLocation: location,
      allowedLocations,
      uri,
      hydrationProps: deserialized,
      serializeFallback: () => ({
        deserializer: "GithubDockItem",
        uri,
      }),
    });
    this.githubTabPaneItem = this.githubTabPaneItem || item;
    if (this.controller) {
      this.rerender();
    }
    return item;
  }
  createDockItemStub(options) {
    return GithubPanelPackage.prototype.createGitHubPaneItem.call(this, options);
  }
  createReviewsPaneItem({ uri, deserialized = {} } = {}) {
    const item = PaneItemHost.create("github-panel-reviews", {
      classPrefix: "github-panel",
      title: "Reviews",
      copyable: false,
      singletonKey: uri,
      uri,
      hydrationProps: deserialized,
      defaultLocation: location,
      allowedLocations,
      serializeFallback: () => ({
        deserializer: "ReviewsStub",
        uri,
      }),
    });
    if (this.controller) {
      this.rerender();
    }
    return item;
  }
  createReviewsStub(options) {
    return GithubPanelPackage.prototype.createReviewsPaneItem.call(this, options);
  }
  copyPaneItemHost(factory, options) {
    options.signal?.throwIfAborted();
    if (this.activationDisposed || this.activated === false)
      throw new DOMException("GitHub Panel was unloaded", "AbortError");
    return GithubPanelPackage.prototype[factory].call(this, options);
  }

  destroyGithubTabItem() {
    if (this.githubTabPaneItem) {
      this.githubTabPaneItem.destroy();
      this.githubTabPaneItem = null;
      if (this.controller) {
        this.rerender();
      }
    }
  }
}
