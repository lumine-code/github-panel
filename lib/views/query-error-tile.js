/** @babel */
/** @jsx React.createElement */
import React from "react";

import Octicon from "../lumine/octicon";

export default class QueryErrorTile extends React.Component {
  componentDidMount() {
    console.error("Error encountered in subquery", this.props.error);
  }

  render() {
    return (
      <div className="github-panel-QueryErrorTile">
        <div className="github-panel-QueryErrorTile-messages">{this.renderMessages()}</div>
      </div>
    );
  }

  renderMessages() {
    if (this.props.error.errors) {
      return this.props.error.errors.map((error, index) => {
        return this.renderMessage(error.message, index, "alert");
      });
    }

    if (this.props.error.response) {
      return this.renderMessage(this.props.error.responseText, "0", "alert");
    }

    if (this.props.error.network) {
      return this.renderMessage("Offline", "0", "alignment-unalign");
    }

    return this.renderMessage(this.props.error.toString(), "0", "alert");
  }

  renderMessage(body, key, icon) {
    return (
      <p key={key} className="github-panel-QueryErrorTile-message">
        <Octicon icon={icon} />
        {body}
      </p>
    );
  }
}
