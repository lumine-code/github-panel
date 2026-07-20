/** @babel */
/** @jsx React.createElement */
import React from "react";
import yubikiri from "yubikiri";
import { QueryRenderer } from "react-relay";

import { PAGE_SIZE } from "../helpers";
import { UNAUTHENTICATED, INSUFFICIENT } from "../shared/token-status";
import PullRequestPatchContainer from "./pr-patch-container";
import ObserveModel from "../views/observe-model";
import LoadingView from "../views/loading-view";
import GithubLoginView from "../views/github-login-view";
import ErrorView from "../views/error-view";
import QueryErrorView from "../views/query-error-view";
import RelayNetworkLayerManager from "../relay-network-layer-manager";
import RelayEnvironment from "../views/relay-environment";
import ReviewsController from "../controllers/reviews-controller";
import AggregatedReviewsContainer from "./aggregated-reviews-container";
import CommentPositioningContainer from "./comment-positioning-container";

export default class ReviewsContainer extends React.Component {
  render() {
    return (
      <ObserveModel model={this.props.loginModel} fetchData={this.fetchToken}>
        {this.renderWithToken}
      </ObserveModel>
    );
  }

  renderWithToken = (token) => {
    if (!token) {
      return <LoadingView />;
    }

    if (token instanceof Error) {
      return (
        <QueryErrorView
          error={token}
          retry={this.handleTokenRetry}
          login={this.handleLogin}
          logout={this.handleLogout}
        />
      );
    }

    if (token === UNAUTHENTICATED) {
      return <GithubLoginView onLogin={this.handleLogin} />;
    }

    if (token === INSUFFICIENT) {
      return (
        <GithubLoginView onLogin={this.handleLogin}>
          <p>
            Your token no longer has sufficient authorizations. Please re-authenticate and generate
            a new one.
          </p>
        </GithubLoginView>
      );
    }

    return (
      <PullRequestPatchContainer
        owner={this.props.owner}
        repo={this.props.repo}
        number={this.props.number}
        endpoint={this.props.endpoint}
        token={token}
        largeDiffThreshold={Infinity}
      >
        {(error, patch) => this.renderWithPatch(error, { token, patch })}
      </PullRequestPatchContainer>
    );
  };

  renderWithPatch(error, { token, patch }) {
    if (error) {
      return <ErrorView descriptions={[error]} />;
    }

    return (
      <ObserveModel model={this.props.repository} fetchData={this.fetchRepositoryData}>
        {(repoData) => this.renderWithRepositoryData(repoData, { token, patch })}
      </ObserveModel>
    );
  }

  renderWithRepositoryData(repoData, { token, patch }) {
    const environment = RelayNetworkLayerManager.getEnvironmentForHost(this.props.endpoint, token);
    const query = require("./__generated__/reviewsContainerQuery.graphql");
    const variables = {
      repoOwner: this.props.owner,
      repoName: this.props.repo,
      prNumber: this.props.number,
      reviewCount: PAGE_SIZE,
      reviewCursor: null,
      threadCount: PAGE_SIZE,
      threadCursor: null,
      commentCount: PAGE_SIZE,
      commentCursor: null,
    };

    return (
      <RelayEnvironment.Provider value={environment}>
        <QueryRenderer
          environment={environment}
          query={query}
          variables={variables}
          render={(queryResult) => this.renderWithQuery(queryResult, { repoData, patch })}
        />
      </RelayEnvironment.Provider>
    );
  }

  renderWithQuery({ error, props, retry }, { repoData, patch }) {
    if (error) {
      return (
        <QueryErrorView
          error={error}
          login={this.handleLogin}
          retry={retry}
          logout={this.handleLogout}
        />
      );
    }

    if (!props || !repoData || !patch) {
      return <LoadingView />;
    }

    return (
      <AggregatedReviewsContainer
        pullRequest={props.repository.pullRequest}
        reportRelayError={this.props.reportRelayError}
      >
        {({ errors, summaries, commentThreads, refetch }) => {
          if (errors && errors.length > 0) {
            return errors.map((err, i) => (
              <ErrorView key={`error-${i}`} title="Pagination error" descriptions={[err.stack]} />
            ));
          }
          const aggregationResult = { summaries, commentThreads, refetch };

          return this.renderWithResult({
            aggregationResult,
            queryProps: props,
            repoData,
            patch,
            refetch,
          });
        }}
      </AggregatedReviewsContainer>
    );
  }

  renderWithResult({ aggregationResult, queryProps, repoData, patch }) {
    return (
      <CommentPositioningContainer
        multiFilePatch={patch}
        {...aggregationResult}
        prCommitSha={queryProps.repository.pullRequest.headRefOid}
        localRepository={this.props.repository}
      >
        {(commentTranslations) => {
          return (
            <ReviewsController
              {...this.props}
              {...aggregationResult}
              commentTranslations={commentTranslations}
              localRepository={this.props.repository}
              multiFilePatch={patch}
              repository={queryProps.repository}
              pullRequest={queryProps.repository.pullRequest}
              viewer={queryProps.viewer}
              {...repoData}
            />
          );
        }}
      </CommentPositioningContainer>
    );
  }

  fetchToken = (loginModel) => loginModel.getToken(this.props.endpoint.getLoginAccount());

  fetchRepositoryData = (repository) => {
    return yubikiri({
      branches: repository.getBranches(),
      remotes: repository.getRemotes(),
      isAbsent: repository.isAbsent(),
      isLoading: repository.isLoading(),
      isPresent: repository.isPresent(),
      isMerging: repository.isMerging(),
      isRebasing: repository.isRebasing(),
    });
  };

  handleLogin = (token) =>
    this.props.loginModel.setToken(this.props.endpoint.getLoginAccount(), token);

  handleLogout = () => this.props.loginModel.removeToken(this.props.endpoint.getLoginAccount());

  handleTokenRetry = () => this.props.loginModel.didUpdate();
}
