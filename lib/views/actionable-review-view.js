/** @babel */
/** @jsx h */
import { provideEnvironment } from "../graphql/environment";
import View, { h } from "../etch/view";
import cx from "classnames";
import { CompositeDisposable, TextBuffer } from "lumine";
import LumineTextEditor from "../lumine/lumine-text-editor";
import RefHolder from "../models/ref-holder";
import Commands, { Command } from "../lumine/commands";
import { showContextMenu } from "../helpers";
import openExternal from "../open-external";
export default class ActionableReviewView extends View {
  constructor(props, children) {
    super(props, children);
    this.refEditor = new RefHolder();
    this.refRoot = new RefHolder();
    this.buffer = new TextBuffer();
    this.buffer.retain();
    this.state = {
      editing: false,
    };
    this.initialize();
  }
  didUpdate(prevProps, prevState) {
    if (this.state.editing && !prevState.editing) {
      this.buffer.setText(this.props.originalContent.body);
      this.refEditor.map((e) => e.getElement().focus());
    }
  }
  willDestroy() {
    this.menuCommandSubs?.dispose();
    this.buffer.release();
  }
  render() {
    return (
      <span
        style={{
          display: "contents",
        }}
      >
        {this.state.editing
          ? this.renderEditor()
          : provideEnvironment(this.props.render(this.showActionsMenu), this.props.environment)}
      </span>
    );
  }
  renderEditor() {
    const className = cx("github-panel-Review-editable", {
      "github-panel-Review-editable--disabled": this.props.isPosting,
    });
    return (
      <div className={className} ref={this.refRoot.setter}>
        {this.renderCommands()}
        <LumineTextEditor
          buffer={this.buffer}
          lineNumberGutterVisible={false}
          softWrapped={true}
          autoHeight={true}
          input={true}
          readOnly={this.props.isPosting}
          refModel={this.refEditor}
          environment={this.props.environment}
        />
        <footer className="github-panel-Review-editable-footer">
          <button
            className="github-panel-Review-editableCancelButton btn btn-sm"
            title="Cancel editing comment"
            disabled={this.props.isPosting}
            onClick={this.onCancel}
          >
            Cancel
          </button>
          <button
            className="github-panel-Review-updateCommentButton btn btn-sm btn-primary"
            title="Update comment"
            disabled={this.props.isPosting}
            onClick={this.onSubmitUpdate}
          >
            Update comment
          </button>
        </footer>
      </div>
    );
  }
  renderCommands() {
    return (
      <Commands
        registry={this.props.commands}
        target={this.refRoot}
        environment={this.props.environment}
      >
        <Command
          command="github-panel:submit-comment"
          description="Post the comment written above as a review comment."
          callback={this.onSubmitUpdate}
          environment={this.props.environment}
        />
        <Command
          command="core:cancel"
          callback={this.onCancel}
          environment={this.props.environment}
        />
      </Commands>
    );
  }
  onCancel = async () => {
    if (this.buffer.getText() === this.props.originalContent.body) {
      this.updateState({
        editing: false,
      });
    } else {
      const choice = await this.props.confirm({
        message: "Are you sure you want to discard your unsaved changes?",
        buttons: ["OK", "Cancel"],
      });
      if (choice === 0) {
        this.updateState({
          editing: false,
        });
      }
    }
  };
  onSubmitUpdate = async () => {
    const text = this.buffer.getText();
    if (text === this.props.originalContent.body || text === "") {
      this.updateState({
        editing: false,
      });
      return;
    }
    try {
      await this.props.contentUpdater(this.props.originalContent.id, text);
      this.updateState({
        editing: false,
      });
    } catch (e) {
      this.buffer.setText(text);
    }
  };
  reportAbuse = async (commentUrl, author) => {
    const url =
      "https://github.com/contact/report-content?report=" +
      `${encodeURIComponent(author)}&content_url=${encodeURIComponent(commentUrl)}`;
    await openExternal(url);
  };
  openOnGitHub = async (url) => {
    await openExternal(url);
  };
  showActionsMenu = (event, content, author) => {
    event.preventDefault();
    const target = event.target;
    if (this.menuCommandSubs) this.menuCommandSubs.dispose();
    this.menuCommandSubs = new CompositeDisposable();
    this.menuCommandSubs.add(
      lumine.commands.add(target, {
        "github-panel:edit-review": {
          description: "Reopen the selected comment for editing.",
          didDispatch: () =>
            this.updateState({
              editing: true,
            }),
        },
        "github-panel:open-review-on-github": {
          description: "Open the selected comment on github.com in a browser.",
          didDispatch: () => this.openOnGitHub(content.url),
        },
        "github-panel:report-abuse": {
          description: "Open GitHub's form for reporting the comment's author.",
          didDispatch: () => this.reportAbuse(content.url, author.login),
        },
      }),
    );
    const template = [
      ...(content.viewerCanUpdate
        ? [
            {
              label: "Edit",
              command: "github-panel:edit-review",
            },
          ]
        : []),
      {
        label: "Open on GitHub",
        command: "github-panel:open-review-on-github",
      },
      {
        label: "Report abuse",
        command: "github-panel:report-abuse",
      },
    ];
    showContextMenu(target, template);
  };
}
