/** @babel */
/** @jsx h */
import View, { h } from "../etch/view";
import Octicon from "../lumine/octicon";
export class BareUserMentionTooltipContainer extends View {
  constructor(props, children) {
    super(props, children);
    this.initialize();
  }
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
            <Octicon icon="mention" environment={this.props.environment} />
            <strong>{login}</strong>
          </div>
          {company && (
            <div>
              <Octicon icon="briefcase" environment={this.props.environment} />
              <span>{company}</span>
            </div>
          )}
          {membersWithRole && (
            <div>
              <Octicon icon="organization" environment={this.props.environment} />
              <span>{membersWithRole.totalCount} members</span>
            </div>
          )}
          <div>
            <Octicon icon="repo" environment={this.props.environment} />
            <span>{repositories.totalCount} repositories</span>
          </div>
        </div>
        <div
          style={{
            clear: "both",
          }}
        />
      </div>
    );
  }
}
export default BareUserMentionTooltipContainer;
