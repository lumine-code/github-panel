/** @babel */
import React from "react";
import ReactDOM from "react-dom";

export default class StatusBar extends React.Component {
  static defaultProps = {
    onConsumeStatusBar: (statusBar) => {},
  };

  constructor(props) {
    super(props);

    // A portal target rather than a control, so it is handed over as a tile
    // group: the bar marks the `<status-bar-tile>` rendered into it and leaves
    // this box unmarked, which is what keeps a theme from painting one hover
    // rectangle on the host and a second on the control inside it.
    this.domNode = document.createElement("status-bar-tile-group");
    this.domNode.classList.add("react-lumine-status-bar");
    if (props.className) {
      this.domNode.classList.add(props.className);
    }
    this.tile = null;
  }

  componentDidMount() {
    this.consumeStatusBar();
  }

  componentDidUpdate(prevProps) {
    if (!prevProps.statusBar && this.props.statusBar) {
      this.consumeStatusBar();
    }
  }

  render() {
    return ReactDOM.createPortal(this.props.children, this.domNode);
  }

  consumeStatusBar() {
    if (this.tile) {
      return;
    }
    if (!this.props.statusBar) {
      return;
    }

    // Source-control band, see the priority convention in the status-bar
    // package README.
    this.tile = this.props.statusBar.addRightTile({ item: this.domNode, priority: 320 });
    this.props.onConsumeStatusBar(this.props.statusBar);
  }

  componentWillUnmount() {
    this.tile && this.tile.destroy();
  }
}
