/** @babel */
import React from "react";

import { executeQuery } from "./client";

// A drop-in replacement for Relay's QueryRenderer. It runs a GraphQL operation
// and invokes `render({error, props, retry})` exactly as QueryRenderer did:
// `props` is the operation's `data` (null while loading), `error` is set on
// failure, and `retry` re-runs the operation. Because the extracted query texts
// inline every fragment, `props` carries the full data tree the former fragment
// containers read from.
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
    if (
      prevProps.query !== this.props.query ||
      prevProps.endpoint !== this.props.endpoint ||
      prevProps.token !== this.props.token ||
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
    const generation = ++this.generation;
    executeQuery(this.props.endpoint, this.props.token, {
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

  render() {
    return this.props.render({
      error: this.state.error,
      props: this.state.props,
      retry: this.retry,
    });
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
