/** @babel */
/** @jsx h */
import View, { h } from "../etch/view.js";
import RefHolder from "../models/ref-holder.js";
import GitHubTabContainer from "../containers/github-tab-container.js";
import LoadingView from "../views/loading-view.js";
import ErrorView from "../views/error-view.js";
import InitialLoad from "../models/initial-load.js";
import dockItemLocation from "./dock-item-location.js";
const { location, allowedLocations } = dockItemLocation;
export default class GitHubTabItem extends View {
  static defaultProps = {
    repositoryIsReady: true,
    documentActiveElement: /* istanbul ignore next */ () => document.activeElement,
  };
  static uriPattern = "lumine-github://dock-item/github";
  static buildURI() {
    return this.uriPattern;
  }
  getURI() {
    return this.constructor.uriPattern;
  }
  constructor(props, children) {
    super(props, children);
    this.rootHolder = new RefHolder();
    this.resetInitialLoad();
    this.initialize();
  }
  resetInitialLoad() {
    this.initialLoad?.dispose();
    this.initialLoad = new InitialLoad({ onChange: () => this.invalidate() });
    this.initialLoadHold = this.initialLoad.retain();
  }
  retryInitialLoad = () => {
    this.resetInitialLoad();
    this.invalidate();
  };
  update(props, children) {
    const wasReady = this.props.repositoryIsReady && !this.props.startupContextPending;
    const isReady = (props.repositoryIsReady ?? true) && !props.startupContextPending;
    if (
      props.repository !== this.props.repository ||
      props.currentWorkDir !== this.props.currentWorkDir ||
      props.loginModel !== this.props.loginModel ||
      (wasReady && !isReady) ||
      (this.props.repositoryObservationError && !props.repositoryObservationError)
    ) {
      this.resetInitialLoad();
    }
    return super.update(props, children);
  }
  didMount() {
    this.releaseInitialContext();
  }
  didUpdate() {
    this.releaseInitialContext();
  }
  releaseInitialContext() {
    if (
      this.props.repositoryObservationError ||
      (this.props.repositoryIsReady && !this.props.startupContextPending)
    ) {
      this.initialLoadHold?.dispose();
      this.initialLoadHold = null;
    }
  }
  willDestroy() {
    this.initialLoad.dispose();
  }
  getTitle() {
    return "GitHub";
  }
  getIconName() {
    return "mark-github";
  }
  getDefaultLocation() {
    return location;
  }
  getAllowedLocations() {
    return allowedLocations;
  }
  getPreferredWidth() {
    return 400;
  }
  getWorkingDirectory() {
    return this.props.repository.getWorkingDirectoryPath();
  }
  serialize() {
    return {
      deserializer: "GithubDockItem",
      uri: this.getURI(),
    };
  }
  render() {
    const error = this.props.repositoryObservationError || this.initialLoad.error;
    const loading = !error && !this.initialLoad.ready;
    const canReadRepository = this.props.repositoryIsReady && !this.props.startupContextPending;
    const environment = { ...this.props.environment, initialLoad: this.initialLoad };
    return (
      <div className="github-panel-GitHubTabItem" attributes={{ "aria-busy": String(loading) }}>
        {loading && (
          <div
            key="loading"
            className="github-panel-GitHubTabItem-loading"
            attributes={{ role: "status", "aria-label": "Loading GitHub…" }}
          >
            <LoadingView />
          </div>
        )}
        <div key="content" className="github-panel-GitHubTabItem-content" hidden={loading}>
          {error ? (
            <ErrorView
              descriptions={[error.message]}
              retry={this.initialLoad.error ? this.retryInitialLoad : null}
            />
          ) : canReadRepository ? (
            <GitHubTabContainer
              {...this.props}
              rootHolder={this.rootHolder}
              environment={environment}
            />
          ) : null}
        </div>
      </div>
    );
  }
  hasFocus() {
    return this.element.contains(this.props.documentActiveElement());
  }
  restoreFocus() {
    // No-op
  }
}
