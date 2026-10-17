/** @babel */
/** @jsx h */
import View, { h } from "../etch/view.js";
import GraphQLQuery from "../graphql/query.js";
import * as queries from "../graphql/queries.js";
import { Disposable } from "lumine";
import { autobind, CHECK_SUITE_PAGE_SIZE, CHECK_RUN_PAGE_SIZE } from "../helpers.js";
import IssueishListController, {
  BareIssueishListController,
} from "../controllers/issueish-list-controller.js";
import { createEnvironment } from "../graphql/environment.js";
export default class IssueishSearchContainer extends View {
  static defaultProps = {
    limit: 20,
  };
  constructor(props, children) {
    super(props, children);
    autobind(this, "renderQueryResult");
    this.sub = new Disposable();
    this.initialize();
  }
  render() {
    const environment = createEnvironment(
      this.props.endpoint,
      this.props.token,
      this.props.environment,
    );
    if (this.props.search.isNull()) {
      this.registerRefresh(null);
      return (
        <BareIssueishListController
          isLoading={false}
          {...this.controllerProps()}
          environment={this.props.environment}
        />
      );
    }
    const query = queries.issueishSearchContainerQuery;
    const variables = {
      query: this.props.search.createQuery(),
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
  renderQueryResult({ error, props, retry }) {
    this.registerRefresh(retry);
    if (error) {
      return (
        <BareIssueishListController
          isLoading={false}
          error={error}
          {...this.controllerProps()}
          environment={this.props.environment}
        />
      );
    }
    if (props === null) {
      return (
        <BareIssueishListController
          isLoading={true}
          {...this.controllerProps()}
          environment={this.props.environment}
        />
      );
    }
    return (
      <IssueishListController
        total={props.search.issueCount}
        results={props.search.nodes}
        isLoading={false}
        {...this.controllerProps()}
        environment={this.props.environment}
      />
    );
  }
  willDestroy() {
    this.sub.dispose();
    this.refresher?.deregister(this);
  }
  registerRefresh(retry) {
    if (this.refresher !== this.props.refresher) this.refresher?.deregister(this);
    this.refresher = this.props.refresher;
    if (retry) this.refresher?.setRetryCallback(this, retry);
    else this.refresher?.deregister(this);
  }
  controllerProps() {
    return {
      title: this.props.search.getName(),
      onOpenIssueish: this.props.onOpenIssueish,
      onOpenReviews: this.props.onOpenReviews,
      onOpenMore: () => this.props.onOpenSearch(this.props.search),
    };
  }
}
