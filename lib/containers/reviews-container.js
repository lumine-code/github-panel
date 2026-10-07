/** @babel */
/** @jsx h */
import View, { h } from "../etch/view";
import { resolveQuery } from "../helpers";
import GraphQLQuery from "../graphql/query";
import * as queries from "../graphql/queries";
import { PAGE_SIZE } from "../helpers";
import { UNAUTHENTICATED, INSUFFICIENT } from "../shared/token-status";
import PullRequestPatchContainer from "./pr-patch-container";
import ObserveModel from "../views/observe-model";
import LoadingView from "../views/loading-view";
import GithubLoginView from "../views/github-login-view";
import ErrorView from "../views/error-view";
import QueryErrorView from "../views/query-error-view";
import { createEnvironment } from "../graphql/environment";
import ReviewsController from "../controllers/reviews-controller";
import AggregatedReviewsContainer from "./aggregated-reviews-container";
import CommentPositioningContainer from "./comment-positioning-container";
export default class ReviewsContainer extends View {
  constructor(props, children) {
    super(props, children);
    this.initialize();
  }
  render() {
    return (
      <ObserveModel
        model={this.props.loginModel}
        fetchData={this.fetchToken}
        children={this.renderWithToken}
        environment={this.props.environment}
      />
    );
  }
  renderWithToken = (token) => {
    if (!token) {
      return <LoadingView environment={this.props.environment} />;
    }
    if (token instanceof Error) {
      return (
        <QueryErrorView
          error={token}
          retry={this.handleTokenRetry}
          login={this.handleLogin}
          logout={this.handleLogout}
          environment={this.props.environment}
        />
      );
    }
    if (token === UNAUTHENTICATED) {
      return <GithubLoginView onLogin={this.handleLogin} environment={this.props.environment} />;
    }
    if (token === INSUFFICIENT) {
      return (
        <GithubLoginView onLogin={this.handleLogin} environment={this.props.environment}>
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
        children={(error, patch) =>
          this.renderWithPatch(error, {
            token,
            patch,
          })
        }
        environment={this.props.environment}
      />
    );
  };
  renderWithPatch(error, { token, patch }) {
    return (
      <span style={{ display: "contents" }}>
        {error && (
          <ErrorView key="diff-error" descriptions={[error]} environment={this.props.environment} />
        )}
        <ObserveModel
          key="review-data"
          model={this.props.repository}
          fetchData={this.fetchRepositoryData}
          children={(repoData) =>
            this.renderWithRepositoryData(repoData, {
              token,
              patch,
            })
          }
          environment={this.props.environment}
        />
      </span>
    );
  }
  renderWithRepositoryData(repoData, { token, patch }) {
    const environment = createEnvironment(this.props.endpoint, token);
    const query = queries.reviewsContainerQuery;
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
      <GraphQLQuery
        environment={environment}
        query={query}
        variables={variables}
        render={(queryResult) =>
          this.renderWithQuery(queryResult, {
            repoData,
            patch,
          })
        }
      />
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
          environment={this.props.environment}
        />
      );
    }
    if (!props || !repoData) {
      return <LoadingView environment={this.props.environment} />;
    }
    if (!props.repository?.pullRequest) {
      return <ErrorView title={`Pull request #${this.props.number} was not found`} />;
    }
    return (
      <AggregatedReviewsContainer
        pullRequest={props.repository.pullRequest}
        reportRelayError={this.props.reportRelayError}
        children={({ errors, summaries, commentThreads, refetch }) => {
          if (errors && errors.length > 0) {
            return errors.map((err, i) => (
              <ErrorView
                key={`error-${i}`}
                title="Pagination error"
                descriptions={[err.stack]}
                environment={this.props.environment}
              />
            ));
          }
          const aggregationResult = {
            summaries,
            commentThreads,
            refetch,
          };
          return this.renderWithResult({
            aggregationResult,
            queryProps: props,
            repoData,
            patch,
            refetch,
          });
        }}
        environment={this.props.environment}
      />
    );
  }
  renderWithResult({ aggregationResult, queryProps, repoData, patch }) {
    return (
      <CommentPositioningContainer
        multiFilePatch={patch}
        {...aggregationResult}
        prCommitSha={queryProps.repository.pullRequest.headRefOid}
        localRepository={this.props.repository}
        children={(commentTranslations) => {
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
              environment={this.props.environment}
            />
          );
        }}
        environment={this.props.environment}
      />
    );
  }
  fetchToken = (loginModel) => loginModel.getToken(this.props.endpoint.getLoginAccount());
  fetchRepositoryData = (repository) => {
    return resolveQuery({
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
