/** @babel */
/** @jsx React.createElement */
import React from "react";

import Octicon from "../../atom/octicon";
import Timeago from "../timeago";
import GithubDotcomMarkdown from "../github-dotcom-markdown";
import { GHOST_USER } from "../../helpers";

export class BareIssueCommentView extends React.Component {
  render() {
    const comment = this.props.item;
    const author = comment.author || GHOST_USER;

    return (
      <div className="issue timeline-item">
        <div className="info-row">
          <Octicon className="pre-timeline-item-icon" icon="comment" />
          <img
            className="author-avatar"
            src={author.avatarUrl || null}
            alt={author.login}
            title={author.login}
          />
          <span className="comment-message-header">
            {author.login} commented{" "}
            <a href={comment.url}>
              <Timeago time={comment.createdAt} />
            </a>
          </span>
        </div>
        <GithubDotcomMarkdown
          html={comment.bodyHTML}
          switchToIssueish={this.props.switchToIssueish}
        />
      </div>
    );
  }
}

export default BareIssueCommentView;
