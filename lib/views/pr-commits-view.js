/** @babel */
/** @jsx React.createElement */
import React, { Fragment } from "react";
import createPaginationContainer from "../graphql/pagination";
import * as queries from "../graphql/queries";
import PrCommitView from "./pr-commit-view";

import { autobind, PAGE_SIZE } from "../helpers";

export class PrCommitsView extends React.Component {
  constructor(props) {
    super(props);
    autobind(this, "loadMore");
  }

  loadMore() {
    this.props.relay.loadMore(PAGE_SIZE, () => {
      this.forceUpdate();
    });
    this.forceUpdate();
  }

  render() {
    return (
      <Fragment>
        <div className="github-panel-PrCommitsView-commitWrapper">{this.renderCommits()}</div>
        {this.renderLoadMore()}
      </Fragment>
    );
  }

  renderLoadMore() {
    if (!this.props.relay.hasMore()) {
      return null;
    }
    return (
      <button className="github-panel-PrCommitsView-load-more-button btn" onClick={this.loadMore}>
        Load more
      </button>
    );
  }

  renderCommits() {
    return this.props.pullRequest.commits.edges.map((edge) => {
      const commit = edge.node.commit;
      return (
        <PrCommitView
          key={commit.id}
          item={commit}
          onBranch={this.props.onBranch}
          openCommit={this.props.openCommit}
        />
      );
    });
  }
}

export default createPaginationContainer(
  PrCommitsView,
  {
    pullRequest: null,
  },
  {
    direction: "forward",
    getConnectionFromProps(props) {
      return props.pullRequest.commits;
    },
    getFragmentVariables(prevVars, totalCount) {
      return {
        ...prevVars,
        commitCount: totalCount,
      };
    },
    getVariables(props, { count, cursor }, fragmentVariables) {
      return {
        commitCount: count,
        commitCursor: cursor,
        url: props.pullRequest.url,
      };
    },
    query: queries.prCommitsViewQuery,
  },
);
