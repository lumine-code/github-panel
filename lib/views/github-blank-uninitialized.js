/** @babel */
/** @jsx React.createElement */
/* istanbul ignore file */

import React from "react";

import Octicon from "../atom/octicon";

export default function GitHubBlankUninitialized(props) {
  return (
    <div className="github-panel-Local-Uninit github-panel-Blank">
      <main className="github-panel-Blank-body">
        <div className="github-panel-LargeIcon icon icon-mark-github" />
        <p className="github-panel-Blank-context">
          This repository is not yet version controlled by git.
        </p>
        <p className="github-panel-Blank-option">
          <button
            className="github-panel-Blank-actionBtn btn icon icon-globe"
            onClick={props.openBoundPublishDialog}
          >
            Initialize and publish on GitHub...
          </button>
        </p>
        <p className="github-panel-Blank-explanation">
          Create a new GitHub repository, then track the existing content within this directory as a
          git repository configured to push there.
        </p>
        <p className="github-panel-Blank-footer github-panel-Blank-explanation">
          To initialize this directory as a git repository without publishing it to GitHub, visit
          the
          <button className="github-panel-Blank-tabLink" onClick={props.openGitTab}>
            <Octicon icon="git-commit" />
            Git tab.
          </button>
        </p>
      </main>
    </div>
  );
}
