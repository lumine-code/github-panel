/** @babel */
/** @jsx React.createElement */
import React from "react";

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

export default class DialogsController extends React.Component {
  state = {
    requestInProgress: null,
    requestError: [null, null],
  };

  render() {
    const DialogComponent = getDialogComponent(this.props.request.identifier);
    return <DialogComponent {...this.getCommonProps()} />;
  }

  getCommonProps() {
    const { request } = this.props;
    const accept = request.isProgressing
      ? async (...args) => {
          this.setState({ requestError: [null, null], requestInProgress: request });
          try {
            const result = await request.accept(...args);
            this.setState({ requestInProgress: null });
            return result;
          } catch (error) {
            this.setState({ requestError: [request, error], requestInProgress: null });
            return undefined;
          }
        }
      : (...args) => {
          this.setState({ requestError: [null, null] });
          try {
            return request.accept(...args);
          } catch (error) {
            this.setState({ requestError: [request, error] });
            return undefined;
          }
        };
    const wrapped = wrapDialogRequest(request, { accept });

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

function NullDialog() {
  return null;
}

class DialogRequest {
  constructor(identifier, params = {}) {
    this.identifier = identifier;
    this.params = params;
    this.isProgressing = false;
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

function wrapDialogRequest(original, { accept }) {
  const dup = new DialogRequest(original.identifier, original.params);
  dup.isProgressing = original.isProgressing;
  dup.onAccept(accept);
  dup.onCancel(original.cancel);
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

  publish({ localDir }) {
    return new DialogRequest("publish", { localDir });
  },
};
