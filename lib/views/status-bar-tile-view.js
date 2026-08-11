/** @babel */
/** @jsx React.createElement */
import React from "react";

import Octicon from "../lumine/octicon";
import Tooltip from "../lumine/tooltip";
import RefHolder from "../models/ref-holder";

export default class StatusBarTileView extends React.Component {
  static defaultProps = {
    onClick: () => {},
  };

  constructor(props) {
    super(props);
    this.refTileNode = new RefHolder();
    this.tooltipEntries = [
      { title: "Toggle GitHub panel", keyBindingExtra: "LMB" },
      {
        title: "Toggle focus",
        keyBindingCommand: "github-panel:toggle-focus",
        keyBindingTarget: props.keyBindingTarget,
      },
    ];
  }

  render() {
    return (
      <status-bar-tile
        ref={this.refTileNode.setter}
        className="github-panel-StatusBarTile"
        onClick={this.props.onClick}
      >
        <Octicon icon="mark-github" />
        GitHub
        {this.props.tooltipManager && (
          <Tooltip
            manager={this.props.tooltipManager}
            target={this.refTileNode}
            entries={this.tooltipEntries}
          />
        )}
      </status-bar-tile>
    );
  }
}
