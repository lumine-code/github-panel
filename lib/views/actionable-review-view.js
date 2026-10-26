/** @babel */
/** @jsx h */
import { provideEnvironment } from "../graphql/environment.js";
import View, { h } from "../etch/view.js";
import cx from "classnames";
import { CompositeDisposable, TextBuffer } from "lumine";
import LumineTextEditor from "../lumine/lumine-text-editor.js";
import RefHolder from "../models/ref-holder.js";
import Commands, { Command } from "../lumine/commands.js";
import { showContextMenu } from "../helpers.js";
import openExternal from "../open-external.js";
import { fitsInput, inputError, COMMENT_LIMIT } from "../input-budget.js";
export default class ActionableReviewView extends View {
  constructor(props, children) {
    super(props, children);
    this.refEditor = new RefHolder();
    this.refRoot = new RefHolder();
    this.buffer = new TextBuffer();
    this.buffer.retain();
    this.inputSubscription = this.buffer.onDidChange(() => this.invalidate());
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
    this.inputSubscription.dispose();
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
          {inputError(this.buffer, COMMENT_LIMIT, "Comment") && (
            <span className="text-error" role="alert">
              {inputError(this.buffer, COMMENT_LIMIT, "Comment").message}
            </span>
          )}
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
            disabled={this.props.isPosting || !fitsInput(this.buffer, COMMENT_LIMIT)}
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
    if (
      this.buffer
        .getTextSnapshot()
        .equals(TextBuffer.createTextSnapshot(this.props.originalContent.body))
    ) {
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
    if (!fitsInput(this.buffer, COMMENT_LIMIT)) return;
    const text = this.buffer.getText();
    const source = this.buffer.getTextSnapshot();
    if (text === this.props.originalContent.body || text === "") {
      this.updateState({
        editing: false,
      });
      return;
    }
    try {
      await this.props.contentUpdater(this.props.originalContent.id, text);
      if (!this.destroyed && this.buffer.getTextSnapshot().equals(source))
        this.updateState({ editing: false });
    } catch (e) {
      // The draft already contains the submitted text or a newer edit.
      // A failed request must not replace either version.
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
          isAvailable: () => Boolean(content.viewerCanUpdate),
          didDispatch: () =>
            this.updateState({
              editing: true,
            }),
        },
        "github-panel:open-review-on-github": {
          description: "Open the selected comment on github.com in a browser.",
          isAvailable: () => Boolean(content.url),
          didDispatch: () => this.openOnGitHub(content.url),
        },
        "github-panel:report-abuse": {
          description: "Open GitHub's form for reporting the comment's author.",
          isAvailable: () => Boolean(content.url && author.login),
          didDispatch: () => this.reportAbuse(content.url, author.login),
        },
      }),
    );
    const template = [
      ...(content.viewerCanUpdate
        ? [
            {
              label: "Edit Comment",
              command: "github-panel:edit-review",
            },
          ]
        : []),
      {
        label: "Open on GitHub",
        command: "github-panel:open-review-on-github",
      },
      {
        label: "Report Abuse",
        command: "github-panel:report-abuse",
      },
    ];
    showContextMenu(target, template);
  };
}
