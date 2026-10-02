/** @babel */
/** @jsx h */
import View, { h } from "../etch/view";
/* istanbul ignore file */

export default class GitHubBlankNoLocal extends View {
  constructor(props, children) {
    super(props, children);
    this.initialize();
  }
  render() {
    const props = this.props;
    return (
      <div className="github-panel-NoLocal github-panel-Blank">
        <div className="github-panel-LargeIcon icon icon-mark-github" />
        <h1 className="github-panel-Blank-banner">Welcome</h1>
        <p className="github-panel-Blank-context">How would you like to get started today?</p>
        <p className="github-panel-Blank-option">
          <button
            className="github-panel-Blank-actionBtn btn icon icon-repo-create"
            onClick={props.openCreateDialog}
          >
            Create a new GitHub repository...
          </button>
        </p>
        <p className="github-panel-Blank-option">
          <button
            className="github-panel-Blank-actionBtn btn icon icon-repo-clone"
            onClick={props.openCloneDialog}
          >
            Clone an existing GitHub repository...
          </button>
        </p>
      </div>
    );
  }
}
