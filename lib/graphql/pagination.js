/** @babel */
/** @jsx h */
import View, { h } from "../etch/view";
import { Disposable } from "lumine";
import GraphQLRequest, { replaceConnection, sameEnvironment } from "./request";
export default function createPaginationView(Component, fragmentSpec, config) {
  const fragmentKey = Object.keys(fragmentSpec)[0];
  return class PaginationView extends View {
    constructor(props, children) {
      super(props, children);
      this.state = {
        data: props[fragmentKey],
        loading: false,
      };
      this.request = new GraphQLRequest();
      this.initialize();
    }
    update(props, children) {
      if (
        this.props[fragmentKey] !== props[fragmentKey] ||
        !sameEnvironment(this.props.environment, props.environment)
      ) {
        this.request.cancel();
        this.state = { data: props[fragmentKey], loading: false };
      }
      return super.update(props, children);
    }
    willDestroy() {
      this.request.destroy();
    }
    configProps() {
      return {
        ...this.props,
        [fragmentKey]: this.state.data,
      };
    }
    getConnection() {
      return config.getConnectionFromProps(this.configProps());
    }
    relay = {
      hasMore: () => Boolean(this.getConnection()?.pageInfo?.hasNextPage),
      isLoading: () => this.state.loading,
      loadMore: (count, callback) => {
        if (this.destroyed || this.state.loading || !this.relay.hasMore()) return new Disposable();
        const connection = this.getConnection();
        const environment = this.props.environment;
        const variables = config.getVariables(
          this.configProps(),
          {
            count,
            cursor: connection.pageInfo.endCursor,
          },
          environment.variables || {},
        );
        this.updateState({
          loading: true,
        });
        const subscription = this.request.run(
          environment,
          config.query,
          variables,
          (error, payload) => {
            if (error) {
              this.updateState(
                {
                  loading: false,
                },
                () => callback?.(error),
              );
              return;
            }
            const nextConnection = config.getConnectionFromProps({
              ...this.props,
              [fragmentKey]: payload[fragmentKey] ?? payload[Object.keys(payload)[0]],
            });
            const seen = new Set(connection.edges.map((edge) => edge.node?.id ?? edge.cursor));
            const edges = [...connection.edges];
            for (const edge of nextConnection?.edges || []) {
              const id = edge.node?.id ?? edge.cursor;
              if (!seen.has(id)) {
                seen.add(id);
                edges.push(edge);
              }
            }
            const replacement = {
              ...connection,
              edges,
              pageInfo: nextConnection?.pageInfo || {
                hasNextPage: false,
                endCursor: null,
              },
            };
            this.updateState(
              {
                data: replaceConnection(this.state.data, connection, replacement),
                loading: false,
              },
              () => callback?.(null),
            );
          },
        );
        return new Disposable(() => {
          subscription.dispose();
          if (!this.destroyed && this.state.loading)
            this.updateState({
              loading: false,
            });
        });
      },
    };
    render() {
      return (
        <Component
          {...this.props}
          {...{
            [fragmentKey]: this.state.data,
          }}
          relay={this.relay}
          environment={this.props.environment}
        />
      );
    }
  };
}
