/** @babel */
/** @jsx React.createElement */
import React from "react";
import createPaginationContainer from "../../graphql/pagination";
import * as queries from "../../graphql/queries";

import { PAGE_SIZE, PAGINATION_WAIT_TIME_MS } from "../../helpers";
import Accumulator from "./accumulator";

export class BareCheckRunsAccumulator extends React.Component {
  render() {
    const resultBatch = this.props.checkSuite.checkRuns.edges.map((edge) => edge.node);

    return (
      <Accumulator
        relay={this.props.relay}
        resultBatch={resultBatch}
        onDidRefetch={this.props.onDidRefetch}
        pageSize={PAGE_SIZE}
        waitTimeMs={PAGINATION_WAIT_TIME_MS}
      >
        {(error, checkRuns, loading) => this.props.children({ error, checkRuns, loading })}
      </Accumulator>
    );
  }
}

export default createPaginationContainer(
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
      return { ...prevVars, totalCount };
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
