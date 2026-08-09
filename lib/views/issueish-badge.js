/** @babel */
/** @jsx React.createElement */
import React from "react";
import cx from "classnames";

import Octicon from "../lumine/octicon";

const typeAndStateToIcon = {
  Issue: {
    OPEN: "issue-opened",
    CLOSED: "issue-closed",
  },
  PullRequest: {
    OPEN: "git-pull-request",
    CLOSED: "git-pull-request",
    MERGED: "git-merge",
  },
};

export default class IssueishBadge extends React.Component {
  render() {
    const { type, state, ...others } = this.props;
    const icons = typeAndStateToIcon[type] || {};
    const icon = icons[state] || "question";

    const { className, ...otherProps } = others;
    return (
      <span
        className={cx(className, "github-panel-IssueishBadge", state.toLowerCase())}
        {...otherProps}
      >
        <Octicon icon={icon} />
        {state.toLowerCase()}
      </span>
    );
  }
}
