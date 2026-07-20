/** @babel */
/** @jsx React.createElement */
import React from "react";
import { CompositeDisposable } from "atom";

import LoadingView from "./loading-view";
import QueryErrorView from "../views/query-error-view";
import GithubLoginView from "../views/github-login-view";
import RemoteSelectorView from "./remote-selector-view";
import GithubTabHeaderContainer from "../containers/github-tab-header-container";
import GitHubBlankNoLocal from "./github-blank-nolocal";
import GitHubBlankUninitialized from "./github-blank-uninitialized";
import GitHubBlankNoRemote from "./github-blank-noremote";
import RemoteContainer from "../containers/remote-container";
import { UNAUTHENTICATED, INSUFFICIENT } from "../shared/token-status";

export default class GitHubTabView extends React.Component {
  constructor(props) {
    super(props);
    this.subscriptions = new CompositeDisposable();
  }

  componentDidMount() {
    this.props.rootHolder.map((root) => {
      return this.subscriptions.add(
        this.props.commands.add(root, {
          "core:close": (e) => { e.stopPropagation(); this.closePanel(); },
        }),
      );
    });
  }

  componentWillUnmount() {
    this.subscriptions.dispose();
  }

  closePanel() {
    const uri = "atom-github://dock-item/github";
    const pane = this.props.workspace.paneForURI(uri);
    if (pane) {
      const item = pane.itemForURI(uri);
      if (item) {
        pane.destroyItem(item);
      }
    }
  }

  render() {
    return (
      <div className="github-panel-GitHub" tabIndex="-1" ref={this.props.rootHolder.setter}>
        {this.renderHeader()}
        <div className="github-panel-github-panel-content">{this.renderRemote()}</div>
      </div>
    );
  }

  renderRemote() {
    if (this.props.token === null) {
      return <LoadingView />;
    }

    if (this.props.token === UNAUTHENTICATED) {
      return <GithubLoginView onLogin={this.props.handleLogin} />;
    }

    if (this.props.token === INSUFFICIENT) {
      return (
        <GithubLoginView onLogin={this.props.handleLogin} tokenStatus={INSUFFICIENT}>
          <p>
            Your token no longer has sufficient authorizations. Please re-authenticate and generate
            a new one.
          </p>
        </GithubLoginView>
      );
    }

    if (this.props.token instanceof Error) {
      return (
        <QueryErrorView
          error={this.props.token}
          retry={this.props.handleTokenRetry}
          login={this.props.handleLogin}
          logout={this.props.handleLogout}
        />
      );
    }

    if (this.props.isLoading) {
      return <LoadingView />;
    }

    if (this.props.repository.isAbsent() || this.props.repository.isAbsentGuess()) {
      return (
        <GitHubBlankNoLocal
          openCreateDialog={this.props.openCreateDialog}
          openCloneDialog={this.props.openCloneDialog}
        />
      );
    }

    if (this.props.repository.isEmpty()) {
      return (
        <GitHubBlankUninitialized
          openBoundPublishDialog={this.props.openBoundPublishDialog}
          openGitTab={this.props.openGitTab}
        />
      );
    }

    if (this.props.currentRemote.isPresent()) {
      // Single, chosen or unambiguous remote
      return (
        <RemoteContainer
          // Connection
          endpoint={this.props.currentRemote.getEndpoint()}
          token={this.props.token}
          // Repository attributes
          refresher={this.props.refresher}
          pushInProgress={this.props.pushInProgress}
          workingDirectory={this.props.workingDirectory}
          workspace={this.props.workspace}
          remote={this.props.currentRemote}
          remotes={this.props.remotes}
          branches={this.props.branches}
          aheadCount={this.props.aheadCount}
          // Action methods
          handleLogin={this.props.handleLogin}
          handleLogout={this.props.handleLogout}
          onPushBranch={() =>
            this.props.handlePushBranch(this.props.currentBranch, this.props.currentRemote)
          }
        />
      );
    }

    if (this.props.manyRemotesAvailable) {
      // No chosen remote, multiple remotes hosted on GitHub instances
      return (
        <RemoteSelectorView
          remotes={this.props.remotes}
          currentBranch={this.props.currentBranch}
          selectRemote={this.props.handleRemoteSelect}
        />
      );
    }

    return <GitHubBlankNoRemote openBoundPublishDialog={this.props.openBoundPublishDialog} />;
  }

  renderHeader() {
    return (
      <GithubTabHeaderContainer
        // Connection
        endpoint={this.props.endpoint}
        token={this.props.token}
        // Workspace
        currentWorkDir={this.props.currentWorkDir || this.props.workingDirectory}
        contextLocked={this.props.contextLocked}
        changeWorkingDirectory={this.props.changeWorkingDirectory}
        setContextLock={this.props.setContextLock}
        getCurrentWorkDirs={this.props.getCurrentWorkDirs}
        // Event Handlers
        onDidChangeWorkDirs={this.props.onDidChangeWorkDirs}
      />
    );
  }
}
