/** @babel */
/** @jsx React.createElement */
import React from "react";

import Octicon from "../atom/octicon";
import { buildStatusFromStatusContext } from "../models/build-status";

export class BarePrStatusContextView extends React.Component {
  render() {
    const { context, description, state, targetUrl } = this.props.context;
    const { icon, classSuffix } = buildStatusFromStatusContext({ state });
    return (
      <li className="github-panel-PrStatuses-list-item">
        <span className="github-panel-PrStatuses-list-item-icon">
          <Octicon icon={icon} className={`github-panel-PrStatuses--${classSuffix}`} />
        </span>
        <span className="github-panel-PrStatuses-list-item-context">
          <strong>{context}</strong> {description}
        </span>
        <span className="github-panel-PrStatuses-list-item-details-link">
          <a href={targetUrl}>Details</a>
        </span>
      </li>
    );
  }
}

export default BarePrStatusContextView;
