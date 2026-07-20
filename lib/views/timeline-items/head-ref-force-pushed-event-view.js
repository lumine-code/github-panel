/** @babel */
/** @jsx React.createElement */
import React from "react";

import Octicon from "../../atom/octicon";
import Timeago from "../timeago";

export class BareHeadRefForcePushedEventView extends React.Component {
  render() {
    const { actor, beforeCommit, afterCommit, createdAt } = this.props.item;
    const { headRefName, headRepositoryOwner, repository } = this.props.issueish;
    const branchPrefix =
      headRepositoryOwner.login !== repository.owner.login ? `${headRepositoryOwner.login}:` : "";
    return (
      <div className="head-ref-force-pushed-event">
        <Octicon className="pre-timeline-item-icon" icon="repo-force-push" />
        {actor && (
          <img
            className="author-avatar"
            src={actor.avatarUrl || null}
            alt={actor.login}
            title={actor.login}
          />
        )}
        <span className="head-ref-force-pushed-event-header">
          <span className="username">{actor ? actor.login : "someone"}</span> force-pushed the{" "}
          {branchPrefix + headRefName} branch from{" "}
          {this.renderCommit(beforeCommit, "an old commit")} to{" "}
          {this.renderCommit(afterCommit, "a new commit")} at <Timeago time={createdAt} />
        </span>
      </div>
    );
  }

  renderCommit(commit, description) {
    if (!commit) {
      return description;
    }

    return <span className="sha">{commit.oid.slice(0, 8)}</span>;
  }
}

export default BareHeadRefForcePushedEventView;
