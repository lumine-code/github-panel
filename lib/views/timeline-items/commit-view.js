/** @babel */
/** @jsx h */
import View, { h } from "../../etch/view.js";
import Octicon from "../../lumine/octicon.js";
export class BareCommitView extends View {
  constructor(props, children) {
    super(props, children);
    this.initialize();
  }
  authoredByCommitter(commit) {
    if (commit.authoredByCommitter) {
      return true;
    }
    // If you commit on GitHub online the committer details would be:
    //
    //    name: "GitHub"
    //    email: "noreply@github.com"
    //    user: null
    //
    if (commit.committer.email === "noreply@github.com") {
      return true;
    }
    if (commit.committer.name === "GitHub" && commit.committer.user === null) {
      return true;
    }
    return false;
  }
  openCommitDetailItem = () =>
    this.props.openCommit({
      sha: this.props.commit.sha,
    });
  renderAvatar(author) {
    return (
      <span className="author-avatar">
        <img
          alt="author's avatar"
          src={author.avatarUrl || null}
          title={author.user ? author.user.login : author.name}
        />
      </span>
    );
  }
  render() {
    const commit = this.props.commit;
    return (
      <div className="commit">
        <Octicon
          className="pre-timeline-item-icon"
          icon="git-commit"
          environment={this.props.environment}
        />
        <span className="commit-author">
          {this.renderAvatar(commit.author)}
          {!this.authoredByCommitter(commit) && this.renderAvatar(commit.committer)}
        </span>
        <p className="commit-message-headline">
          {this.props.onBranch ? (
            <button
              className="open-commit-detail-button"
              title={commit.message}
              innerHTML={commit.messageHeadlineHTML}
              onClick={this.openCommitDetailItem}
            />
          ) : (
            <span title={commit.message} innerHTML={commit.messageHeadlineHTML} />
          )}
        </p>
        <a className="commit-sha" href={commit.commitUrl}>
          {commit.sha.slice(0, 8)}
        </a>
      </div>
    );
  }
}
export default BareCommitView;
