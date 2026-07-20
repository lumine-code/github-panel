/** @babel */
/** @jsx React.createElement */
import React from "react";
import createPaginationContainer from "../../graphql/pagination";
import * as queries from "../../graphql/queries";
import { Disposable } from "atom";

import { PAGE_SIZE, PAGINATION_WAIT_TIME_MS } from "../../helpers";
import CheckRunsAccumulator from "./check-runs-accumulator";
import Accumulator from "./accumulator";

export class BareCheckSuitesAccumulator extends React.Component {
  static defaultProps = {
    onDidRefetch: /* istanbul ignore next */ () => new Disposable(),
  };

  render() {
    const resultBatch = this.props.commit.checkSuites.edges.map((edge) => edge.node);

    return (
      <Accumulator
        relay={this.props.relay}
        resultBatch={resultBatch}
        onDidRefetch={this.props.onDidRefetch}
        pageSize={PAGE_SIZE}
        waitTimeMs={PAGINATION_WAIT_TIME_MS}
      >
        {this.renderCheckSuites}
      </Accumulator>
    );
  }

  renderCheckSuites = (err, suites, loading) => {
    if (err) {
      return this.props.children({
        errors: [err],
        suites,
        runsBySuite: new Map(),
        loading,
      });
    }

    return this.renderCheckSuite({ errors: [], suites, runsBySuite: new Map(), loading }, suites);
  };

  renderCheckSuite(payload, suites) {
    if (suites.length === 0) {
      return this.props.children(payload);
    }

    const [suite] = suites;
    return (
      <CheckRunsAccumulator onDidRefetch={this.props.onDidRefetch} checkSuite={suite}>
        {({ error, checkRuns, loading: runsLoading }) => {
          if (error) {
            payload.errors.push(error);
          }

          payload.runsBySuite.set(suite, checkRuns);
          payload.loading = payload.loading || runsLoading;
          return this.renderCheckSuite(payload, suites.slice(1));
        }}
      </CheckRunsAccumulator>
    );
  }
}

export default createPaginationContainer(
  BareCheckSuitesAccumulator,
  {
    commit: null,
  },
  {
    direction: "forward",
    /* istanbul ignore next */
    getConnectionFromProps(props) {
      return props.commit.checkSuites;
    },
    /* istanbul ignore next */
    getFragmentVariables(prevVars, totalCount) {
      return { ...prevVars, totalCount };
    },
    /* istanbul ignore next */
    getVariables(props, { count, cursor }, fragmentVariables) {
      return {
        id: props.commit.id,
        checkSuiteCount: count,
        checkSuiteCursor: cursor,
        checkRunCount: fragmentVariables.checkRunCount,
      };
    },
    query: queries.checkSuitesAccumulatorQuery,
  },
);
