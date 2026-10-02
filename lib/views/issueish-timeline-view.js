/** @babel */
/** @jsx h */
import View, { h } from "../etch/view";
import { autobind } from "../helpers";
import Octicon from "../lumine/octicon";
import CommitsView from "./timeline-items/commits-view.js";
import IssueCommentView from "./timeline-items/issue-comment-view.js";
import MergedEventView from "./timeline-items/merged-event-view.js";
import HeadRefForcePushedEventView from "./timeline-items/head-ref-force-pushed-event-view.js";
import CrossReferencedEventsView from "./timeline-items/cross-referenced-events-view.js";
import CommitCommentThreadView from "./timeline-items/commit-comment-thread-view";
export function collectionRenderer(Component, styleAsTimelineItem = true) {
  return class GroupedComponent extends View {
    static displayName = `Grouped(${Component.render ? Component.render.displayName : Component.displayName})`;
    static getFragment(fragName, ...args) {
      const frag = fragName === "nodes" ? "item" : fragName;
      return Component.getFragment(frag, ...args);
    }
    constructor(props, children) {
      super(props, children);
      autobind(this, "renderNode");
      this.initialize();
    }
    render() {
      return (
        <div className={styleAsTimelineItem ? "timeline-item" : ""}>
          {this.props.nodes.map(this.renderNode)}
        </div>
      );
    }
    renderNode(node, i) {
      return (
        <Component
          key={i}
          item={node}
          issueish={this.props.issueish}
          switchToIssueish={this.props.switchToIssueish}
          environment={this.props.environment}
        />
      );
    }
  };
}
const timelineItems = {
  PullRequestCommit: CommitsView,
  PullRequestCommitCommentThread: collectionRenderer(CommitCommentThreadView, false),
  IssueComment: collectionRenderer(IssueCommentView, false),
  MergedEvent: collectionRenderer(MergedEventView),
  HeadRefForcePushedEvent: collectionRenderer(HeadRefForcePushedEventView),
  CrossReferencedEvent: CrossReferencedEventsView,
};
export default class IssueishTimelineView extends View {
  static defaultProps = {
    onBranch: false,
    openCommit: () => {},
  };
  constructor(props, children) {
    super(props, children);
    autobind(this, "loadMore");
    this.initialize();
  }
  loadMore() {
    this.props.relay.loadMore(10, () => {
      this.invalidate();
    });
    this.invalidate();
  }
  render() {
    const issueish = this.props.issue || this.props.pullRequest;
    const groupedEdges = this.groupEdges(issueish.timelineItems.edges);
    return (
      <div className="github-panel-PrTimeline">
        {groupedEdges.map(({ type, edges }) => {
          const Component = timelineItems[type];
          const propsForCommits = {
            onBranch: this.props.onBranch,
            openCommit: this.props.openCommit,
          };
          if (Component) {
            return (
              <Component
                key={`${type}-${edges[0].cursor}`}
                nodes={edges.map((e) => e.node)}
                issueish={issueish}
                switchToIssueish={this.props.switchToIssueish}
                {...(Component === CommitsView && propsForCommits)}
                environment={this.props.environment}
              />
            );
          } else {
            // GitHub returns every timeline event type (labels, milestones,
            // mentions, subscriptions, assignments, …); like upstream we only
            // render the handful above and quietly skip the rest.
            return null;
          }
        })}
        {this.renderLoadMore()}
      </div>
    );
  }
  renderLoadMore() {
    if (!this.props.relay.hasMore()) {
      return null;
    }
    return (
      <div className="github-panel-PrTimeline-loadMore">
        <button className="github-panel-PrTimeline-loadMoreButton btn" onClick={this.loadMore}>
          {this.props.relay.isLoading() ? (
            <Octicon icon="ellipsis" environment={this.props.environment} />
          ) : (
            "Load More"
          )}
        </button>
      </div>
    );
  }
  groupEdges(edges) {
    let currentGroup;
    const groupedEdges = [];
    let lastEdgeType;
    edges.forEach(({ node, cursor }) => {
      const currentEdgeType = node.__typename;
      if (currentEdgeType === lastEdgeType) {
        currentGroup.edges.push({
          node,
          cursor,
        });
      } else {
        currentGroup = {
          type: currentEdgeType,
          edges: [
            {
              node,
              cursor,
            },
          ],
        };
        groupedEdges.push(currentGroup);
      }
      lastEdgeType = currentEdgeType;
    });
    return groupedEdges;
  }
}
