/** @babel */
/** @jsx React.createElement */
import path from "path";
import React, { Fragment } from "react";
import cx from "classnames";
import { CompositeDisposable } from "atom";

import Tooltip from "../atom/tooltip";
import Commands, { Command } from "../atom/commands";
import AtomTextEditor from "../atom/atom-text-editor";
import { getDataFromGithubUrl } from "./issueish-link";
import EmojiReactionsController from "../controllers/emoji-reactions-controller";
import { checkoutStates } from "../controllers/pr-checkout-controller";
import GithubDotcomMarkdown from "./github-dotcom-markdown";
import PatchPreviewView from "./patch-preview-view";
import ReviewCommentView from "./review-comment-view";
import ActionableReviewView from "./actionable-review-view";
import CheckoutButton from "./checkout-button";
import Octicon from "../atom/octicon";
import Timeago from "./timeago";
import RefHolder from "../models/ref-holder";
import { toNativePathSep, GHOST_USER } from "../helpers";

const authorAssociationText = {
  MEMBER: "Member",
  OWNER: "Owner",
  COLLABORATOR: "Collaborator",
  CONTRIBUTOR: "Contributor",
  FIRST_TIME_CONTRIBUTOR: "First-time contributor",
  FIRST_TIMER: "First-timer",
  NONE: null,
};

export default class ReviewsView extends React.Component {
  constructor(props) {
    super(props);

    this.rootHolder = new RefHolder();
    this.replyHolders = new Map();
    this.threadHolders = new Map();
    this.state = {
      isRefreshing: false,
    };
    this.subs = new CompositeDisposable();
  }

  componentDidMount() {
    const { scrollToThreadID } = this.props;
    if (scrollToThreadID) {
      this.scrollToThread(scrollToThreadID);
    }
  }

  componentDidUpdate(prevProps) {
    const { scrollToThreadID } = this.props;
    if (scrollToThreadID && scrollToThreadID !== prevProps.scrollToThreadID) {
      this.scrollToThread(scrollToThreadID);
    }
  }

  componentWillUnmount() {
    this.subs.dispose();
  }

  render() {
    return (
      <div className="github-panel-Reviews" ref={this.rootHolder.setter}>
        {this.renderCommands()}
        {this.renderHeader()}
        <div className="github-panel-Reviews-list">
          {this.renderReviewSummaries()}
          {this.renderReviewCommentThreads()}
        </div>
      </div>
    );
  }

  renderCommands() {
    return (
      <Fragment>
        <Commands registry={this.props.commands} target={this.rootHolder}>
          <Command command="github-panel:more-context" callback={this.props.moreContext} />
          <Command command="github-panel:less-context" callback={this.props.lessContext} />
        </Commands>
        <Commands registry={this.props.commands} target=".github-panel-Review-reply">
          <Command command="github-panel:submit-comment" callback={this.submitCurrentComment} />
        </Commands>
      </Fragment>
    );
  }

  renderHeader() {
    const refresh = () => {
      if (this.state.isRefreshing) {
        return;
      }
      this.setState({ isRefreshing: true });
      const sub = this.props.refetch(() => {
        this.subs.remove(sub);
        this.setState({ isRefreshing: false });
      });
      this.subs.add(sub);
    };
    return (
      <header className="github-panel-Reviews-topHeader">
        <span className="icon icon-comment-discussion" />
        <span className="github-panel-Reviews-headerTitle">
          Reviews for&nbsp;
          <span className="github-panel-Reviews-clickable" onClick={this.props.openPR}>
            {this.props.owner}/{this.props.repo}#{this.props.number}
          </span>
        </span>
        <button
          className={cx(
            "github-panel-Reviews-headerButton github-panel-Reviews-clickable icon icon-repo-sync",
            {
              refreshing: this.state.isRefreshing,
            },
          )}
          onClick={refresh}
        />
        <CheckoutButton
          checkoutOp={this.props.checkoutOp}
          classNamePrefix="github-panel-Reviews-checkoutButton--"
          classNames={["github-panel-Reviews-headerButton"]}
        />
      </header>
    );
  }

  renderEmptyState() {
    const { number, repo, owner } = this.props;
    // TODO: open the review flow in Pulsar instead of dotcom
    const pullRequestURL = `https://www.github.com/${owner}/${repo}/pull/${number}/files/`;
    return (
      <div className="github-panel-Reviews-emptyState">
        <img
          src="atom://github-panel/img/mona.svg"
          alt="Mona the octocat in spaaaccee"
          className="github-panel-Reviews-emptyImg"
        />
        <div className="github-panel-Reviews-emptyText">This pull request has no reviews</div>
        <button className="github-panel-Reviews-emptyCallToActionButton btn">
          <a href={pullRequestURL}>Start a new review</a>
        </button>
      </div>
    );
  }

  renderReviewSummaries() {
    if (this.props.summaries.length === 0) {
      return this.renderEmptyState();
    }

    const toggle = (evt) => {
      evt.preventDefault();
      if (this.props.summarySectionOpen) {
        this.props.hideSummaries();
      } else {
        this.props.showSummaries();
      }
    };

    return (
      <details
        className="github-panel-Reviews-section summaries"
        open={this.props.summarySectionOpen}
      >
        <summary className="github-panel-Reviews-header" onClick={toggle}>
          <span className="github-panel-Reviews-title">Summaries</span>
        </summary>
        <main className="github-panel-Reviews-container">
          {this.props.summaries.map(this.renderReviewSummary)}
        </main>
      </details>
    );
  }

  renderReviewSummary = (review) => {
    const reviewTypes = (type) => {
      return (
        {
          APPROVED: { icon: "icon-check", copy: "approved these changes" },
          COMMENTED: { icon: "icon-comment", copy: "commented" },
          CHANGES_REQUESTED: { icon: "icon-alert", copy: "requested changes" },
        }[type] || { icon: "", copy: "" }
      );
    };

    const { icon, copy } = reviewTypes(review.state);

    // filter non actionable empty summary comments from this view
    if (review.state === "PENDING" || (review.state === "COMMENTED" && review.bodyHTML === "")) {
      return null;
    }

    const author = review.author || GHOST_USER;

    return (
      <div className="github-panel-ReviewSummary" key={review.id}>
        <ActionableReviewView
          originalContent={review}
          confirm={this.props.confirm}
          commands={this.props.commands}
          contentUpdater={this.props.updateSummary}
          render={(showActionsMenu) => {
            return (
              <Fragment>
                <header className="github-panel-Review-header">
                  <div className="github-panel-Review-header-authorData">
                    <span className={`github-panel-ReviewSummary-icon icon ${icon}`} />
                    <img
                      className="github-panel-ReviewSummary-avatar"
                      src={author.avatarUrl || null}
                      alt={author.login}
                    />
                    <a className="github-panel-ReviewSummary-username" href={author.url}>
                      {author.login}
                    </a>
                    <span className="github-panel-ReviewSummary-type">{copy}</span>
                    {this.renderEditedLink(review)}
                    {this.renderAuthorAssociation(review)}
                  </div>
                  <Timeago
                    className="github-panel-ReviewSummary-timeAgo"
                    time={review.submittedAt}
                    displayStyle="short"
                  />
                  <Octicon
                    icon="ellipses"
                    className="github-panel-Review-actionsMenu"
                    onClick={(event) => showActionsMenu(event, review, author)}
                  />
                </header>
                <main className="github-panel-ReviewSummary-comment">
                  <GithubDotcomMarkdown
                    html={review.bodyHTML}
                    switchToIssueish={this.props.openIssueish}
                    openIssueishLinkInNewTab={this.openIssueishLinkInNewTab}
                  />
                  <EmojiReactionsController
                    reactable={review}
                    tooltips={this.props.tooltips}
                    reportRelayError={this.props.reportRelayError}
                  />
                </main>
              </Fragment>
            );
          }}
        />
      </div>
    );
  };

  renderReviewCommentThreads() {
    const commentThreads = this.props.commentThreads;
    if (commentThreads.length === 0) {
      return null;
    }

    const resolvedThreads = commentThreads.filter((pair) => pair.thread.isResolved);
    const unresolvedThreads = commentThreads.filter((pair) => !pair.thread.isResolved);

    const toggleComments = (evt) => {
      evt.preventDefault();
      if (this.props.commentSectionOpen) {
        this.props.hideComments();
      } else {
        this.props.showComments();
      }
    };

    return (
      <details
        className="github-panel-Reviews-section comments"
        open={this.props.commentSectionOpen}
      >
        <summary className="github-panel-Reviews-header" onClick={toggleComments}>
          <span className="github-panel-Reviews-title">Comments</span>
          <span className="github-panel-Reviews-progress">
            <span className="github-panel-Reviews-count">
              Resolved{" "}
              <span className="github-panel-Reviews-countNr">{resolvedThreads.length}</span> of{" "}
              <span className="github-panel-Reviews-countNr">
                {resolvedThreads.length + unresolvedThreads.length}
              </span>
            </span>
            <progress
              className="github-panel-Reviews-progessBar"
              value={resolvedThreads.length}
              max={resolvedThreads.length + unresolvedThreads.length}
            />
          </span>
        </summary>

        {unresolvedThreads.length > 0 && (
          <main className="github-panel-Reviews-container">
            {unresolvedThreads.map(this.renderReviewCommentThread)}
          </main>
        )}
        {resolvedThreads.length > 0 && (
          <details className="github-panel-Reviews-section resolved-comments" open>
            <summary className="github-panel-Reviews-header">
              <span className="github-panel-Reviews-title">Resolved</span>
            </summary>
            <main className="github-panel-Reviews-container">
              {resolvedThreads.map(this.renderReviewCommentThread)}
            </main>
          </details>
        )}
      </details>
    );
  }

  renderReviewCommentThread = (commentThread) => {
    const { comments, thread } = commentThread;
    const rootComment = comments[0];
    if (!rootComment) {
      return null;
    }

    let threadHolder = this.threadHolders.get(thread.id);
    if (!threadHolder) {
      threadHolder = new RefHolder();
      this.threadHolders.set(thread.id, threadHolder);
    }

    const nativePath = toNativePathSep(rootComment.path);
    const { dir, base } = path.parse(nativePath);
    const { lineNumber, positionText } = this.getTranslatedPosition(rootComment);

    const refJumpToFileButton = new RefHolder();
    const jumpToFileDisabledLabel = "Checkout this pull request to enable Jump To File.";

    const elementId = `review-thread-${thread.id}`;

    const navButtonClasses = ["github-panel-Review-navButton", "icon", { outdated: !lineNumber }];
    const openFileClasses = cx("icon-code", ...navButtonClasses);
    const openDiffClasses = cx("icon-diff", ...navButtonClasses);

    const isOpen = this.props.threadIDsOpen.has(thread.id);
    const isHighlighted = this.props.highlightedThreadIDs.has(thread.id);
    const toggle = (evt) => {
      evt.preventDefault();
      evt.stopPropagation();

      if (isOpen) {
        this.props.hideThreadID(thread.id);
      } else {
        this.props.showThreadID(thread.id);
      }
    };

    const author = rootComment.author || GHOST_USER;

    return (
      <details
        ref={threadHolder.setter}
        className={cx("github-panel-Review", {
          resolved: thread.isResolved,
          "github-panel-Review--highlight": isHighlighted,
        })}
        key={elementId}
        id={elementId}
        open={isOpen}
      >
        <summary className="github-panel-Review-reference" onClick={toggle}>
          {dir && <span className="github-panel-Review-path">{dir}</span>}
          <span className="github-panel-Review-file">
            {dir ? path.sep : ""}
            {base}
          </span>
          <span className="github-panel-Review-lineNr">{positionText}</span>
          <img
            className="github-panel-Review-referenceAvatar"
            src={author.avatarUrl || null}
            alt={author.login}
          />
          <Timeago
            className="github-panel-Review-referenceTimeAgo"
            time={rootComment.createdAt}
            displayStyle="short"
          />
        </summary>
        <nav className="github-panel-Review-nav">
          <button
            className={openFileClasses}
            data-path={nativePath}
            data-line={lineNumber}
            onClick={this.openFile}
            disabled={this.props.checkoutOp.isEnabled()}
            ref={refJumpToFileButton.setter}
          >
            Jump To File
          </button>
          <button
            className={openDiffClasses}
            data-path={nativePath}
            data-line={rootComment.position}
            onClick={this.openDiff}
          >
            Open Diff
          </button>
          {this.props.checkoutOp.isEnabled() && (
            <Tooltip
              manager={this.props.tooltips}
              target={refJumpToFileButton}
              title={jumpToFileDisabledLabel}
              showDelay={200}
            />
          )}
        </nav>

        {rootComment.position !== null && (
          <PatchPreviewView
            multiFilePatch={this.props.multiFilePatch}
            fileName={nativePath}
            diffRow={rootComment.position}
            maxRowCount={this.props.contextLines}
            config={this.props.config}
          />
        )}

        {this.renderThread({ thread, comments })}
      </details>
    );
  };

  renderThread = ({ thread, comments }) => {
    let replyHolder = this.replyHolders.get(thread.id);
    if (!replyHolder) {
      replyHolder = new RefHolder();
      this.replyHolders.set(thread.id, replyHolder);
    }

    const lastComment = comments[comments.length - 1];
    const isPosting = this.props.postingToThreadID !== null;

    return (
      <Fragment>
        <main className="github-panel-Review-comments">
          {comments.map((comment) => {
            return (
              <ReviewCommentView
                key={comment.id}
                comment={comment}
                openIssueish={this.props.openIssueish}
                openIssueishLinkInNewTab={this.openIssueishLinkInNewTab}
                tooltips={this.props.tooltips}
                reportRelayError={this.props.reportRelayError}
                renderEditedLink={this.renderEditedLink}
                renderAuthorAssociation={this.renderAuthorAssociation}
                isPosting={isPosting}
                confirm={this.props.confirm}
                commands={this.props.commands}
                updateComment={this.props.updateComment}
              />
            );
          })}

          <div
            className={cx("github-panel-Review-reply", {
              "github-panel-Review-reply--disabled": isPosting,
            })}
            data-thread-id={thread.id}
          >
            <AtomTextEditor
              placeholderText="Reply..."
              lineNumberGutterVisible={false}
              softWrapped={true}
              autoHeight={true}
              readOnly={isPosting}
              refModel={replyHolder}
            />
          </div>
        </main>
        {thread.isResolved && (
          <div className="github-panel-Review-resolvedText">
            This conversation was marked as resolved by @{thread.resolvedBy.login}
          </div>
        )}
        <footer className="github-panel-Review-footer">
          <button
            className="github-panel-Review-replyButton btn btn-primary"
            title="Add your comment"
            disabled={isPosting}
            onClick={() => this.submitReply(replyHolder, thread, lastComment)}
          >
            Comment
          </button>
          {this.renderResolveButton(thread)}
        </footer>
      </Fragment>
    );
  };

  renderResolveButton = (thread) => {
    if (thread.isResolved) {
      return (
        <button
          className="github-panel-Review-resolveButton btn icon icon-check"
          title="Unresolve conversation"
          onClick={() => this.resolveUnresolveThread(thread)}
        >
          Unresolve conversation
        </button>
      );
    } else {
      return (
        <button
          className="github-panel-Review-resolveButton btn icon icon-check"
          title="Resolve conversation"
          onClick={() => this.resolveUnresolveThread(thread)}
        >
          Resolve conversation
        </button>
      );
    }
  };

  renderEditedLink(entity) {
    if (!entity.lastEditedAt) {
      return null;
    } else {
      return (
        <span className="github-panel-Review-edited">
          &nbsp;•&nbsp;
          <a className="github-panel-Review-edited" href={entity.url}>
            edited
          </a>
        </span>
      );
    }
  }

  renderAuthorAssociation(entity) {
    const text = authorAssociationText[entity.authorAssociation];
    if (!text) {
      return null;
    }
    return <span className="github-panel-Review-authorAssociationBadge badge">{text}</span>;
  }

  openFile = (evt) => {
    if (!this.props.checkoutOp.isEnabled()) {
      const target = evt.currentTarget;
      this.props.openFile(target.dataset.path, target.dataset.line);
    }
  };

  openDiff = (evt) => {
    const target = evt.currentTarget;
    this.props.openDiff(target.dataset.path, parseInt(target.dataset.line, 10));
  };

  openIssueishLinkInNewTab = (evt) => {
    const { repoOwner, repoName, issueishNumber } = getDataFromGithubUrl(evt.target.dataset.url);
    return this.props.openIssueish(repoOwner, repoName, issueishNumber);
  };

  submitReply(replyHolder, thread, lastComment) {
    const body = replyHolder.map((editor) => editor.getText()).getOr("");
    const didSubmitComment = () =>
      replyHolder.map((editor) => editor.setText("", { bypassReadOnly: true }));
    const didFailComment = () =>
      replyHolder.map((editor) => editor.setText(body, { bypassReadOnly: true }));

    return this.props.addSingleComment(
      body,
      thread.id,
      lastComment.id,
      lastComment.path,
      lastComment.position,
      {
        didSubmitComment,
        didFailComment,
      },
    );
  }

  submitCurrentComment = (evt) => {
    const threadID = evt.currentTarget.dataset.threadId;
    /* istanbul ignore if */
    if (!threadID) {
      return null;
    }

    const { thread, comments } = this.props.commentThreads.find(
      (each) => each.thread.id === threadID,
    );
    const replyHolder = this.replyHolders.get(threadID);

    return this.submitReply(replyHolder, thread, comments[comments.length - 1]);
  };

  getTranslatedPosition(rootComment) {
    let lineNumber, positionText;
    const translations = this.props.commentTranslations;

    const isCheckedOutPullRequest = this.props.checkoutOp.why() === checkoutStates.CURRENT;
    if (translations === null) {
      lineNumber = null;
      positionText = "";
    } else if (rootComment.position === null) {
      lineNumber = null;
      positionText = "outdated";
    } else {
      const translationsForFile = translations.get(path.normalize(rootComment.path));
      lineNumber = translationsForFile.diffToFilePosition.get(parseInt(rootComment.position, 10));
      if (translationsForFile.fileTranslations && isCheckedOutPullRequest) {
        lineNumber = translationsForFile.fileTranslations.get(lineNumber).newPosition;
      }
      positionText = lineNumber;
    }

    return { lineNumber, positionText };
  }

  /* istanbul ignore next */
  scrollToThread(threadID) {
    const threadHolder = this.threadHolders.get(threadID);
    if (threadHolder) {
      threadHolder.map((element) => {
        element.scrollIntoViewIfNeeded();
        return null; // shh, eslint
      });
    }
  }

  async resolveUnresolveThread(thread) {
    if (thread.isResolved) {
      await this.props.unresolveThread(thread);
    } else {
      await this.props.resolveThread(thread);
    }
  }
}
