/** @babel */
/** @jsx h */
import { provideEnvironment } from "../../graphql/environment.js";
import View, { h } from "../../etch/view.js";
import createPaginationView from "../../graphql/pagination.js";
import * as queries from "../../graphql/queries.js";
import { PAGE_SIZE, PAGINATION_WAIT_TIME_MS } from "../../helpers.js";
import Accumulator from "./accumulator.js";
export class BareReviewCommentsAccumulator extends View {
  constructor(props, children) {
    super(props, children);
    this.initialize();
  }
  render() {
    const resultBatch = this.props.reviewThread.comments.edges.map((edge) => edge.node);
    return (
      <Accumulator
        relay={this.props.relay}
        resultBatch={resultBatch}
        onDidRefetch={this.props.onDidRefetch}
        pageSize={PAGE_SIZE}
        waitTimeMs={PAGINATION_WAIT_TIME_MS}
        children={(error, comments, loading) =>
          provideEnvironment(
            this.props.children({
              error,
              comments,
              loading,
            }),
            this.props.environment,
          )
        }
        environment={this.props.environment}
      />
    );
  }
}
export default createPaginationView(
  BareReviewCommentsAccumulator,
  {
    reviewThread: null,
  },
  {
    direction: "forward",
    /* istanbul ignore next */
    getConnectionFromProps(props) {
      return props.reviewThread.comments;
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
        id: props.reviewThread.id,
        commentCount: count,
        commentCursor: cursor,
      };
    },
    query: queries.reviewCommentsAccumulatorQuery,
  },
);
