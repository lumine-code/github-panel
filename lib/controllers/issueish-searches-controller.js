/** @babel */
/** @jsx h */
import View, { h } from "../etch/view";
import Search from "../models/search";
import IssueishSearchContainer from "../containers/issueish-search-container";
import CurrentPullRequestContainer from "../containers/current-pull-request-container";
import IssueishDetailItem from "../items/issueish-detail-item";
import ReviewsItem from "../items/reviews-item";
import openExternal from "../open-external";
export default class IssueishSearchesController extends View {
  constructor(props, children) {
    super(props, children);
    this.initialize();
  }
  state = {};
  static deriveState(props) {
    return {
      searches: [Search.inRemote(props.remote, "Open pull requests", "type:pr state:open")],
    };
  }
  render() {
    return (
      <div className="github-panel-IssueishSearch">
        <CurrentPullRequestContainer
          repository={this.props.repository}
          token={this.props.token}
          endpoint={this.props.endpoint}
          remote={this.props.remote}
          remotes={this.props.remotes}
          branches={this.props.branches}
          aheadCount={this.props.aheadCount}
          pushInProgress={this.props.pushInProgress}
          workspace={this.props.workspace}
          workingDirectory={this.props.workingDirectory}
          onOpenIssueish={this.onOpenIssueish}
          onOpenReviews={this.onOpenReviews}
          onCreatePr={this.props.onCreatePr}
          environment={this.props.environment}
        />
        {this.state.searches.map((search) => (
          <IssueishSearchContainer
            key={search.getName()}
            token={this.props.token}
            endpoint={this.props.endpoint}
            search={search}
            onOpenIssueish={this.onOpenIssueish}
            onOpenSearch={this.onOpenSearch}
            onOpenReviews={this.onOpenReviews}
            environment={this.props.environment}
          />
        ))}
      </div>
    );
  }
  onOpenReviews = (issueish) => {
    const uri = ReviewsItem.buildURI({
      host: this.props.endpoint.getHost(),
      owner: this.props.remote.getOwner(),
      repo: this.props.remote.getRepo(),
      number: issueish.getNumber(),
      workdir: this.props.workingDirectory,
    });
    return this.props.workspace.open(uri);
  };
  onOpenIssueish = (issueish) => {
    return this.props.workspace.open(
      IssueishDetailItem.buildURI({
        host: this.props.endpoint.getHost(),
        owner: this.props.remote.getOwner(),
        repo: this.props.remote.getRepo(),
        number: issueish.getNumber(),
        workdir: this.props.workingDirectory,
      }),
      {
        pending: true,
        searchAllPanes: true,
      },
    );
  };
  onOpenSearch = async (search) => {
    const searchURL = search.getWebURL(this.props.remote);
    await openExternal(searchURL);
  };
}
