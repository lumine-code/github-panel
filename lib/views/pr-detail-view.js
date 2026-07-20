/** @babel */
/** @jsx React.createElement */
import React from "react";
import createRefetchContainer from "../graphql/refetch";
import * as queries from "../graphql/queries";
import cx from "classnames";
import { Tab, Tabs, TabList, TabPanel } from "react-tabs";

import PeriodicRefresher from "../periodic-refresher";
import Octicon from "../atom/octicon";
import PullRequestChangedFilesContainer from "../containers/pr-changed-files-container";
import { checkoutStates } from "../controllers/pr-checkout-controller";
import PullRequestTimelineController from "../controllers/pr-timeline-controller";
import EmojiReactionsController from "../controllers/emoji-reactions-controller";
import GithubDotcomMarkdown from "../views/github-dotcom-markdown";
import IssueishBadge from "../views/issueish-badge";
import CheckoutButton from "./checkout-button";
import PullRequestCommitsView from "../views/pr-commits-view";
import PullRequestStatusesView from "../views/pr-statuses-view";
import ReviewsFooterView from "../views/reviews-footer-view";
import { PAGE_SIZE, GHOST_USER } from "../helpers";

export class BarePullRequestDetailView extends React.Component {
  state = {
    refreshing: false,
  };

  componentDidMount() {
    this.refresher = new PeriodicRefresher(BarePullRequestDetailView, {
      interval: () => 5 * 60 * 1000,
      getCurrentId: () => this.props.pullRequest.id,
      refresh: this.refresh,
      minimumIntervalPerId: 2 * 60 * 1000,
    });
    // auto-refresh disabled for now until pagination is handled
    // this.refresher.start();
  }

  componentWillUnmount() {
    this.refresher.destroy();
  }

  renderPrMetadata(pullRequest, repo) {
    const author = this.getAuthor(pullRequest);

    return (
      <span className="github-panel-IssueishDetailView-meta">
        <code className="github-panel-IssueishDetailView-baseRefName">
          {pullRequest.isCrossRepository
            ? `${repo.owner.login}/${pullRequest.baseRefName}`
            : pullRequest.baseRefName}
        </code>
        {" ‹ "}
        <code className="github-panel-IssueishDetailView-headRefName">
          {pullRequest.isCrossRepository
            ? `${author.login}/${pullRequest.headRefName}`
            : pullRequest.headRefName}
        </code>
      </span>
    );
  }

  renderPullRequestBody(pullRequest) {
    const onBranch = this.props.checkoutOp.why() === checkoutStates.CURRENT;

    return (
      <Tabs selectedIndex={this.props.selectedTab} onSelect={this.onTabSelected}>
        <TabList className="github-panel-tablist">
          <Tab className="github-panel-tab">
            <Octicon icon="info" className="github-panel-tab-icon" />
            Overview
          </Tab>
          <Tab className="github-panel-tab">
            <Octicon icon="checklist" className="github-panel-tab-icon" />
            Build Status
          </Tab>
          <Tab className="github-panel-tab">
            <Octicon icon="git-commit" className="github-panel-tab-icon" />
            Commits
            <span className="github-panel-tab-count">{pullRequest.countedCommits.totalCount}</span>
          </Tab>
          <Tab className="github-panel-tab">
            <Octicon icon="diff" className="github-panel-tab-icon" />
            Files
            <span className="github-panel-tab-count">{pullRequest.changedFiles}</span>
          </Tab>
        </TabList>
        {/* 'Reviews' tab to be added in the future. */}

        {/* overview */}
        <TabPanel>
          <div className="github-panel-IssueishDetailView-overview">
            <GithubDotcomMarkdown
              html={pullRequest.bodyHTML || "<em>No description provided.</em>"}
              switchToIssueish={this.props.switchToIssueish}
            />
            <EmojiReactionsController
              reactable={pullRequest}
              tooltips={this.props.tooltips}
              reportRelayError={this.props.reportRelayError}
            />
            <PullRequestTimelineController
              onBranch={onBranch}
              openCommit={this.props.openCommit}
              pullRequest={pullRequest}
              switchToIssueish={this.props.switchToIssueish}
            />
          </div>
        </TabPanel>

        {/* build status */}
        <TabPanel>
          <div className="github-panel-IssueishDetailView-buildStatus">
            <PullRequestStatusesView
              pullRequest={pullRequest}
              displayType="full"
              switchToIssueish={this.props.switchToIssueish}
            />
          </div>
        </TabPanel>

        {/* commits */}
        <TabPanel>
          <PullRequestCommitsView
            pullRequest={pullRequest}
            onBranch={onBranch}
            openCommit={this.props.openCommit}
          />
        </TabPanel>

        {/* files changed */}
        <TabPanel className="github-panel-IssueishDetailView-filesChanged">
          <PullRequestChangedFilesContainer
            localRepository={this.props.localRepository}
            owner={this.props.repository.owner.login}
            repo={this.props.repository.name}
            number={pullRequest.number}
            endpoint={this.props.endpoint}
            token={this.props.token}
            reviewCommentsLoading={this.props.reviewCommentsLoading}
            reviewCommentThreads={this.props.reviewCommentThreads}
            workspace={this.props.workspace}
            commands={this.props.commands}
            keymaps={this.props.keymaps}
            tooltips={this.props.tooltips}
            config={this.props.config}
            workdirPath={this.props.workdirPath}
            itemType={this.props.itemType}
            refEditor={this.props.refEditor}
            destroy={this.props.destroy}
            shouldRefetch={this.state.refreshing}
            switchToIssueish={this.props.switchToIssueish}
            pullRequest={this.props.pullRequest}
            initChangedFilePath={this.props.initChangedFilePath}
            initChangedFilePosition={this.props.initChangedFilePosition}
            onOpenFilesTab={this.props.onOpenFilesTab}
          />
        </TabPanel>
      </Tabs>
    );
  }

  render() {
    const repo = this.props.repository;
    const pullRequest = this.props.pullRequest;
    const author = this.getAuthor(pullRequest);

    return (
      <div className="github-panel-IssueishDetailView native-key-bindings">
        <div className="github-panel-IssueishDetailView-container">
          <header className="github-panel-IssueishDetailView-header">
            <div className="github-panel-IssueishDetailView-headerColumn">
              <a className="github-panel-IssueishDetailView-avatar" href={author.url}>
                <img
                  className="github-panel-IssueishDetailView-avatarImage"
                  src={author.avatarUrl || null}
                  title={author.login}
                  alt={author.login}
                />
              </a>
            </div>

            <div className="github-panel-IssueishDetailView-headerColumn is-flexible">
              <div className="github-panel-IssueishDetailView-headerRow is-fullwidth">
                <a className="github-panel-IssueishDetailView-title" href={pullRequest.url}>
                  {pullRequest.title}
                </a>
              </div>
              <div className="github-panel-IssueishDetailView-headerRow">
                <IssueishBadge
                  className="github-panel-IssueishDetailView-headerBadge"
                  type={pullRequest.__typename}
                  state={pullRequest.state}
                />
                <Octicon
                  icon="repo-sync"
                  className={cx("github-panel-IssueishDetailView-headerRefreshButton", {
                    refreshing: this.state.refreshing,
                  })}
                  onClick={this.handleRefreshClick}
                />
                <a
                  className="github-panel-IssueishDetailView-headerLink"
                  title="open on GitHub.com"
                  href={pullRequest.url}
                  onClick={this.recordOpenInBrowserEvent}
                >
                  {repo.owner.login}/{repo.name}#{pullRequest.number}
                </a>
                <span className="github-panel-IssueishDetailView-headerStatus">
                  <PullRequestStatusesView
                    pullRequest={pullRequest}
                    displayType="check"
                    switchToIssueish={this.props.switchToIssueish}
                  />
                </span>
              </div>
              <div className="github-panel-IssueishDetailView-headerRow">
                {this.renderPrMetadata(pullRequest, repo)}
              </div>
            </div>

            <div className="github-panel-IssueishDetailView-headerColumn">
              <CheckoutButton
                checkoutOp={this.props.checkoutOp}
                classNamePrefix="github-panel-IssueishDetailView-checkoutButton--"
                classNames={["github-panel-IssueishDetailView-checkoutButton"]}
              />
            </div>
          </header>

          {this.renderPullRequestBody(pullRequest)}

          <ReviewsFooterView
            commentsResolved={this.props.reviewCommentsResolvedCount}
            totalComments={this.props.reviewCommentsTotalCount}
            openReviews={this.props.openReviews}
            pullRequestURL={`${this.props.pullRequest.url}/files`}
          />
        </div>
      </div>
    );
  }

  handleRefreshClick = (e) => {
    e.preventDefault();
    this.refresher.refreshNow(true);
  };

  recordOpenInBrowserEvent = () => {};

  onTabSelected = (index) => {
    this.props.onTabSelected(index);
  };

  refresh = () => {
    if (this.state.refreshing) {
      return;
    }

    this.setState({ refreshing: true });
    this.props.relay.refetch(
      {
        repoId: this.props.repository.id,
        issueishId: this.props.pullRequest.id,
        timelineCount: PAGE_SIZE,
        timelineCursor: null,
        commitCount: PAGE_SIZE,
        commitCursor: null,
      },
      null,
      (err) => {
        if (err) {
          this.props.reportRelayError("Unable to refresh pull request details", err);
        }
        this.setState({ refreshing: false });
      },
      { force: true },
    );
  };

  getAuthor(pullRequest) {
    return pullRequest.author || GHOST_USER;
  }
}

export default createRefetchContainer(
  BarePullRequestDetailView,
  {
    repository: null,

    pullRequest: null,
  },
  queries.prDetailViewRefetchQuery,
);
