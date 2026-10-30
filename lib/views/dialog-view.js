/** @babel */
/** @jsx h */
import View, { h, Fragment } from "../etch/view.js";
import cx from "classnames";
import Commands, { Command } from "../lumine/commands.js";
import Panel from "../lumine/panel.js";
import { TabbableButton } from "./tabbable.js";
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
      <Panel
        workspace={this.props.workspace}
        location="modal"
        options={{ className: "dialog-panel" }}
        environment={this.props.environment}
      >
        <div
          className="github-panel-Dialog dialog-form"
          role="dialog"
          attributes={{
            "aria-label": this.props.prompt || this.props.acceptText,
            "aria-busy": String(Boolean(this.props.inProgress)),
          }}
        >
          <Commands
            registry={this.props.commands}
            target=".github-panel-Dialog"
            environment={this.props.environment}
          >
            <Command
              command="core:confirm"
              isAvailable={() => Boolean(this.props.acceptEnabled && !this.props.inProgress)}
              callback={() => {
                if (this.props.acceptEnabled && !this.props.inProgress) return this.props.accept();
              }}
              environment={this.props.environment}
            />
            <Command
              command="core:cancel"
              callback={this.props.cancel}
              environment={this.props.environment}
            />
          </Commands>
          {this.props.prompt && (
            <header className="dialog-header">
              <h1 className="github-panel-DialogPrompt dialog-title">{this.props.prompt}</h1>
            </header>
          )}
          <main className="github-panel-DialogForm dialog-body">{this.props.children}</main>
          <div className="github-panel-DialogInfo dialog-status" role="status">
            {this.props.progressMessage && this.props.inProgress && (
              <Fragment>
                <span className="inline-block loading loading-spinner-small" />
                <span className="github-panel-DialogProgress-message">
                  {this.props.progressMessage}
                </span>
              </Fragment>
            )}
            {this.props.error && (
              <div className="text-error">
                {this.props.error.userMessage || this.props.error.message}
              </div>
            )}
          </div>
          <footer className="github-panel-DialogFooter dialog-footer">
            <div className="github-panel-DialogButtons dialog-actions">
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
