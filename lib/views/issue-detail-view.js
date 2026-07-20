/** @babel */
/** @jsx React.createElement */
import React from "react";
import createRefetchContainer from "../graphql/refetch";
import * as queries from "../graphql/queries";
import cx from "classnames";

import IssueTimelineController from "../controllers/issue-timeline-controller";
import EmojiReactionsController from "../controllers/emoji-reactions-controller";
import Octicon from "../atom/octicon";
import IssueishBadge from "../views/issueish-badge";
import GithubDotcomMarkdown from "../views/github-dotcom-markdown";
import PeriodicRefresher from "../periodic-refresher";
import { GHOST_USER } from "../helpers";

export class BareIssueDetailView extends React.Component {
  state = {
    refreshing: false,
  };

  componentDidMount() {
    this.refresher = new PeriodicRefresher(BareIssueDetailView, {
      interval: () => 5 * 60 * 1000,
      getCurrentId: () => this.props.issue.id,
      refresh: this.refresh,
      minimumIntervalPerId: 2 * 60 * 1000,
    });
    // auto-refresh disabled for now until pagination is handled
    // this.refresher.start();
  }

  componentWillUnmount() {
    this.refresher.destroy();
  }

  renderIssueBody(issue) {
    return (
      <div className="github-panel-IssueishDetailView-issueBody">
        <GithubDotcomMarkdown
          html={issue.bodyHTML || "<em>No description provided.</em>"}
          switchToIssueish={this.props.switchToIssueish}
        />
        <EmojiReactionsController
          reactable={issue}
          tooltips={this.props.tooltips}
          reportRelayError={this.props.reportRelayError}
        />
        <IssueTimelineController issue={issue} switchToIssueish={this.props.switchToIssueish} />
      </div>
    );
  }

  render() {
    const repo = this.props.repository;
    const issue = this.props.issue;
    const author = issue.author || GHOST_USER;

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
                <a className="github-panel-IssueishDetailView-title" href={issue.url}>
                  {issue.title}
                </a>
              </div>
              <div className="github-panel-IssueishDetailView-headerRow">
                <IssueishBadge
                  className="github-panel-IssueishDetailView-headerBadge"
                  type={issue.__typename}
                  state={issue.state}
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
                  href={issue.url}
                  onClick={this.recordOpenInBrowserEvent}
                >
                  {repo.owner.login}/{repo.name}#{issue.number}
                </a>
              </div>
            </div>
          </header>

          {this.renderIssueBody(issue)}

          <footer className="github-panel-IssueishDetailView-footer">
            <a
              className="github-panel-IssueishDetailView-footerLink icon icon-mark-github"
              href={issue.url}
            >
              {repo.owner.login}/{repo.name}#{issue.number}
            </a>
          </footer>
        </div>
      </div>
    );
  }

  handleRefreshClick = (e) => {
    e.preventDefault();
    this.refresher.refreshNow(true);
  };

  recordOpenInBrowserEvent = () => {};

  refresh = () => {
    if (this.state.refreshing) {
      return;
    }

    this.setState({ refreshing: true });
    this.props.relay.refetch(
      {
        repoId: this.props.repository.id,
        issueishId: this.props.issue.id,
        timelineCount: 100,
        timelineCursor: null,
      },
      null,
      (err) => {
        if (err) {
          this.props.reportRelayError("Unable to refresh issue details", err);
        }
        this.setState({ refreshing: false });
      },
      { force: true },
    );
  };
}

export default createRefetchContainer(
  BareIssueDetailView,
  {
    repository: null,

    issue: null,
  },
  queries.issueDetailViewRefetchQuery,
);
