/** @babel */
/** @jsx React.createElement */
import React, { Fragment } from "react";
import { CompositeDisposable } from "atom";
import path from "path";

import EditorCommentDecorationsController from "./editor-comment-decorations-controller";
import ReviewsItem from "../items/reviews-item";
import Gutter from "../atom/gutter";
import Commands, { Command } from "../atom/commands";
import { toNativePathSep, isCheckedOutPullRequest } from "../helpers";

export class BareCommentDecorationsController extends React.Component {
  constructor(props, context) {
    super(props, context);

    this.subscriptions = new CompositeDisposable();
    this.state = { openEditors: this.props.workspace.getTextEditors() };
  }

  componentDidMount() {
    this.subscriptions.add(
      this.props.workspace.observeTextEditors(this.updateOpenEditors),
      this.props.workspace.onDidDestroyPaneItem(this.updateOpenEditors),
    );
  }

  componentWillUnmount() {
    this.subscriptions.dispose();
  }

  render() {
    if (this.props.pullRequests.length === 0) {
      return null;
    }
    const pullRequest = this.props.pullRequests[0];

    // only show comment decorations if we're on a checked out pull request
    // otherwise, we'd have no way of knowing which comments to show.
    if (
      !isCheckedOutPullRequest(
        this.props.repoData.branches,
        this.props.repoData.remotes,
        pullRequest,
      )
    ) {
      return null;
    }

    const threadDataByPath = new Map();
    const workdirPath = this.props.repoData.workingDirectoryPath;

    for (const { comments, thread } of this.props.commentThreads) {
      // Skip comment threads that are entirely minimized.
      if (comments.every((comment) => comment.isMinimized)) {
        continue;
      }

      // There may be multiple comments in the thread, but we really only care about the root comment when rendering
      // decorations.
      const threadData = {
        rootCommentID: comments[0].id,
        threadID: thread.id,
        position: comments[0].position,
        nativeRelPath: toNativePathSep(comments[0].path),
        fullPath: path.join(workdirPath, toNativePathSep(comments[0].path)),
      };

      if (threadDataByPath.get(threadData.fullPath)) {
        threadDataByPath.get(threadData.fullPath).push(threadData);
      } else {
        threadDataByPath.set(threadData.fullPath, [threadData]);
      }
    }

    const openEditorsWithCommentThreads = this.getOpenEditorsWithCommentThreads(threadDataByPath);
    return (
      <Fragment>
        <Commands registry={this.props.commands} target="atom-workspace">
          <Command command="github-panel:open-reviews-tab" callback={this.openReviewsTab} />
        </Commands>
        {openEditorsWithCommentThreads.map((editor) => {
          const threadData = threadDataByPath.get(editor.getPath());
          const translations = this.props.commentTranslations.get(threadData[0].nativeRelPath);

          return (
            <Fragment key={`github-panel-editor-decoration-${editor.id}`}>
              <Gutter
                name="github-comment-icon"
                priority={1}
                className="comment"
                editor={editor}
                type="decorated"
              />
              <EditorCommentDecorationsController
                endpoint={this.props.endpoint}
                owner={this.props.owner}
                repo={this.props.repo}
                number={pullRequest.number}
                workdir={workdirPath}
                workspace={this.props.workspace}
                editor={editor}
                fileName={editor.getPath()}
                headSha={pullRequest.headRefOid}
                threadsForPath={threadData}
                commentTranslationsForPath={translations}
              />
            </Fragment>
          );
        })}
      </Fragment>
    );
  }

  getOpenEditorsWithCommentThreads(threadDataByPath) {
    const haveThreads = [];
    for (const editor of this.state.openEditors) {
      if (threadDataByPath.has(editor.getPath())) {
        haveThreads.push(editor);
      }
    }
    return haveThreads;
  }

  updateOpenEditors = () => {
    return new Promise((resolve) => {
      this.setState({ openEditors: this.props.workspace.getTextEditors() }, resolve);
    });
  };

  openReviewsTab = () => {
    const [pullRequest] = this.props.pullRequests;
    /* istanbul ignore if */
    if (!pullRequest) {
      return null;
    }

    const uri = ReviewsItem.buildURI({
      host: this.props.endpoint.getHost(),
      owner: this.props.owner,
      repo: this.props.repo,
      number: pullRequest.number,
      workdir: this.props.repoData.workingDirectoryPath,
    });
    return this.props.workspace.open(uri, { searchAllPanes: true });
  };
}

export default BareCommentDecorationsController;
