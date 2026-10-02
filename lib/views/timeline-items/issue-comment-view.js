/** @babel */
/** @jsx h */
import View, { h } from "../../etch/view";
import Octicon from "../../lumine/octicon";
import Timeago from "../timeago";
import GithubDotcomMarkdown from "../github-dotcom-markdown";
import { GHOST_USER } from "../../helpers";
export class BareIssueCommentView extends View {
  constructor(props, children) {
    super(props, children);
    this.initialize();
  }
  render() {
    const comment = this.props.item;
    const author = comment.author || GHOST_USER;
    return (
      <div className="issue timeline-item">
        <div className="info-row">
          <Octicon
            className="pre-timeline-item-icon"
            icon="comment"
            environment={this.props.environment}
          />
          <img
            className="author-avatar"
            src={author.avatarUrl || null}
            alt={author.login}
            title={author.login}
          />
          <span className="comment-message-header">
            {author.login} commented{" "}
            <a href={comment.url}>
              <Timeago time={comment.createdAt} environment={this.props.environment} />
            </a>
          </span>
        </div>
        <GithubDotcomMarkdown
          html={comment.bodyHTML}
          switchToIssueish={this.props.switchToIssueish}
          environment={this.props.environment}
        />
      </div>
    );
  }
}
export default BareIssueCommentView;
