/** @babel */
/** @jsx React.createElement */
import React from "react";
import { CompositeDisposable } from "atom";

import PullRequestPatchContainer from "./pr-patch-container";
import { getGitBridge } from "../git-bridge";
import LoadingView from "../views/loading-view";
import ErrorView from "../views/error-view";

export default class PullRequestChangedFilesContainer extends React.Component {
  constructor(props) {
    super(props);

    this.lastPatch = {
      patch: null,
      subs: new CompositeDisposable(),
    };
  }

  componentWillUnmount() {
    this.lastPatch.subs.dispose();
  }

  render() {
    const patchProps = {
      owner: this.props.owner,
      repo: this.props.repo,
      number: this.props.number,
      endpoint: this.props.endpoint,
      token: this.props.token,
      refetch: this.props.shouldRefetch,
    };

    return (
      <PullRequestPatchContainer {...patchProps}>
        {this.renderPatchResult}
      </PullRequestPatchContainer>
    );
  }

  renderPatchResult = (error, multiFilePatch) => {
    if (error === null && multiFilePatch === null) {
      return <LoadingView />;
    }

    if (error !== null) {
      return <ErrorView descriptions={[error]} />;
    }

    if (multiFilePatch !== this.lastPatch.patch) {
      this.lastPatch.subs.dispose();

      this.lastPatch = {
        subs: new CompositeDisposable(
          ...multiFilePatch
            .getFilePatches()
            .map((fp) => fp.onDidChangeRenderStatus(() => this.forceUpdate())),
        ),
        patch: multiFilePatch,
      };
    }

    const MultiFilePatchController = getGitBridge().MultiFilePatchController;
    return (
      <MultiFilePatchController
        multiFilePatch={multiFilePatch}
        repository={this.props.localRepository}
        reviewCommentsLoading={this.props.reviewCommentsLoading}
        reviewCommentThreads={this.props.reviewCommentThreads}
        surface={() => {}}
        {...this.props}
      />
    );
  };
}
