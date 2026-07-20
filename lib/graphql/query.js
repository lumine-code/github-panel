/** @babel */
/** @jsx React.createElement */
import React from "react";

import { executeQuery } from "./client";
import EnvironmentContext from "./environment-context";

// A drop-in replacement for Relay's QueryRenderer. It runs a GraphQL operation
// and invokes `render({error, props, retry})` exactly as QueryRenderer did:
// `props` is the operation's `data` (null while loading), `error` is set on
// failure, and `retry` re-runs the operation. Because the extracted query texts
// inline every fragment, `props` carries the full data tree the former fragment
// containers read from. The `environment` prop is the `{endpoint, token}` value
// object from environment.js.
export default class GraphQLQuery extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, props: null };
    this.mounted = false;
    this.generation = 0;
  }

  componentDidMount() {
    this.mounted = true;
    this.load();
  }

  componentDidUpdate(prevProps) {
    const prevEnv = prevProps.environment || {};
    const env = this.props.environment || {};
    if (
      prevProps.query !== this.props.query ||
      prevEnv.endpoint !== env.endpoint ||
      prevEnv.token !== env.token ||
      !shallowEqual(prevProps.variables, this.props.variables)
    ) {
      this.setState({ error: null, props: null });
      this.load();
    }
  }

  componentWillUnmount() {
    this.mounted = false;
  }

  load() {
    const { endpoint, token } = this.props.environment;
    const generation = ++this.generation;
    executeQuery(endpoint, token, {
      query: this.props.query,
      variables: this.props.variables,
    }).then(
      (payload) => {
        if (this.mounted && generation === this.generation) {
          this.setState({ error: null, props: payload.data });
        }
      },
      (error) => {
        if (this.mounted && generation === this.generation) {
          this.setState({ error, props: null });
        }
      },
    );
  }

  retry = () => {
    this.setState({ error: null, props: null });
    this.load();
  };

  // Carry {endpoint, token, variables} down the tree. Nested refetch containers
  // merge these base variables so a refetch query still receives the counts
  // (e.g. checkSuiteCount/checkRunCount) the root query supplied — Relay used to
  // do that automatically. Memoized so the context identity only changes when an
  // input actually changes.
  getContextValue() {
    const env = this.props.environment || {};
    if (
      !this._contextValue ||
      this._contextValue.endpoint !== env.endpoint ||
      this._contextValue.token !== env.token ||
      this._contextValue.variables !== this.props.variables
    ) {
      this._contextValue = {
        endpoint: env.endpoint,
        token: env.token,
        variables: this.props.variables,
      };
    }
    return this._contextValue;
  }

  render() {
    return (
      <EnvironmentContext.Provider value={this.getContextValue()}>
        {this.props.render({
          error: this.state.error,
          props: this.state.props,
          retry: this.retry,
        })}
      </EnvironmentContext.Provider>
    );
  }
}

function shallowEqual(a, b) {
  if (a === b) return true;
  if (!a || !b) return a === b;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key) => a[key] === b[key]);
}
