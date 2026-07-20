/** @babel */
/** @jsx React.createElement */
import React from "react";

import IssueDetailView from "../views/issue-detail-view";
import ReviewsItem from "../items/reviews-item";
import PullRequestCheckoutController from "./pr-checkout-controller";
import PullRequestDetailView from "../views/pr-detail-view";

export class BareIssueishDetailController extends React.Component {
  componentDidMount() {
    this.updateTitle();
  }

  componentDidUpdate() {
    this.updateTitle();
  }

  updateTitle() {
    const { repository } = this.props;
    if (repository && (repository.issue || repository.pullRequest)) {
      let prefix, issueish;
      if (this.getTypename() === "PullRequest") {
        prefix = "PR:";
        issueish = repository.pullRequest;
      } else {
        prefix = "Issue:";
        issueish = repository.issue;
      }
      const title = `${prefix} ${repository.owner.login}/${repository.name}#${issueish.number}: ${issueish.title}`;
      this.props.onTitleChange(title);
    }
  }

  render() {
    const { repository } = this.props;
    if (!repository || !repository.issue || !repository.pullRequest) {
      return <div>Issue/PR #{this.props.issueishNumber} not found</div>;
    }

    if (this.getTypename() === "PullRequest") {
      return (
        <PullRequestCheckoutController
          repository={repository}
          pullRequest={repository.pullRequest}
          localRepository={this.props.localRepository}
          isAbsent={this.props.isAbsent}
          isLoading={this.props.isLoading}
          isPresent={this.props.isPresent}
          isMerging={this.props.isMerging}
          isRebasing={this.props.isRebasing}
          branches={this.props.branches}
          remotes={this.props.remotes}
        >
          {(checkoutOp) => (
            <PullRequestDetailView
              relay={this.props.relay}
              repository={this.props.repository}
              pullRequest={this.props.repository.pullRequest}
              checkoutOp={checkoutOp}
              localRepository={this.props.localRepository}
              reviewCommentsLoading={this.props.reviewCommentsLoading}
              reviewCommentsTotalCount={this.props.reviewCommentsTotalCount}
              reviewCommentsResolvedCount={this.props.reviewCommentsResolvedCount}
              reviewCommentThreads={this.props.reviewCommentThreads}
              endpoint={this.props.endpoint}
              token={this.props.token}
              workspace={this.props.workspace}
              commands={this.props.commands}
              keymaps={this.props.keymaps}
              tooltips={this.props.tooltips}
              config={this.props.config}
              openCommit={this.openCommit}
              openReviews={this.openReviews}
              switchToIssueish={this.props.switchToIssueish}
              destroy={this.props.destroy}
              reportRelayError={this.props.reportRelayError}
              itemType={this.props.itemType}
              refEditor={this.props.refEditor}
              initChangedFilePath={this.props.initChangedFilePath}
              initChangedFilePosition={this.props.initChangedFilePosition}
              selectedTab={this.props.selectedTab}
              onTabSelected={this.props.onTabSelected}
              onOpenFilesTab={this.props.onOpenFilesTab}
              workdirPath={this.props.workdirPath}
            />
          )}
        </PullRequestCheckoutController>
      );
    } else {
      return (
        <IssueDetailView
          repository={repository}
          issue={repository.issue}
          switchToIssueish={this.props.switchToIssueish}
          tooltips={this.props.tooltips}
          reportRelayError={this.props.reportRelayError}
        />
      );
    }
  }

  openCommit = async ({ sha }) => {
    /* istanbul ignore if */
    if (!this.props.workdirPath) {
      return;
    }

    const uri = `atom-github://commit-detail?workdir=${encodeURIComponent(this.props.workdirPath)}&sha=${encodeURIComponent(sha)}`;
    await this.props.workspace.open(uri, { pending: true });
  };

  openReviews = async () => {
    /* istanbul ignore if */
    if (this.getTypename() !== "PullRequest") {
      return;
    }

    const uri = ReviewsItem.buildURI({
      host: this.props.endpoint.getHost(),
      owner: this.props.repository.owner.login,
      repo: this.props.repository.name,
      number: this.props.issueishNumber,
      workdir: this.props.workdirPath,
    });
    await this.props.workspace.open(uri);
  };

  getTypename() {
    const { repository } = this.props;
    /* istanbul ignore if */
    if (!repository) {
      return null;
    }
    /* istanbul ignore if */
    if (!repository.pullRequest) {
      return null;
    }
    return repository.pullRequest.__typename;
  }
}

export default BareIssueishDetailController;
