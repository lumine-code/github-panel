/** @babel */
/** @jsx React.createElement */
import React from "react";

import GitHubTabView from "../views/github-tab-view";

export default class GitHubTabController extends React.Component {
  render() {
    return (
      <GitHubTabView
        // Connection
        endpoint={this.currentEndpoint()}
        token={this.props.token}
        workspace={this.props.workspace}
        commands={this.props.commands}
        refresher={this.props.refresher}
        rootHolder={this.props.rootHolder}
        workingDirectory={this.props.workingDirectory || this.props.currentWorkDir}
        currentWorkDir={this.props.currentWorkDir}
        contextLocked={this.props.contextLocked}
        repository={this.props.repository}
        branches={this.props.branches}
        currentBranch={this.props.currentBranch}
        remotes={this.props.githubRemotes}
        currentRemote={this.props.currentRemote}
        manyRemotesAvailable={this.props.manyRemotesAvailable}
        aheadCount={this.props.aheadCount}
        pushInProgress={this.props.pushInProgress}
        isLoading={this.props.isLoading}
        handleLogin={this.handleLogin}
        handleLogout={this.handleLogout}
        handleTokenRetry={this.handleTokenRetry}
        handlePushBranch={this.handlePushBranch}
        handleRemoteSelect={this.handleRemoteSelect}
        changeWorkingDirectory={this.props.changeWorkingDirectory}
        setContextLock={this.props.setContextLock}
        getCurrentWorkDirs={this.props.getCurrentWorkDirs}
        onDidChangeWorkDirs={this.props.onDidChangeWorkDirs}
        openCreateDialog={this.props.openCreateDialog}
        openBoundPublishDialog={this.openBoundPublishDialog}
        openCloneDialog={this.props.openCloneDialog}
        openGitTab={this.props.openGitTab}
      />
    );
  }

  handlePushBranch = async (currentBranch, targetRemote) => {
    try {
      return await this.props.repository.push(currentBranch.getName(), {
        remote: targetRemote,
        setUpstream: true,
      });
    } catch (e) {
      if (lumine.config.get("github-panel.debug")) {
        console.error(e);
      }
    }
    return null;
  };

  handleRemoteSelect = async (e, remote) => {
    e.preventDefault();
    try {
      return await this.props.repository.setConfig("lumineGithub.currentRemote", remote.getName());
    } catch (err) {
      if (lumine.config.get("github-panel.debug")) {
        console.error(err);
      }
    }
    return null;
  };

  openBoundPublishDialog = () => this.props.openPublishDialog(this.props.repository);

  handleLogin = (token) => {
    this.props.loginModel.setToken(this.currentEndpoint().getLoginAccount(), token);
  };

  handleLogout = () => {
    this.props.loginModel.removeToken(this.currentEndpoint().getLoginAccount());
  };

  handleTokenRetry = () => this.props.loginModel.didUpdate();

  currentEndpoint() {
    return this.props.currentRemote.getEndpointOrDotcom();
  }
}
