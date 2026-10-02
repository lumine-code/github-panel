/** @babel */
/** @jsx h */
import View, { h } from "../etch/view";
import cx from "classnames";
import Octicon from "../lumine/octicon";
import { GHOST_USER } from "../helpers";
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
export class BareIssueishTooltipContainer extends View {
  constructor(props, children) {
    super(props, children);
    this.initialize();
  }
  render() {
    const resource = this.props.resource;
    const author = resource.author || GHOST_USER;
    const { repository, state, number, title, __typename } = resource;
    const icons = typeAndStateToIcon[__typename] || {};
    const icon = icons[state] || "";
    return (
      <div className="github-panel-IssueishTooltip">
        <div className="issueish-avatar-and-title">
          <img
            className="author-avatar"
            src={author.avatarUrl || null}
            title={author.login}
            alt={author.login}
          />
          <h3 className="issueish-title">{title}</h3>
        </div>
        <div className="issueish-badge-and-link">
          <span className={cx("issueish-badge", "badge", state.toLowerCase())}>
            <Octicon icon={icon} environment={this.props.environment} />
            {state.toLowerCase()}
          </span>
          <span className="issueish-link">
            {repository.owner.login}/{repository.name}#{number}
          </span>
        </div>
      </div>
    );
  }
}
export default BareIssueishTooltipContainer;
