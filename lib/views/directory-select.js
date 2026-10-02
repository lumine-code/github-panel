/** @babel */
/** @jsx h */
import View, { h } from "../etch/view";
import { TabbableTextEditor, TabbableButton } from "./tabbable";
export default class DirectorySelect extends View {
  constructor(props, children) {
    super(props, children);
    this.initialize();
  }
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
          environment={this.props.environment}
        />
        <TabbableButton
          tabGroup={this.props.tabGroup}
          commands={this.props.commands}
          className="btn icon icon-file-directory github-panel-Dialog-rightBumper"
          disabled={this.props.disabled}
          onClick={this.chooseDirectory}
          environment={this.props.environment}
        />
      </div>
    );
  }
  chooseDirectory = async () => {
    const folder = await lumine.window.pickFolder();
    if (folder) this.props.buffer.setText(folder[0]);
  };
}
