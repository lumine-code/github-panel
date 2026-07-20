/** @babel */
/** @jsx React.createElement */
import { CompositeDisposable, Disposable } from "atom";

import React from "react";
import { createRoot } from "react-dom/client";

import { autobind } from "./helpers";
import GithubLoginModel from "./models/github-login-model";
import GitHubRootController from "./controllers/github-root-controller";
import GitHubTabItem from "./items/github-tab-item";
import StubItem from "./items/stub-item";
import TabTracker from "./controllers/tab-tracker";
import { setGitBridge, getGitBridge } from "./git-bridge";

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
    currentWindow,
    loginModel,
    renderFn,
  }) {
    autobind(this, "createIssueishPaneItemStub", "createDockItemStub", "destroyGithubTabItem");

    this.workspace = workspace;
    this.project = project;
    this.commands = commands;
    this.deserializers = deserializers;
    this.notificationManager = notificationManager;
    this.tooltips = tooltips;
    this.config = config;
    this.grammars = grammars;
    this.keymaps = keymaps;
    this.currentWindow = currentWindow;
    this.confirm = confirm;
    this.activated = false;

    this.loginModel = loginModel || new GithubLoginModel();
    this.statusBar = null;

    this._roots = new WeakMap();
    this.renderFn =
      renderFn ||
      ((component, node, callback) => {
        let root = this._roots.get(node);
        if (!root) {
          root = createRoot(node);
          this._roots.set(node, root);
        }
        root.render(component);
        if (callback) {
          requestAnimationFrame(callback);
        }
      });

    this.subscriptions = new CompositeDisposable();
  }

  async activate() {
    this.startOpenGitHubTab = this.config.get("github-panel.openGitHubTabOnStart");

    this.githubTabTracker = new TabTracker("github", {
      uri: GitHubTabItem.buildURI(),
      getWorkspace: () => this.workspace,
    });

    this.activated = true;

    // The active-repository selection and its pin (lock) live in core. Follow
    // core directly so the lock control reacts to locks toggled elsewhere (the
    // git tab or the API): the bridge's onDidUpdate only fires on active-context
    // changes, and a pin-only toggle does not change the context.
    this.subscriptions.add(atom.repositories.onDidChangeActiveRepository(() => this.rerender()));

    // The git-panel.git-bridge service arrives via consumeGitHubBridge; render
    // now in case it is already available, and again when it is consumed.
    this.rerender();

    if (this.startOpenGitHubTab) {
      await this.githubTabTracker.ensureRendered(false);
    }
  }

  consumeGitHubBridge(bridge) {
    setGitBridge(bridge);
    this.subscriptions.add(bridge.onDidUpdate(() => this.rerender()));
    this.rerender();
    return new Disposable(() => setGitBridge(null));
  }

  consumeStatusBar(statusBar) {
    this.statusBar = statusBar;
    if (this.activated) {
      this.rerender();
    }
    return new Disposable(() => {
      this.statusBar = null;
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
    if (!this.activated || !gitPanel) {
      return;
    }

    if (!this.element) {
      this.element = document.createElement("div");
      this.subscriptions.add(
        new Disposable(() => {
          const root = this._roots.get(this.element);
          if (root) {
            this._roots.delete(this.element);
            // Defer unmount so it never runs synchronously during a React render
            // (React 19 warns about that); see the tooltip items for the same fix.
            Promise.resolve().then(() => root.unmount());
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
        currentWindow={this.currentWindow}
        workdirContextPool={gitPanel.getContextPool()}
        repository={gitPanel.getActiveRepository()}
        loginModel={this.loginModel}
        clone={gitPanel.clone}
        currentWorkDir={gitPanel.getActiveWorkdir()}
        contextLocked={gitPanel.isContextLocked()}
        // The active-repository selection is owned by core's atom.repositories —
        // the same registry git-panel's own tab drives — so route switches and
        // locks there. git-panel's scheduleActiveContextUpdate only mutates its
        // local activeContext transiently (and ignores the lock), so the previous
        // wiring never pinned the selection and reverted on the next recompute.
        changeWorkingDirectory={(p) =>
          atom.repositories.setActiveRepositoryForPath(p, {
            pin: atom.repositories.isActiveRepositoryPinned(),
          })
        }
        setContextLock={(p, lock) => atom.repositories.setActiveRepositoryForPath(p, { pin: lock })}
        githubTabTracker={this.githubTabTracker}
        openGitTab={() => gitPanel.openGitTab()}
        openCloneDialog={() => gitPanel.openCloneDialog()}
        openInitializeDialog={() => gitPanel.openInitializeDialog()}
        statusBar={this.statusBar}
      />,
      this.element,
      callback,
    );
  }

  async deactivate() {
    const items = this.workspace.getPaneItems().filter((item) => {
      const uri = item.getURI && item.getURI();
      return (
        uri &&
        uri.startsWith("atom-github://") &&
        (uri.includes("dock-item/github") || uri.includes("issueish/") || uri.includes("reviews/"))
      );
    });
    for (const item of items) {
      const pane = this.workspace.paneForItem(item);
      if (pane) {
        pane.destroyItem(item);
      }
    }

    this.subscriptions.dispose();
  }

  createIssueishPaneItemStub({ uri, selectedTab }) {
    return StubItem.create(
      "issueish-detail-item",
      {
        title: "Issueish",
        initSelectedTab: selectedTab,
      },
      uri,
    );
  }

  createDockItemStub({ uri }) {
    if (uri !== "atom-github://dock-item/github") {
      throw new Error(`Invalid DockItem stub URI: ${uri}`);
    }

    const item = this.createGitHubStub(uri);
    this.githubTabStubItem = this.githubTabStubItem || item;

    if (this.controller) {
      this.rerender();
    }
    return item;
  }

  createGitHubStub(uri) {
    return StubItem.create(
      "github",
      {
        title: "GitHub",
      },
      uri,
    );
  }

  createReviewsStub({ uri }) {
    const item = StubItem.create(
      "github-panel-reviews",
      {
        title: "Reviews",
      },
      uri,
    );
    if (this.controller) {
      this.rerender();
    }
    return item;
  }

  destroyGithubTabItem() {
    if (this.githubTabStubItem) {
      this.githubTabStubItem.destroy();
      this.githubTabStubItem = null;
      if (this.controller) {
        this.rerender();
      }
    }
  }
}
