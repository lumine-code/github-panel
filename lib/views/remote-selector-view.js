/** @babel */
/** @jsx React.createElement */
import React from "react";

export default class RemoteSelectorView extends React.Component {
  render() {
    const { remotes, currentBranch, selectRemote } = this.props;
    return (
      <div className="github-panel-RemoteSelector">
        <div className="github-panel-LargeIcon icon icon-mirror" />
        <h1>Select a Remote</h1>
        <div className="initialize-repo-description">
          <span>
            This repository has multiple remotes hosted at GitHub.com. Select a remote to see pull
            requests associated with the <strong>{currentBranch.getName()}</strong> branch:
          </span>
        </div>

        <ul>
          {Array.from(remotes, (remote) => (
            <li key={remote.getName()}>
              <button className="btn btn-primary" onClick={(e) => selectRemote(e, remote)}>
                {remote.getName()} ({remote.getOwner()}/{remote.getRepo()})
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }
}
