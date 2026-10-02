/** @babel */
/** @jsx h */
import View, { h } from "../etch/view";
import RefHolder from "../models/ref-holder";
import GitHubTabContainer from "../containers/github-tab-container";
import LoadingView from "../views/loading-view";
import ErrorView from "../views/error-view";
import { location, allowedLocations } from "./dock-item-location";
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
    this.initialize();
  }
  getTitle() {
    return "GitHub";
  }
  getIconName() {
    return "octoface";
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
    if (this.props.repositoryObservationError) {
      return <ErrorView descriptions={[this.props.repositoryObservationError.message]} />;
    }
    if (!this.props.repositoryIsReady) return <LoadingView />;
    return (
      <GitHubTabContainer
        {...this.props}
        rootHolder={this.rootHolder}
        environment={this.props.environment}
      />
    );
  }
  hasFocus() {
    return this.rootHolder
      .map((root) => root.contains(this.props.documentActiveElement()))
      .getOr(false);
  }
  restoreFocus() {
    // No-op
  }
}
