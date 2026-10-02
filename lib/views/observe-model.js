/** @babel */
/** @jsx h */
import { provideEnvironment } from "../graphql/environment";
import View, { h } from "../etch/view";
import ModelObserver from "../models/model-observer";
export default class ObserveModel extends View {
  static defaultProps = {
    fetchParams: [],
  };
  constructor(props, context) {
    super(props, context);
    this.state = {
      data: null,
    };
    this.modelObserver = new ModelObserver({
      fetchData: this.fetchData,
      didUpdate: this.publishModelData,
    });
    this.initialize();
  }
  didMount() {
    this.mounted = true;
    this.modelObserver.setActiveModel(this.props.model);
  }
  didUpdate(prevProps) {
    this.modelObserver.setActiveModel(this.props.model);
    if (
      (!this.modelObserver.hasPendingUpdate() &&
        prevProps.fetchParams.length !== this.props.fetchParams.length) ||
      prevProps.fetchParams.some((prevParam, i) => prevParam !== this.props.fetchParams[i])
    ) {
      this.modelObserver.refreshModelData();
    }
  }
  fetchData = (model) => this.props.fetchData(model, ...this.props.fetchParams);
  publishModelData = () => {
    if (this.mounted) {
      const data = this.modelObserver.getActiveModelData();
      this.updateState({
        data,
      });
    }
  };
  render() {
    return (
      <span
        style={{
          display: "contents",
        }}
      >
        {provideEnvironment(this.props.children(this.state.data), this.props.environment)}
      </span>
    );
  }
  willDestroy() {
    this.mounted = false;
    this.modelObserver.destroy();
  }
}
