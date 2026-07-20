/** @babel */
/** @jsx React.createElement */
import React from "react";
import dayjs from "dayjs";
import createPaginationContainer from "../../graphql/pagination";
import * as queries from "../../graphql/queries";

import { PAGE_SIZE, PAGINATION_WAIT_TIME_MS } from "../../helpers";
import Accumulator from "./accumulator";

export class BareReviewSummariesAccumulator extends React.Component {
  render() {
    const resultBatch = this.props.pullRequest.reviews.edges.map((edge) => edge.node);

    return (
      <Accumulator
        relay={this.props.relay}
        resultBatch={resultBatch}
        onDidRefetch={this.props.onDidRefetch}
        pageSize={PAGE_SIZE}
        waitTimeMs={PAGINATION_WAIT_TIME_MS}
      >
        {(error, results, loading) => {
          const summaries = results.sort((a, b) => dayjs(a.submittedAt) - dayjs(b.submittedAt));
          return this.props.children({ error, summaries, loading });
        }}
      </Accumulator>
    );
  }
}

export default createPaginationContainer(
  BareReviewSummariesAccumulator,
  {
    pullRequest: null,
  },
  {
    direction: "forward",
    /* istanbul ignore next */
    getConnectionFromProps(props) {
      return props.pullRequest.reviews;
    },
    /* istanbul ignore next */
    getFragmentVariables(prevVars, totalCount) {
      return { ...prevVars, totalCount };
    },
    /* istanbul ignore next */
    getVariables(props, { count, cursor }) {
      return {
        url: props.pullRequest.url,
        reviewCount: count,
        reviewCursor: cursor,
      };
    },
    query: queries.reviewSummariesAccumulatorQuery,
  },
);
