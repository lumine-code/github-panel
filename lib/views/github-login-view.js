/** @babel */
/** @jsx React.createElement */
import React from "react";

import { autobind } from "../helpers";
import { INSUFFICIENT } from "../shared/token-status";
import { DOTCOM } from "../models/endpoint";
import {
  getClientId,
  requestDeviceCode,
  pollForAccessToken,
  DeviceFlowError,
} from "../models/github-device-flow";

export default class GithubLoginView extends React.Component {
  static defaultProps = {
    children: (
      <div className="initialize-repo-description">
        <span>Log in to GitHub to access PR information and more!</span>
      </div>
    ),
    onLogin: (token) => {},
    tokenStatus: Symbol(),
    endpoint: DOTCOM,
  };

  constructor(props, context) {
    super(props, context);
    autobind(
      this,
      "startDeviceFlow",
      "cancelDeviceFlow",
      "showTokenInput",
      "backToStart",
      "handleSubmitToken",
      "handleSubmitTokenClick",
      "handleTokenChange",
    );
    // mode: "start" | "device" | "token"
    this.state = { mode: "start", deviceData: null, error: null, token: "" };
    this.abortController = null;
  }

  componentWillUnmount() {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  render() {
    let subview;
    if (this.state.mode === "device") {
      subview = this.renderDeviceFlow();
    } else if (this.state.mode === "token") {
      subview = this.renderTokenInput();
    } else {
      subview = this.renderStart();
    }

    return <div className="github-panel-GithubLoginView">{subview}</div>;
  }

  renderStart() {
    return (
      <div className="github-panel-GithubLoginView-Subview">
        <div className="github-panel-LargeIcon icon icon-mark-github" />
        <h1>Log in to GitHub</h1>
        {this.props.children}
        <button onClick={this.startDeviceFlow} className="btn btn-primary icon icon-octoface">
          Sign in with GitHub
        </button>
        <p>
          <a className="github-panel-GithubLoginView-tokenLink" onClick={this.showTokenInput}>
            Sign in with a personal access token instead
          </a>
        </p>
      </div>
    );
  }

  renderDeviceFlow() {
    const { deviceData, error } = this.state;

    let body;
    if (error) {
      body = (
        <div className="error-messages">
          <span>{error}</span>
        </div>
      );
    } else if (deviceData) {
      body = (
        <div className="github-panel-GithubLoginView-device">
          <p>
            Enter this code at{" "}
            <a href={deviceData.verification_uri}>{deviceData.verification_uri}</a>:
          </p>
          <div className="github-panel-GithubLoginView-userCode">
            <code>{deviceData.user_code}</code>
            <button
              className="btn icon icon-clippy"
              onClick={() => atom.clipboard.write(deviceData.user_code)}
            >
              Copy
            </button>
          </div>
          <p>
            <span className="github-panel-Spinner" /> Waiting for you to authorize in the browser…
          </p>
        </div>
      );
    } else {
      body = (
        <p>
          <span className="github-panel-Spinner" /> Requesting a code…
        </p>
      );
    }

    return (
      <div className="github-panel-GithubLoginView-Subview">
        <div className="github-panel-LargeIcon icon icon-mark-github" />
        <h1>Sign in with GitHub</h1>
        {body}
        <button onClick={this.cancelDeviceFlow} className="btn icon icon-remove-close">
          {error ? "Back" : "Cancel"}
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
    return (
      <form className="github-panel-GithubLoginView-Subview" onSubmit={this.handleSubmitToken}>
        <div className="github-panel-LargeIcon icon icon-mark-github" />
        <h1>Enter Token</h1>
        <ol>
          <li>
            Visit{" "}
            <a href="https://github.com/settings/tokens/new?scopes=repo,workflow,user:email,read:org&description=Lumine%20github-panel">
              github.com/settings/tokens
            </a>{" "}
            to generate a new Personal Access Token (classic).
          </li>
          <li>
            Ensure it has the following permissions: <code>repo</code>, <code>workflow</code>,{" "}
            <code>read:org</code>, and <code>user:email</code>.
          </li>
          <li>Enter the token below:</li>
        </ol>

        {this.renderTokenHint()}

        <input
          type="text"
          className="input-text native-key-bindings"
          placeholder="Enter your token..."
          value={this.state.token}
          onChange={this.handleTokenChange}
        />
        <ul>
          <li>
            <button type="button" onClick={this.backToStart} className="btn icon icon-remove-close">
              Back
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

  async startDeviceFlow() {
    const clientId = getClientId();
    if (!clientId) {
      // OAuth isn't configured (no client id); fall back to token entry.
      this.setState({ mode: "token", error: null });
      return;
    }

    const controller = new AbortController();
    this.abortController = controller;
    this.setState({ mode: "device", deviceData: null, error: null });

    try {
      const deviceData = await requestDeviceCode({ endpoint: this.props.endpoint, clientId });
      if (controller.signal.aborted) {
        return;
      }
      this.setState({ deviceData });

      const token = await pollForAccessToken({
        endpoint: this.props.endpoint,
        clientId,
        deviceCode: deviceData.device_code,
        interval: deviceData.interval,
        expiresIn: deviceData.expires_in,
        signal: controller.signal,
      });
      if (controller.signal.aborted) {
        return;
      }
      this.props.onLogin(token);
    } catch (e) {
      if (controller.signal.aborted) {
        return;
      }
      const message = e instanceof DeviceFlowError ? e.message : `Sign-in failed: ${e.message}`;
      this.setState({ error: message });
    }
  }

  cancelDeviceFlow() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.setState({ mode: "start", deviceData: null, error: null });
  }

  showTokenInput() {
    this.setState({ mode: "token", error: null });
  }

  backToStart() {
    this.setState({ mode: "start", error: null });
  }

  handleSubmitToken(e) {
    if (e) {
      e.preventDefault();
    }
    this.props.onLogin(this.state.token);
  }

  handleSubmitTokenClick(e) {
    e.preventDefault();
    this.handleSubmitToken();
  }

  handleTokenChange(e) {
    this.setState({ token: e.target.value });
  }
}
