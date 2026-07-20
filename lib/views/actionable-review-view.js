/** @babel */
/** @jsx React.createElement */
import React from "react";
import cx from "classnames";
import { shell } from "electron";
import { CompositeDisposable, TextBuffer } from "atom";
import AtomTextEditor from "../atom/atom-text-editor";
import RefHolder from "../models/ref-holder";
import Commands, { Command } from "../atom/commands";
import { showContextMenu } from "../helpers";

export default class ActionableReviewView extends React.Component {
  constructor(props) {
    super(props);
    this.refEditor = new RefHolder();
    this.refRoot = new RefHolder();
    this.buffer = new TextBuffer();
    this.state = { editing: false };
  }

  componentDidUpdate(prevProps, prevState) {
    if (this.state.editing && !prevState.editing) {
      this.buffer.setText(this.props.originalContent.body);
      this.refEditor.map((e) => e.getElement().focus());
    }
  }

  render() {
    return this.state.editing ? this.renderEditor() : this.props.render(this.showActionsMenu);
  }

  renderEditor() {
    const className = cx("github-panel-Review-editable", {
      "github-panel-Review-editable--disabled": this.props.isPosting,
    });

    return (
      <div className={className} ref={this.refRoot.setter}>
        {this.renderCommands()}
        <AtomTextEditor
          buffer={this.buffer}
          lineNumberGutterVisible={false}
          softWrapped={true}
          autoHeight={true}
          readOnly={this.props.isPosting}
          refModel={this.refEditor}
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
      <Commands registry={this.props.commands} target={this.refRoot}>
        <Command command="github-panel:submit-comment" callback={this.onSubmitUpdate} />
        <Command command="core:cancel" callback={this.onCancel} />
      </Commands>
    );
  }

  onCancel = () => {
    if (this.buffer.getText() === this.props.originalContent.body) {
      this.setState({ editing: false });
    } else {
      const choice = this.props.confirm({
        message: "Are you sure you want to discard your unsaved changes?",
        buttons: ["OK", "Cancel"],
      });
      if (choice === 0) {
        this.setState({ editing: false });
      }
    }
  };

  onSubmitUpdate = async () => {
    const text = this.buffer.getText();
    if (text === this.props.originalContent.body || text === "") {
      this.setState({ editing: false });
      return;
    }

    try {
      await this.props.contentUpdater(this.props.originalContent.id, text);
      this.setState({ editing: false });
    } catch (e) {
      this.buffer.setText(text);
    }
  };

  reportAbuse = async (commentUrl, author) => {
    const url =
      "https://github.com/contact/report-content?report=" +
      `${encodeURIComponent(author)}&content_url=${encodeURIComponent(commentUrl)}`;

    await shell.openExternal(url);
  };

  openOnGitHub = async (url) => {
    await shell.openExternal(url);
  };

  showActionsMenu = (event, content, author) => {
    event.preventDefault();

    const target = event.target;

    if (this.menuCommandSubs) this.menuCommandSubs.dispose();
    this.menuCommandSubs = new CompositeDisposable();
    this.menuCommandSubs.add(
      atom.commands.add(target, {
        "github-panel:edit-review": () => this.setState({ editing: true }),
        "github-panel:open-review-on-github": () => this.openOnGitHub(content.url),
        "github-panel:report-abuse": () => this.reportAbuse(content.url, author.login),
      }),
    );

    const template = [
      ...(content.viewerCanUpdate ? [{ label: "Edit", command: "github-panel:edit-review" }] : []),
      { label: "Open on GitHub", command: "github-panel:open-review-on-github" },
      { label: "Report abuse", command: "github-panel:report-abuse" },
    ];

    showContextMenu(target, template);
  };
}
