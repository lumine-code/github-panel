/** @babel */
/** @jsx React.createElement */
import React from "react";
import cx from "classnames";

import RefHolder from "../models/ref-holder";
import Timeago from "./timeago";
import Octicon from "../lumine/octicon";
import GithubDotcomMarkdown from "./github-dotcom-markdown";
import EmojiReactionsController from "../controllers/emoji-reactions-controller";
import { GHOST_USER } from "../helpers";
import ActionableReviewView from "./actionable-review-view";

export default class ReviewCommentView extends React.Component {
  constructor(props) {
    super(props);
    this.refEditor = new RefHolder();
  }

  render() {
    return (
      <ActionableReviewView
        originalContent={this.props.comment}
        isPosting={this.props.isPosting}
        confirm={this.props.confirm}
        commands={this.props.commands}
        contentUpdater={this.props.updateComment}
        render={this.renderComment}
      />
    );
  }

  renderComment = (showActionsMenu) => {
    const comment = this.props.comment;

    if (comment.isMinimized) {
      return (
        <div
          className="github-panel-Review-comment github-panel-Review-comment--hidden"
          key={comment.id}
        >
          <Octicon icon={"fold"} className="github-panel-Review-icon" />
          <em>This comment was hidden</em>
        </div>
      );
    }

    const commentClass = cx("github-panel-Review-comment", {
      "github-panel-Review-comment--pending": comment.state === "PENDING",
    });
    const author = comment.author || GHOST_USER;

    return (
      <div className={commentClass}>
        <header className="github-panel-Review-header">
          <div className="github-panel-Review-header-authorData">
            <img
              className="github-panel-Review-avatar"
              src={author.avatarUrl || null}
              alt={author.login}
            />
            <a className="github-panel-Review-username" href={author.url}>
              {author.login}
            </a>
            <a className="github-panel-Review-timeAgo" href={comment.url}>
              <Timeago displayStyle="long" time={comment.createdAt} />
            </a>
            {this.props.renderEditedLink(comment)}
            {this.props.renderAuthorAssociation(comment)}
            {comment.state === "PENDING" && (
              <span className="github-panel-Review-pendingBadge badge badge-warning">pending</span>
            )}
          </div>
          <Octicon
            icon="ellipses"
            className="github-panel-Review-actionsMenu"
            onClick={(event) => showActionsMenu(event, comment, author)}
          />
        </header>
        <div className="github-panel-Review-text">
          <GithubDotcomMarkdown
            html={comment.bodyHTML}
            switchToIssueish={this.props.openIssueish}
            openIssueishLinkInNewTab={this.props.openIssueishLinkInNewTab}
          />
          <EmojiReactionsController
            reactable={comment}
            tooltips={this.props.tooltips}
            reportRelayError={this.props.reportRelayError}
          />
        </div>
      </div>
    );
  };
}
