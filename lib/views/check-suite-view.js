/** @babel */
/** @jsx h */
import View, { h, Fragment } from "../etch/view";
import Octicon from "../lumine/octicon";
import CheckRunView from "./check-run-view";
import { buildStatusFromCheckResult } from "../models/build-status";
export class BareCheckSuiteView extends View {
  constructor(props, children) {
    super(props, children);
    this.initialize();
  }
  render() {
    const { icon, classSuffix } = buildStatusFromCheckResult(this.props.checkSuite);
    return (
      <span
        style={{
          display: "contents",
        }}
      >
        {
          <Fragment>
            <li className="github-panel-PrStatuses-list-item">
              <span className="github-panel-PrStatuses-list-item-icon">
                <Octicon
                  icon={icon}
                  className={`github-panel-PrStatuses--${classSuffix}`}
                  environment={this.props.environment}
                />
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
                environment={this.props.environment}
              />
            ))}
          </Fragment>
        }
      </span>
    );
  }
}
export default BareCheckSuiteView;
