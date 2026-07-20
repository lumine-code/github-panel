/** @babel */
/** @jsx React.createElement */
import React from "react";
import IssueishListView from "../views/issueish-list-view";
import Issueish from "../models/issueish";
import { shell } from "electron";
import { CompositeDisposable } from "atom";
import { showContextMenu } from "../helpers";

export class BareIssueishListController extends React.Component {
  static defaultProps = {
    results: [],
    total: 0,
    resultFilter: () => true,
  };

  constructor(props) {
    super(props);

    this.state = {};
  }

  static getDerivedStateFromProps(props, state) {
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
    await shell.openExternal(url);
  };

  showActionsMenu = /* istanbul ignore next */ (issueish, event) => {
    const target = event?.target || document.body;

    if (this.menuCommandSubs) this.menuCommandSubs.dispose();
    this.menuCommandSubs = new CompositeDisposable();
    this.menuCommandSubs.add(
      atom.commands.add(target, {
        "github-panel:see-reviews": () => this.props.onOpenReviews(issueish),
        "github-panel:open-on-github": () => this.openOnGitHub(issueish.getGitHubURL()),
      }),
    );

    showContextMenu(target, [
      { label: "See reviews", command: "github-panel:see-reviews" },
      { label: "Open on GitHub", command: "github-panel:open-on-github" },
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
        emptyComponent={this.props.emptyComponent}
      />
    );
  }
}

export default BareIssueishListController;
