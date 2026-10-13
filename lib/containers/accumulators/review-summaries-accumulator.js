/** @babel */
/** @jsx h */
import { provideEnvironment } from "../../graphql/environment.js";
import View, { h } from "../../etch/view.js";
import dayjs from "dayjs";
import createPaginationView from "../../graphql/pagination.js";
import * as queries from "../../graphql/queries.js";
import { PAGE_SIZE, PAGINATION_WAIT_TIME_MS } from "../../helpers.js";
import Accumulator from "./accumulator.js";
export class BareReviewSummariesAccumulator extends View {
  constructor(props, children) {
    super(props, children);
    this.initialize();
  }
  render() {
    const resultBatch = this.props.pullRequest.reviews.edges.map((edge) => edge.node);
    return (
      <Accumulator
        relay={this.props.relay}
        resultBatch={resultBatch}
        onDidRefetch={this.props.onDidRefetch}
        pageSize={PAGE_SIZE}
        waitTimeMs={PAGINATION_WAIT_TIME_MS}
        children={(error, results, loading) => {
          const summaries = results.sort((a, b) => dayjs(a.submittedAt) - dayjs(b.submittedAt));
          return provideEnvironment(
            this.props.children({
              error,
              summaries,
              loading,
            }),
            this.props.environment,
          );
        }}
        environment={this.props.environment}
      />
    );
  }
}
export default createPaginationView(
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
      return {
        ...prevVars,
        totalCount,
      };
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
