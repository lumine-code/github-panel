/** @babel */
/** @jsx React.createElement */
import React from "react";
import { emojify } from "node-emoji";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
dayjs.extend(relativeTime);

import { autobind } from "../helpers";

const avatarAltText = "committer avatar";

export class PrCommitView extends React.Component {
  constructor(props) {
    super(props);
    this.state = { showMessageBody: false };
    autobind(this, "toggleShowCommitMessageBody", "humanizeTimeSince");
  }

  toggleShowCommitMessageBody() {
    this.setState({ showMessageBody: !this.state.showMessageBody });
  }

  humanizeTimeSince(date) {
    return dayjs(date).fromNow();
  }

  openCommitDetailItem = () => this.props.openCommit({ sha: this.props.item.sha });

  render() {
    const { messageHeadline, messageBody, shortSha, url } = this.props.item;
    const { avatarUrl, name, date } = this.props.item.committer;
    return (
      <div className="github-panel-PrCommitView-container">
        <div className="github-panel-PrCommitView-commit">
          <h3 className="github-panel-PrCommitView-title">
            {this.props.onBranch ? (
              <button
                className="github-panel-PrCommitView-messageHeadline is-button"
                onClick={this.openCommitDetailItem}
              >
                {emojify(messageHeadline)}
              </button>
            ) : (
              <span className="github-panel-PrCommitView-messageHeadline">
                {emojify(messageHeadline)}
              </span>
            )}
            {messageBody ? (
              <button
                className="github-panel-PrCommitView-moreButton"
                onClick={this.toggleShowCommitMessageBody}
              >
                {this.state.showMessageBody ? "hide" : "show"} more...
              </button>
            ) : null}
          </h3>
          <div className="github-panel-PrCommitView-meta">
            <img
              className="github-panel-PrCommitView-avatar"
              src={avatarUrl || null}
              alt={avatarAltText}
              title={avatarAltText}
            />
            <span className="github-panel-PrCommitView-metaText">
              {name} committed {this.humanizeTimeSince(date)}
            </span>
          </div>
          {this.state.showMessageBody ? (
            <pre className="github-panel-PrCommitView-moreText">{emojify(messageBody)}</pre>
          ) : null}
        </div>
        <div className="github-panel-PrCommitView-sha">
          <a href={url} title={`open commit ${shortSha} on GitHub.com`}>
            {shortSha}
          </a>
        </div>
      </div>
    );
  }
}

export default PrCommitView;
