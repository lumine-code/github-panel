/** @babel */
/** @jsx h */
import View, { h, Fragment } from "../../etch/view";
import Octicon from "../../lumine/octicon";
import Timeago from "../../views/timeago";
export class BareMergedEventView extends View {
  constructor(props, children) {
    super(props, children);
    this.initialize();
  }
  render() {
    const { actor, mergeRefName, createdAt } = this.props.item;
    return (
      <div className="merged-event">
        <Octicon
          className="pre-timeline-item-icon"
          icon="git-merge"
          environment={this.props.environment}
        />
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
          <Timeago time={createdAt} environment={this.props.environment} />
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
