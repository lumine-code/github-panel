/** @babel */
/** @jsx h */
import View, { h } from "../etch/view";
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
export default class IssueishBadge extends View {
  constructor(props, children) {
    super(props, children);
    this.initialize();
  }
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
        <Octicon icon={icon} environment={this.props.environment} />
        {state.toLowerCase()}
      </span>
    );
  }
}
