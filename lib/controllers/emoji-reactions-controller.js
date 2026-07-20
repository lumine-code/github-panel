/** @babel */
/** @jsx React.createElement */
import React from "react";

import EmojiReactionsView from "../views/emoji-reactions-view";
import addReactionMutation from "../mutations/add-reaction";
import removeReactionMutation from "../mutations/remove-reaction";

export class BareEmojiReactionsController extends React.Component {
  render() {
    return (
      <EmojiReactionsView
        addReaction={this.addReaction}
        removeReaction={this.removeReaction}
        {...this.props}
      />
    );
  }

  addReaction = async (content) => {
    try {
      await addReactionMutation(this.props.relay.environment, this.props.reactable.id, content);
    } catch (err) {
      this.props.reportRelayError("Unable to add reaction emoji", err);
    }
  };

  removeReaction = async (content) => {
    try {
      await removeReactionMutation(this.props.relay.environment, this.props.reactable.id, content);
    } catch (err) {
      this.props.reportRelayError("Unable to remove reaction emoji", err);
    }
  };
}

export default BareEmojiReactionsController;
