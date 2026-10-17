/** @babel */
/** @jsx h */
import View, { h } from "../etch/view.js";
import GraphQLRequest, { sameVariables, sameEnvironment } from "./request.js";
import { provideEnvironment } from "./environment.js";
export default class GraphQLQuery extends View {
  constructor(props, children) {
    super(props, children);
    this.state = {
      error: null,
      props: null,
    };
    this.request = new GraphQLRequest();
    this.hasAcceptedResult = false;
    this.loadRevision = 0;
    this.syncInitialLoad(this.props.environment?.initialLoad);
    this.initialize();
  }
  didMount() {
    this.load();
  }
  update(props, children) {
    const trackerChanged = this.syncInitialLoad(props.environment?.initialLoad);
    const changed =
      this.props.query !== props.query ||
      !sameEnvironment(this.props.environment, props.environment) ||
      !sameVariables(this.props.variables, props.variables);
    if (changed) {
      this.retainInitialLoad();
      this.request.cancel();
      this.state = { error: null, props: null };
      this.hasAcceptedResult = false;
    }
    const result = super.update(props, children);
    if (changed) this.load();
    else if (trackerChanged && this.hasAcceptedResult) {
      const hold = this.initialHold;
      const revision = this.loadRevision;
      result.then(
        () => {
          if (!this.destroyed && revision === this.loadRevision) this.releaseInitialLoad(hold);
        },
        () => {},
      );
    }
    return result;
  }
  willDestroy() {
    this.request.destroy();
    this.releaseInitialLoad(this.initialHold);
  }
  retainInitialLoad() {
    if (!this.initialHold && this.initialLoad && !this.initialLoad.ready)
      this.initialHold = this.initialLoad.retain();
  }
  syncInitialLoad(tracker) {
    if (tracker === this.initialLoad) return false;
    const previous = this.initialHold;
    this.initialLoad = tracker;
    this.initialHold = tracker?.retain() || null;
    previous?.dispose();
    return true;
  }
  releaseInitialLoad(hold) {
    if (!hold || hold !== this.initialHold) return;
    this.initialHold = null;
    hold.dispose();
  }
  load = () => {
    const revision = ++this.loadRevision;
    this.retainInitialLoad();
    if (!this.initialLoad?.ready || this.state.props === null) {
      this.updateState({
        error: null,
        props: null,
      });
    }
    this.request.run(
      this.props.environment,
      this.props.query,
      this.props.variables,
      (error, props) => {
        this.hasAcceptedResult = true;
        const hold = this.initialHold;
        this.updateState({
          error,
          props,
        }).then(
          () => {
            if (!this.destroyed && revision === this.loadRevision) this.releaseInitialLoad(hold);
          },
          () => {},
        );
      },
    );
  };
  render() {
    const environment = {
      ...this.props.environment,
      variables: this.props.variables,
    };
    if (
      !sameEnvironment(this.environment, environment) ||
      this.environment?.initialLoad !== environment.initialLoad
    )
      this.environment = environment;
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
