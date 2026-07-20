/** @babel */
/** @jsx React.createElement */
import React from "react";

import Octicon from "../atom/octicon";

export class BareUserMentionTooltipContainer extends React.Component {
  render() {
    const owner = this.props.repositoryOwner;
    const { login, company, repositories, membersWithRole } = owner;
    return (
      <div className="github-panel-UserMentionTooltip">
        <div className="github-panel-UserMentionTooltip-avatar">
          <img alt="repository owner's avatar" src={owner.avatarUrl || null} />
        </div>
        <div className="github-panel-UserMentionTooltip-info">
          <div className="github-panel-UserMentionTooltip-info-username">
            <Octicon icon="mention" />
            <strong>{login}</strong>
          </div>
          {company && (
            <div>
              <Octicon icon="briefcase" />
              <span>{company}</span>
            </div>
          )}
          {membersWithRole && (
            <div>
              <Octicon icon="organization" />
              <span>{membersWithRole.totalCount} members</span>
            </div>
          )}
          <div>
            <Octicon icon="repo" />
            <span>{repositories.totalCount} repositories</span>
          </div>
        </div>
        <div style={{ clear: "both" }} />
      </div>
    );
  }
}

export default BareUserMentionTooltipContainer;
