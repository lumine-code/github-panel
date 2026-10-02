/** @babel */
/** @jsx h */
import View, { h } from "../etch/view";
import GithubLoginView from "./github-login-view";
import ErrorView from "./error-view";
import OfflineView from "./offline-view";
export default class QueryErrorView extends View {
  constructor(props, children) {
    super(props, children);
    this.initialize();
  }
  render() {
    const e = this.props.error;
    if (e.response) {
      switch (e.response.status) {
        case 401:
          return (
            <span
              style={{
                display: "contents",
              }}
            >
              {this.render401()}
            </span>
          );
        case 200:
          // Do the default
          break;
        default:
          return (
            <span
              style={{
                display: "contents",
              }}
            >
              {this.renderUnknown(e.response, e.responseText)}
            </span>
          );
      }
    }
    if (e.errors) {
      return (
        <span
          style={{
            display: "contents",
          }}
        >
          {this.renderGraphQLErrors(e.errors)}
        </span>
      );
    }
    if (e.network) {
      return (
        <span
          style={{
            display: "contents",
          }}
        >
          {this.renderNetworkError()}
        </span>
      );
    }
    return (
      <ErrorView
        title={e.message}
        descriptions={[e.stack]}
        preformatted={true}
        {...this.errorViewProps()}
        environment={this.props.environment}
      />
    );
  }
  renderGraphQLErrors(errors) {
    return (
      <ErrorView
        title="Query errors reported"
        descriptions={errors.map((e) => e.message)}
        {...this.errorViewProps()}
        environment={this.props.environment}
      />
    );
  }
  renderNetworkError() {
    return <OfflineView retry={this.props.retry} environment={this.props.environment} />;
  }
  render401() {
    return (
      <div className="github-panel-GithubLoginView-Container">
        <GithubLoginView onLogin={this.props.login} environment={this.props.environment}>
          <p>
            The API endpoint returned a unauthorized error. Please try to re-authenticate with the
            endpoint.
          </p>
        </GithubLoginView>
      </div>
    );
  }
  renderUnknown(response, text) {
    return (
      <ErrorView
        title={`Received an error response: ${response.status}`}
        descriptions={[text]}
        preformatted={true}
        {...this.errorViewProps()}
        environment={this.props.environment}
      />
    );
  }
  errorViewProps() {
    return {
      retry: this.props.retry,
      logout: this.props.logout,
    };
  }
}
