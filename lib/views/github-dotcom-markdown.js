/** @babel */
/** @jsx h */
import View, { h } from "../etch/view.js";
import { CompositeDisposable, Disposable } from "lumine";
import {
  handleClickEvent,
  openIssueishLinkInNewTab,
  openLinkInBrowser,
  getDataFromGithubUrl,
} from "./issueish-link.js";
import UserMentionTooltipItem from "../items/user-mention-tooltip-item.js";
import IssueishTooltipItem from "../items/issueish-tooltip-item.js";
import { renderMarkdown } from "../helpers.js";
export class BareGithubDotcomMarkdown extends View {
  constructor(props, children) {
    super(props, children);
    this.initialize();
  }
  static defaultProps = {
    className: "",
    handleClickEvent,
    openIssueishLinkInNewTab,
    openLinkInBrowser,
  };
  didMount() {
    this.commandSubscriptions = lumine.commands.add(this.component, {
      "github-panel:open-link-in-new-tab": {
        description: "Open the link under the pointer in a new editor tab.",
        isAvailable: (event) => Boolean(event.target.closest?.(".issue-link")?.dataset.url),
        didDispatch: this.openLinkInNewTab,
      },
      "github-panel:open-link-in-browser": {
        description: "Open the link under the pointer in the system browser.",
        isAvailable: (event) =>
          Boolean(event.target.closest?.(".issue-link")?.getAttribute("href")),
        didDispatch: this.openLinkInBrowser,
      },
      "github-panel:open-link-in-this-tab": {
        description: "Follow the link under the pointer in this tab.",
        isAvailable: (event) =>
          Boolean(
            event.target.closest?.(".issue-link")?.dataset.url && this.props.switchToIssueish,
          ),
        didDispatch: this.openLinkInThisTab,
      },
    });
    this.setupComponentHandlers();
    this.setupTooltipHandlers();
  }
  didUpdate(previous) {
    if (
      previous.html !== this.props.html ||
      previous.relayEnvironment !== this.props.relayEnvironment
    )
      this.setupTooltipHandlers();
  }
  setupComponentHandlers() {
    const component = this.component;
    component.addEventListener("click", this.handleClick);
    this.componentHandlers = new Disposable(() => {
      component.removeEventListener("click", this.handleClick);
    });
  }
  setupTooltipHandlers() {
    if (this.tooltipSubscriptions) {
      this.tooltipSubscriptions.dispose();
    }
    this.tooltipSubscriptions = new CompositeDisposable();
    this.component.querySelectorAll(".user-mention").forEach((node) => {
      const item = new UserMentionTooltipItem(node.textContent, this.props.relayEnvironment);
      this.tooltipSubscriptions.add(
        lumine.tooltips.add(node, {
          trigger: "hover",
          delay: 0,
          class: "github-panel-Popover",
          item,
        }),
      );
      this.tooltipSubscriptions.add(new Disposable(() => item.destroy()));
    });
    this.component.querySelectorAll(".issue-link").forEach((node) => {
      const item = new IssueishTooltipItem(node.getAttribute("href"), this.props.relayEnvironment);
      this.tooltipSubscriptions.add(
        lumine.tooltips.add(node, {
          trigger: "hover",
          delay: 0,
          class: "github-panel-Popover",
          item,
        }),
      );
      this.tooltipSubscriptions.add(new Disposable(() => item.destroy()));
    });
  }
  willDestroy() {
    this.commandSubscriptions.dispose();
    this.componentHandlers.dispose();
    this.tooltipSubscriptions && this.tooltipSubscriptions.dispose();
  }
  render() {
    return (
      <div
        className={`github-panel-DotComMarkdownHtml native-key-bindings ${this.props.className}`}
        tabIndex="-1"
        ref={(c) => {
          this.component = c;
        }}
        innerHTML={this.props.html}
      />
    );
  }
  handleClick = (event) => {
    if (event.target.dataset.url) {
      return this.props.handleClickEvent(event, event.target.dataset.url);
    } else {
      return null;
    }
  };
  openLinkInNewTab = (event) => {
    const link = event.target.closest?.(".issue-link");
    if (link) return this.props.openIssueishLinkInNewTab(link.dataset.url);
  };
  openLinkInThisTab = (event) => {
    const link = event.target.closest?.(".issue-link");
    if (!link) return;
    const { repoOwner, repoName, issueishNumber } = getDataFromGithubUrl(link.dataset.url);
    this.props.switchToIssueish(repoOwner, repoName, issueishNumber);
  };
  openLinkInBrowser = (event) => {
    const link = event.target.closest?.(".issue-link");
    if (link) return this.props.openLinkInBrowser(link.getAttribute("href"));
  };
}
export default class GithubDotcomMarkdown extends View {
  constructor(props, children) {
    super(props, children);
    this.initialize();
  }
  state = {
    lastMarkdown: null,
    html: null,
  };
  static deriveState(props, state) {
    if (props.html) {
      return {
        html: props.html,
      };
    }
    if (props.markdown && props.markdown !== state.lastMarkdown) {
      return {
        html: renderMarkdown(props.markdown),
        lastMarkdown: props.markdown,
      };
    }
    return null;
  }
  render() {
    return (
      <BareGithubDotcomMarkdown
        {...this.props}
        relayEnvironment={this.props.environment}
        html={this.state.html}
        environment={this.props.environment}
      />
    );
  }
}
