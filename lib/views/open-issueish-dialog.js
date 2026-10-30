/** @babel */
/** @jsx h */
import View, { h } from "../etch/view.js";
import { TextBuffer } from "lumine";
import IssueishDetailItem from "../items/issueish-detail-item.js";
import TabGroup from "../tab-group.js";
import DialogView from "./dialog-view.js";
import { TabbableTextEditor } from "./tabbable.js";
import { fitsInput, inputError, FIELD_LIMIT } from "../input-budget.js";
const ISSUEISH_URL_REGEX =
  /^(?:https?:\/\/)?(github.com)\/([^/]+)\/([^/]+)\/(?:issues|pull)\/(\d+)/;
export default class OpenIssueishDialog extends View {
  constructor(props, children) {
    super(props, children);
    this.url = new TextBuffer();
    this.state = {
      acceptEnabled: false,
    };
    this.sub = this.url.onDidChange(this.didChangeURL);
    this.tabGroup = new TabGroup();
    this.initialize();
  }
  render() {
    return (
      <DialogView
        prompt="Open Issue or Pull Request"
        acceptEnabled={this.state.acceptEnabled}
        acceptClassName="icon icon-git-pull-request"
        acceptText="Open Issue or Pull Request"
        accept={this.accept}
        cancel={this.props.request.cancel}
        tabGroup={this.tabGroup}
        inProgress={this.props.inProgress}
        error={inputError(this.url, FIELD_LIMIT, "URL") || this.props.error}
        workspace={this.props.workspace}
        commands={this.props.commands}
        environment={this.props.environment}
      >
        <label className="github-panel-DialogLabel dialog-field">
          <span className="dialog-label">Issue or pull request URL</span>
          <TabbableTextEditor
            tabGroup={this.tabGroup}
            commands={this.props.commands}
            autofocus
            mini
            ariaLabel="Issue or pull request URL"
            readOnly={this.props.inProgress}
            className="github-panel-OpenIssueish-url"
            buffer={this.url}
            environment={this.props.environment}
          />
        </label>
      </DialogView>
    );
  }
  didMount() {
    this.tabGroup.autofocus();
  }
  willDestroy() {
    this.sub.dispose();
  }
  accept = () => {
    if (!fitsInput(this.url, FIELD_LIMIT)) return Promise.resolve();
    const issueishURL = this.url.getText();
    if (issueishURL.length === 0) {
      return Promise.resolve();
    }
    return this.props.request.accept(issueishURL);
  };
  parseUrl() {
    if (!fitsInput(this.url, FIELD_LIMIT)) return false;
    const url = this.url.getText();
    const matches = url.match(ISSUEISH_URL_REGEX);
    if (!matches) {
      return false;
    }
    const [_full, _host, repoOwner, repoName, issueishNumber] = matches;
    return {
      repoOwner,
      repoName,
      issueishNumber,
    };
  }
  didChangeURL = () => {
    const enabled = !this.url.isEmpty() && fitsInput(this.url, FIELD_LIMIT);
    if (this.state.acceptEnabled !== enabled) {
      this.updateState({
        acceptEnabled: enabled,
      });
    } else this.invalidate();
  };
}
export async function openIssueishItem(issueishURL, { workspace, workdir }) {
  const matches = ISSUEISH_URL_REGEX.exec(issueishURL);
  if (!matches) {
    throw new Error("Not a valid issue or pull request URL");
  }
  const [, host, owner, repo, number] = matches;
  const uri = IssueishDetailItem.buildURI({
    host,
    owner,
    repo,
    number,
    workdir,
  });
  const item = await workspace.open(uri, {
    searchAllPanes: true,
  });
  return item;
}
