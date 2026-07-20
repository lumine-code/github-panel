/** @babel */
/** @jsx React.createElement */
import React from "react";
import { CompositeDisposable, Disposable } from "atom";

import {
  handleClickEvent,
  openIssueishLinkInNewTab,
  openLinkInBrowser,
  getDataFromGithubUrl,
} from "./issueish-link";
import UserMentionTooltipItem from "../items/user-mention-tooltip-item";
import IssueishTooltipItem from "../items/issueish-tooltip-item";
import EnvironmentContext from "../graphql/environment-context";
import { renderMarkdown } from "../helpers";

export class BareGithubDotcomMarkdown extends React.Component {
  static defaultProps = {
    className: "",
    handleClickEvent,
    openIssueishLinkInNewTab,
    openLinkInBrowser,
  };

  componentDidMount() {
    this.commandSubscriptions = atom.commands.add(this.component, {
      "github-panel:open-link-in-new-tab": this.openLinkInNewTab,
      "github-panel:open-link-in-browser": this.openLinkInBrowser,
      "github-panel:open-link-in-this-tab": this.openLinkInThisTab,
    });
    this.setupComponentHandlers();
    this.setupTooltipHandlers();
  }

  componentDidUpdate() {
    this.setupTooltipHandlers();
  }

  setupComponentHandlers() {
    this.component.addEventListener("click", this.handleClick);
    this.componentHandlers = new Disposable(() => {
      this.component.removeEventListener("click", this.handleClick);
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
        atom.tooltips.add(node, {
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
        atom.tooltips.add(node, {
          trigger: "hover",
          delay: 0,
          class: "github-panel-Popover",
          item,
        }),
      );
      this.tooltipSubscriptions.add(new Disposable(() => item.destroy()));
    });
  }

  componentWillUnmount() {
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
        dangerouslySetInnerHTML={{ __html: this.props.html }}
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
    return this.props.openIssueishLinkInNewTab(event.target.dataset.url);
  };

  openLinkInThisTab = (event) => {
    const { repoOwner, repoName, issueishNumber } = getDataFromGithubUrl(event.target.dataset.url);
    this.props.switchToIssueish(repoOwner, repoName, issueishNumber);
  };

  openLinkInBrowser = (event) => {
    return this.props.openLinkInBrowser(event.target.getAttribute("href"));
  };
}

export default class GithubDotcomMarkdown extends React.Component {
  state = {
    lastMarkdown: null,
    html: null,
  };

  static getDerivedStateFromProps(props, state) {
    if (props.html) {
      return { html: props.html };
    }

    if (props.markdown && props.markdown !== state.lastMarkdown) {
      return { html: renderMarkdown(props.markdown), lastMarkdown: props.markdown };
    }

    return null;
  }

  render() {
    return (
      <EnvironmentContext.Consumer>
        {(relayEnvironment) => (
          <BareGithubDotcomMarkdown
            relayEnvironment={relayEnvironment}
            {...this.props}
            html={this.state.html}
          />
        )}
      </EnvironmentContext.Consumer>
    );
  }
}
