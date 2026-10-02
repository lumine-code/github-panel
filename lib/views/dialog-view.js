/** @babel */
/** @jsx h */
import View, { h, Fragment } from "../etch/view";
import cx from "classnames";
import Commands, { Command } from "../lumine/commands";
import Panel from "../lumine/panel";
import { TabbableButton } from "./tabbable";
export default class DialogView extends View {
  constructor(props, children) {
    super(props, children);
    this.initialize();
  }
  static defaultProps = {
    acceptEnabled: true,
    acceptText: "Accept",
  };
  render() {
    return (
      <Panel workspace={this.props.workspace} location="modal" environment={this.props.environment}>
        <div className="github-panel-Dialog">
          <Commands
            registry={this.props.commands}
            target=".github-panel-Dialog"
            environment={this.props.environment}
          >
            <Command
              command="core:confirm"
              callback={this.props.accept}
              environment={this.props.environment}
            />
            <Command
              command="core:cancel"
              callback={this.props.cancel}
              environment={this.props.environment}
            />
          </Commands>
          {this.props.prompt && (
            <header className="github-panel-DialogPrompt">{this.props.prompt}</header>
          )}
          <main className="github-panel-DialogForm">{this.props.children}</main>
          <footer className="github-panel-DialogFooter">
            <div className="github-panel-DialogInfo">
              {this.props.progressMessage && this.props.inProgress && (
                <Fragment>
                  <span className="inline-block loading loading-spinner-small" />
                  <span className="github-panel-DialogProgress-message">
                    {this.props.progressMessage}
                  </span>
                </Fragment>
              )}
              {this.props.error && (
                <ul className="error-messages">
                  <li>{this.props.error.userMessage || this.props.error.message}</li>
                </ul>
              )}
            </div>
            <div className="github-panel-DialogButtons">
              <TabbableButton
                tabGroup={this.props.tabGroup}
                commands={this.props.commands}
                className="btn github-panel-Dialog-cancelButton"
                onClick={this.props.cancel}
                environment={this.props.environment}
              >
                Cancel
              </TabbableButton>
              <TabbableButton
                tabGroup={this.props.tabGroup}
                commands={this.props.commands}
                className={cx(
                  "btn btn-primary github-panel-Dialog-acceptButton",
                  this.props.acceptClassName,
                )}
                onClick={this.props.accept}
                disabled={this.props.inProgress || !this.props.acceptEnabled}
                children={this.props.acceptText}
                environment={this.props.environment}
              />
            </div>
          </footer>
        </div>
      </Panel>
    );
  }
}
