/** @babel */
/** @jsx h */
import View, { h } from "../etch/view";
import IssueishListView from "../views/issueish-list-view";
import Issueish from "../models/issueish";
import { CompositeDisposable } from "lumine";
import { showContextMenu } from "../helpers";
import openExternal from "../open-external";
export class BareIssueishListController extends View {
  static defaultProps = {
    results: [],
    total: 0,
    resultFilter: () => true,
  };
  constructor(props, children) {
    super(props, children);
    this.state = {};
    this.initialize();
  }
  static deriveState(props, state) {
    if (props.results === null) {
      return {
        lastResults: null,
        issueishes: [],
      };
    }
    if (props.results !== state.lastResults) {
      return {
        lastResults: props.results,
        issueishes: props.results.map((node) => new Issueish(node)).filter(props.resultFilter),
      };
    }
    return null;
  }
  openOnGitHub = async (url) => {
    await openExternal(url);
  };
  showActionsMenu = /* istanbul ignore next */ (issueish, event) => {
    const target = event?.target || document.body;
    if (this.menuCommandSubs) this.menuCommandSubs.dispose();
    this.menuCommandSubs = new CompositeDisposable();
    this.menuCommandSubs.add(
      lumine.commands.add(target, {
        "github-panel:see-reviews": {
          description: "Open the review comments of the selected pull request.",
          didDispatch: () => this.props.onOpenReviews(issueish),
        },
        "github-panel:open-on-github": {
          description: "Open the selected item on github.com in a browser.",
          didDispatch: () => this.openOnGitHub(issueish.getGitHubURL()),
        },
      }),
    );
    showContextMenu(target, [
      {
        label: "See reviews",
        command: "github-panel:see-reviews",
      },
      {
        label: "Open on GitHub",
        command: "github-panel:open-on-github",
      },
    ]);
  };
  render() {
    return (
      <IssueishListView
        title={this.props.title}
        isLoading={this.props.isLoading}
        total={this.props.total}
        issueishes={this.state.issueishes}
        error={this.props.error}
        needReviewsButton={this.props.needReviewsButton}
        onIssueishClick={this.props.onOpenIssueish}
        onMoreClick={this.props.onOpenMore}
        openReviews={this.props.onOpenReviews}
        openOnGitHub={this.openOnGitHub}
        showActionsMenu={this.showActionsMenu}
        renderEmpty={this.props.renderEmpty}
        environment={this.props.environment}
      />
    );
  }
}
export default BareIssueishListController;
