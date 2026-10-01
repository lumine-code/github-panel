/** @babel */
export default class ModelObserver {
  constructor({ fetchData, didUpdate }) {
    this.fetchData = fetchData || (() => {});
    this.didUpdate = didUpdate || (() => {});
    this.activeModel = null;
    this.activeModelData = null;
    this.activeModelUpdateSubscription = null;
    this.inProgress = false;
    this.pending = false;
    this.activeRefresh = null;
    this.destroyed = false;
  }

  setActiveModel(model) {
    if (this.destroyed) return null;
    if (model !== this.activeModel) {
      if (this.activeModelUpdateSubscription) {
        this.activeModelUpdateSubscription.dispose();
        this.activeModelUpdateSubscription = null;
      }
      this.activeModel = model;
      this.activeModelData = null;
      this.inProgress = false;
      this.pending = false;
      this.activeRefresh = null;
      this.didUpdate(model);
      if (model && (!model.isDestroyed || !model.isDestroyed())) {
        this.activeModelUpdateSubscription = model.onDidUpdate(() => this.refreshModelData(model));
        return this.refreshModelData(model);
      }
    }
    return null;
  }

  refreshModelData(model = this.activeModel) {
    if (this.destroyed || !model || model !== this.activeModel || model.isDestroyed?.())
      return null;
    if (this.inProgress) {
      this.pending = true;
      return null;
    }
    const refresh = {};
    this.activeRefresh = refresh;
    this.lastModelDataRefreshPromise = this._refreshModelData(model, refresh);
    return this.lastModelDataRefreshPromise;
  }

  async _refreshModelData(model, refresh) {
    try {
      this.inProgress = true;
      const fetchDataPromise = this.fetchData(model);
      this.lastFetchDataPromise = fetchDataPromise;
      const modelData = await fetchDataPromise;
      // Since we re-fetch immediately when the model changes,
      // we need to ensure a fetch for an old active model
      // does not trample the newer fetch for the newer active model.
      if (refresh === this.activeRefresh && !model.isDestroyed?.()) {
        this.activeModelData = modelData;
        this.didUpdate(model);
      }
    } catch (error) {
      if (refresh !== this.activeRefresh) return;
      if (
        model.isDestroyed?.() ||
        error?.code === "ERR_GIT_REPOSITORY_UNAVAILABLE" ||
        error?.code === "ERR_GIT_REPOSITORY_DESTROYED" ||
        error?.code === "ABORT_ERR" ||
        error?.name === "AbortError"
      ) {
        // Moving a repository can invalidate a read before the next model
        // update replaces it. Remove the old data until that update arrives.
        this.activeModelData = null;
        this.didUpdate(model);
      } else {
        console.error("GitHub panel model data refresh failed", error);
      }
    } finally {
      // An older model's completion must not drain the new model's queue.
      if (refresh === this.activeRefresh) {
        this.activeRefresh = null;
        this.inProgress = false;
        if (this.pending) {
          this.pending = false;
          this.refreshModelData();
        }
      }
    }
  }

  getActiveModel() {
    return this.activeModel;
  }

  getActiveModelData() {
    return this.activeModelData;
  }

  getLastModelDataRefreshPromise() {
    return this.lastModelDataRefreshPromise;
  }

  hasPendingUpdate() {
    return this.pending;
  }

  destroy() {
    this.destroyed = true;
    this.activeRefresh = null;
    this.inProgress = false;
    this.pending = false;
    if (this.activeModelUpdateSubscription) {
      this.activeModelUpdateSubscription.dispose();
      this.activeModelUpdateSubscription = null;
    }
  }
}
