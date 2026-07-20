/** @babel */
/** @jsx React.createElement */
import React, { Fragment } from "react";
import createPaginationContainer from "../graphql/pagination";
import * as queries from "../graphql/queries";

import { components as selectComponents } from "react-select";
import { TabbableTextEditor, TabbableSelect } from "./tabbable";

const PAGE_DELAY = 500;

export const PAGE_SIZE = 50;

export class BareRepositoryHomeSelectionView extends React.Component {
  static defaultProps = {
    autofocusOwner: false,
    autofocusName: false,
  };

  render() {
    const owners = this.getOwners();
    const currentOwner = owners.find((o) => o.id === this.props.selectedOwnerID) || owners[0];

    return (
      <div className="github-panel-RepositoryHome">
        <TabbableSelect
          tabGroup={this.props.tabGroup}
          commands={this.props.commands}
          autofocus={this.props.autofocusOwner}
          className="github-panel-RepositoryHome-owner"
          classNamePrefix="Select"
          isClearable={false}
          isDisabled={this.props.isLoading}
          isOptionDisabled={(option) => option.disabled}
          options={owners}
          getOptionValue={(option) => option.id}
          getOptionLabel={(option) => option.login}
          components={this.selectComponentsConfig}
          value={currentOwner}
          onChange={this.didChangeOwner}
        />
        <span className="github-panel-RepositoryHome-separator">/</span>
        <TabbableTextEditor
          tabGroup={this.props.tabGroup}
          commands={this.props.commands}
          autofocus={this.props.autofocusName}
          mini={true}
          buffer={this.props.nameBuffer}
        />
      </div>
    );
  }

  renderOwnerContent = (owner) => (
    <Fragment>
      <div className="github-panel-RepositoryHome-ownerOption">
        <img
          alt=""
          src={owner.avatarURL || null}
          className="github-panel-RepositoryHome-ownerAvatar"
        />
        <span className="github-panel-RepositoryHome-ownerName">{owner.login}</span>
      </div>
      {owner.disabled && !owner.placeholder && (
        <div className="github-panel-RepositoryHome-ownerUnwritable">
          (insufficient permissions)
        </div>
      )}
    </Fragment>
  );

  OwnerOption = (props) => (
    <selectComponents.Option {...props}>
      {this.renderOwnerContent(props.data)}
    </selectComponents.Option>
  );

  OwnerSingleValue = (props) => (
    <selectComponents.SingleValue {...props}>
      {this.renderOwnerContent(props.data)}
    </selectComponents.SingleValue>
  );

  selectComponentsConfig = {
    Option: this.OwnerOption,
    SingleValue: this.OwnerSingleValue,
  };

  componentDidMount() {
    this.schedulePageLoad();
  }

  componentDidUpdate() {
    this.schedulePageLoad();
  }

  getOwners() {
    if (!this.props.user) {
      return [
        {
          id: "loading",
          login: "loading...",
          avatarURL: "",
          disabled: true,
          placeholder: true,
        },
      ];
    }

    const owners = [
      {
        id: this.props.user.id,
        login: this.props.user.login,
        avatarURL: this.props.user.avatarUrl,
        disabled: false,
      },
    ];

    /* istanbul ignore if */
    if (!this.props.user.organizations.edges) {
      return owners;
    }

    for (const { node } of this.props.user.organizations.edges) {
      /* istanbul ignore if */
      if (!node) {
        continue;
      }

      owners.push({
        id: node.id,
        login: node.login,
        avatarURL: node.avatarUrl,
        disabled: !node.viewerCanCreateRepositories,
      });
    }

    if (this.props.relay && this.props.relay.hasMore()) {
      owners.push({
        id: "loading",
        login: "loading...",
        avatarURL: "",
        disabled: true,
        placeholder: true,
      });
    }

    return owners;
  }

  didChangeOwner = (owner) => this.props.didChangeOwnerID(owner.id);

  schedulePageLoad() {
    if (!this.props.relay.hasMore()) {
      return;
    }

    setTimeout(this.loadNextPage, PAGE_DELAY);
  }

  loadNextPage = () => {
    /* istanbul ignore if */
    if (this.props.relay.isLoading()) {
      setTimeout(this.loadNextPage, PAGE_DELAY);
      return;
    }

    this.props.relay.loadMore(PAGE_SIZE);
  };
}

export default createPaginationContainer(
  BareRepositoryHomeSelectionView,
  {
    user: null,
  },
  {
    direction: "forward",
    /* istanbul ignore next */
    getConnectionFromProps(props) {
      return props.user && props.user.organizations;
    },
    /* istanbul ignore next */
    getFragmentVariables(prevVars, totalCount) {
      return { ...prevVars, totalCount };
    },
    /* istanbul ignore next */
    getVariables(props, { count, cursor }) {
      return {
        id: props.user.id,
        organizationCount: count,
        organizationCursor: cursor,
      };
    },
    query: queries.repositoryHomeSelectionViewQuery,
  },
);
