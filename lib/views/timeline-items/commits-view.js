/** @babel */
/** @jsx React.createElement */
import React from "react";

import Octicon from "../../atom/octicon";
import CommitView from "./commit-view";

export class BareCommitsView extends React.Component {
  render() {
    return (
      <div className="timeline-item commits">
        {this.renderSummary()}
        {this.renderCommits()}
      </div>
    );
  }

  renderSummary() {
    if (this.props.nodes.length > 1) {
      const namesString = this.calculateNames(this.getCommits());
      return (
        <div className="info-row">
          <Octicon className="pre-timeline-item-icon" icon="repo-push" />
          <span className="comment-message-header">{namesString} added some commits...</span>
        </div>
      );
    } else {
      return null;
    }
  }

  renderCommits() {
    return this.getCommits().map((commit) => {
      return (
        <CommitView
          key={commit.id}
          commit={commit}
          onBranch={this.props.onBranch}
          openCommit={this.props.openCommit}
        />
      );
    });
  }

  getCommits() {
    return this.props.nodes.map((n) => n.commit);
  }

  calculateNames(commits) {
    let names = new Set();
    commits.forEach((commit) => {
      let name = null;
      if (commit.author.user) {
        name = commit.author.user.login;
      } else if (commit.author.name) {
        name = commit.author.name;
      }

      if (name && !names.has(name)) {
        names.add(name);
      }
    });

    names = Array.from(names);
    if (names.length === 1) {
      return names[0];
    } else if (names.length === 2) {
      return `${names[0]} and ${names[1]}`;
    } else if (names.length > 2) {
      return `${names[0]}, ${names[1]}, and others`;
    } else {
      return "Someone";
    }
  }
}

export default BareCommitsView;
