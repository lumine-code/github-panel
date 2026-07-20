/** @babel */
/** @jsx React.createElement */
import React from "react";
import { Emitter } from "atom";

import { getGitBridge } from "../git-bridge";
import { getEndpoint } from "../models/endpoint";
import ReviewsContainer from "../containers/reviews-container";

export default class ReviewsItem extends React.Component {
  static uriPattern = "atom-github://reviews/{host}/{owner}/{repo}/{number}?workdir={workdir}";

  static buildURI({ host, owner, repo, number, workdir }) {
    return (
      "atom-github://reviews/" +
      encodeURIComponent(host) +
      "/" +
      encodeURIComponent(owner) +
      "/" +
      encodeURIComponent(repo) +
      "/" +
      encodeURIComponent(number) +
      "?workdir=" +
      encodeURIComponent(workdir || "")
    );
  }

  constructor(props) {
    super(props);

    this.emitter = new Emitter();
    this.isDestroyed = false;

    this.state = {
      initThreadID: null,
    };
  }

  render() {
    const endpoint = getEndpoint(this.props.host);

    const repository =
      this.props.workdir.length > 0
        ? this.props.workdirContextPool.add(this.props.workdir).getRepository()
        : getGitBridge().getAbsentRepository();

    return (
      <ReviewsContainer
        endpoint={endpoint}
        repository={repository}
        initThreadID={this.state.initThreadID}
        {...this.props}
      />
    );
  }

  getTitle() {
    return `Reviews #${this.props.number}`;
  }

  getDefaultLocation() {
    return "right";
  }

  getPreferredWidth() {
    return 400;
  }

  destroy() {
    /* istanbul ignore else */
    if (!this.isDestroyed) {
      this.emitter.emit("did-destroy");
      this.isDestroyed = true;
    }
  }

  onDidDestroy(callback) {
    return this.emitter.on("did-destroy", callback);
  }

  serialize() {
    return {
      deserializer: "ReviewsStub",
      uri: ReviewsItem.buildURI({
        host: this.props.host,
        owner: this.props.owner,
        repo: this.props.repo,
        number: this.props.number,
        workdir: this.props.workdir,
      }),
    };
  }

  async jumpToThread(id) {
    if (this.state.initThreadID === id) {
      await new Promise((resolve) => this.setState({ initThreadID: null }, resolve));
    }

    return new Promise((resolve) => this.setState({ initThreadID: id }, resolve));
  }
}
