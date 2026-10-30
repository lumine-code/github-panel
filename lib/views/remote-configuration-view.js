/** @babel */
/** @jsx h */
import View, { h } from "../etch/view.js";
import cx from "classnames";
import { TabbableInput, TabbableSummary, TabbableTextEditor } from "./tabbable.js";
export default class RemoteConfigurationView extends View {
  constructor(props, children) {
    super(props, children);
    this.initialize();
  }
  render() {
    const httpsClassName = cx(
      "github-panel-RemoteConfiguration-protocolOption",
      "github-panel-RemoteConfiguration-protocolOption--https",
      "input-label",
    );
    const sshClassName = cx(
      "github-panel-RemoteConfiguration-protocolOption",
      "github-panel-RemoteConfiguration-protocolOption--ssh",
      "input-label",
    );
    return (
      <details className="github-panel-RemoteConfiguration-details">
        <TabbableSummary
          tabGroup={this.props.tabGroup}
          commands={this.props.commands}
          environment={this.props.environment}
        >
          Advanced
        </TabbableSummary>
        <div className="dialog-body">
          <div className="github-panel-RemoteConfiguration-protocol">
            <span className="github-panel-RemoteConfiguration-protocolHeading">Protocol:</span>
            <label className={httpsClassName}>
              <TabbableInput
                tabGroup={this.props.tabGroup}
                commands={this.props.commands}
                className="input-radio"
                type="radio"
                name="protocol"
                value="https"
                checked={this.props.currentProtocol === "https"}
                disabled={this.props.disabled}
                onChange={this.handleProtocolChange}
                environment={this.props.environment}
              />
              HTTPS
            </label>
            <label className={sshClassName}>
              <TabbableInput
                tabGroup={this.props.tabGroup}
                commands={this.props.commands}
                className="input-radio"
                type="radio"
                name="protocol"
                value="ssh"
                checked={this.props.currentProtocol === "ssh"}
                disabled={this.props.disabled}
                onChange={this.handleProtocolChange}
                environment={this.props.environment}
              />
              SSH
            </label>
          </div>
          <div className="github-panel-RemoteConfiguration-sourceRemote">
            <label className="dialog-field">
              <span className="dialog-label">Source remote name</span>
              <TabbableTextEditor
                tabGroup={this.props.tabGroup}
                commands={this.props.commands}
                className="github-panel-RemoteConfiguration-sourceRemoteName"
                mini={true}
                ariaLabel="Source remote name"
                readOnly={this.props.disabled}
                autoWidth={false}
                buffer={this.props.sourceRemoteBuffer}
                environment={this.props.environment}
              />
            </label>
          </div>
        </div>
      </details>
    );
  }
  handleProtocolChange = (event) => {
    this.props.didChangeProtocol(event.target.value);
  };
}
