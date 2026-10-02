/** @babel */
/** @jsx h */
import { CompositeDisposable, Disposable } from "lumine";
import { autobind } from "./helpers";
import GithubLoginModel from "./models/github-login-model";
import TabTracker from "./controllers/tab-tracker";
import { setGitBridge, getGitBridge } from "./git-bridge";
import { location, allowedLocations } from "./items/dock-item-location";
import PaneItemHost from "./items/pane-item-host";
const GITHUB_TAB_URI = "lumine-github://dock-item/github";
const CENTER_ONLY = Object.freeze(["center"]);
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
    this.gitPanelWaiters = [];
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
    this.gitPanelWaiters = [];
    this.controllerReadyPromise = null;
    this.controllerReadyReject = null;
    this.controller = null;
    this.githubTabPaneItem = null;
    this.activationDisposed = false;
    if (this.ownsLoginModel) this.loginModel = new GithubLoginModel();
  }
  registerGlobalCommands() {
    this.subscriptions.add(
      this.commands.add("lumine-workspace", {
        // The dock opener is registered before these cold handlers run, so the
        // tracker can reveal a host without waiting for the optional git-panel
        // bridge or the lazy view tree. The tree hydrates the host on idle.
        "github-panel:toggle": () => this.githubTabTracker.toggle(),
        "github-panel:toggle-focus": () => this.githubTabTracker.toggleFocus(),
        "github-panel:logout": {
          description: "Forget the GitHub token this window is signed in with.",
          didDispatch: () => this.invokeRootController("clearGithubToken"),
        },
        "github-panel:show-rate-limit": {
          description: "Report how much of the GitHub API quota is left.",
          didDispatch: () => this.invokeRootController("showRateLimit"),
        },
        "github-panel:open-issue-or-pull-request": {
          description: "Open an issue or pull request by the URL you paste.",
          didDispatch: () => this.invokeRootController("openIssueishDialog"),
        },
        "github-panel:create-repository": {
          description: "Create a repository on GitHub from a local folder.",
          didDispatch: () => this.invokeRootController("openCreateDialog"),
        },
      }),
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
  waitForGitPanel() {
    const bridge = getGitBridge();
    if (bridge) return Promise.resolve(bridge);
    return new Promise((resolve, reject) => this.gitPanelWaiters.push({ resolve, reject }));
  }
  async ensureRootController() {
    if (!this.activated) throw new Error("GitHub panel is inactive");
    if (this.controller) return this.controller;
    if (!this.controllerReadyPromise) {
      const generation = this.activationGeneration;
      const ready = this.waitForGitPanel()
        .then(
          (bridge) =>
            new Promise((resolve, reject) => {
              if (
                !this.activated ||
                generation !== this.activationGeneration ||
                getGitBridge() !== bridge
              ) {
                reject(new Error("GitHub panel activation was cancelled"));
                return;
              }
              this.controllerReadyReject = reject;
              this.startupComplete = true;
              this.rerender(() => {
                if (this.controllerReadyReject === reject) this.controllerReadyReject = null;
                if (this.controller) resolve(this.controller);
                else reject(new Error("GitHub panel root did not mount"));
              });
            }),
        )
        .finally(() => {
          if (this.controllerReadyPromise === ready) this.controllerReadyPromise = null;
        });
      this.controllerReadyPromise = ready;
    }
    return this.controllerReadyPromise;
  }
  invokeRootController(method, ...args) {
    return this.ensureRootController().then((controller) => controller[method](...args));
  }
  activate(_state, { signal } = {}) {
    signal?.throwIfAborted();
    this.activationGeneration++;
    if (this.activationDisposed) {
      this.restoreActivationState();
    }
    this.startOpenGitHubTab = this.config.get("github-panel.openGitHubTabOnStart");
    this.githubTabTracker = new TabTracker("github", {
      uri: GITHUB_TAB_URI,
      getWorkspace: () => this.workspace,
    });
    this.registerDockItemOpener();
    this.registerGlobalCommands();
    this.activated = true;

    // The active-repository selection and its pin (lock) live in core. Follow
    // core directly so the lock control reacts to locks toggled elsewhere (the
    // git tab or the API): the bridge's onDidUpdate only fires on active-context
    // changes, and a pin-only toggle does not change the context.
    this.subscriptions.add(lumine.repositories.onDidChangeActiveRepository(() => this.rerender()));

    // The git-panel.git-bridge service arrives via consumeGitPanel; render
    // now in case it is already available, and again when it is consumed.
    if (this.startOpenGitHubTab) {
      this.startupComplete = true;
      this.rerender();
    } else {
      // The root mounts the GitHub status tile, commands, dialogs, and pane-item
      // controllers. None of them is needed to finish opening the editor when
      // the GitHub tab is closed, so keep the renderer and controller graph off
      // the startup critical path.
      lumine.window.whenLoaded().then(() => {
        if (!this.activated || this.startupComplete) return;
        const schedule = globalThis.requestIdleCallback || ((callback) => setTimeout(callback, 0));
        this.startupRenderHandle = schedule(
          () => {
            this.startupRenderHandle = null;
            if (!this.activated) return;
            this.startupComplete = true;
            this.rerender();
          },
          {
            timeout: 2000,
          },
        );
      });
    }
    if (this.startOpenGitHubTab) {
      void waitForSignal(this.githubTabTracker.ensureRendered(false), signal).catch((error) => {
        if (!signal?.aborted) console.error(`Failed to open GitHub panel: ${error.message}`);
      });
    }
  }
  consumeGitPanel(bridge) {
    setGitBridge(bridge);
    for (const waiter of this.gitPanelWaiters.splice(0)) waiter.resolve(bridge);
    const subscriptions = this.subscriptions;
    const edge = bridge.onDidUpdate(() => {
      if (getGitBridge() === bridge) this.rerender();
    });
    subscriptions.add(edge);
    this.rerender();
    return new Disposable(() => {
      edge.dispose();
      subscriptions.remove(edge);
      if (getGitBridge() === bridge) {
        this.controllerReadyReject?.(new Error("Git panel provider disappeared"));
        this.controllerReadyReject = null;
        setGitBridge(null);
        const root = this.element && this._roots?.get(this.element);
        if (root) {
          this._roots.delete(this.element);
          root.destroy();
        }
        this.controller = null;
        this.controllerReadyPromise = null;
      }
    });
  }
  serialize() {
    return {};
  }
  rerender(callback) {
    if (this.workspace.isDestroyed()) {
      return;
    }
    const gitPanel = getGitBridge();
    if (!this.activated || !this.startupComplete || !gitPanel) {
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
        workdirContextPool={gitPanel.getContextPool()}
        repository={gitPanel.getActiveRepository()}
        loginModel={this.loginModel}
        clone={gitPanel.clone}
        currentWorkDir={gitPanel.getActiveWorkdir()}
        contextLocked={gitPanel.isContextLocked()}
        // The active-repository selection is owned by core's lumine.repositories —
        // the same registry git-panel's own tab drives — so route switches and
        // locks there. git-panel's scheduleActiveContextUpdate only mutates its
        // local activeContext transiently (and ignores the lock), so the previous
        // wiring never pinned the selection and reverted on the next recompute.
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
        openGitTab={() => gitPanel.openGitTab()}
        openCloneDialog={() => gitPanel.openCloneDialog()}
        openInitializeDialog={() => gitPanel.openInitializeDialog()}
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
    for (const waiter of this.gitPanelWaiters.splice(0))
      waiter.reject(new Error("GitHub panel deactivated"));
    if (this.startupRenderHandle != null) {
      if (globalThis.cancelIdleCallback) {
        cancelIdleCallback(this.startupRenderHandle);
      } else {
        clearTimeout(this.startupRenderHandle);
      }
      this.startupRenderHandle = null;
    }
    const items = this.workspace.getPaneItems().filter((item) => {
      const uri = item.getURI && item.getURI();
      return (
        uri &&
        uri.startsWith("lumine-github://") &&
        (uri.includes("dock-item/github") || uri.includes("issueish/") || uri.includes("reviews/"))
      );
    });
    for (const item of items) {
      const pane = this.workspace.paneForItem(item);
      if (pane) {
        // Dock items are permanent outside the center pane; force teardown so
        // an update cannot leave the old generation visible and hydrated.
        await pane.destroyItem(item, true);
      }
    }
    this.subscriptions.dispose();
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
      iconName: "octoface",
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
