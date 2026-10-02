/** @babel */
/** @jsx h */
import View, { h } from "../etch/view";
import path from "path";
import ReviewsView, { reviewContextKey } from "../views/reviews-view";
import PullRequestCheckoutController from "../controllers/pr-checkout-controller";
import addReviewMutation from "../mutations/add-pr-review";
import addReviewCommentMutation from "../mutations/add-pr-review-comment";
import submitReviewMutation from "../mutations/submit-pr-review";
import deleteReviewMutation from "../mutations/delete-pr-review";
import resolveReviewThreadMutation from "../mutations/resolve-review-thread";
import unresolveReviewThreadMutation from "../mutations/unresolve-review-thread";
import updatePrReviewCommentMutation from "../mutations/update-pr-review-comment";
import updatePrReviewSummaryMutation from "../mutations/update-pr-review-summary";
import IssueishDetailItem from "../items/issueish-detail-item";

// Milliseconds to update highlightedThreadIDs
const FLASH_DELAY = 1500;
export class BareReviewsController extends View {
  constructor(props, children) {
    super(props, children);
    this.state = {
      contextLines: 4,
      postingToThreadID: null,
      scrollToThreadID: this.props.initThreadID,
      summarySectionOpen: true,
      commentSectionOpen: true,
      threadIDsOpen: new Set(this.props.initThreadID ? [this.props.initThreadID] : []),
      highlightedThreadIDs: new Set(),
    };
    this.highlightTimers = new Map();
    this.activeSubmission = null;
    this.initialize();
  }
  update(props, children) {
    if (this.destroyed) return Promise.resolve();
    const contextChanged = reviewContextKey(this.props) !== reviewContextKey(props);
    if (contextChanged || this.props.environment?.token !== props.environment?.token) {
      this.rememberPrevious();
      this.activeSubmission = null;
      this.state = { ...this.state, postingToThreadID: null };
    }
    if (contextChanged) {
      for (const timer of this.highlightTimers.values()) clearTimeout(timer);
      this.highlightTimers.clear();
      this.state = {
        ...this.state,
        postingToThreadID: null,
        scrollToThreadID: props.initThreadID,
        threadIDsOpen: new Set(props.initThreadID ? [props.initThreadID] : []),
        highlightedThreadIDs: new Set(),
      };
    }
    return super.update(props, children);
  }
  didMount() {
    const { scrollToThreadID } = this.state;
    if (scrollToThreadID) {
      this.highlightThread(scrollToThreadID);
    }
  }
  willDestroy() {
    this.activeSubmission = null;
    for (const timer of this.highlightTimers.values()) clearTimeout(timer);
    this.highlightTimers.clear();
  }
  didUpdate(prevProps) {
    const { initThreadID } = this.props;
    if (initThreadID && initThreadID !== prevProps.initThreadID) {
      this.updateState((prev) => {
        prev.threadIDsOpen.add(initThreadID);
        this.highlightThread(initThreadID);
        return {
          commentSectionOpen: true,
          scrollToThreadID: initThreadID,
        };
      });
    }
  }
  render() {
    return (
      <PullRequestCheckoutController
        repository={this.props.repository}
        pullRequest={this.props.pullRequest}
        localRepository={this.props.localRepository}
        isAbsent={this.props.isAbsent}
        isLoading={this.props.isLoading}
        isPresent={this.props.isPresent}
        isMerging={this.props.isMerging}
        isRebasing={this.props.isRebasing}
        branches={this.props.branches}
        remotes={this.props.remotes}
        children={(checkoutOp) => (
          <ReviewsView
            checkoutOp={checkoutOp}
            contextLines={this.state.contextLines}
            postingToThreadID={this.state.postingToThreadID}
            summarySectionOpen={this.state.summarySectionOpen}
            commentSectionOpen={this.state.commentSectionOpen}
            threadIDsOpen={this.state.threadIDsOpen}
            highlightedThreadIDs={this.state.highlightedThreadIDs}
            scrollToThreadID={this.state.scrollToThreadID}
            moreContext={this.moreContext}
            lessContext={this.lessContext}
            openFile={this.openFile}
            openDiff={this.openDiff}
            openPR={this.openPR}
            openIssueish={this.openIssueish}
            showSummaries={this.showSummaries}
            hideSummaries={this.hideSummaries}
            showComments={this.showComments}
            hideComments={this.hideComments}
            showThreadID={this.showThreadID}
            hideThreadID={this.hideThreadID}
            resolveThread={this.resolveThread}
            unresolveThread={this.unresolveThread}
            addSingleComment={this.addSingleComment}
            updateComment={this.updateComment}
            updateSummary={this.updateSummary}
            {...this.props}
            environment={this.props.environment}
          />
        )}
        environment={this.props.environment}
      />
    );
  }
  openFile = async (filePath, lineNumber) => {
    await this.props.workspace.open(path.join(this.props.workdir, filePath), {
      initialLine: lineNumber - 1,
      initialColumn: 0,
      pending: true,
    });
  };
  openDiff = async (filePath, lineNumber) => {
    const item = await this.getPRDetailItem();
    item.openFilesTab({
      changedFilePath: filePath,
      changedFilePosition: lineNumber,
    });
  };
  openPR = async () => {
    await this.getPRDetailItem();
  };
  getPRDetailItem = async () => {
    const item = await this.props.workspace.open(
      IssueishDetailItem.buildURI({
        host: this.props.endpoint.getHost(),
        owner: this.props.owner,
        repo: this.props.repo,
        number: this.props.number,
        workdir: this.props.workdir,
      }),
      {
        pending: true,
        searchAllPanes: true,
      },
    );
    return item?.whenHydrated ? await item.whenHydrated() : item;
  };
  moreContext = () => {
    this.updateState((prev) => ({
      contextLines: prev.contextLines + 1,
    }));
  };
  lessContext = () => {
    this.updateState((prev) => ({
      contextLines: Math.max(prev.contextLines - 1, 1),
    }));
  };
  openIssueish = async (owner, repo, number) => {
    const host = this.props.endpoint.getHost();
    const homeRepository = (await this.props.localRepository.hasGitHubRemote(host, owner, repo))
      ? this.props.localRepository
      : (await this.props.workdirContextPool.getMatchingContext(host, owner, repo)).getRepository();
    const uri = IssueishDetailItem.buildURI({
      host,
      owner,
      repo,
      number,
      workdir: homeRepository.getWorkingDirectoryPath(),
    });
    return this.props.workspace.open(uri, {
      pending: true,
      searchAllPanes: true,
    });
  };
  showSummaries = () =>
    this.updateState({
      summarySectionOpen: true,
    });
  hideSummaries = () =>
    this.updateState({
      summarySectionOpen: false,
    });
  showComments = () =>
    this.updateState({
      commentSectionOpen: true,
    });
  hideComments = () =>
    this.updateState({
      commentSectionOpen: false,
    });
  showThreadID = (commentID) =>
    this.updateState((state) => {
      state.threadIDsOpen.add(commentID);
      return {};
    });
  hideThreadID = (commentID) =>
    this.updateState((state) => {
      state.threadIDsOpen.delete(commentID);
      return {};
    });
  highlightThread = (threadID) => {
    this.updateState(
      (state) => {
        state.highlightedThreadIDs.add(threadID);
        return {};
      },
      () => {
        clearTimeout(this.highlightTimers.get(threadID));
        const timer = setTimeout(() => {
          this.highlightTimers.delete(threadID);
          this.updateState((state) => {
            state.highlightedThreadIDs.delete(threadID);
            if (state.scrollToThreadID === threadID) {
              return {
                scrollToThreadID: null,
              };
            }
            return {};
          });
        }, FLASH_DELAY);
        this.highlightTimers.set(threadID, timer);
      },
    );
  };
  resolveThread = async (thread) => {
    if (thread.viewerCanResolve) {
      // optimistically hide the thread to avoid jankiness;
      // if the operation fails, the onError callback will revert it.
      this.hideThreadID(thread.id);
      try {
        await resolveReviewThreadMutation(this.props.environment, {
          threadID: thread.id,
          viewerID: this.props.viewer.id,
          viewerLogin: this.props.viewer.login,
        });
        this.props.refetch?.(() => {});
        this.highlightThread(thread.id);
      } catch (err) {
        this.showThreadID(thread.id);
        this.props.reportRelayError("Unable to resolve the comment thread", err);
      }
    }
  };
  unresolveThread = async (thread) => {
    if (thread.viewerCanUnresolve) {
      try {
        await unresolveReviewThreadMutation(this.props.environment, {
          threadID: thread.id,
          viewerID: this.props.viewer.id,
          viewerLogin: this.props.viewer.login,
        });
        this.props.refetch?.(() => {});
        this.highlightThread(thread.id);
      } catch (err) {
        this.props.reportRelayError("Unable to unresolve the comment thread", err);
      }
    }
  };
  addSingleComment = async (
    commentBody,
    threadID,
    replyToID,
    commentPath,
    position,
    callbacks = {},
  ) => {
    if (this.destroyed || this.activeSubmission) return false;
    const submission = {
      context: reviewContextKey(this.props),
      environment: { ...this.props.environment },
      pullRequestID: this.props.pullRequest.id,
      viewerID: this.props.viewer.id,
      threadID,
    };
    this.activeSubmission = submission;
    const isCurrent = () =>
      !this.destroyed &&
      this.activeSubmission === submission &&
      reviewContextKey(this.props) === submission.context &&
      this.props.environment?.token === submission.environment.token &&
      this.props.commentThreads.some(({ thread }) => thread.id === threadID);
    let pendingReviewID = null;
    let failure = null;
    try {
      this.updateState({
        postingToThreadID: threadID,
      });
      const reviewResult = await addReviewMutation(submission.environment, {
        pullRequestID: submission.pullRequestID,
        viewerID: submission.viewerID,
      });
      const reviewID = reviewResult?.addPullRequestReview?.reviewEdge?.node?.id;
      if (!reviewID) throw new Error("GitHub did not confirm creation of the pending review.");
      pendingReviewID = reviewID;
      if (!isCurrent()) return false;
      const commentResult = await addReviewCommentMutation(submission.environment, {
        body: commentBody,
        inReplyTo: replyToID,
        reviewID,
        threadID,
        viewerID: submission.viewerID,
        path: commentPath,
        position,
      });
      if (!commentResult?.addPullRequestReviewComment?.commentEdge?.node?.id) {
        throw new Error("GitHub did not confirm creation of your comment.");
      }
      if (!isCurrent()) return false;
      const submitResult = await submitReviewMutation(submission.environment, {
        event: "COMMENT",
        reviewID,
      });
      if (submitResult?.submitPullRequestReview?.pullRequestReview?.id !== reviewID) {
        throw new Error("GitHub did not confirm submission of your review.");
      }
      pendingReviewID = null;
      if (isCurrent()) {
        callbacks.didSubmitComment?.();
        this.props.refetch?.(() => {});
      }
      return true;
    } catch (error) {
      failure = error;
      if (isCurrent()) callbacks.didFailComment?.();
      return false;
    } finally {
      if (pendingReviewID !== null) {
        try {
          await deleteReviewMutation(submission.environment, {
            reviewID: pendingReviewID,
            pullRequestID: submission.pullRequestID,
          });
        } catch (e) {
          /* istanbul ignore else */
          if (failure?.errors && e.errors) {
            failure.errors.push(...e.errors);
          } else if (isCurrent()) {
            console.warn("Unable to delete pending review", e);
          }
        }
      }
      if (failure && isCurrent())
        this.props.reportRelayError("Unable to submit your comment", failure);
      if (this.activeSubmission === submission) {
        this.activeSubmission = null;
        this.updateState({ postingToThreadID: null });
      }
    }
  };
  updateComment = async (commentId, commentBody) => {
    try {
      await updatePrReviewCommentMutation(this.props.environment, {
        commentId,
        commentBody,
      });
      this.props.refetch?.(() => {});
    } catch (error) {
      this.props.reportRelayError("Unable to update comment", error);
      throw error;
    }
  };
  updateSummary = async (reviewId, reviewBody) => {
    try {
      await updatePrReviewSummaryMutation(this.props.environment, {
        reviewId,
        reviewBody,
      });
      this.props.refetch?.(() => {});
    } catch (error) {
      this.props.reportRelayError("Unable to update review summary", error);
      throw error;
    }
  };
}
export default BareReviewsController;
