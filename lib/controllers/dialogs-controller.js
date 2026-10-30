/** @babel */
/** @jsx h */
import { createRequire } from "node:module";
import View, { h } from "../etch/view.js";
const require = import.meta.require ?? createRequire(import.meta.url);
let OpenIssueishDialog;
let CreateDialog;

// The null request is the startup state. Loading either real dialog here used
// to pull both dialog trees into the otherwise empty root render.
function getDialogComponent(identifier) {
  if (identifier === "null") {
    return NullDialog;
  }
  if (identifier === "issueish") {
    if (!OpenIssueishDialog) {
      const dialogModule = require("../views/open-issueish-dialog");
      OpenIssueishDialog = dialogModule.default || dialogModule;
    }
    return OpenIssueishDialog;
  }
  if (identifier === "create" || identifier === "publish") {
    if (!CreateDialog) {
      const dialogModule = require("../views/create-dialog");
      CreateDialog = dialogModule.default || dialogModule;
    }
    return CreateDialog;
  }
  throw new Error(`Unknown GitHub dialog: ${identifier}`);
}
export default class DialogsController extends View {
  constructor(props, children) {
    super(props, children);
    this.initialize();
  }
  state = {
    requestInProgress: null,
    requestError: [null, null],
  };
  render() {
    const DialogComponent = getDialogComponent(this.props.request.identifier);
    return <DialogComponent {...this.getCommonProps()} environment={this.props.environment} />;
  }
  getCommonProps() {
    const { request } = this.props;
    const ownsRequest = () => !this.destroyed && this.props.request === request;
    const accept = request.isProgressing
      ? async (...args) => {
          if (!ownsRequest() || request.pending) return undefined;
          request.pending = true;
          this.updateState({
            requestError: [null, null],
            requestInProgress: request,
          });
          try {
            const result = await request.accept(...args);
            if (ownsRequest() && this.state.requestInProgress === request)
              this.updateState({ requestInProgress: null });
            return result;
          } catch (error) {
            if (ownsRequest() && this.state.requestInProgress === request)
              this.updateState({ requestError: [request, error], requestInProgress: null });
            return undefined;
          } finally {
            request.pending = false;
          }
        }
      : (...args) => {
          if (!ownsRequest() || request.pending) return undefined;
          this.updateState({
            requestError: [null, null],
          });
          try {
            return request.accept(...args);
          } catch (error) {
            if (ownsRequest()) this.updateState({ requestError: [request, error] });
            return undefined;
          }
        };
    const wrapped = wrapDialogRequest(request, {
      accept,
      cancel: () => {
        if (ownsRequest() && !request.pending) return request.cancel();
      },
    });
    return {
      loginModel: this.props.loginModel,
      request: wrapped,
      inProgress: this.state.requestInProgress === request,
      workspace: this.props.workspace,
      commands: this.props.commands,
      config: this.props.config,
      error: this.state.requestError[0] === request ? this.state.requestError[1] : null,
    };
  }
}
class NullDialog extends View {
  constructor(props, children) {
    super(props, children);
    this.initialize();
  }
  render() {
    return h("span", {
      hidden: true,
    });
  }
}
class DialogRequest {
  constructor(identifier, params = {}) {
    this.identifier = identifier;
    this.params = params;
    this.isProgressing = false;
    this.pending = false;
    this.accept = () => {};
    this.cancel = () => {};
  }
  onAccept(cb) {
    this.accept = cb;
  }
  onProgressingAccept(cb) {
    this.isProgressing = true;
    this.onAccept(cb);
  }
  onCancel(cb) {
    this.cancel = cb;
  }
  getParams() {
    return this.params;
  }
}
function wrapDialogRequest(original, { accept, cancel }) {
  const dup = new DialogRequest(original.identifier, original.params);
  dup.isProgressing = original.isProgressing;
  dup.onAccept(accept);
  dup.onCancel(cancel);
  return dup;
}
export const dialogRequests = {
  null: {
    identifier: "null",
    isProgressing: false,
    params: {},
    accept: () => {},
    cancel: () => {},
  },
  issueish() {
    return new DialogRequest("issueish");
  },
  create() {
    return new DialogRequest("create");
  },
  publish({ localDir = "", directories = [], pathEditable = false } = {}) {
    return new DialogRequest("publish", {
      localDir,
      directories,
      pathEditable,
    });
  },
};
