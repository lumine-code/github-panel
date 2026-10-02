/** @babel */
/** @jsx h */
import View, { h } from "../etch/view";
import cx from "classnames";
import { TabbableInput, TabbableSummary, TabbableTextEditor } from "./tabbable";
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
      <details className="github-panel-RemoteConfiguration-details block">
        <TabbableSummary
          tabGroup={this.props.tabGroup}
          commands={this.props.commands}
          environment={this.props.environment}
        >
          Advanced
        </TabbableSummary>
        <main>
          <div className="github-panel-RemoteConfiguration-protocol block">
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
                onChange={this.handleProtocolChange}
                environment={this.props.environment}
              />
              SSH
            </label>
          </div>
          <div className="github-panel-RemoteConfiguration-sourceRemote block">
            <label className="input-label">
              Source remote name:
              <TabbableTextEditor
                tabGroup={this.props.tabGroup}
                commands={this.props.commands}
                className="github-panel-RemoteConfiguration-sourceRemoteName"
                mini={true}
                autoWidth={false}
                buffer={this.props.sourceRemoteBuffer}
                environment={this.props.environment}
              />
            </label>
          </div>
        </main>
      </details>
    );
  }
  handleProtocolChange = (event) => {
    this.props.didChangeProtocol(event.target.value);
  };
}
