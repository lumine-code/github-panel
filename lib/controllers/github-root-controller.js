/** @babel */
/** @jsx React.createElement */
import path from "path";

import React, { Fragment } from "react";
import { resolveQuery } from "../helpers";

import PaneItem from "../lumine/pane-item";
import StatusBar from "../lumine/status-bar";
import StatusBarTileView from "../views/status-bar-tile-view";
import ObserveModel from "../views/observe-model";
import Commands, { Command } from "../lumine/commands";
import CommentDecorationsContainer from "../containers/comment-decorations-container";
import DialogsController, { dialogRequests } from "./dialogs-controller";
import { autobind } from "../helpers";

const GITHUB_TAB_URI = "lumine-github://dock-item/github";
const ISSUEISH_URI_PATTERN =
  "lumine-github://issueish/{host}/{owner}/{repo}/{issueishNumber}?workdir={workingDirectory}";
const REVIEWS_URI_PATTERN =
  "lumine-github://reviews/{host}/{owner}/{repo}/{number}?workdir={workdir}";

let GitHubTabItem;
let IssueishDetailItem;
let ReviewsItem;

// PaneItem calls its render prop only for an open URI. Resolve each pane's
// component there so a closed GitHub panel does not load the entire tab,
// issue, and review UI graph during the startup idle callback.
function getGitHubTabItem() {
  if (!GitHubTabItem) {
    const itemModule = require("../items/github-tab-item");
    GitHubTabItem = itemModule.default || itemModule;
  }
  return GitHubTabItem;
}

function getIssueishDetailItem() {
  if (!IssueishDetailItem) {
    const itemModule = require("../items/issueish-detail-item");
    IssueishDetailItem = itemModule.default || itemModule;
  }
  return IssueishDetailItem;
}

function getReviewsItem() {
  if (!ReviewsItem) {
    const itemModule = require("../items/reviews-item");
    ReviewsItem = itemModule.default || itemModule;
  }
  return ReviewsItem;
}

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
      <StatusBar statusBar={this.props.statusBar} className="github-panel-StatusBarTileHost">
        <StatusBarTileView
          onClick={this.props.githubTabTracker.toggle}
          tooltipManager={this.props.tooltips}
          keyBindingTarget={lumine.views.getView(this.props.workspace)}
        />
      </StatusBar>
    );
  }

  renderCommands() {
    return (
      <Fragment>
        <Commands registry={this.props.commands} target="lumine-workspace">
          <Command
            command="github-panel:logout"
            description="Forget the GitHub token this window is signed in with."
            callback={this.clearGithubToken}
          />
          <Command
            command="github-panel:show-rate-limit"
            description="Report how much of the GitHub API quota is left."
            callback={this.showRateLimit}
          />
          <Command command="github-panel:toggle" callback={this.props.githubTabTracker.toggle} />
          <Command
            command="github-panel:toggle-focus"
            callback={this.props.githubTabTracker.toggleFocus}
          />
          <Command
            command="github-panel:open-issue-or-pull-request"
            description="Open an issue or pull request by the URL you paste."
            callback={() => this.openIssueishDialog()}
          />
          <Command
            command="github-panel:create-repository"
            description="Create a repository on GitHub from a local folder."
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
              <Commands registry={this.props.commands} target="lumine-workspace">
                <Command
                  command="github-panel:publish-repository"
                  description="Push this local repository to a new one on GitHub."
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
    // Build the working-directory list from core's actual repositories (plus the
    // active directory, so an "initialize here" context still shows) — the same
    // source git-panel and git-center use. The context pool additionally holds
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
        for (const repository of lumine.repositories.getRepositories()) {
          try {
            add(repository.getWorkingDirectory());
          } catch {
            // A repository destroyed mid-render has no working directory.
          }
        }
        add(lumine.repositories.getActiveRepositoryContext().workingDirectory);
      } catch {
        add(this.props.currentWorkDir);
      }
      return workdirs;
    };
    const onDidChangeWorkDirs = (cb) => lumine.repositories.onDidChange(cb);

    return (
      <Fragment>
        <PaneItem
          workspace={this.props.workspace}
          uriPattern={GITHUB_TAB_URI}
          className="github-panel-root"
        >
          {({ itemHolder }) => {
            const Item = getGitHubTabItem();
            return (
              <Item
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
            );
          }}
        </PaneItem>
        <PaneItem workspace={this.props.workspace} uriPattern={ISSUEISH_URI_PATTERN}>
          {({ itemHolder, params, deserialized }) => {
            const Item = getIssueishDetailItem();
            return (
              <Item
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
            );
          }}
        </PaneItem>
        <PaneItem workspace={this.props.workspace} uriPattern={REVIEWS_URI_PATTERN}>
          {({ itemHolder, params }) => {
            const Item = getReviewsItem();
            return (
              <Item
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
            );
          }}
        </PaneItem>
      </Fragment>
    );
  }

  renderDialogs() {
    return (
      <DialogsController
        loginModel={this.props.loginModel}
        request={this.state.dialogRequest}
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
    resolveQuery({
      isPublishable: repository.isPublishable(),
      remotes: repository.getRemotes(),
    });

  showRateLimit = () => {
    const { getRateLimitSummary } = require("../graphql/client");
    const summary = getRateLimitSummary();
    lumine.notifications.addInfo(
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
    const { openIssueishItem } = require("../views/open-issueish-dialog");
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
    const { createRepository } = require("../views/create-dialog");
    const { createEnvironment } = require("../graphql/environment");
    const { getEndpoint } = require("../models/endpoint");
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
    const { publishRepository } = require("../views/create-dialog");
    const { createEnvironment } = require("../graphql/environment");
    const { getEndpoint } = require("../models/endpoint");
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
