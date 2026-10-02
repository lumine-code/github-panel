/** @babel */
/** @jsx h */
import View, { h } from "../etch/view";
/* istanbul ignore file */

export default class GitHubBlankNoRemote extends View {
  constructor(props, children) {
    super(props, children);
    this.initialize();
  }
  render() {
    const props = this.props;
    return (
      <div className="github-panel-Local-NoRemotes github-panel-Blank">
        <div className="github-panel-LargeIcon icon icon-mark-github" />
        <p className="github-panel-Blank-context">This repository has no remotes on GitHub.</p>
        <p className="github-panel-Blank-option github-panel-Blank-option--explained">
          <button
            className="github-panel-Blank-actionBtn btn icon icon-globe"
            onClick={props.openBoundPublishDialog}
          >
            Publish on GitHub...
          </button>
        </p>
        <p className="github-panel-Blank-explanation">
          Create a new GitHub repository and configure this git repository configured to push there.
        </p>
      </div>
    );
  }
}
