/** @babel */
/** @jsx h */
import View, { h } from "../etch/view";
import Octicon from "../lumine/octicon";
import GithubDotcomMarkdown from "./github-dotcom-markdown";
import { buildStatusFromCheckResult } from "../models/build-status";
export class BareCheckRunView extends View {
  constructor(props, children) {
    super(props, children);
    this.initialize();
  }
  render() {
    const { checkRun } = this.props;
    const { icon, classSuffix } = buildStatusFromCheckResult(checkRun);
    return (
      <li className="github-panel-PrStatuses-list-item github-panel-PrStatuses-list-item--checkRun">
        <span className="github-panel-PrStatuses-list-item-icon">
          <Octicon
            icon={icon}
            className={`github-panel-PrStatuses--${classSuffix}`}
            environment={this.props.environment}
          />
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
              environment={this.props.environment}
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
