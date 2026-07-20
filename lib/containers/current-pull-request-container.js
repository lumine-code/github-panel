/** @babel */
/** @jsx React.createElement */
import React from "react";
import GraphQLQuery from "../graphql/query";
import * as queries from "../graphql/queries";
import { Disposable } from "atom";

import { autobind, CHECK_SUITE_PAGE_SIZE, CHECK_RUN_PAGE_SIZE } from "../helpers";
import IssueishListController, {
  BareIssueishListController,
} from "../controllers/issueish-list-controller";
import CreatePullRequestTile from "../views/create-pull-request-tile";
import { createEnvironment } from "../graphql/environment";

export default class CurrentPullRequestContainer extends React.Component {
  static defaultProps = {
    limit: 5,
  };

  constructor(props) {
    super(props);
    autobind(this, "renderQueryResult", "renderEmptyTile");

    this.sub = new Disposable();
  }

  render() {
    const environment = createEnvironment(this.props.endpoint, this.props.token);

    const head = this.props.branches.getHeadBranch();
    if (!head.isPresent()) {
      return this.renderEmptyResult();
    }
    const push = head.getPush();
    if (!push.isPresent() || !push.isRemoteTracking()) {
      return this.renderEmptyResult();
    }
    const pushRemote = this.props.remotes.withName(push.getRemoteName());
    if (!pushRemote.isPresent() || !pushRemote.isGithubRepo()) {
      return this.renderEmptyResult();
    }

    const query = queries.currentPullRequestContainerQuery;
    const variables = {
      headOwner: pushRemote.getOwner(),
      headName: pushRemote.getRepo(),
      headRef: push.getRemoteRef(),
      first: this.props.limit,
      checkSuiteCount: CHECK_SUITE_PAGE_SIZE,
      checkSuiteCursor: null,
      checkRunCount: CHECK_RUN_PAGE_SIZE,
      checkRunCursor: null,
    };

    return (
      <GraphQLQuery
        environment={environment}
        variables={variables}
        query={query}
        render={this.renderQueryResult}
      />
    );
  }

  renderEmptyResult() {
    return <BareIssueishListController isLoading={false} {...this.controllerProps()} />;
  }

  renderQueryResult({ error, props }) {
    if (error) {
      return (
        <BareIssueishListController isLoading={false} error={error} {...this.controllerProps()} />
      );
    }

    if (props === null) {
      return <BareIssueishListController isLoading={true} {...this.controllerProps()} />;
    }

    if (!props.repository || !props.repository.ref) {
      return <BareIssueishListController isLoading={false} {...this.controllerProps()} />;
    }

    const associatedPullRequests = props.repository.ref.associatedPullRequests;

    return (
      <IssueishListController
        total={associatedPullRequests.totalCount}
        results={associatedPullRequests.nodes}
        isLoading={false}
        endpoint={this.props.endpoint}
        resultFilter={(issueish) => issueish.getHeadRepositoryID() === this.props.repository.id}
        {...this.controllerProps()}
      />
    );
  }

  renderEmptyTile() {
    return (
      <CreatePullRequestTile
        repository={this.props.repository}
        remote={this.props.remote}
        branches={this.props.branches}
        aheadCount={this.props.aheadCount}
        pushInProgress={this.props.pushInProgress}
        onCreatePr={this.props.onCreatePr}
      />
    );
  }

  componentWillUnmount() {
    this.sub.dispose();
  }

  controllerProps() {
    return {
      title: "Checked out pull request",
      onOpenIssueish: this.props.onOpenIssueish,
      onOpenReviews: this.props.onOpenReviews,
      emptyComponent: this.renderEmptyTile,
      needReviewsButton: true,
    };
  }
}
