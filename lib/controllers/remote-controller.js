/** @babel */
/** @jsx h */
import View, { h } from "../etch/view";
import IssueishSearchesController from "./issueish-searches-controller";
import openExternal from "../open-external";
export default class RemoteController extends View {
  constructor(props, children) {
    super(props, children);
    this.initialize();
  }
  render() {
    return (
      <IssueishSearchesController
        endpoint={this.props.endpoint}
        token={this.props.token}
        workingDirectory={this.props.workingDirectory}
        repository={this.props.repository}
        workspace={this.props.workspace}
        remote={this.props.remote}
        remotes={this.props.remotes}
        branches={this.props.branches}
        aheadCount={this.props.aheadCount}
        pushInProgress={this.props.pushInProgress}
        onCreatePr={this.onCreatePr}
        environment={this.props.environment}
      />
    );
  }
  onCreatePr = async () => {
    const currentBranch = this.props.branches.getHeadBranch();
    const upstream = currentBranch.getUpstream();
    if (!upstream.isPresent() || this.props.aheadCount > 0) {
      await this.props.onPushBranch();
    }
    let createPrUrl = "https://github.com/";
    createPrUrl += this.props.remote.getOwner() + "/" + this.props.remote.getRepo();
    createPrUrl += "/compare/" + encodeURIComponent(currentBranch.getName());
    createPrUrl += "?expand=1";
    await openExternal(createPrUrl);
  };
}
