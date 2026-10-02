/** @babel */
/** @jsx h */
import View, { h } from "../etch/view";
import GraphQLQuery from "../graphql/query";
import * as queries from "../graphql/queries";
import { Disposable } from "lumine";
import { autobind, CHECK_SUITE_PAGE_SIZE, CHECK_RUN_PAGE_SIZE } from "../helpers";
import IssueishListController, {
  BareIssueishListController,
} from "../controllers/issueish-list-controller";
import { createEnvironment } from "../graphql/environment";
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
    const environment = createEnvironment(this.props.endpoint, this.props.token);
    if (this.props.search.isNull()) {
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
  renderQueryResult({ error, props }) {
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
