/** @babel */
/** @jsx h */
import View, { h } from "../etch/view";
import createRefetchView from "../graphql/refetch";
import * as queries from "../graphql/queries";
import cx from "classnames";
import PeriodicRefresher from "../periodic-refresher";
import Octicon from "../lumine/octicon";
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
export class BarePullRequestDetailView extends View {
  constructor(props, children) {
    super(props, children);
    this.initialize();
  }
  state = {
    refreshing: false,
  };
  didMount() {
    this.refresher = new PeriodicRefresher(BarePullRequestDetailView, {
      interval: () => 5 * 60 * 1000,
      getCurrentId: () => this.props.pullRequest.id,
      refresh: this.refresh,
      minimumIntervalPerId: 2 * 60 * 1000,
    });
    // auto-refresh disabled for now until pagination is handled
    // this.refresher.start();
  }
  willDestroy() {
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
      <div className="github-panel-tabs">
        <div
          className="github-panel-tablist"

          attributes={{
            role: "tablist",
            "aria-label": "Pull request sections",
          }}
          onKeyDown={this.handleTabKeyDown}
        >
          <button
            className="github-panel-tab"

            type="button"
            tabIndex={this.props.selectedTab === 0 ? 0 : -1}
            onClick={() => this.onTabSelected(0)}
            attributes={{
              role: "tab",
              "aria-selected": this.props.selectedTab === 0,
              "data-tab-index": 0,
            }}
          >
            <Octicon
              icon="info"
              className="github-panel-tab-icon"
              environment={this.props.environment}
            />
            Overview
          </button>
          <button
            className="github-panel-tab"

            type="button"
            tabIndex={this.props.selectedTab === 1 ? 0 : -1}
            onClick={() => this.onTabSelected(1)}
            attributes={{
              role: "tab",
              "aria-selected": this.props.selectedTab === 1,
              "data-tab-index": 1,
            }}
          >
            <Octicon
              icon="checklist"
              className="github-panel-tab-icon"
              environment={this.props.environment}
            />
            Build Status
          </button>
          <button
            className="github-panel-tab"

            type="button"
            tabIndex={this.props.selectedTab === 2 ? 0 : -1}
            onClick={() => this.onTabSelected(2)}
            attributes={{
              role: "tab",
              "aria-selected": this.props.selectedTab === 2,
              "data-tab-index": 2,
            }}
          >
            <Octicon
              icon="git-commit"
              className="github-panel-tab-icon"
              environment={this.props.environment}
            />
            Commits
            <span className="github-panel-tab-count">{pullRequest.countedCommits.totalCount}</span>
          </button>
          <button
            className="github-panel-tab"

            type="button"
            tabIndex={this.props.selectedTab === 3 ? 0 : -1}
            onClick={() => this.onTabSelected(3)}
            attributes={{
              role: "tab",
              "aria-selected": this.props.selectedTab === 3,
              "data-tab-index": 3,
            }}
          >
            <Octicon
              icon="diff"
              className="github-panel-tab-icon"
              environment={this.props.environment}
            />
            Files
            <span className="github-panel-tab-count">{pullRequest.changedFiles}</span>
          </button>
        </div>
        {/* 'Reviews' tab to be added in the future. */}

        {/* overview */}
        <div
          hidden={this.props.selectedTab !== 0}
          attributes={{
            role: "tabpanel",
          }}
          className="github-panel-tab-panel"
        >
          {this.props.selectedTab === 0 && (
            <div>
              <div className="github-panel-IssueishDetailView-overview">
                <GithubDotcomMarkdown
                  html={pullRequest.bodyHTML || "<em>No description provided.</em>"}
                  switchToIssueish={this.props.switchToIssueish}
                  environment={this.props.environment}
                />
                <EmojiReactionsController
                  reactable={pullRequest}
                  tooltips={this.props.tooltips}
                  reportRelayError={this.props.reportRelayError}
                  environment={this.props.environment}
                />
                <PullRequestTimelineController
                  onBranch={onBranch}
                  openCommit={this.props.openCommit}
                  pullRequest={pullRequest}
                  switchToIssueish={this.props.switchToIssueish}
                  environment={this.props.environment}
                />
              </div>
            </div>
          )}
        </div>

        {/* build status */}
        <div
          hidden={this.props.selectedTab !== 1}
          attributes={{
            role: "tabpanel",
          }}
          className="github-panel-tab-panel"
        >
          {this.props.selectedTab === 1 && (
            <div>
              <div className="github-panel-IssueishDetailView-buildStatus">
                <PullRequestStatusesView
                  pullRequest={pullRequest}
                  displayType="full"
                  switchToIssueish={this.props.switchToIssueish}
                  environment={this.props.environment}
                />
              </div>
            </div>
          )}
        </div>

        {/* commits */}
        <div
          hidden={this.props.selectedTab !== 2}
          attributes={{
            role: "tabpanel",
          }}
          className="github-panel-tab-panel"
        >
          {this.props.selectedTab === 2 && (
            <div>
              <PullRequestCommitsView
                pullRequest={pullRequest}
                onBranch={onBranch}
                openCommit={this.props.openCommit}
                environment={this.props.environment}
              />
            </div>
          )}
        </div>

        {/* files changed */}
        <div
          className="github-panel-tab-panel github-panel-IssueishDetailView-filesChanged"

          hidden={this.props.selectedTab !== 3}
          attributes={{
            role: "tabpanel",
          }}
        >
          {this.props.selectedTab === 3 && (
            <div className="github-panel-IssueishDetailView-diff">
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
                environment={this.props.environment}
              />
            </div>
          )}
        </div>
      </div>
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
                  environment={this.props.environment}
                />
                <Octicon
                  icon="repo-sync"
                  className={cx("github-panel-IssueishDetailView-headerRefreshButton", {
                    refreshing: this.state.refreshing,
                  })}
                  onClick={this.handleRefreshClick}
                  environment={this.props.environment}
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
                    environment={this.props.environment}
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
                environment={this.props.environment}
              />
            </div>
          </header>

          {this.renderPullRequestBody(pullRequest)}

          <ReviewsFooterView
            commentsResolved={this.props.reviewCommentsResolvedCount}
            totalComments={this.props.reviewCommentsTotalCount}
            openReviews={this.props.openReviews}
            pullRequestURL={`${this.props.pullRequest.url}/files`}
            environment={this.props.environment}
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
  handleTabKeyDown = (event) => {
    const index = this.props.selectedTab;
    const next = { ArrowRight: (index + 1) % 4, ArrowLeft: (index + 3) % 4, Home: 0, End: 3 }[
      event.key
    ];
    if (next === undefined) return;
    event.preventDefault();
    this.onTabSelected(next);
    event.currentTarget.querySelector(`[data-tab-index="${next}"]`)?.focus();
  };
  refresh = () => {
    if (this.state.refreshing) {
      return;
    }
    this.updateState({
      refreshing: true,
    });
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
        this.updateState({
          refreshing: false,
        });
      },
      {
        force: true,
      },
    );
  };
  getAuthor(pullRequest) {
    return pullRequest.author || GHOST_USER;
  }
}
export default createRefetchView(
  BarePullRequestDetailView,
  {
    repository: null,
    pullRequest: null,
  },
  queries.prDetailViewRefetchQuery,
);
