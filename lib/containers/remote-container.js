/** @babel */
/** @jsx h */
import View, { h } from "../etch/view.js";
import GraphQLQuery from "../graphql/query.js";
import * as queries from "../graphql/queries.js";
import { createEnvironment } from "../graphql/environment.js";
import RemoteController from "../controllers/remote-controller.js";
import LoadingView from "../views/loading-view.js";
import QueryErrorView from "../views/query-error-view.js";
export default class RemoteContainer extends View {
  constructor(props, children) {
    super(props, children);
    this.initialize();
  }
  render() {
    const environment = createEnvironment(
      this.props.endpoint,
      this.props.token,
      this.props.environment,
    );
    const query = queries.remoteContainerQuery;
    const variables = {
      owner: this.props.remote.getOwner(),
      name: this.props.remote.getRepo(),
    };
    return (
      <GraphQLQuery
        environment={environment}
        variables={variables}
        query={query}
        render={this.renderWithResult}
      />
    );
  }
  renderWithResult = ({ error, props, retry }) => {
    this.registerRefresh(retry);
    if (error) {
      return (
        <QueryErrorView
          error={error}
          login={this.props.handleLogin}
          logout={this.props.handleLogout}
          retry={retry}
          environment={this.props.environment}
        />
      );
    }
    if (props === null) {
      return <LoadingView environment={this.props.environment} />;
    }
    return (
      <RemoteController
        endpoint={this.props.endpoint}
        token={this.props.token}
        repository={props.repository}
        workingDirectory={this.props.workingDirectory}
        workspace={this.props.workspace}
        remote={this.props.remote}
        remotes={this.props.remotes}
        branches={this.props.branches}
        aheadCount={this.props.aheadCount}
        pushInProgress={this.props.pushInProgress}
        onPushBranch={this.props.onPushBranch}
        refresher={this.props.refresher}
        environment={this.props.environment}
      />
    );
  };
  registerRefresh(retry) {
    if (this.refresher !== this.props.refresher) this.refresher?.deregister(this);
    this.refresher = this.props.refresher;
    if (retry) this.refresher?.setRetryCallback(this, retry);
    else this.refresher?.deregister(this);
  }
  willDestroy() {
    this.refresher?.deregister(this);
  }
}
