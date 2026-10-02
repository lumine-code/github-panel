/** @babel */
/** @jsx h */
import View, { h } from "../../etch/view";
import Octicon from "../../lumine/octicon";
import Timeago from "../timeago";
import GithubDotcomMarkdown from "../github-dotcom-markdown";
import { GHOST_USER } from "../../helpers";
export class BareCommitCommentView extends View {
  constructor(props, children) {
    super(props, children);
    this.initialize();
  }
  render() {
    const comment = this.props.item;
    const author = comment.author || GHOST_USER;
    return (
      <div className="issue">
        <div className="info-row">
          {this.props.isReply ? null : (
            <Octicon
              className="pre-timeline-item-icon"
              icon="comment"
              environment={this.props.environment}
            />
          )}
          <img
            className="author-avatar"
            src={author.avatarUrl || null}
            alt={author.login}
            title={author.login}
          />
          {this.renderHeader(comment, author)}
        </div>
        <GithubDotcomMarkdown
          html={comment.bodyHTML}
          switchToIssueish={this.props.switchToIssueish}
          environment={this.props.environment}
        />
      </div>
    );
  }
  renderHeader(comment, author) {
    if (this.props.isReply) {
      return (
        <span className="comment-message-header">
          {author.login} replied{" "}
          <Timeago time={comment.createdAt} environment={this.props.environment} />
        </span>
      );
    } else {
      return (
        <span className="comment-message-header">
          {author.login} commented {this.renderPath()} in {comment.commit.oid.substr(0, 7)}{" "}
          <Timeago time={comment.createdAt} environment={this.props.environment} />
        </span>
      );
    }
  }
  renderPath() {
    if (this.props.item.path) {
      return (
        <span>
          on <code>{this.props.item.path}</code>
        </span>
      );
    } else {
      return null;
    }
  }
}
export default BareCommitCommentView;
