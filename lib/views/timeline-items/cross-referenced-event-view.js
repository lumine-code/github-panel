/** @babel */
/** @jsx React.createElement */
import React from "react";

import Octicon from "../../atom/octicon";
import IssueishBadge from "../../views/issueish-badge";
import IssueishLink from "../../views/issueish-link";

export class BareCrossReferencedEventView extends React.Component {
  render() {
    const xref = this.props.item;
    const repo = xref.source.repository;
    const repoLabel = `${repo.owner.login}/${repo.name}`;
    return (
      <div className="cross-referenced-event">
        <div className="cross-referenced-event-label">
          <span className="cross-referenced-event-label-title">{xref.source.title}</span>
          <IssueishLink url={xref.source.url} className="cross-referenced-event-label-number">
            {this.getIssueishNumberDisplay(xref)}
          </IssueishLink>
        </div>
        {repo.isPrivate ? (
          <div className="cross-referenced-event-private">
            <Octicon
              icon="lock"
              title={`Only people who can see ${repoLabel} will see this reference.`}
            />
          </div>
        ) : (
          ""
        )}
        <div className="cross-referenced-event-state">
          <IssueishBadge
            type={xref.source.__typename}
            state={xref.source.issueState || xref.source.prState}
          />
        </div>
      </div>
    );
  }

  getIssueishNumberDisplay(xref) {
    const { source } = xref;
    if (!xref.isCrossRepository) {
      return `#${source.number}`;
    } else {
      const { repository } = source;
      return `${repository.owner.login}/${repository.name}#${source.number}`;
    }
  }
}

export default BareCrossReferencedEventView;
