/** @babel */
/** @jsx React.createElement */
import React from "react";
import { Emitter } from "atom";
import createRefetchContainer from "../graphql/refetch";
import * as queries from "../graphql/queries";

import { PAGE_SIZE } from "../helpers";
import ReviewSummariesAccumulator from "./accumulators/review-summaries-accumulator";
import ReviewThreadsAccumulator from "./accumulators/review-threads-accumulator";

export class BareAggregatedReviewsContainer extends React.Component {
  constructor(props) {
    super(props);
    this.emitter = new Emitter();
  }

  render() {
    return (
      <ReviewSummariesAccumulator
        onDidRefetch={this.onDidRefetch}
        pullRequest={this.props.pullRequest}
      >
        {({ error: summaryError, summaries, loading: summariesLoading }) => {
          return (
            <ReviewThreadsAccumulator
              onDidRefetch={this.onDidRefetch}
              pullRequest={this.props.pullRequest}
            >
              {(payload) => {
                const result = {
                  errors: [],
                  refetch: this.refetch,
                  summaries,
                  commentThreads: payload.commentThreads,
                  loading: payload.loading || summariesLoading,
                };

                if (summaryError) {
                  result.errors.push(summaryError);
                }
                result.errors.push(...payload.errors);

                return this.props.children(result);
              }}
            </ReviewThreadsAccumulator>
          );
        }}
      </ReviewSummariesAccumulator>
    );
  }

  refetch = (callback) =>
    this.props.relay.refetch(
      {
        prId: this.props.pullRequest.id,
        reviewCount: PAGE_SIZE,
        reviewCursor: null,
        threadCount: PAGE_SIZE,
        threadCursor: null,
        commentCount: PAGE_SIZE,
        commentCursor: null,
      },
      null,
      (err) => {
        if (err) {
          this.props.reportRelayError("Unable to refresh reviews", err);
        } else {
          this.emitter.emit("did-refetch");
        }
        callback();
      },
      { force: true },
    );

  onDidRefetch = (callback) => this.emitter.on("did-refetch", callback);
}

export default createRefetchContainer(
  BareAggregatedReviewsContainer,
  {
    pullRequest: null,
  },
  queries.aggregatedReviewsContainerRefetchQuery,
);
