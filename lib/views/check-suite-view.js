/** @babel */
/** @jsx React.createElement */
import React, { Fragment } from "react";

import Octicon from "../atom/octicon";
import CheckRunView from "./check-run-view";
import { buildStatusFromCheckResult } from "../models/build-status";

export class BareCheckSuiteView extends React.Component {
  render() {
    const { icon, classSuffix } = buildStatusFromCheckResult(this.props.checkSuite);

    return (
      <Fragment>
        <li className="github-panel-PrStatuses-list-item">
          <span className="github-panel-PrStatuses-list-item-icon">
            <Octicon icon={icon} className={`github-panel-PrStatuses--${classSuffix}`} />
          </span>
          {this.props.checkSuite.app && (
            <span className="github-panel-PrStatuses-list-item-context">
              <strong>{this.props.checkSuite.app.name}</strong>
            </span>
          )}
        </li>
        {this.props.checkRuns.map((run) => (
          <CheckRunView
            key={run.id}
            checkRun={run}
            switchToIssueish={this.props.switchToIssueish}
          />
        ))}
      </Fragment>
    );
  }
}

export default BareCheckSuiteView;
