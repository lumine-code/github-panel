/** @babel */
/** @jsx React.createElement */
import React from "react";

import Octicon from "../lumine/octicon";

export default class OfflineView extends React.Component {
  componentDidMount() {
    window.addEventListener("online", this.props.retry);
  }

  componentWillUnmount() {
    window.removeEventListener("online", this.props.retry);
  }

  render() {
    return (
      <div className="github-panel-Offline github-panel-Message">
        <div className="github-panel-Message-wrapper">
          <Octicon className="github-panel-Offline-logo" icon="alignment-unalign" />
          <h1 className="github-panel-Message-title">Offline</h1>
          <p className="github-panel-Message-description">
            You don't seem to be connected to the Internet. When you're back online, we'll try
            again.
          </p>
          <p className="github-panel-Message-action">
            <button className="github-panel-Message-button btn" onClick={this.props.retry}>
              Retry
            </button>
          </p>
        </div>
      </div>
    );
  }
}
