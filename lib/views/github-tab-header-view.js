/** @babel */
/** @jsx React.createElement */
import React from "react";
import path from "path";

import Octicon from "../atom/octicon";

export default class GithubTabHeaderView extends React.Component {
  componentDidMount() {
    if (this.selectRef) {
      this.selectRef.addEventListener("wheel", this.handleWheel, { passive: false });
    }
  }

  componentWillUnmount() {
    if (this.selectRef) {
      this.selectRef.removeEventListener("wheel", this.handleWheel);
    }
  }

  render() {
    const lockIcon = this.props.contextLocked ? "lock" : "unlock";
    const lockToggleTitle = this.props.contextLocked
      ? "Change repository with the dropdown"
      : "Follow the active pane item";

    return (
      <header className="github-panel-Project">
        {this.renderUser()}
        <select
          ref={(el) => {
            this.selectRef = el;
          }}
          className="github-panel-Project-path input-select"
          // Normalize to match the <option> values (also path.normalize'd), or on
          // Windows the raw active workdir never string-matches an option and the
          // control falls back to displaying the first entry.
          value={this.props.workdir ? path.normalize(this.props.workdir) : ""}
          disabled={this.props.changingWorkDir}
          onChange={this.props.handleWorkDirChange}
        >
          {this.renderWorkDirs()}
        </select>
        <button
          className="github-panel-Project-lock btn btn-small"
          onClick={this.props.handleLockToggle}
          disabled={this.props.changingLock}
          title={lockToggleTitle}
        >
          <Octicon icon={lockIcon} />
        </button>
      </header>
    );
  }

  handleWheel = (e) => {
    const select = e.currentTarget;
    const delta = e.deltaY > 0 ? 1 : -1;
    const nextIndex = select.selectedIndex + delta;
    if (nextIndex >= 0 && nextIndex < select.options.length) {
      select.selectedIndex = nextIndex;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
    e.preventDefault();
  };

  renderWorkDirs() {
    const workdirs = [];
    for (const workdir of this.props.workdirs) {
      workdirs.push(
        <option key={workdir} value={path.normalize(workdir)}>
          {path.basename(workdir)}
        </option>,
      );
    }
    return workdirs;
  }

  renderUser() {
    const login = this.props.user.getLogin();
    const avatarUrl = this.props.user.getAvatarUrl();

    return (
      <img
        className="github-panel-Project-avatar"
        src={avatarUrl || "atom://github-panel/img/avatar.svg"}
        title={`@${login}`}
        alt={`@${login}'s avatar`}
      />
    );
  }
}
