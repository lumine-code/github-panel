/** @babel */
/** @jsx h */
import View, { h } from "../etch/view";
import ReactionPickerView from "../views/reaction-picker-view";
export default class ReactionPickerController extends View {
  constructor(props, children) {
    super(props, children);
    this.initialize();
  }
  render() {
    return (
      <ReactionPickerView
        addReactionAndClose={this.addReactionAndClose}
        removeReactionAndClose={this.removeReactionAndClose}
        {...this.props}
        environment={this.props.environment}
      />
    );
  }
  addReactionAndClose = async (content) => {
    await this.props.addReaction(content);
    this.props.tooltipHolder.map((tooltip) => tooltip.dispose());
  };
  removeReactionAndClose = async (content) => {
    await this.props.removeReaction(content);
    this.props.tooltipHolder.map((tooltip) => tooltip.dispose());
  };
}
