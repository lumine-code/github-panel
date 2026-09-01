/** @babel */
/** @jsx React.createElement */
import React from "react";
import path from "path";

import Octicon from "../lumine/octicon";
import SelectBox from "./select-box";

export default class GithubTabHeaderView extends React.Component {
  componentDidMount() {
    if (this.selectRef) {
      this.selectRef.element.addEventListener("wheel", this.handleWheel, { passive: false });
    }
  }

  componentWillUnmount() {
    if (this.selectRef) {
      this.selectRef.element.removeEventListener("wheel", this.handleWheel);
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
        <SelectBox
          ref={(el) => {
            this.selectRef = el;
          }}
          className="github-panel-Project-path"
          // Normalize to match the item values (also path.normalize'd), or on
          // Windows the raw active workdir never string-matches an item and the
          // control falls back to displaying the first entry.
          value={this.props.workdir ? path.normalize(this.props.workdir) : ""}
          disabled={this.props.changingWorkDir}
          ariaLabel="Repository"
          onDidChange={({ value }) => this.props.handleWorkDirChange(value)}
          items={this.renderWorkDirs()}
        />
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
    if (!this.selectRef?.element || this.selectRef.element.disabled) {
      return;
    }
    const items = this.selectRef.items;
    const index = items.findIndex((item) => item.value === this.selectRef.value);
    const nextIndex = index + (e.deltaY > 0 ? 1 : -1);
    if (nextIndex >= 0 && nextIndex < items.length) {
      this.selectRef.setValue(items[nextIndex].value, { emit: true });
    }
    e.preventDefault();
  };

  renderWorkDirs() {
    return this.props.workdirs.map((workdir) => ({
      value: path.normalize(workdir),
      label: path.basename(workdir),
    }));
  }

  renderUser() {
    const login = this.props.user.getLogin();
    const avatarUrl = this.props.user.getAvatarUrl();

    return (
      <img
        className="github-panel-Project-avatar"
        src={avatarUrl || "lumine://github-panel/img/avatar.svg"}
        title={`@${login}`}
        alt={`@${login}'s avatar`}
      />
    );
  }
}
