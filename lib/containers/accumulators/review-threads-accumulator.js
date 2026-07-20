/** @babel */
/** @jsx React.createElement */
import React from "react";
import createPaginationContainer from "../../graphql/pagination";
import * as queries from "../../graphql/queries";

import { PAGE_SIZE, PAGINATION_WAIT_TIME_MS } from "../../helpers";
import Accumulator from "./accumulator";
import ReviewCommentsAccumulator from "./review-comments-accumulator";

export class BareReviewThreadsAccumulator extends React.Component {
  render() {
    const resultBatch = this.props.pullRequest.reviewThreads.edges.map((edge) => edge.node);
    return (
      <Accumulator
        relay={this.props.relay}
        resultBatch={resultBatch}
        onDidRefetch={this.props.onDidRefetch}
        pageSize={PAGE_SIZE}
        waitTimeMs={PAGINATION_WAIT_TIME_MS}
      >
        {this.renderReviewThreads}
      </Accumulator>
    );
  }

  renderReviewThreads = (err, threads, loading) => {
    if (err) {
      return this.props.children({
        errors: [err],
        commentThreads: [],
        loading,
      });
    }

    return this.renderReviewThread({ errors: [], commentsByThread: new Map(), loading }, threads);
  };

  renderReviewThread = (payload, threads) => {
    if (threads.length === 0) {
      const commentThreads = [];
      payload.commentsByThread.forEach((comments, thread) => {
        commentThreads.push({ thread, comments });
      });
      return this.props.children({
        commentThreads,
        errors: payload.errors,
        loading: payload.loading,
      });
    }

    const [thread] = threads;
    return (
      <ReviewCommentsAccumulator onDidRefetch={this.props.onDidRefetch} reviewThread={thread}>
        {({ error, comments, loading: threadLoading }) => {
          if (error) {
            payload.errors.push(error);
          }
          payload.commentsByThread.set(thread, comments);
          payload.loading = payload.loading || threadLoading;
          return this.renderReviewThread(payload, threads.slice(1));
        }}
      </ReviewCommentsAccumulator>
    );
  };
}

export default createPaginationContainer(
  BareReviewThreadsAccumulator,
  {
    pullRequest: null,
  },
  {
    direction: "forward",
    /* istanbul ignore next */
    getConnectionFromProps(props) {
      return props.pullRequest.reviewThreads;
    },
    /* istanbul ignore next */
    getFragmentVariables(prevVars, totalCount) {
      return { ...prevVars, totalCount };
    },
    /* istanbul ignore next */
    getVariables(props, { count, cursor }, fragmentVariables) {
      return {
        url: props.pullRequest.url,
        threadCount: count,
        threadCursor: cursor,
        commentCount: fragmentVariables.commentCount,
      };
    },
    query: queries.reviewThreadsAccumulatorQuery,
  },
);
