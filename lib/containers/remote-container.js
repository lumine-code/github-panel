/** @babel */
/** @jsx React.createElement */
import React from "react";
import GraphQLQuery from "../graphql/query";
import * as queries from "../graphql/queries";

import { createEnvironment } from "../graphql/environment";
import RemoteController from "../controllers/remote-controller";
import LoadingView from "../views/loading-view";
import QueryErrorView from "../views/query-error-view";

export default class RemoteContainer extends React.Component {
  render() {
    const environment = createEnvironment(this.props.endpoint, this.props.token);
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
    this.props.refresher.setRetryCallback(this, retry);

    if (error) {
      return (
        <QueryErrorView
          error={error}
          login={this.props.handleLogin}
          logout={this.props.handleLogout}
          retry={retry}
        />
      );
    }

    if (props === null) {
      return <LoadingView />;
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
      />
    );
  };
}
