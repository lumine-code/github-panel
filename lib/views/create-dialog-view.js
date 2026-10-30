/** @babel */
/** @jsx h */
import View, { h } from "../etch/view.js";
import DialogView from "./dialog-view.js";
import RepositoryHomeSelectionView from "./repository-home-selection-view.js";
import DirectorySelect from "./directory-select.js";
import RemoteConfigurationView from "./remote-configuration-view.js";
import TabGroup from "../tab-group.js";
import { TabbableInput, makeTabbable } from "./tabbable.js";
import SelectBox from "./select-box.js";
import Octicon from "../lumine/octicon.js";
const TabbableFolderSelect = makeTabbable(SelectBox);
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
  static defaultProps = {
    publishDirectories: [],
    pathEditable: false,
  };
  constructor(props, children) {
    super(props, children);
    this.tabGroup = new TabGroup();
    this.initialize();
  }
  render() {
    const text = DIALOG_TEXT[this.props.request.identifier];
    return (
      <DialogView
        prompt={text.heading}
        panelClassName="dialog-panel-wide"
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
        <div className="github-panel-Create-repo dialog-field">
          <span className="dialog-label">Repository</span>
          <RepositoryHomeSelectionView
            tabGroup={this.tabGroup}
            commands={this.props.commands}
            autofocusName
            user={this.props.user}
            nameBuffer={this.props.repoName}
            selectedOwnerID={this.props.selectedOwnerID}
            didChangeOwnerID={this.props.didChangeOwnerID}
            isLoading={this.props.isLoading}
            disabled={this.props.inProgress}
            environment={this.props.environment}
          />
        </div>
        <div className="github-panel-Create-visibility">
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
              disabled={this.props.inProgress}
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
              disabled={this.props.inProgress}
              onChange={this.didChangeVisibility}
              environment={this.props.environment}
            />
            <Octicon icon="mirror-private" environment={this.props.environment} />
            Private
          </label>
        </div>
        <div className="github-panel-Create-localPath dialog-field">
          <span className="dialog-label">{text.hostPath}</span>
          {this.props.request.identifier === "publish" &&
            this.props.publishDirectories.length > 1 && (
              <div className="dialog-field">
                <p>Choose one selected folder to publish.</p>
                <TabbableFolderSelect
                  tabGroup={this.tabGroup}
                  commands={this.props.commands}
                  ariaLabel="Folder to publish"
                  disabled={this.props.inProgress}
                  items={[
                    { value: "", label: "Choose a folder…", disabled: true },
                    ...this.props.publishDirectories.map((directory) => ({
                      value: directory,
                      label: directory,
                    })),
                  ]}
                  value={this.props.localPath.getText()}
                  onDidChange={this.props.didSelectPublishDirectory}
                  environment={this.props.environment}
                />
              </div>
            )}
          {this.props.request.identifier === "publish" && this.props.pathEditable && (
            <p>Choose the existing local folder to publish on GitHub.</p>
          )}
          <DirectorySelect
            tabGroup={this.tabGroup}
            commands={this.props.commands}
            buffer={this.props.localPath}
            disabled={
              this.props.inProgress ||
              (this.props.request.identifier === "publish" && !this.props.pathEditable)
            }
            ariaLabel={text.hostPath.replace(/:$/, "")}
            environment={this.props.environment}
          />
        </div>
        <RemoteConfigurationView
          tabGroup={this.tabGroup}
          commands={this.props.commands}
          currentProtocol={this.props.selectedProtocol}
          didChangeProtocol={this.props.didChangeProtocol}
          sourceRemoteBuffer={this.props.sourceRemoteName}
          disabled={this.props.inProgress}
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
