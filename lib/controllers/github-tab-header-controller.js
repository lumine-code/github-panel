/** @babel */
/** @jsx React.createElement */
import React from "react";
import GithubTabHeaderView from "../views/github-tab-header-view";
import { getGitBridge } from "../git-bridge";

export default class GithubTabHeaderController extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      currentWorkDirs: [],
      changingLock: null,
      changingWorkDir: null,
    };
  }

  static getDerivedStateFromProps(props) {
    return {
      currentWorkDirs: props.getCurrentWorkDirs(),
    };
  }

  componentDidMount() {
    this.disposable = this.props.onDidChangeWorkDirs(this.resetWorkDirs);
    const gitPanel = getGitBridge();
    if (gitPanel) {
      this.gitPanelSub = gitPanel.onDidUpdate(() => this.forceUpdate());
    }
  }

  componentDidUpdate(prevProps) {
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
      />
    );
  }

  resetWorkDirs = () => {
    this.setState(() => ({
      currentWorkDirs: [],
    }));
  };

  handleLockToggle = async () => {
    if (this.state.changingLock !== null) {
      return;
    }

    const nextLock = !this.getContextLocked();
    this.setState({ changingLock: nextLock });
    try {
      await this.props.setContextLock(this.state.changingWorkDir || this.getWorkDir(), nextLock);
    } finally {
      this.setState({ changingLock: null });
    }
  };

  handleWorkDirChange = async (e) => {
    if (this.state.changingWorkDir !== null) {
      return;
    }

    const nextWorkDir = e.target.value;
    this.setState({ changingWorkDir: nextWorkDir });
    try {
      await this.props.changeWorkingDirectory(nextWorkDir);
    } finally {
      this.setState({ changingWorkDir: null });
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

  componentWillUnmount() {
    this.disposable.dispose();
    if (this.gitPanelSub) {
      this.gitPanelSub.dispose();
    }
  }
}
