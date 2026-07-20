/** @babel */
/** @jsx React.createElement */
import React from "react";

import EmojiReactionsView from "../views/emoji-reactions-view";
import EnvironmentContext from "../graphql/environment-context";
import addReactionMutation from "../mutations/add-reaction";
import removeReactionMutation from "../mutations/remove-reaction";

export class BareEmojiReactionsController extends React.Component {
  // The {endpoint, token} environment comes from the enclosing GraphQLQuery via
  // context now, not a Relay `relay` prop.
  static contextType = EnvironmentContext;

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
      await addReactionMutation(this.context, this.props.reactable.id, content);
    } catch (err) {
      this.props.reportRelayError("Unable to add reaction emoji", err);
    }
  };

  removeReaction = async (content) => {
    try {
      await removeReactionMutation(this.context, this.props.reactable.id, content);
    } catch (err) {
      this.props.reportRelayError("Unable to remove reaction emoji", err);
    }
  };
}

export default BareEmojiReactionsController;
