/** @babel */
/** @jsx React.createElement */
import React from "react";
import { createRoot } from "react-dom/client";
import GraphQLQuery from "../graphql/query";
import * as queries from "../graphql/queries";

import IssueishTooltipContainer from "../containers/issueish-tooltip-container";

export default class IssueishTooltipItem {
  constructor(issueishUrl, relayEnvironment) {
    this.issueishUrl = issueishUrl;
    this.relayEnvironment = relayEnvironment;
  }

  getElement() {
    return this.element;
  }

  get element() {
    if (!this._element) {
      this._element = document.createElement("div");
      const rootContainer = (
        <GraphQLQuery
          environment={this.relayEnvironment}
          query={queries.issueishTooltipItemQuery}
          variables={{
            issueishUrl: this.issueishUrl,
          }}
          render={({ error, props, retry }) => {
            if (error) {
              return <div>Could not load information</div>;
            } else if (props) {
              return <IssueishTooltipContainer {...props} />;
            } else {
              return (
                <div className="github-panel-Loader">
                  <span className="github-panel-Spinner" />
                </div>
              );
            }
          }}
        />
      );
      this._root = createRoot(this._element);
      this._root.render(rootContainer);
    }

    return this._element;
  }

  destroy() {
    if (this._root) {
      const root = this._root;
      this._root = null;
      delete this._element;
      // Defer the unmount to a microtask: destroy() can be called from within a
      // React render (a tooltip disposed while its parent re-renders), and React
      // 19 warns when a root is unmounted synchronously mid-render.
      Promise.resolve().then(() => root.unmount());
    }
  }
}
