/** @babel */
/** @jsx React.createElement */
import React, { Fragment } from "react";
import { Range } from "lumine";

import Marker from "../lumine/marker";
import Decoration from "../lumine/decoration";
import ReviewsItem from "../items/reviews-item";
import CommentGutterDecorationController from "../controllers/comment-gutter-decoration-controller";

export default class EditorCommentDecorationsController extends React.Component {
  constructor(props) {
    super(props);

    this.rangesByRootID = new Map();
  }

  shouldComponentUpdate(nextProps) {
    return translationDigestFrom(this.props) !== translationDigestFrom(nextProps);
  }

  render() {
    if (!this.props.commentTranslationsForPath) {
      return null;
    }

    if (this.props.commentTranslationsForPath.removed && this.props.threadsForPath.length > 0) {
      const [firstThread] = this.props.threadsForPath;

      return (
        <Marker
          editor={this.props.editor}
          exclusive={true}
          invalidate="surround"
          bufferRange={Range.fromObject([
            [0, 0],
            [0, 0],
          ])}
        >
          <Decoration
            type="block"
            editor={this.props.editor}
            className="github-panel-EditorComment-omitted"
          >
            <p>This file has review comments, but its patch is too large for the editor to load.</p>
            <p>
              Review comments may still be viewed within
              <button className="btn" onClick={() => this.openReviewThread(firstThread.threadID)}>
                the review tab
              </button>
              .
            </p>
          </Decoration>
        </Marker>
      );
    }

    return this.props.threadsForPath.map((thread) => {
      const range = this.getRangeForThread(thread);
      if (!range) {
        return null;
      }

      return (
        <Fragment key={`github-panel-editor-review-decoration-${thread.rootCommentID}`}>
          <Marker
            editor={this.props.editor}
            exclusive={true}
            invalidate="surround"
            bufferRange={range}
            didChange={(evt) => this.markerDidChange(thread.rootCommentID, evt)}
          >
            <Decoration
              type="line"
              editor={this.props.editor}
              className="github-panel-editorCommentHighlight"
              omitEmptyLastRow={false}
            />
          </Marker>
          <CommentGutterDecorationController
            commentRow={range.start.row}
            threadId={thread.threadID}
            editor={this.props.editor}
            workspace={this.props.workspace}
            endpoint={this.props.endpoint}
            owner={this.props.owner}
            repo={this.props.repo}
            number={this.props.number}
            workdir={this.props.workdir}
            parent={this.constructor.name}
          />
        </Fragment>
      );
    });
  }

  markerDidChange(rootCommentID, { newRange }) {
    this.rangesByRootID.set(rootCommentID, Range.fromObject(newRange));
  }

  getRangeForThread(thread) {
    const translations = this.props.commentTranslationsForPath;

    if (thread.position === null) {
      this.rangesByRootID.delete(thread.rootCommentID);
      return null;
    }

    let adjustedPosition = translations.diffToFilePosition.get(thread.position);
    if (!adjustedPosition) {
      this.rangesByRootID.delete(thread.rootCommentID);
      return null;
    }

    if (translations.fileTranslations) {
      adjustedPosition = translations.fileTranslations.get(adjustedPosition).newPosition;
      if (!adjustedPosition) {
        this.rangesByRootID.delete(thread.rootCommentID);
        return null;
      }
    }

    const editorRow = adjustedPosition - 1;

    let localRange = this.rangesByRootID.get(thread.rootCommentID);
    if (!localRange) {
      localRange = Range.fromObject([
        [editorRow, 0],
        [editorRow, Infinity],
      ]);
      this.rangesByRootID.set(thread.rootCommentID, localRange);
    }
    return localRange;
  }

  openReviewThread = async (threadId) => {
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
  };
}

function translationDigestFrom(props) {
  const translations = props.commentTranslationsForPath;
  return translations ? translations.digest : null;
}
