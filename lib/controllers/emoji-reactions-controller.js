/** @babel */
/** @jsx h */
import View, { h } from "../etch/view";
import EmojiReactionsView from "../views/emoji-reactions-view";
import addReactionMutation from "../mutations/add-reaction";
import removeReactionMutation from "../mutations/remove-reaction";
import { sameEnvironment } from "../graphql/request";
export class BareEmojiReactionsController extends View {
  constructor(props, children) {
    super(props, children);
    this.state = { reactable: props.reactable, busy: false };
    this.operation = null;
    this.initialize();
  }
  update(props, children) {
    if (
      this.props.reactable !== props.reactable ||
      !sameEnvironment(this.props.environment, props.environment)
    ) {
      this.operation = null;
      this.state = { reactable: props.reactable, busy: false };
    }
    return super.update(props, children);
  }
  render() {
    const reactable = this.state.busy
      ? { ...this.state.reactable, viewerCanReact: false }
      : this.state.reactable;
    return (
      <EmojiReactionsView
        {...this.props}
        reactable={reactable}
        addReaction={this.addReaction}
        removeReaction={this.removeReaction}
      />
    );
  }
  changeReaction = async (content, mutation, field, message) => {
    if (this.destroyed || this.state.busy) return;
    const operation = {};
    this.operation = operation;
    this.updateState({ busy: true });
    try {
      const result = await mutation(this.props.environment, this.props.reactable.id, content);
      if (!this.destroyed && this.operation === operation) {
        this.updateState({
          reactable: { ...this.state.reactable, ...result[field].subject },
          busy: false,
        });
      }
    } catch (err) {
      if (!this.destroyed && this.operation === operation) {
        this.updateState({ busy: false });
        this.props.reportRelayError(message, err);
      }
    }
  };
  addReaction = (content) =>
    this.changeReaction(
      content,
      addReactionMutation,
      "addReaction",
      "Unable to add reaction emoji",
    );
  removeReaction = (content) =>
    this.changeReaction(
      content,
      removeReactionMutation,
      "removeReaction",
      "Unable to remove reaction emoji",
    );
}
export default BareEmojiReactionsController;
