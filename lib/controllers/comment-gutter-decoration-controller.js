/** @babel */
/** @jsx React.createElement */
import React from "react";
import { Range } from "atom";
import Decoration from "../atom/decoration";
import Marker from "../atom/marker";
import ReviewsItem from "../items/reviews-item";

export default class CommentGutterDecorationController extends React.Component {
  static defaultProps = {
    extraClasses: [],
  };

  render() {
    const range = Range.fromObject([
      [this.props.commentRow, 0],
      [this.props.commentRow, Infinity],
    ]);
    return (
      <Marker
        key={`github-comment-gutter-decoration-${this.props.threadId}`}
        editor={this.props.editor}
        exclusive={true}
        invalidate="surround"
        bufferRange={range}
      >
        <Decoration
          editor={this.props.editor}
          type="gutter"
          gutterName="github-comment-icon"
          className={`github-panel-editorCommentGutterIcon ${this.props.extraClasses.join(" ")}`}
          omitEmptyLastRow={false}
        >
          <button
            className="icon icon-comment"
            onClick={() => this.openReviewThread(this.props.threadId)}
          />
        </Decoration>
      </Marker>
    );
  }

  async openReviewThread(threadId) {
    const uri = ReviewsItem.buildURI({
      host: this.props.endpoint.getHost(),
      owner: this.props.owner,
      repo: this.props.repo,
      number: this.props.number,
      workdir: this.props.workdir,
    });
    const reviewsItem = await this.props.workspace.open(uri, { searchAllPanes: true });
    // An open can decline, e.g. when the workspace center is full.
    reviewsItem?.jumpToThread(threadId);
  }
}
