/** @babel */
/** @jsx h */
import View, { h } from "../etch/view";
import { CompositeDisposable } from "lumine";
import PullRequestPatchContainer from "./pr-patch-container";
import { getGitBridge } from "../git-bridge";
import LoadingView from "../views/loading-view";
import ErrorView from "../views/error-view";
export default class PullRequestChangedFilesContainer extends View {
  state = { diffView: "unified" };

  constructor(props, children) {
    super(props, children);
    this.lastPatch = {
      patch: null,
      subs: new CompositeDisposable(),
    };
    this.initialize();
  }
  willDestroy() {
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
      <PullRequestPatchContainer
        {...patchProps}
        children={this.renderPatchResult}
        environment={this.props.environment}
      />
    );
  }
  renderPatchResult = (error, multiFilePatch) => {
    if (multiFilePatch === null || error !== null) {
      this.lastPatch.subs.dispose();
      this.lastPatch = { patch: null, subs: new CompositeDisposable() };
    }
    if (error === null && multiFilePatch === null) {
      return <LoadingView environment={this.props.environment} />;
    }
    if (error !== null) {
      return <ErrorView descriptions={[error]} environment={this.props.environment} />;
    }
    if (multiFilePatch !== this.lastPatch.patch) {
      this.lastPatch.subs.dispose();
      this.lastPatch = {
        subs: new CompositeDisposable(
          ...multiFilePatch
            .getFilePatches()
            .map((fp) => fp.onDidChangeRenderStatus(() => this.invalidate())),
        ),
        patch: multiFilePatch,
      };
    }
    const ChangesView = getGitBridge().ChangesView;
    return (
      <ChangesView
        {...this.props}
        title="Changed Files"
        readOnly={true}
        initialDiffView={this.state.diffView}
        onDiffViewChange={this.didChangeDiffView}
        multiFilePatch={multiFilePatch}
        repository={this.props.localRepository}
        reviewCommentsLoading={this.props.reviewCommentsLoading}
        reviewCommentThreads={this.props.reviewCommentThreads}
        surface={() => {}}
        environment={this.props.environment}
      />
    );
  };

  didChangeDiffView = (diffView) => this.updateState({ diffView });
}
