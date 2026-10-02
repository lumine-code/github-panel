/** @babel */
/** @jsx h */
import { provideEnvironment } from "../../graphql/environment";
import View, { h } from "../../etch/view";
import createPaginationView from "../../graphql/pagination";
import * as queries from "../../graphql/queries";
import { PAGE_SIZE, PAGINATION_WAIT_TIME_MS } from "../../helpers";
import Accumulator from "./accumulator";
export class BareCheckRunsAccumulator extends View {
  constructor(props, children) {
    super(props, children);
    this.initialize();
  }
  render() {
    const resultBatch = this.props.checkSuite.checkRuns.edges.map((edge) => edge.node);
    return (
      <Accumulator
        relay={this.props.relay}
        resultBatch={resultBatch}
        onDidRefetch={this.props.onDidRefetch}
        pageSize={PAGE_SIZE}
        waitTimeMs={PAGINATION_WAIT_TIME_MS}
        children={(error, checkRuns, loading) =>
          provideEnvironment(
            this.props.children({
              error,
              checkRuns,
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
  BareCheckRunsAccumulator,
  {
    checkSuite: null,
  },
  {
    direction: "forward",
    /* istanbul ignore next */
    getConnectionFromProps(props) {
      return props.checkSuite.checkRuns;
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
        id: props.checkSuite.id,
        checkRunCount: count,
        checkRunCursor: cursor,
      };
    },
    query: queries.checkRunsAccumulatorQuery,
  },
);
