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
    const snapshot = this.readSnapshot();
    this.state = {
      data: snapshot?.data ?? null,
    };
    this.hasAcceptedData = Boolean(snapshot);
    this.seededInitialData = Boolean(snapshot);
    this.initialRevision = 0;
    this.syncInitialLoad(this.props.environment?.initialLoad, this.seededInitialData);
    this.modelObserver = new ModelObserver({
      fetchData: this.fetchData,
      didUpdate: this.publishModelData,
      didSettle: this.settleInitialLoad,
    });
    this.initialize();
  }
  didMount() {
    this.mounted = true;
    this.settingSeededModel = this.seededInitialData;
    this.modelObserver.setActiveModel(this.props.model);
    this.settingSeededModel = false;
    if (!this.props.model) this.settleInitialLoad(null);
  }
  update(props = {}, children) {
    const trackerChanged = this.syncInitialLoad(props.environment?.initialLoad);
    const nextParams = props.fetchParams || [];
    const paramsChanged =
      this.props.fetchParams.length !== nextParams.length ||
      this.props.fetchParams.some((value, index) => value !== nextParams[index]);
    const modelChanged = this.props.model !== props.model;
    if (trackerChanged || modelChanged || paramsChanged) this.seededInitialData = false;
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
    const cache = this.props.environment?.initialLoad?.presentationCache;
    this.snapshotRead = cache && {
      cache,
      revision: cache.revision,
      key: this.props.snapshotKey,
      model,
      params: [...this.props.fetchParams],
      cacheable: !model.isLoading?.() && !model.isDestroyed?.(),
    };
    return this.props.fetchData(model, ...this.props.fetchParams);
  };
  readSnapshot() {
    if (!this.props.snapshotKey) return null;
    return this.props.environment?.initialLoad?.presentationCache?.readModel(
      this.props.snapshotKey,
      this.props.model,
      this.props.fetchParams,
    );
  }
  retainInitialLoad() {
    if (!this.seededInitialData && !this.initialHold && this.initialLoad && !this.initialLoad.ready)
      this.initialHold = this.initialLoad.retain();
  }
  syncInitialLoad(tracker, hasSnapshot = false) {
    if (tracker === this.initialLoad) return false;
    const previous = this.initialHold;
    this.initialLoad = tracker;
    this.initialHold = !hasSnapshot ? tracker?.retain() || null : null;
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
      // Starting the observer emits null before its first refresh. The seed
      // already belongs to this model and stays visible during that refresh.
      if (data === null && this.settingSeededModel) return;
      const snapshot = this.snapshotRead;
      if (
        snapshot?.key &&
        snapshot.cacheable &&
        snapshot.model === this.props.model &&
        snapshot.cache === this.props.environment?.initialLoad?.presentationCache
      )
        snapshot.cache.writeModel(
          snapshot.key,
          snapshot.model,
          snapshot.params,
          data,
          snapshot.revision,
        );
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
