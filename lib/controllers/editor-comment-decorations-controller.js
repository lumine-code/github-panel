/** @babel */
/** @jsx h */
import View, { h, Fragment } from "../etch/view";
import { Range } from "lumine";
import Marker from "../lumine/marker";
import Decoration from "../lumine/decoration";
import ReviewsItem from "../items/reviews-item";
import CommentGutterDecorationController from "../controllers/comment-gutter-decoration-controller";
export default class EditorCommentDecorationsController extends View {
  constructor(props, children) {
    super(props, children);
    this.rangesByRootID = new Map();
    this.rangeOriginsByRootID = new Map();
    this.initialize();
  }
  render() {
    const currentIDs = new Set(this.props.threadsForPath.map((thread) => thread.rootCommentID));
    for (const rootID of this.rangesByRootID.keys()) {
      if (!currentIDs.has(rootID)) this.clearRange(rootID);
    }
    if (!this.props.commentTranslationsForPath) {
      this.rangesByRootID.clear();
      this.rangeOriginsByRootID.clear();
      return (
        <span
          style={{
            display: "contents",
          }}
        >
          {null}
        </span>
      );
    }
    if (this.props.commentTranslationsForPath.removed && this.props.threadsForPath.length > 0) {
      this.rangesByRootID.clear();
      this.rangeOriginsByRootID.clear();
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
          environment={this.props.environment}
        >
          <Decoration
            type="block"
            editor={this.props.editor}
            className="github-panel-EditorComment-omitted"
            environment={this.props.environment}
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
    return (
      <span
        style={{
          display: "contents",
        }}
      >
        {this.props.threadsForPath.map((thread) => {
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
                onDidChange={(evt) => this.markerDidChange(thread.rootCommentID, evt)}
                environment={this.props.environment}
              >
                <Decoration
                  type="line"
                  editor={this.props.editor}
                  className="github-panel-editorCommentHighlight"
                  omitEmptyLastRow={false}
                  environment={this.props.environment}
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
                environment={this.props.environment}
              />
            </Fragment>
          );
        })}
      </span>
    );
  }
  markerDidChange(rootCommentID, { newRange }) {
    this.rangesByRootID.set(rootCommentID, Range.fromObject(newRange));
  }
  clearRange(rootCommentID) {
    this.rangesByRootID.delete(rootCommentID);
    this.rangeOriginsByRootID.delete(rootCommentID);
    return null;
  }
  getRangeForThread(thread) {
    const translations = this.props.commentTranslationsForPath;
    if (thread.position === null) {
      return this.clearRange(thread.rootCommentID);
    }
    let adjustedPosition = translations.diffToFilePosition.get(thread.position);
    if (!adjustedPosition) {
      return this.clearRange(thread.rootCommentID);
    }
    if (translations.fileTranslations) {
      const translated = translations.fileTranslations.get(adjustedPosition);
      if (!translated || translated.invalidated || translated.newPosition < 1) {
        return this.clearRange(thread.rootCommentID);
      }
      adjustedPosition = translated.newPosition;
    }
    const editorRow = adjustedPosition - 1;
    let localRange = this.rangesByRootID.get(thread.rootCommentID);
    const origin = this.rangeOriginsByRootID.get(thread.rootCommentID);
    if (
      !localRange ||
      origin?.editor !== this.props.editor ||
      origin?.position !== thread.position ||
      origin?.adjustedPosition !== adjustedPosition
    ) {
      localRange = Range.fromObject([
        [editorRow, 0],
        [editorRow, Infinity],
      ]);
      this.rangesByRootID.set(thread.rootCommentID, localRange);
      this.rangeOriginsByRootID.set(thread.rootCommentID, {
        editor: this.props.editor,
        position: thread.position,
        adjustedPosition,
      });
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
    const reviewsItem = await this.props.workspace.open(uri, {
      searchAllPanes: true,
    });
    // An open can decline, e.g. when the workspace center is full.
    reviewsItem?.jumpToThread(threadId);
  };
}
