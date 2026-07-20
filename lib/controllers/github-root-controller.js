/** @babel */
/** @jsx React.createElement */
import path from "path";

import React, { Fragment } from "react";
import yubikiri from "yubikiri";

import PaneItem from "../atom/pane-item";
import StatusBar from "../atom/status-bar";
import Octicon from "../atom/octicon";
import { openIssueishItem } from "../views/open-issueish-dialog";
import { createRepository, publishRepository } from "../views/create-dialog";
import ObserveModel from "../views/observe-model";
import Commands, { Command } from "../atom/commands";
import GitHubTabItem from "../items/github-tab-item";
import IssueishDetailItem from "../items/issueish-detail-item";
import ReviewsItem from "../items/reviews-item";
import CommentDecorationsContainer from "../containers/comment-decorations-container";
import DialogsController, { dialogRequests } from "./dialogs-controller";
import { createEnvironment } from "../graphql/environment";
import { getEndpoint } from "../models/endpoint";
import { getRateLimitSummary } from "../graphql/client";
import { autobind } from "../helpers";

export default class GitHubRootController extends React.Component {
  constructor(props) {
    super(props);
    autobind(this, "clearGithubToken");

    this.state = {
      dialogRequest: dialogRequests.null,
    };
  }

  render() {
    return (
      <Fragment>
        {this.renderStatusBarTile()}
        {this.renderCommands()}
        {this.renderPaneItems()}
        {this.renderDialogs()}
        {this.renderCommentDecorations()}
      </Fragment>
    );
  }

  renderStatusBarTile() {
    return (
      <StatusBar statusBar={this.props.statusBar} className="github-panel-StatusBarTile">
        <button
          className="github-panel-StatusBarTile inline-block"
          onClick={this.props.githubTabTracker.toggle}
        >
          <Octicon icon="mark-github" />
          GitHub
        </button>
      </StatusBar>
    );
  }

  renderCommands() {
    return (
      <Fragment>
        <Commands registry={this.props.commands} target="atom-workspace">
          <Command command="github-panel:logout" callback={this.clearGithubToken} />
          <Command command="github-panel:show-rate-limit" callback={this.showRateLimit} />
          <Command
            command="github-panel:toggle-github-panel-tab"
            callback={this.props.githubTabTracker.toggle}
          />
          <Command
            command="github-panel:toggle-github-panel-tab-focus"
            callback={this.props.githubTabTracker.toggleFocus}
          />
          <Command
            command="github-panel:open-issue-or-pull-request"
            callback={() => this.openIssueishDialog()}
          />
          <Command
            command="github-panel:create-repository"
            callback={() => this.openCreateDialog()}
          />
        </Commands>
        <ObserveModel model={this.props.repository} fetchData={this.fetchData}>
          {(data) => {
            if (
              !data ||
              !data.isPublishable ||
              !data.remotes.filter((r) => r.isGithubRepo()).isEmpty()
            ) {
              return null;
            }

            return (
              <Commands registry={this.props.commands} target="atom-workspace">
                <Command
                  command="github-panel:publish-repository"
                  callback={() => this.openPublishDialog(this.props.repository)}
                />
              </Commands>
            );
          }}
        </ObserveModel>
      </Fragment>
    );
  }

  renderPaneItems() {
    const { workdirContextPool } = this.props;

    // Build the working-directory list from core's actual repositories (plus the
    // active directory, so an "initialize here" context still shows) — the same
    // source git-panel and git-switcher use. The context pool additionally holds
    // non-repository project roots for the initialize/clone flow; those must not
    // appear here as switchable repositories.
    const getCurrentWorkDirs = () => {
      const workdirs = [];
      const seen = new Set();
      const add = (workdir) => {
        if (!workdir) {
          return;
        }
        const key = path.normalize(workdir);
        if (seen.has(key)) {
          return;
        }
        seen.add(key);
        workdirs.push(workdir);
      };

      try {
        for (const repository of atom.repositories.getRepositories()) {
          try {
            add(repository.getWorkingDirectory());
          } catch {
            // A repository destroyed mid-render has no working directory.
          }
        }
        add(atom.repositories.getActiveRepositoryContext().workingDirectory);
      } catch {
        add(this.props.currentWorkDir);
      }
      return workdirs;
    };
    const onDidChangeWorkDirs = (cb) => atom.repositories.onDidChange(cb);

    return (
      <Fragment>
        <PaneItem
          workspace={this.props.workspace}
          uriPattern={GitHubTabItem.uriPattern}
          className="github-panel-root"
        >
          {({ itemHolder }) => (
            <GitHubTabItem
              ref={itemHolder.setter}
              repository={this.props.repository}
              loginModel={this.props.loginModel}
              workspace={this.props.workspace}
              commands={this.props.commands}
              currentWorkDir={this.props.currentWorkDir}
              getCurrentWorkDirs={getCurrentWorkDirs}
              onDidChangeWorkDirs={onDidChangeWorkDirs}
              contextLocked={this.props.contextLocked}
              changeWorkingDirectory={this.props.changeWorkingDirectory}
              setContextLock={this.props.setContextLock}
              openCreateDialog={this.openCreateDialog}
              openPublishDialog={this.openPublishDialog}
              openCloneDialog={this.props.openCloneDialog}
              openGitTab={this.props.openGitTab}
            />
          )}
        </PaneItem>
        <PaneItem workspace={this.props.workspace} uriPattern={IssueishDetailItem.uriPattern}>
          {({ itemHolder, params, deserialized }) => (
            <IssueishDetailItem
              ref={itemHolder.setter}
              host={params.host}
              owner={params.owner}
              repo={params.repo}
              issueishNumber={parseInt(params.issueishNumber, 10)}
              workingDirectory={params.workingDirectory}
              workdirContextPool={this.props.workdirContextPool}
              loginModel={this.props.loginModel}
              initSelectedTab={deserialized.initSelectedTab}
              workspace={this.props.workspace}
              commands={this.props.commands}
              keymaps={this.props.keymaps}
              tooltips={this.props.tooltips}
              config={this.props.config}
              reportRelayError={this.reportRelayError}
            />
          )}
        </PaneItem>
        <PaneItem workspace={this.props.workspace} uriPattern={ReviewsItem.uriPattern}>
          {({ itemHolder, params }) => (
            <ReviewsItem
              ref={itemHolder.setter}
              host={params.host}
              owner={params.owner}
              repo={params.repo}
              number={parseInt(params.number, 10)}
              workdir={params.workdir}
              workdirContextPool={this.props.workdirContextPool}
              loginModel={this.props.loginModel}
              workspace={this.props.workspace}
              tooltips={this.props.tooltips}
              config={this.props.config}
              commands={this.props.commands}
              confirm={this.props.confirm}
              reportRelayError={this.reportRelayError}
            />
          )}
        </PaneItem>
      </Fragment>
    );
  }

  renderDialogs() {
    return (
      <DialogsController
        loginModel={this.props.loginModel}
        request={this.state.dialogRequest}
        currentWindow={this.props.currentWindow}
        workspace={this.props.workspace}
        commands={this.props.commands}
        config={this.props.config}
      />
    );
  }

  renderCommentDecorations() {
    if (!this.props.repository) {
      return null;
    }
    return (
      <CommentDecorationsContainer
        workspace={this.props.workspace}
        commands={this.props.commands}
        localRepository={this.props.repository}
        loginModel={this.props.loginModel}
        reportRelayError={this.reportRelayError}
      />
    );
  }

  fetchData = (repository) =>
    yubikiri({
      isPublishable: repository.isPublishable(),
      remotes: repository.getRemotes(),
    });

  showRateLimit = () => {
    const summary = getRateLimitSummary();
    atom.notifications.addInfo(
      summary
        ? `GitHub API rate limit: ${summary}`
        : "No GitHub API requests have been made yet this session.",
    );
  };

  clearGithubToken() {
    return this.props.loginModel.removeToken("https://api.github.com");
  }

  closeDialog = () =>
    new Promise((resolve) => this.setState({ dialogRequest: dialogRequests.null }, resolve));

  openIssueishDialog = () => {
    const dialogRequest = dialogRequests.issueish();
    dialogRequest.onProgressingAccept(async (url) => {
      await openIssueishItem(url, {
        workspace: this.props.workspace,
        workdir: this.props.repository.getWorkingDirectoryPath(),
      });
      await this.closeDialog();
    });
    dialogRequest.onCancel(this.closeDialog);

    return new Promise((resolve) => this.setState({ dialogRequest }, resolve));
  };

  openCreateDialog = () => {
    const dialogRequest = dialogRequests.create();
    dialogRequest.onProgressingAccept(async (result) => {
      const dotcom = getEndpoint("github.com");
      const token = await this.props.loginModel.getToken(dotcom.getLoginAccount());
      const relayEnvironment = createEnvironment(dotcom, token);

      await createRepository(result, { clone: this.props.clone, relayEnvironment });
      await this.closeDialog();
    });
    dialogRequest.onCancel(this.closeDialog);

    return new Promise((resolve) => this.setState({ dialogRequest }, resolve));
  };

  openPublishDialog = (repository) => {
    const dialogRequest = dialogRequests.publish({
      localDir: repository.getWorkingDirectoryPath(),
    });
    dialogRequest.onProgressingAccept(async (result) => {
      const dotcom = getEndpoint("github.com");
      const token = await this.props.loginModel.getToken(dotcom.getLoginAccount());
      const relayEnvironment = createEnvironment(dotcom, token);

      await publishRepository(result, { repository, relayEnvironment });
      await this.closeDialog();
    });
    dialogRequest.onCancel(this.closeDialog);

    return new Promise((resolve) => this.setState({ dialogRequest }, resolve));
  };

  reportRelayError = (friendlyMessage, err) => {
    const opts = { dismissable: true };

    if (err.network) {
      // Offline
      opts.icon = "alignment-unalign";
      opts.description = "It looks like you're offline right now.";
    } else if (err.responseText) {
      // Transient error like a 500 from the API
      opts.description = "The GitHub API reported a problem.";
      opts.detail = err.responseText;
    } else if (err.errors) {
      // GraphQL errors
      opts.detail = err.errors.map((e) => e.message).join("\n");
    } else {
      opts.detail = err.stack;
    }

    this.props.notificationManager.addError(friendlyMessage, opts);
  };
}
