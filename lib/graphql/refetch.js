/** @babel */
/** @jsx h */
import View, { h } from "../etch/view";
import GraphQLRequest, { sameEnvironment } from "./request";
export default function createRefetchView(Component, fragmentSpec, query) {
  const keys = Object.keys(fragmentSpec);
  const declared = new Set([...query.matchAll(/\$(\w+)\s*:/g)].map((match) => match[1]));
  return class RefetchView extends View {
    constructor(props, children) {
      super(props, children);
      this.state = {
        data: Object.fromEntries(keys.map((key) => [key, props[key]])),
      };
      this.request = new GraphQLRequest();
      this.initialize();
    }
    update(props, children) {
      if (
        keys.some((key) => this.props[key] !== props[key]) ||
        !sameEnvironment(this.props.environment, props.environment)
      ) {
        this.request.cancel();
        this.state = { data: Object.fromEntries(keys.map((key) => [key, props[key]])) };
      }
      return super.update(props, children);
    }
    willDestroy() {
      this.request.destroy();
    }
    relay = {
      refetch: (changes, _renderVariables, callback) => {
        const environment = this.props.environment;
        const merged = {
          ...environment.variables,
          ...changes,
        };
        const variables = Object.fromEntries(
          Object.entries(merged).filter(([key]) => declared.has(key)),
        );
        return this.request.run(environment, query, variables, (error, payload) => {
          if (error) {
            callback?.(error);
            return;
          }
          const data =
            keys.length === 1
              ? {
                  [keys[0]]: payload[keys[0]] ?? payload[Object.keys(payload)[0]],
                }
              : Object.fromEntries(keys.map((key) => [key, payload[key]]));
          this.updateState(
            {
              data,
            },
            () => callback?.(),
          );
        });
      },
    };
    render() {
      return (
        <Component
          {...this.props}
          {...this.state.data}
          relay={this.relay}
          environment={this.props.environment}
        />
      );
    }
  };
}
