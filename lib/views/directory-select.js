/** @babel */
/** @jsx React.createElement */
import React from "react";
import { TabbableTextEditor, TabbableButton } from "./tabbable";

export default class DirectorySelect extends React.Component {
  static defaultProps = {
    disabled: false,
  };

  render() {
    return (
      <div className="github-panel-Dialog-row">
        <TabbableTextEditor
          tabGroup={this.props.tabGroup}
          commands={this.props.commands}
          className="github-panel-DirectorySelect-destinationPath"
          mini={true}
          readOnly={this.props.disabled}
          buffer={this.props.buffer}
        />
        <TabbableButton
          tabGroup={this.props.tabGroup}
          commands={this.props.commands}
          className="btn icon icon-file-directory github-panel-Dialog-rightBumper"
          disabled={this.props.disabled}
          onClick={this.chooseDirectory}
        />
      </div>
    );
  }

  chooseDirectory = () => {
    atom.applicationDelegate.pickFolder((folder) => {
      if (folder) {
        this.props.buffer.setText(Array.isArray(folder) ? folder[0] : folder);
      }
    });
  };
}
