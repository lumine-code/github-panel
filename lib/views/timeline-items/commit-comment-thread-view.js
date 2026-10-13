/** @babel */
/** @jsx h */
import View, { h } from "../../etch/view.js";
import CommitCommentView from "./commit-comment-view.js";
export class BareCommitCommentThreadView extends View {
  constructor(props, children) {
    super(props, children);
    this.initialize();
  }
  render() {
    const { item } = this.props;
    return (
      <div className="commit-comment-thread timeline-item">
        {item.comments.edges.map((edge, i) => (
          <CommitCommentView
            isReply={i !== 0}
            key={edge.node.id}
            item={edge.node}
            switchToIssueish={this.props.switchToIssueish}
            environment={this.props.environment}
          />
        ))}
      </div>
    );
  }
}
export default BareCommitCommentThreadView;
