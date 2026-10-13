/** @babel */
/** @jsx h */
import View, { h } from "../etch/view.js";
import GraphQLQuery from "../graphql/query.js";
import * as queries from "../graphql/queries.js";
import CreateDialogController from "../controllers/create-dialog-controller.js";
import ObserveModel from "../views/observe-model.js";
import { PAGE_SIZE } from "../views/repository-home-selection-view.js";
import { createEnvironment } from "../graphql/environment.js";
import { getEndpoint } from "../models/endpoint.js";
const DOTCOM = getEndpoint("github.com");
export default class CreateDialogContainer extends View {
  constructor(props, children) {
    super(props, children);
    this.lastProps = null;
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
      return null;
    }
    const environment = createEnvironment(DOTCOM, token);
    const query = queries.createDialogContainerQuery;
    const variables = {
      organizationCount: PAGE_SIZE,
      organizationCursor: null,
      // Force QueryRenderer to re-render when dialog request state changes
      error: this.props.error,
      inProgress: this.props.inProgress,
    };
    return (
      <GraphQLQuery
        environment={environment}
        query={query}
        variables={variables}
        render={this.renderWithResult}
      />
    );
  };
  renderWithResult = ({ error, props }) => {
    if (error) {
      return this.renderError(error);
    }
    if (!props && !this.lastProps) {
      return this.renderLoading();
    }
    const currentProps = props || this.lastProps;
    return (
      <CreateDialogController
        user={currentProps.viewer}
        isLoading={false}
        {...this.props}
        environment={this.props.environment}
      />
    );
  };
  renderError(error) {
    return (
      <CreateDialogController
        user={null}
        error={error}
        isLoading={false}
        {...this.props}
        environment={this.props.environment}
      />
    );
  }
  renderLoading() {
    return (
      <CreateDialogController
        user={null}
        isLoading={true}
        {...this.props}
        environment={this.props.environment}
      />
    );
  }
  fetchToken = (loginModel) => loginModel.getToken(DOTCOM.getLoginAccount());
}
