/** @babel */
/** @jsx h */
import { createRequire } from "node:module";
import View, { h, Fragment } from "../etch/view.js";
import path from "path";
import PaneItem from "../lumine/pane-item.js";
import CommentDecorationsContainer from "../containers/comment-decorations-container.js";
import DialogsController, { dialogRequests } from "./dialogs-controller.js";
import { autobind } from "../helpers.js";
import RepositoryObservation from "../repository-observation.js";
import TabPresentation from "../models/tab-presentation.js";
const require = import.meta.require ?? createRequire(import.meta.url);
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
export default class GitHubRootController extends View {
  constructor(props, children) {
    super(props, children);
    autobind(this, "clearGithubToken");
    this.state = {
      dialogRequest: dialogRequests.null,
    };
    this.tabPresentation = new TabPresentation();
    this.repositoryObservation = new RepositoryObservation({ onChange: () => this.invalidate() });
    this.repositoryObservation.select(this.props.workdirContextPool, this.props.currentWorkDir);
    this.initialize();
  }
  render() {
    this.repositoryObservation.select(this.props.workdirContextPool, this.props.currentWorkDir);
    return (
      <span
        style={{
          display: "contents",
        }}
      >
        {
          <Fragment>
            {this.renderPaneItems()}
            {this.renderDialogs()}
            {this.renderCommentDecorations()}
          </Fragment>
        }
      </span>
    );
  }
  renderPaneItems() {
    this.syncTabPresentation();
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
    // Readiness adds and removes sibling controls around these registrations.
    // Keep each owner stable: disposing one also closes its workspace items.
    return (
      <Fragment>
        <PaneItem
          key="github-pane"
          workspace={this.props.workspace}
          uriPattern={GITHUB_TAB_URI}
          className="github-panel-root"
          createPaneItem={this.props.createGitHubPaneItem}
          children={({ itemHolder }) => {
            const Item = getGitHubTabItem();
            return (
              <Item
                ref={itemHolder.setter}
                repository={this.props.repository}
                startupContextPending={this.props.startupContextPending}
                repositoryIsReady={this.repositoryObservation.isReady}
                repositoryObservationError={this.repositoryObservation.error}
                presentationCache={this.tabPresentation}
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
                repositorySetupAvailable={this.props.repositorySetupAvailable}
                openGitTab={this.props.openGitTab}
                openInitializeDialog={(event) =>
                  this.props.openInitializeDialog({
                    event,
                    directoryPath: this.props.repository.getWorkingDirectoryPath(),
                  })
                }
                environment={this.props.environment}
              />
            );
          }}
          environment={this.props.environment}
        />
        <PaneItem
          key="issueish-panes"
          workspace={this.props.workspace}
          uriPattern={ISSUEISH_URI_PATTERN}
          createPaneItem={this.props.createIssueishPaneItem}
          children={({ itemHolder, params, deserialized }) => {
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
                initChangedFilePath={deserialized.initChangedFilePath}
                initChangedFilePosition={deserialized.initChangedFilePosition}
                presentationState={deserialized.presentationState}
                copySnapshot={deserialized.copySnapshot}
                workspace={this.props.workspace}
                commands={this.props.commands}
                keymaps={this.props.keymaps}
                tooltips={this.props.tooltips}
                config={this.props.config}
                reportRelayError={this.reportRelayError}
                environment={this.props.environment}
              />
            );
          }}
          environment={this.props.environment}
        />
        <PaneItem
          key="review-panes"
          workspace={this.props.workspace}
          uriPattern={REVIEWS_URI_PATTERN}
          createPaneItem={this.props.createReviewsPaneItem}
          children={({ itemHolder, params }) => {
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
                environment={this.props.environment}
              />
            );
          }}
          environment={this.props.environment}
        />
      </Fragment>
    );
  }
  renderDialogs() {
    return (
      <DialogsController
        key="dialogs"
        loginModel={this.props.loginModel}
        request={this.state.dialogRequest}
        workspace={this.props.workspace}
        commands={this.props.commands}
        config={this.props.config}
        environment={this.props.environment}
      />
    );
  }
  renderCommentDecorations() {
    if (!this.props.repository || !this.repositoryObservation.isReady) {
      return null;
    }
    return (
      <CommentDecorationsContainer
        key="comment-decorations"
        workspace={this.props.workspace}
        commands={this.props.commands}
        localRepository={this.props.repository}
        loginModel={this.props.loginModel}
        reportRelayError={this.reportRelayError}
        environment={this.props.environment}
      />
    );
  }
  syncTabPresentation() {
    const { repository, currentWorkDir, loginModel } = this.props;
    const previous = this.tabPresentationContext;
    if (
      !previous ||
      previous.repository !== repository ||
      previous.currentWorkDir !== currentWorkDir ||
      previous.loginModel !== loginModel ||
      !this.repositoryObservation.isReady ||
      this.props.startupContextPending
    ) {
      this.tabPresentation.clear();
      this.tabPresentationContext = { repository, currentWorkDir, loginModel };
    }
    if (previous?.loginModel !== loginModel) {
      this.tabLoginSubscription?.dispose();
      this.tabLoginSubscription = loginModel?.onDidUpdate(() => this.tabPresentation.clear());
    }
  }
  willDestroy() {
    this.tabLoginSubscription?.dispose();
    this.tabPresentation.clear();
    this.repositoryObservation.dispose();
  }
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
  closeDialog = (request = this.state.dialogRequest, { completed = false } = {}) => {
    if (this.destroyed || this.state.dialogRequest !== request || (request.pending && !completed))
      return;
    return this.updateState({ dialogRequest: dialogRequests.null });
  };
  openIssueishDialog = () => {
    if (this.state.dialogRequest.pending) return;
    const { openIssueishItem } = require("../views/open-issueish-dialog");
    const dialogRequest = dialogRequests.issueish();
    dialogRequest.onProgressingAccept(async (url) => {
      await openIssueishItem(url, {
        workspace: this.props.workspace,
        workdir: this.props.repository.getWorkingDirectoryPath(),
      });
      await this.closeDialog(dialogRequest, { completed: true });
    });
    dialogRequest.onCancel(() => this.closeDialog(dialogRequest));
    return this.updateState({
      dialogRequest,
    });
  };
  openCreateDialog = () => {
    if (this.state.dialogRequest.pending) return;
    const { createRepository } = require("../views/create-dialog");
    const { createEnvironment } = require("../graphql/environment");
    const { getEndpoint } = require("../models/endpoint");
    const dialogRequest = dialogRequests.create();
    dialogRequest.onProgressingAccept(async (result) => {
      const dotcom = getEndpoint("github.com");
      const token = await this.props.loginModel.getToken(dotcom.getLoginAccount());
      const relayEnvironment = createEnvironment(dotcom, token);
      await createRepository(result, {
        clone: this.props.clone,
        relayEnvironment,
      });
      await this.closeDialog(dialogRequest, { completed: true });
    });
    dialogRequest.onCancel(() => this.closeDialog(dialogRequest));
    return this.updateState({
      dialogRequest,
    });
  };
  openPublishDialog = (context) => {
    if (this.state.dialogRequest.pending) return;
    const { publishRepository } = require("../views/create-dialog");
    const { createEnvironment } = require("../graphql/environment");
    const { getEndpoint } = require("../models/endpoint");
    const params = context?.getWorkingDirectoryPath
      ? { localDir: context.getWorkingDirectoryPath(), pathEditable: false }
      : context;
    const dialogRequest = dialogRequests.publish(params);
    dialogRequest.onProgressingAccept(async (result) => {
      const repository = await this.props.resolvePublishRepository(result.localPath);
      try {
        if (!(await repository.getRemotes()).filter((remote) => remote.isGithubRepo()).isEmpty())
          throw new Error("This local repository already has a GitHub remote.");
        const dotcom = getEndpoint("github.com");
        const token = await this.props.loginModel.getToken(dotcom.getLoginAccount());
        const relayEnvironment = createEnvironment(dotcom, token);
        await publishRepository(result, {
          repository,
          relayEnvironment,
        });
      } finally {
        repository.destroy();
      }
      await this.closeDialog(dialogRequest, { completed: true });
    });
    dialogRequest.onCancel(() => this.closeDialog(dialogRequest));
    return this.updateState({
      dialogRequest,
    });
  };
  reportRelayError = (friendlyMessage, err) => {
    const opts = {
      dismissable: true,
    };
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
