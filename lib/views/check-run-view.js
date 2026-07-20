/** @babel */
/** @jsx React.createElement */
import React from "react";

import Octicon from "../atom/octicon";
import GithubDotcomMarkdown from "./github-dotcom-markdown";
import { buildStatusFromCheckResult } from "../models/build-status";

export class BareCheckRunView extends React.Component {
  render() {
    const { checkRun } = this.props;
    const { icon, classSuffix } = buildStatusFromCheckResult(checkRun);

    return (
      <li className="github-panel-PrStatuses-list-item github-panel-PrStatuses-list-item--checkRun">
        <span className="github-panel-PrStatuses-list-item-icon">
          <Octicon icon={icon} className={`github-panel-PrStatuses--${classSuffix}`} />
        </span>
        <a className="github-panel-PrStatuses-list-item-name" href={checkRun.permalink}>
          {checkRun.name}
        </a>
        <div className="github-panel-PrStatuses-list-item-context">
          {checkRun.title && (
            <span className="github-panel-PrStatuses-list-item-title">{checkRun.title}</span>
          )}
          {checkRun.summary && (
            <GithubDotcomMarkdown
              className="github-panel-PrStatuses-list-item-summary"
              switchToIssueish={this.props.switchToIssueish}
              markdown={checkRun.summary}
            />
          )}
        </div>
        {checkRun.detailsUrl && (
          <a className="github-panel-PrStatuses-list-item-details-link" href={checkRun.detailsUrl}>
            Details
          </a>
        )}
      </li>
    );
  }
}

export default BareCheckRunView;
