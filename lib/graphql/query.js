/** @babel */
/** @jsx h */
import View, { h } from "../etch/view";
import GraphQLRequest, { sameVariables, sameEnvironment } from "./request";
import { provideEnvironment } from "./environment";
export default class GraphQLQuery extends View {
  constructor(props, children) {
    super(props, children);
    this.state = {
      error: null,
      props: null,
    };
    this.request = new GraphQLRequest();
    this.initialize();
  }
  didMount() {
    this.load();
  }
  update(props, children) {
    const changed =
      this.props.query !== props.query ||
      !sameEnvironment(this.props.environment, props.environment) ||
      !sameVariables(this.props.variables, props.variables);
    if (changed) {
      this.request.cancel();
      this.state = { error: null, props: null };
    }
    const result = super.update(props, children);
    if (changed) this.load();
    return result;
  }
  willDestroy() {
    this.request.destroy();
  }
  load = () => {
    this.updateState({
      error: null,
      props: null,
    });
    this.request.run(
      this.props.environment,
      this.props.query,
      this.props.variables,
      (error, props) =>
        this.updateState({
          error,
          props,
        }),
    );
  };
  render() {
    const environment = {
      ...this.props.environment,
      variables: this.props.variables,
    };
    if (!sameEnvironment(this.environment, environment)) this.environment = environment;
    const node = this.props.render({
      ...this.state,
      retry: this.load,
    });
    return (
      <span
        style={{
          display: "contents",
        }}
      >
        {provideEnvironment(node, this.environment)}
      </span>
    );
  }
}
