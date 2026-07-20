/** @babel */
/** @jsx React.createElement */
import React from "react";
import { Disposable } from "atom";

import { executeQuery } from "./client";
import EnvironmentContext from "./environment-context";

// Replaces Relay's createPaginationContainer for the accumulator pattern (load
// every page of a connection). Keeps the same call shape —
// createPaginationContainer(Component, fragmentSpec, config) — so migrating a
// container only means swapping the import and pointing `config.query` at the
// extracted query text. It seeds the connection from the initial fragment prop,
// then on loadMore re-issues the pagination query (config.getVariables) and
// appends the new edges, exposing the `relay` object Accumulator drives.
export default function createPaginationContainer(Component, fragmentSpec, config) {
  const fragmentKey = Object.keys(fragmentSpec)[0];
  const queryText = typeof config.query === "string" ? config.query : config.query.params.text;

  return class PaginationContainer extends React.Component {
    static contextType = EnvironmentContext;

    constructor(props) {
      super(props);
      this.state = { data: props[fragmentKey], loading: false };
      this.mounted = false;
    }

    componentDidMount() {
      this.mounted = true;
    }

    componentDidUpdate(prevProps) {
      if (prevProps[fragmentKey] !== this.props[fragmentKey]) {
        this.setState({ data: this.props[fragmentKey] });
      }
    }

    componentWillUnmount() {
      this.mounted = false;
    }

    configProps() {
      return { ...this.props, [fragmentKey]: this.state.data };
    }

    getConnection() {
      return config.getConnectionFromProps(this.configProps());
    }

    relay = {
      hasMore: () => {
        const connection = this.getConnection();
        return Boolean(connection && connection.pageInfo && connection.pageInfo.hasNextPage);
      },
      isLoading: () => this.state.loading,
      loadMore: (count, callback) => {
        if (this.state.loading || !this.relay.hasMore()) {
          if (callback) callback(null);
          return new Disposable();
        }

        const connection = this.getConnection();
        const variables = config.getVariables(this.configProps(), {
          count,
          cursor: connection.pageInfo.endCursor,
        });

        this.setState({ loading: true });
        let disposed = false;
        executeQuery(this.context.endpoint, this.context.token, {
          query: queryText,
          variables,
        }).then(
          (payload) => {
            if (disposed || !this.mounted) return;
            // The pagination query returns the fragment data under a single root
            // field (e.g. `resource`/`node`); reuse getConnectionFromProps to
            // locate the new connection regardless of that field's name.
            const rootKey = Object.keys(payload.data)[0];
            const nextConnection = config.getConnectionFromProps({
              ...this.props,
              [fragmentKey]: payload.data[rootKey],
            });
            const existing = this.getConnection();
            existing.edges = existing.edges.concat(nextConnection ? nextConnection.edges : []);
            existing.pageInfo = nextConnection
              ? nextConnection.pageInfo
              : { hasNextPage: false, endCursor: null };
            this.setState({ data: { ...this.state.data }, loading: false }, () => {
              if (callback) callback(null);
            });
          },
          (error) => {
            if (disposed || !this.mounted) return;
            this.setState({ loading: false }, () => {
              if (callback) callback(error);
            });
          },
        );

        return new Disposable(() => {
          disposed = true;
        });
      },
    };

    render() {
      return (
        <Component {...this.props} {...{ [fragmentKey]: this.state.data }} relay={this.relay} />
      );
    }
  };
}
