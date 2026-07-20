/** @babel */
/** @jsx React.createElement */
import React, { Fragment } from "react";

import Octicon from "../../atom/octicon";
import Timeago from "../../views/timeago";

export class BareMergedEventView extends React.Component {
  render() {
    const { actor, mergeRefName, createdAt } = this.props.item;
    return (
      <div className="merged-event">
        <Octicon className="pre-timeline-item-icon" icon="git-merge" />
        {actor && (
          <img
            className="author-avatar"
            src={actor.avatarUrl || null}
            alt={actor.login}
            title={actor.login}
          />
        )}
        <span className="merged-event-header">
          <span className="username">{actor ? actor.login : "someone"}</span> merged{" "}
          {this.renderCommit()} into <span className="merge-ref">{mergeRefName}</span> on{" "}
          <Timeago time={createdAt} />
        </span>
      </div>
    );
  }

  renderCommit() {
    const { commit } = this.props.item;
    if (!commit) {
      return "a commit";
    }

    return (
      <Fragment>
        commit <span className="sha">{commit.oid.slice(0, 8)}</span>
      </Fragment>
    );
  }
}

export default BareMergedEventView;
