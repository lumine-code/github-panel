/** @babel */
/** @jsx h */
import View, { h } from "../etch/view";
import { resolveQuery } from "../helpers";
import GraphQLQuery from "../graphql/query";
import * as queries from "../graphql/queries";
import { PAGE_SIZE, CHECK_SUITE_PAGE_SIZE, CHECK_RUN_PAGE_SIZE } from "../helpers";
import { createEnvironment } from "../graphql/environment";
import { UNAUTHENTICATED, INSUFFICIENT } from "../shared/token-status";
import GithubLoginView from "../views/github-login-view";
import LoadingView from "../views/loading-view";
import QueryErrorView from "../views/query-error-view";
import ErrorView from "../views/error-view";
import ObserveModel from "../views/observe-model";
import AggregatedReviewsContainer from "./aggregated-reviews-container";
import IssueishDetailController from "../controllers/issueish-detail-controller";
export default class IssueishDetailContainer extends View {
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
  renderWithToken = (tokenData) => {
    const token = tokenData && tokenData.token;
    if (token instanceof Error) {
      return (
        <QueryErrorView
          error={token}
          login={this.handleLogin}
          retry={this.handleTokenRetry}
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
      <ObserveModel
        model={this.props.repository}
        fetchData={this.fetchRepositoryData}
        children={(repoData) => this.renderWithRepositoryData(token, repoData)}
        environment={this.props.environment}
      />
    );
  };
  renderWithRepositoryData(token, repoData) {
    if (!token) {
      return <LoadingView environment={this.props.environment} />;
    }
    const environment = createEnvironment(this.props.endpoint, token);
    const query = queries.issueishDetailContainerQuery;
    const variables = {
      repoOwner: this.props.owner,
      repoName: this.props.repo,
      issueishNumber: this.props.issueishNumber,
      timelineCount: PAGE_SIZE,
      timelineCursor: null,
      commitCount: PAGE_SIZE,
      commitCursor: null,
      reviewCount: PAGE_SIZE,
      reviewCursor: null,
      threadCount: PAGE_SIZE,
      threadCursor: null,
      commentCount: PAGE_SIZE,
      commentCursor: null,
      checkSuiteCount: CHECK_SUITE_PAGE_SIZE,
      checkSuiteCursor: null,
      checkRunCount: CHECK_RUN_PAGE_SIZE,
      checkRunCursor: null,
    };
    return (
      <GraphQLQuery
        environment={environment}
        query={query}
        variables={variables}
        render={(queryResult) => this.renderWithQueryResult(token, repoData, queryResult)}
      />
    );
  }
  renderWithQueryResult(token, repoData, { error, props, retry }) {
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
    if (!props.repository?.issueish) {
      return (
        <ErrorView title={`Issue or pull request #${this.props.issueishNumber} was not found`} />
      );
    }
    if (props.repository.issueish.__typename === "PullRequest") {
      return (
        <AggregatedReviewsContainer
          pullRequest={props.repository.issueish}
          reportRelayError={this.props.reportRelayError}
          children={(aggregatedReviews) =>
            this.renderWithCommentResult(
              token,
              repoData,
              {
                props,
                retry,
              },
              aggregatedReviews,
            )
          }
          environment={this.props.environment}
        />
      );
    } else {
      return this.renderWithCommentResult(
        token,
        repoData,
        {
          props,
          retry,
        },
        {
          errors: [],
          commentThreads: [],
          loading: false,
        },
      );
    }
  }
  renderWithCommentResult(token, repoData, { props, retry }, { errors, commentThreads, loading }) {
    const nonEmptyThreads = commentThreads.filter(
      (each) => each.comments && each.comments.length > 0,
    );
    const totalCount = nonEmptyThreads.length;
    const resolvedCount = nonEmptyThreads.filter((each) => each.thread.isResolved).length;
    if (errors && errors.length > 0) {
      const descriptions = errors.map((error) => error.toString());
      return (
        <ErrorView
          title="Unable to fetch review comments"
          descriptions={descriptions}
          retry={retry}
          logout={this.handleLogout}
          environment={this.props.environment}
        />
      );
    }
    return (
      <IssueishDetailController
        {...props}
        {...repoData}
        reviewCommentsLoading={loading}
        reviewCommentsTotalCount={totalCount}
        reviewCommentsResolvedCount={resolvedCount}
        reviewCommentThreads={nonEmptyThreads}
        token={token}
        localRepository={this.props.repository}
        workdirPath={this.props.repository.getWorkingDirectoryPath()}
        issueishNumber={this.props.issueishNumber}
        onTitleChange={this.props.onTitleChange}
        switchToIssueish={this.props.switchToIssueish}
        initChangedFilePath={this.props.initChangedFilePath}
        initChangedFilePosition={this.props.initChangedFilePosition}
        selectedTab={this.props.selectedTab}
        onTabSelected={this.props.onTabSelected}
        onOpenFilesTab={this.props.onOpenFilesTab}
        endpoint={this.props.endpoint}
        reportRelayError={this.props.reportRelayError}
        workspace={this.props.workspace}
        commands={this.props.commands}
        keymaps={this.props.keymaps}
        tooltips={this.props.tooltips}
        config={this.props.config}
        itemType={this.props.itemType}
        destroy={this.props.destroy}
        refEditor={this.props.refEditor}
        environment={this.props.environment}
      />
    );
  }
  fetchToken = (loginModel) => {
    return resolveQuery({
      token: loginModel.getToken(this.props.endpoint.getLoginAccount()),
    });
  };
  fetchRepositoryData = (repository) => {
    return resolveQuery({
      branches: repository.getBranches(),
      remotes: repository.getRemotes(),
      isMerging: repository.isMerging(),
      isRebasing: repository.isRebasing(),
      isAbsent: repository.isAbsent(),
      isLoading: repository.isLoading(),
      isPresent: repository.isPresent(),
    });
  };
  handleLogin = (token) =>
    this.props.loginModel.setToken(this.props.endpoint.getLoginAccount(), token);
  handleLogout = () => this.props.loginModel.removeToken(this.props.endpoint.getLoginAccount());
  handleTokenRetry = () => this.props.loginModel.didUpdate();
}
