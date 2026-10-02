/** @babel */
/** @jsx h */
import View, { h } from "../etch/view";
import { Emitter } from "lumine";
import { getGitBridge } from "../git-bridge";
import { getEndpoint } from "../models/endpoint";
import ReviewsContainer from "../containers/reviews-container";
import { location, allowedLocations } from "./dock-item-location";
export default class ReviewsItem extends View {
  static uriPattern = "lumine-github://reviews/{host}/{owner}/{repo}/{number}?workdir={workdir}";
  static buildURI({ host, owner, repo, number, workdir }) {
    return (
      "lumine-github://reviews/" +
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
  constructor(props, children) {
    super(props, children);
    this.emitter = new Emitter();
    this.isDestroyed = false;
    this.state = {
      initThreadID: null,
    };
    this.initialize();
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
        environment={this.props.environment}
      />
    );
  }
  getTitle() {
    return `Reviews #${this.props.number}`;
  }
  getDefaultLocation() {
    return location;
  }
  getAllowedLocations() {
    return allowedLocations;
  }
  getPreferredWidth() {
    return 400;
  }
  willDestroy() {
    /* istanbul ignore else */
    if (!this.isDestroyed) {
      this.emitter.emit("did-destroy");
      this.isDestroyed = true;
      this.emitter.dispose();
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
      await this.updateState({
        initThreadID: null,
      });
    }
    return this.updateState({
      initThreadID: id,
    });
  }
}
