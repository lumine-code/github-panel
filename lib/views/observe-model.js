/** @babel */
/** @jsx h */
import { provideEnvironment } from "../graphql/environment.js";
import View, { h } from "../etch/view.js";
import ModelObserver from "../models/model-observer.js";
export default class ObserveModel extends View {
  static defaultProps = {
    fetchParams: [],
  };
  constructor(props, context) {
    super(props, context);
    this.state = {
      data: null,
    };
    this.hasAcceptedData = false;
    this.initialRevision = 0;
    this.syncInitialLoad(this.props.environment?.initialLoad);
    this.modelObserver = new ModelObserver({
      fetchData: this.fetchData,
      didUpdate: this.publishModelData,
      didSettle: this.settleInitialLoad,
    });
    this.initialize();
  }
  didMount() {
    this.mounted = true;
    this.modelObserver.setActiveModel(this.props.model);
    if (!this.props.model) this.settleInitialLoad(null);
  }
  update(props = {}, children) {
    const trackerChanged = this.syncInitialLoad(props.environment?.initialLoad);
    const nextParams = props.fetchParams || [];
    const paramsChanged =
      this.props.fetchParams.length !== nextParams.length ||
      this.props.fetchParams.some((value, index) => value !== nextParams[index]);
    const modelChanged = this.props.model !== props.model;
    if (modelChanged || paramsChanged) {
      this.hasAcceptedData = false;
      this.initialRevision++;
      this.retainInitialLoad();
    }
    const result = super.update(props, children);
    if (trackerChanged && !modelChanged && !paramsChanged && this.hasAcceptedData) {
      const hold = this.initialHold;
      const revision = this.initialRevision;
      result.then(
        () => {
          if (!this.destroyed && revision === this.initialRevision) this.releaseInitialLoad(hold);
        },
        () => {},
      );
    }
    return result;
  }
  didUpdate(prevProps) {
    this.modelObserver.setActiveModel(this.props.model);
    if (!this.props.model && !this.hasAcceptedData) this.settleInitialLoad(null);
    if (
      (!this.modelObserver.hasPendingUpdate() &&
        prevProps.fetchParams.length !== this.props.fetchParams.length) ||
      prevProps.fetchParams.some((prevParam, i) => prevParam !== this.props.fetchParams[i])
    ) {
      this.modelObserver.refreshModelData();
    }
  }
  fetchData = (model) => {
    this.initialRevision++;
    this.retainInitialLoad();
    return this.props.fetchData(model, ...this.props.fetchParams);
  };
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
  releaseInitialLoad(hold, error = null) {
    if (!hold || hold !== this.initialHold) return;
    this.initialHold = null;
    if (error) this.initialLoad?.fail(error);
    hold.dispose();
  }
  settleInitialLoad = (model, error = null) => {
    if (this.destroyed || model !== this.modelObserver.getActiveModel()) return;
    const initialError = error && !this.hasAcceptedData ? error : null;
    if (!error) this.hasAcceptedData = true;
    const hold = this.initialHold;
    if (!hold) return;
    const tracker = this.initialLoad;
    const revision = this.initialRevision;
    this.invalidate().then(
      () => {
        if (
          !this.destroyed &&
          tracker === this.initialLoad &&
          revision === this.initialRevision &&
          model === this.modelObserver.getActiveModel()
        )
          this.releaseInitialLoad(hold, initialError);
      },
      () => {},
    );
  };
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
    this.releaseInitialLoad(this.initialHold);
  }
}
