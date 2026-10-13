/** @babel */
/** @jsx h */
import View, { h } from "../etch/view.js";
import { Emitter } from "lumine";
import { autobind } from "../helpers.js";
import { getEndpoint } from "../models/endpoint.js";
import IssueishDetailContainer from "../containers/issueish-detail-container.js";
import RefHolder from "../models/ref-holder.js";
import RepositoryObservation from "../repository-observation.js";
import LoadingView from "../views/loading-view.js";
import ErrorView from "../views/error-view.js";
export default class IssueishDetailItem extends View {
  static tabs = {
    OVERVIEW: 0,
    BUILD_STATUS: 1,
    COMMITS: 2,
    FILES: 3,
  };
  static defaultProps = {
    initSelectedTab: IssueishDetailItem.tabs.OVERVIEW,
  };
  static uriPattern =
    "lumine-github://issueish/{host}/{owner}/{repo}/{issueishNumber}?workdir={workingDirectory}";
  static buildURI({ host, owner, repo, number, workdir }) {
    const encodeOptionalParam = (param) => (param ? encodeURIComponent(param) : "");
    return (
      "lumine-github://issueish/" +
      encodeURIComponent(host) +
      "/" +
      encodeURIComponent(owner) +
      "/" +
      encodeURIComponent(repo) +
      "/" +
      encodeURIComponent(number) +
      "?workdir=" +
      encodeOptionalParam(workdir)
    );
  }
  constructor(props, children) {
    super(props, children);
    autobind(this, "switchToIssueish", "handleTitleChanged");
    this.emitter = new Emitter();
    this.title = `${this.props.owner}/${this.props.repo}#${this.props.issueishNumber}`;
    this.hasTerminatedPendingState = false;
    this.repositorySelectionRequest = 0;
    this.resourceRevision = 0;
    this.pendingRepositoryLeases = new Set();
    this.repositoryObservation = new RepositoryObservation({
      onReady: (repository) => {
        if (repository && this.state.repository !== repository) this.updateState({ repository });
      },
      onChange: () => this.invalidate(),
    });
    this.repositoryObservation.select(this.props.workdirContextPool, this.props.workingDirectory);
    const repository = !this.props.workingDirectory
      ? this.props.workdirContextPool.getAbsentRepository()
      : this.repositoryObservation.repository;
    this.state = {
      host: this.props.host,
      owner: this.props.owner,
      repo: this.props.repo,
      issueishNumber: this.props.issueishNumber,
      repository,
      initChangedFilePath: this.props.initChangedFilePath || "",
      initChangedFilePosition: this.props.initChangedFilePosition || 0,
      selectedTab: this.props.initSelectedTab,
      presentationState: this.props.presentationState,
      copySnapshot: this.props.copySnapshot,
    };
    if (repository.isAbsent()) {
      this.switchToIssueish(this.props.owner, this.props.repo, this.props.issueishNumber);
    }
    this.refEditor = new RefHolder();
    this.refPatchView = new RefHolder();
    this.editorSubscription = this.refEditor.observe((editor) => {
      if (editor.isAlive()) {
        this.emitter.emit("did-change-embedded-text-editor", editor);
        const disposable = lumine.textEditors.add(editor, {
          role: "viewer",
        });
        editor.onDidDestroy(() => disposable.dispose());
      }
    });
    this.initialize();
  }
  render() {
    this.repositoryObservation.select(
      this.props.workdirContextPool,
      this.repositoryObservation.directory || this.props.workingDirectory,
    );
    if (this.repositoryObservation.error) {
      return <ErrorView descriptions={[this.repositoryObservation.error.message]} />;
    }
    if (!this.repositoryObservation.isReady) return <LoadingView />;
    return (
      <IssueishDetailContainer
        endpoint={getEndpoint(this.state.host)}
        owner={this.state.owner}
        repo={this.state.repo}
        issueishNumber={this.state.issueishNumber}
        initChangedFilePath={this.state.initChangedFilePath}
        initChangedFilePosition={this.state.initChangedFilePosition}
        selectedTab={this.state.selectedTab}
        onTabSelected={this.onTabSelected}
        onOpenFilesTab={this.onOpenFilesTab}
        repository={this.state.repository}
        workspace={this.props.workspace}
        loginModel={this.props.loginModel}
        onTitleChange={this.handleTitleChanged}
        switchToIssueish={this.switchToIssueish}
        commands={this.props.commands}
        keymaps={this.props.keymaps}
        tooltips={this.props.tooltips}
        config={this.props.config}
        destroy={this.destroy}
        itemType={this.constructor}
        refEditor={this.refEditor}
        refPatchView={this.refPatchView}
        presentationState={this.state.presentationState}
        copySnapshot={this.state.copySnapshot}
        reportRelayError={this.props.reportRelayError}
        environment={this.props.environment}
      />
    );
  }
  async switchToIssueish(owner, repo, issueishNumber) {
    const pool = this.props.workdirContextPool;
    this.repositoryObservation.select(
      pool,
      this.repositoryObservation.directory || this.props.workingDirectory,
    );
    const request = ++this.repositorySelectionRequest;
    for (const lease of this.pendingRepositoryLeases) lease.dispose();
    this.pendingRepositoryLeases.clear();
    const prev = {
      owner: this.state.owner,
      repo: this.state.repo,
      issueishNumber: this.state.issueishNumber,
    };
    try {
      await this.repositoryObservation.ready;
    } catch (error) {
      if (this.destroyed || request !== this.repositorySelectionRequest) return;
      throw error;
    }
    if (this.destroyed || request !== this.repositorySelectionRequest) return;
    const currentRepository = this.repositoryObservation.repository || this.state.repository;
    const nextRepository = (await currentRepository.hasGitHubRemote(this.state.host, owner, repo))
      ? currentRepository
      : (await pool.getMatchingContext(this.state.host, owner, repo)).getRepository();
    if (this.destroyed || request !== this.repositorySelectionRequest) return;
    const directory = nextRepository.getWorkingDirectoryPath();
    let lease = directory && typeof pool.retain === "function" ? pool.retain(directory) : null;
    if (lease) this.pendingRepositoryLeases.add(lease);
    try {
      await lease?.ready;
      if (this.destroyed || request !== this.repositorySelectionRequest) return;
      await this.updateState((prevState, props) => {
        if (
          pool === props.workdirContextPool &&
          prevState.owner === prev.owner &&
          prevState.repo === prev.repo &&
          prevState.issueishNumber === prev.issueishNumber
        ) {
          this.repositoryObservation.select(pool, directory, lease);
          this.resourceRevision++;
          this.state.copySnapshot?.dispose();
          if (lease) this.pendingRepositoryLeases.delete(lease);
          lease = null;
          return {
            owner,
            repo,
            issueishNumber,
            repository: this.repositoryObservation.repository || nextRepository,
            presentationState: null,
            copySnapshot: null,
          };
        }
        return {};
      });
    } catch (error) {
      if (this.destroyed || request !== this.repositorySelectionRequest) return;
      throw error;
    } finally {
      if (lease) {
        this.pendingRepositoryLeases.delete(lease);
        lease.dispose();
      }
    }
  }
  handleTitleChanged(title) {
    if (this.title !== title) {
      this.title = title;
      this.emitter.emit("did-change-title", title);
    }
  }

  didUpdate(_previousProps, previousState) {
    if (
      previousState &&
      ["host", "owner", "repo", "issueishNumber", "repository"].some(
        (key) => previousState[key] !== this.state[key],
      )
    ) {
      this.emitter.emit("did-change-uri");
    }
  }

  getURI() {
    return IssueishDetailItem.buildURI({
      host: this.state.host,
      owner: this.state.owner,
      repo: this.state.repo,
      number: this.state.issueishNumber,
      workdir: this.repositoryObservation.directory || this.props.workingDirectory,
    });
  }

  getPaneItemRevision() {
    return this.resourceRevision;
  }

  onDidChangeURI(callback) {
    return this.emitter.on("did-change-uri", callback);
  }

  captureCopyState() {
    const patchView = this.refPatchView.getOr(null);
    return {
      initSelectedTab: this.state.selectedTab,
      initChangedFilePath: this.state.initChangedFilePath,
      initChangedFilePosition: this.state.initChangedFilePosition,
      presentationState: patchView?.capturePresentationState() ?? this.state.presentationState,
      copySnapshot:
        patchView?.captureCopySnapshot() ??
        (this.state.copySnapshot?.isAvailable() ? this.state.copySnapshot.clone() : undefined),
    };
  }

  focus() {
    if (this.destroyed) return;
    const embedded = this.refEditor.getOr(null)?.getElement();
    if (this.state.selectedTab === IssueishDetailItem.tabs.FILES && embedded?.isConnected) {
      if (this.refPatchView.getOr(null)) this.refPatchView.get().focus();
      else embedded.focus();
    } else {
      this.element
        .querySelector('[role="tab"][aria-selected="true"], button, a[href], input')
        ?.focus();
    }
  }
  onDidChangeTitle(cb) {
    return this.emitter.on("did-change-title", cb);
  }
  terminatePendingState() {
    if (!this.hasTerminatedPendingState) {
      this.emitter.emit("did-terminate-pending-state");
      this.hasTerminatedPendingState = true;
    }
  }
  onDidTerminatePendingState(callback) {
    return this.emitter.on("did-terminate-pending-state", callback);
  }
  destroy = () => super.destroy();
  willDestroy() {
    this.repositorySelectionRequest++;
    this.repositoryObservation.dispose();
    for (const lease of this.pendingRepositoryLeases) lease.dispose();
    this.pendingRepositoryLeases.clear();
    /* istanbul ignore else */
    if (!this.isDestroyed) {
      this.emitter.emit("did-destroy");
      this.isDestroyed = true;
      this.editorSubscription.dispose();
      this.emitter.dispose();
    }
  }
  onDidDestroy(callback) {
    return this.emitter.on("did-destroy", callback);
  }
  serialize() {
    return {
      uri: this.getURI(),
      selectedTab: this.state.selectedTab,
      deserializer: "IssueishDetailItem",
    };
  }
  getTitle() {
    return this.title;
  }
  observeEmbeddedTextEditor(cb) {
    this.refEditor.map((editor) => editor.isAlive() && cb(editor));
    return this.emitter.on("did-change-embedded-text-editor", cb);
  }
  openFilesTab({ changedFilePath, changedFilePosition }) {
    this.updateState(
      {
        selectedTab: IssueishDetailItem.tabs.FILES,
        initChangedFilePath: changedFilePath,
        initChangedFilePosition: changedFilePosition,
      },
      () => {
        this.emitter.emit("on-open-files-tab", {
          changedFilePath,
          changedFilePosition,
        });
      },
    );
  }
  onTabSelected = (index) =>
    this.updateState({
      selectedTab: index,
      initChangedFilePath: "",
      initChangedFilePosition: 0,
    });
  onOpenFilesTab = (callback) => this.emitter.on("on-open-files-tab", callback);
}
