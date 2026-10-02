/** @babel */
/** @jsx h */
import View, { h } from "../etch/view";
import GithubTabHeaderView from "../views/github-tab-header-view";
import { getGitBridge } from "../git-bridge";
export default class GithubTabHeaderController extends View {
  constructor(props, children) {
    super(props, children);
    this.state = {
      currentWorkDirs: [],
      changingLock: null,
      changingWorkDir: null,
    };
    this.initialize();
  }
  static deriveState(props) {
    return {
      currentWorkDirs: props.getCurrentWorkDirs(),
    };
  }
  didMount() {
    this.disposable = this.props.onDidChangeWorkDirs(this.resetWorkDirs);
    const gitPanel = getGitBridge();
    if (gitPanel) {
      this.gitPanelSub = gitPanel.onDidUpdate(() => this.invalidate());
    }
  }
  didUpdate(prevProps) {
    if (prevProps.onDidChangeWorkDirs !== this.props.onDidChangeWorkDirs) {
      if (this.disposable) {
        this.disposable.dispose();
      }
      this.disposable = this.props.onDidChangeWorkDirs(this.resetWorkDirs);
    }
  }
  render() {
    return (
      <GithubTabHeaderView
        user={this.props.user}
        // Workspace
        workdir={this.getWorkDir()}
        workdirs={this.state.currentWorkDirs}
        contextLocked={this.getContextLocked()}
        changingWorkDir={this.state.changingWorkDir !== null}
        changingLock={this.state.changingLock !== null}
        handleWorkDirChange={this.handleWorkDirChange}
        handleLockToggle={this.handleLockToggle}
        environment={this.props.environment}
      />
    );
  }
  resetWorkDirs = () => {
    this.updateState(() => ({
      currentWorkDirs: [],
    }));
  };
  handleLockToggle = async () => {
    if (this.state.changingLock !== null) {
      return;
    }
    const nextLock = !this.getContextLocked();
    this.updateState({
      changingLock: nextLock,
    });
    try {
      await this.props.setContextLock(this.state.changingWorkDir || this.getWorkDir(), nextLock);
    } finally {
      this.updateState({
        changingLock: null,
      });
    }
  };
  handleWorkDirChange = async (nextWorkDir) => {
    if (this.state.changingWorkDir !== null) {
      return;
    }
    this.updateState({
      changingWorkDir: nextWorkDir,
    });
    try {
      await this.props.changeWorkingDirectory(nextWorkDir);
    } finally {
      this.updateState({
        changingWorkDir: null,
      });
    }
  };
  getWorkDir() {
    if (this.state.changingWorkDir !== null) {
      return this.state.changingWorkDir;
    }
    const gitPanel = getGitBridge();
    return gitPanel ? gitPanel.getActiveWorkdir() : this.props.currentWorkDir;
  }
  getContextLocked() {
    if (this.state.changingLock !== null) {
      return this.state.changingLock;
    }
    const gitPanel = getGitBridge();
    return gitPanel ? gitPanel.isContextLocked() : this.props.contextLocked;
  }
  willDestroy() {
    this.disposable.dispose();
    if (this.gitPanelSub) {
      this.gitPanelSub.dispose();
    }
  }
}
