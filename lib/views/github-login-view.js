/** @babel */
/** @jsx React.createElement */
import React from "react";

import { autobind } from "../helpers";
import { INSUFFICIENT } from "../shared/token-status";

export default class GithubLoginView extends React.Component {
  static defaultProps = {
    children: (
      <div className="initialize-repo-description">
        <span>Log in to GitHub to access PR information and more!</span>
      </div>
    ),
    onLogin: (token) => {},
    tokenStatus: Symbol(),
  };

  constructor(props, context) {
    super(props, context);
    autobind(
      this,
      "handleLoginClick",
      "handleCancelTokenClick",
      "handleSubmitTokenClick",
      "handleSubmitToken",
      "handleTokenChange",
    );
    this.state = {
      loggingIn: false,
      token: "",
    };
  }

  render() {
    let subview;
    if (this.state.loggingIn) {
      subview = this.renderTokenInput();
    } else {
      subview = this.renderLogin();
    }

    return <div className="github-panel-GithubLoginView">{subview}</div>;
  }

  renderLogin() {
    return (
      <div className="github-panel-GithubLoginView-Subview">
        <div className="github-panel-github-panel-LargeIcon icon icon-mark-github" />
        <h1>Log in to GitHub</h1>
        {this.props.children}
        <button onClick={this.handleLoginClick} className="btn btn-primary icon icon-octoface">
          Login
        </button>
      </div>
    );
  }

  renderTokenHint() {
    if (this.props.tokenStatus === INSUFFICIENT) {
      return (
        <span>
          Hint: Entered token has insufficient scopes. Update the scopes on your token and try
          again. See Dev Tools console for details.
        </span>
      );
    }
  }

  renderTokenInput() {
    const tokenHint = this.renderTokenHint();

    return (
      <form className="github-panel-GithubLoginView-Subview" onSubmit={this.handleSubmitToken}>
        <div className="github-panel-github-panel-LargeIcon icon icon-mark-github" />
        <h1>Enter Token</h1>
        <ol>
          <li>
            {/* eslint-disable-next-line max-len */}
            Visit{" "}
            <a href="https://github.com/settings/tokens/new?scopes=repo,workflow,user:email,read:org&description=Pulsar%20github%20package">
              github.com/settings/tokens
            </a>{" "}
            to generate a new Personal Access Token (classic).
            {/* eslint-disable-next-line max-len */}
            <sup>
              <a href="https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token#creating-a-personal-access-token-classic">
                [docs]
              </a>
            </sup>
          </li>
          <li>
            Ensure it has the following permissions: <code>repo</code>, <code>workflow</code>,{" "}
            <code>read:org</code>, and <code>user:email</code>.
          </li>
          <li>Enter the token below:</li>
        </ol>

        {tokenHint}

        <input
          type="text"
          className="input-text native-key-bindings"
          placeholder="Enter your token..."
          value={this.state.token}
          onChange={this.handleTokenChange}
        />
        <ul>
          <li>
            <button
              type="button"
              onClick={this.handleCancelTokenClick}
              className="btn icon icon-remove-close"
            >
              Cancel
            </button>
          </li>
          <li>
            <button
              type="submit"
              onClick={this.handleSubmitTokenClick}
              className="btn btn-primary icon icon-check"
            >
              Login
            </button>
          </li>
        </ul>
      </form>
    );
  }

  handleLoginClick() {
    this.setState({ loggingIn: true });
  }

  handleCancelTokenClick(e) {
    e.preventDefault();
    this.setState({ loggingIn: false });
  }

  handleSubmitTokenClick(e) {
    e.preventDefault();
    this.handleSubmitToken();
  }

  handleSubmitToken() {
    this.props.onLogin(this.state.token);
  }

  handleTokenChange(e) {
    this.setState({ token: e.target.value });
  }
}
