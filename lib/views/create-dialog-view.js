/** @babel */
/** @jsx h */
import View, { h } from "../etch/view";
import DialogView from "./dialog-view";
import RepositoryHomeSelectionView from "./repository-home-selection-view";
import DirectorySelect from "./directory-select";
import RemoteConfigurationView from "./remote-configuration-view";
import TabGroup from "../tab-group";
import { TabbableInput } from "./tabbable";
import Octicon from "../lumine/octicon";
const DIALOG_TEXT = {
  create: {
    heading: "Create GitHub repository",
    hostPath: "Destination path:",
    progressMessage: "Creating repository...",
    acceptText: "Create",
  },
  publish: {
    heading: "Publish GitHub repository",
    hostPath: "Local path:",
    progressMessage: "Publishing repository...",
    acceptText: "Publish",
  },
};
export default class CreateDialogView extends View {
  constructor(props, children) {
    super(props, children);
    this.tabGroup = new TabGroup();
    this.initialize();
  }
  render() {
    const text = DIALOG_TEXT[this.props.request.identifier];
    return (
      <DialogView
        progressMessage={text.progressMessage}
        acceptEnabled={this.props.acceptEnabled}
        acceptText={text.acceptText}
        accept={this.props.accept}
        cancel={this.props.request.cancel}
        tabGroup={this.tabGroup}
        inProgress={this.props.inProgress}
        error={this.props.error}
        workspace={this.props.workspace}
        commands={this.props.commands}
        environment={this.props.environment}
      >
        <h1 className="github-panel-Create-header">
          <Octicon icon="globe" environment={this.props.environment} />
          {text.heading}
        </h1>
        <div className="github-panel-Create-repo block">
          <RepositoryHomeSelectionView
            tabGroup={this.tabGroup}
            commands={this.props.commands}
            autofocusName
            user={this.props.user}
            nameBuffer={this.props.repoName}
            selectedOwnerID={this.props.selectedOwnerID}
            didChangeOwnerID={this.props.didChangeOwnerID}
            isLoading={this.props.isLoading}
            environment={this.props.environment}
          />
        </div>
        <div className="github-panel-Create-visibility block">
          <span className="github-panel-Create-visibilityHeading">Visibility:</span>
          <label className="github-panel-Create-visibilityOption input-label">
            <TabbableInput
              tabGroup={this.tabGroup}
              commands={this.props.commands}
              className="input-radio"
              type="radio"
              name="visibility"
              value="PUBLIC"
              checked={this.props.selectedVisibility === "PUBLIC"}
              onChange={this.didChangeVisibility}
              environment={this.props.environment}
            />
            <Octicon icon="globe" environment={this.props.environment} />
            Public
          </label>
          <label className="github-panel-Create-visibilityOption input-label">
            <TabbableInput
              tabGroup={this.tabGroup}
              commands={this.props.commands}
              className="input-radio"
              type="radio"
              name="visibility"
              value="PRIVATE"
              checked={this.props.selectedVisibility === "PRIVATE"}
              onChange={this.didChangeVisibility}
              environment={this.props.environment}
            />
            <Octicon icon="mirror-private" environment={this.props.environment} />
            Private
          </label>
        </div>
        <div className="github-panel-Create-localPath">
          <DirectorySelect
            tabGroup={this.tabGroup}
            commands={this.props.commands}
            buffer={this.props.localPath}
            disabled={this.props.request.identifier === "publish"}
            environment={this.props.environment}
          />
        </div>
        <RemoteConfigurationView
          tabGroup={this.tabGroup}
          commands={this.props.commands}
          currentProtocol={this.props.selectedProtocol}
          didChangeProtocol={this.props.didChangeProtocol}
          sourceRemoteBuffer={this.props.sourceRemoteName}
          environment={this.props.environment}
        />
      </DialogView>
    );
  }
  didMount() {
    this.tabGroup.autofocus();
  }
  didChangeVisibility = (event) => this.props.didChangeVisibility(event.target.value);
}
