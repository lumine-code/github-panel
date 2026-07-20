/** @babel */
/** @jsx React.createElement */
import React from "react";
import { TextBuffer } from "atom";
import { CompositeDisposable } from "atom";
import path from "path";

import CreateDialogView from "../views/create-dialog-view";

export class BareCreateDialogController extends React.Component {
  constructor(props) {
    super(props);

    const { localDir } = this.props.request.getParams();

    this.projectHome = this.props.config.get("core.projectHome");
    this.modified = {
      repoName: false,
      localPath: false,
    };

    this.repoName = new TextBuffer({
      text: localDir ? path.basename(localDir) : "",
    });
    this.localPath = new TextBuffer({
      text: localDir || this.projectHome,
    });
    this.sourceRemoteName = new TextBuffer({
      text: this.props.config.get("git-panel.sourceRemoteName"),
    });

    this.subs = new CompositeDisposable(
      this.repoName.onDidChange(this.didChangeRepoName),
      this.localPath.onDidChange(this.didChangeLocalPath),
      this.sourceRemoteName.onDidChange(this.didChangeSourceRemoteName),
      this.props.config.onDidChange("git-panel.sourceRemoteName", this.readSourceRemoteNameSetting),
      this.props.config.onDidChange(
        "git-panel.remoteFetchProtocol",
        this.readRemoteFetchProtocolSetting,
      ),
    );

    this.state = {
      acceptEnabled: this.acceptIsEnabled(),
      selectedVisibility: "PUBLIC",
      selectedProtocol: this.props.config.get("git-panel.remoteFetchProtocol"),
      selectedOwnerID: this.props.user ? this.props.user.id : "",
    };
  }

  render() {
    return (
      <CreateDialogView
        selectedOwnerID={this.state.selectedOwnerID}
        repoName={this.repoName}
        selectedVisibility={this.state.selectedVisibility}
        localPath={this.localPath}
        sourceRemoteName={this.sourceRemoteName}
        selectedProtocol={this.state.selectedProtocol}
        didChangeOwnerID={this.didChangeOwnerID}
        didChangeVisibility={this.didChangeVisibility}
        didChangeProtocol={this.didChangeProtocol}
        acceptEnabled={this.state.acceptEnabled}
        accept={this.accept}
        {...this.props}
      />
    );
  }

  componentDidUpdate(prevProps) {
    if (this.props.user !== prevProps.user) {
      this.recheckAcceptEnablement();
    }
  }

  componentWillUnmount() {
    this.subs.dispose();
  }

  didChangeRepoName = () => {
    this.modified.repoName = true;
    if (!this.modified.localPath) {
      if (this.localPath.getText() === this.projectHome) {
        this.localPath.setText(path.join(this.projectHome, this.repoName.getText()));
      } else {
        const dirName = path.dirname(this.localPath.getText());
        this.localPath.setText(path.join(dirName, this.repoName.getText()));
      }
      this.modified.localPath = false;
    }
    this.recheckAcceptEnablement();
  };

  didChangeOwnerID = (ownerID) =>
    new Promise((resolve) => this.setState({ selectedOwnerID: ownerID }, resolve));

  didChangeLocalPath = () => {
    this.modified.localPath = true;
    if (!this.modified.repoName) {
      this.repoName.setText(path.basename(this.localPath.getText()));
      this.modified.repoName = false;
    }
    this.recheckAcceptEnablement();
  };

  didChangeVisibility = (visibility) => {
    return new Promise((resolve) => this.setState({ selectedVisibility: visibility }, resolve));
  };

  didChangeSourceRemoteName = () => {
    this.writeSourceRemoteNameSetting();
    this.recheckAcceptEnablement();
  };

  didChangeProtocol = async (protocol) => {
    await new Promise((resolve) => this.setState({ selectedProtocol: protocol }, resolve));
    this.writeRemoteFetchProtocolSetting(protocol);
  };

  readSourceRemoteNameSetting = ({ newValue }) => {
    if (newValue !== this.sourceRemoteName.getText()) {
      this.sourceRemoteName.setText(newValue);
    }
  };

  writeSourceRemoteNameSetting() {
    if (this.props.config.get("git-panel.sourceRemoteName") !== this.sourceRemoteName.getText()) {
      this.props.config.set("git-panel.sourceRemoteName", this.sourceRemoteName.getText());
    }
  }

  readRemoteFetchProtocolSetting = ({ newValue }) => {
    if (newValue !== this.state.selectedProtocol) {
      this.setState({ selectedProtocol: newValue });
    }
  };

  writeRemoteFetchProtocolSetting(protocol) {
    if (this.props.config.get("git-panel.remoteFetchProtocol") !== protocol) {
      this.props.config.set("git-panel.remoteFetchProtocol", protocol);
    }
  }

  acceptIsEnabled() {
    return (
      !this.repoName.isEmpty() &&
      !this.localPath.isEmpty() &&
      !this.sourceRemoteName.isEmpty() &&
      this.props.user !== null
    );
  }

  recheckAcceptEnablement() {
    const nextEnablement = this.acceptIsEnabled();
    if (nextEnablement !== this.state.acceptEnabled) {
      this.setState({ acceptEnabled: nextEnablement });
    }
  }

  accept = () => {
    if (!this.acceptIsEnabled()) {
      return Promise.resolve();
    }

    const ownerID =
      this.state.selectedOwnerID !== "" ? this.state.selectedOwnerID : this.props.user.id;

    return this.props.request.accept({
      ownerID,
      name: this.repoName.getText(),
      visibility: this.state.selectedVisibility,
      localPath: this.localPath.getText(),
      protocol: this.state.selectedProtocol,
      sourceRemoteName: this.sourceRemoteName.getText(),
    });
  };
}

export default BareCreateDialogController;
