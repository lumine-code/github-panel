/** @babel */
/** @jsx h */
import { provideEnvironment } from "../../graphql/environment";
import View, { h } from "../../etch/view";
import createPaginationView from "../../graphql/pagination";
import * as queries from "../../graphql/queries";
import { PAGE_SIZE, PAGINATION_WAIT_TIME_MS } from "../../helpers";
import Accumulator from "./accumulator";
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
