/** @babel */
/** @jsx React.createElement */
import React from "react";
import { Disposable } from "atom";

import { executeQuery } from "./client";
import EnvironmentContext from "./environment-context";

// Replaces Relay's createRefetchContainer. Keeps the same call shape —
// createRefetchContainer(Component, fragmentSpec, refetchQuery) — so migrating a
// container only means swapping the import and pointing the refetch query at the
// extracted text. It seeds the fragment data from props, then `relay.refetch`
// re-issues the query with new variables and replaces that data.
export default function createRefetchContainer(Component, fragmentSpec, refetchQuery) {
  const fragmentKey = Object.keys(fragmentSpec)[0];
  const queryText = typeof refetchQuery === "string" ? refetchQuery : refetchQuery.params.text;

  return class RefetchContainer extends React.Component {
    static contextType = EnvironmentContext;

    constructor(props) {
      super(props);
      this.state = { data: props[fragmentKey] };
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

    relay = {
      refetch: (refetchVariables, _renderVariables, callback) => {
        executeQuery(this.context.endpoint, this.context.token, {
          query: queryText,
          variables: refetchVariables,
        }).then(
          (payload) => {
            if (!this.mounted) return;
            const rootKey = Object.keys(payload.data)[0];
            this.setState({ data: payload.data[rootKey] }, () => {
              if (callback) callback();
            });
          },
          (error) => {
            if (!this.mounted) return;
            if (callback) callback(error);
          },
        );
        return new Disposable();
      },
    };

    render() {
      return (
        <Component {...this.props} {...{ [fragmentKey]: this.state.data }} relay={this.relay} />
      );
    }
  };
}
