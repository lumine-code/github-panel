/** @babel */
/** @jsx h */
import View, { h } from "../etch/view.js";
import GraphQLQuery from "../graphql/query.js";
import * as queries from "../graphql/queries.js";
import { createEnvironment } from "../graphql/environment.js";
import { UNAUTHENTICATED, INSUFFICIENT } from "../shared/token-status.js";
import Author, { nullAuthor } from "../models/author.js";
import GithubTabHeaderController from "../controllers/github-tab-header-controller.js";
export default class GithubTabHeaderContainer extends View {
  constructor(props, children) {
    super(props, children);
    this.initialize();
  }
  render() {
    if (
      this.props.token == null ||
      this.props.token instanceof Error ||
      this.props.token === UNAUTHENTICATED ||
      this.props.token === INSUFFICIENT
    ) {
      return (
        <span
          style={{
            display: "contents",
          }}
        >
          {this.renderNoResult()}
        </span>
      );
    }
    const environment = createEnvironment(
      this.props.endpoint,
      this.props.token,
      this.props.environment,
    );
    const query = queries.githubTabHeaderContainerQuery;
    return (
      <GraphQLQuery
        environment={environment}
        variables={{}}
        query={query}
        render={this.renderWithResult}
      />
    );
  }
  renderWithResult = ({ error, props }) => {
    if (error || props === null) {
      return this.renderNoResult();
    }
    const { email, name, avatarUrl, login } = props.viewer;
    return (
      <GithubTabHeaderController
        user={new Author(email, name, login, false, avatarUrl)}
        // Workspace
        currentWorkDir={this.props.currentWorkDir}
        contextLocked={this.props.contextLocked}
        getCurrentWorkDirs={this.props.getCurrentWorkDirs}
        changeWorkingDirectory={this.props.changeWorkingDirectory}
        setContextLock={this.props.setContextLock}
        // Event Handlers
        onDidChangeWorkDirs={this.props.onDidChangeWorkDirs}
        environment={this.props.environment}
      />
    );
  };
  renderNoResult() {
    return (
      <GithubTabHeaderController
        user={nullAuthor}
        // Workspace
        currentWorkDir={this.props.currentWorkDir}
        contextLocked={this.props.contextLocked}
        changeWorkingDirectory={this.props.changeWorkingDirectory}
        setContextLock={this.props.setContextLock}
        getCurrentWorkDirs={this.props.getCurrentWorkDirs}
        // Event Handlers
        onDidChangeWorkDirs={this.props.onDidChangeWorkDirs}
        environment={this.props.environment}
      />
    );
  }
}
