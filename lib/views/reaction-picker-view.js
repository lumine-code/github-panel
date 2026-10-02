/** @babel */
/** @jsx h */
import View, { h } from "../etch/view";
import cx from "classnames";
import { reactionTypeToEmoji } from "../helpers";
const CONTENT_TYPES = Object.keys(reactionTypeToEmoji);
const EMOJI_COUNT = CONTENT_TYPES.length;
const EMOJI_PER_ROW = 4;
const EMOJI_ROWS = Math.ceil(EMOJI_COUNT / EMOJI_PER_ROW);
export default class ReactionPickerView extends View {
  constructor(props, children) {
    super(props, children);
    this.initialize();
  }
  render() {
    const viewerReactedSet = new Set(this.props.viewerReacted);
    const emojiRows = [];
    for (let row = 0; row < EMOJI_ROWS; row++) {
      const emojiButtons = [];
      for (let column = 0; column < EMOJI_PER_ROW; column++) {
        const emojiIndex = row * EMOJI_PER_ROW + column;

        /* istanbul ignore if */
        if (emojiIndex >= CONTENT_TYPES.length) {
          break;
        }
        const content = CONTENT_TYPES[emojiIndex];
        const toggle = !viewerReactedSet.has(content)
          ? () => this.props.addReactionAndClose(content)
          : () => this.props.removeReactionAndClose(content);
        const className = cx("github-panel-ReactionPicker-reaction", "btn", {
          selected: viewerReactedSet.has(content),
        });
        emojiButtons.push(
          <button key={content} className={className} onClick={toggle}>
            {reactionTypeToEmoji[content]}
          </button>,
        );
      }
      emojiRows.push(
        <p key={row} className="github-panel-ReactionPicker-row inline-block-tight">
          {emojiButtons}
        </p>,
      );
    }
    return <div className="github-panel-ReactionPicker">{emojiRows}</div>;
  }
}
