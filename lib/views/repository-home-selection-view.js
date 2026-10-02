/** @babel */
/** @jsx h */
import View, { h } from "../etch/view";
import createPaginationView from "../graphql/pagination";
import * as queries from "../graphql/queries";
import { TabbableTextEditor, TabbableSelect } from "./tabbable";
const PAGE_DELAY = 500;
export const PAGE_SIZE = 50;
export class BareRepositoryHomeSelectionView extends View {
  constructor(props, children) {
    super(props, children);
    this.initialize();
  }
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
          value={currentOwner}
          onChange={this.didChangeOwner}
          environment={this.props.environment}
        />
        <span className="github-panel-RepositoryHome-separator">/</span>
        <TabbableTextEditor
          tabGroup={this.props.tabGroup}
          commands={this.props.commands}
          autofocus={this.props.autofocusName}
          mini={true}
          buffer={this.props.nameBuffer}
          environment={this.props.environment}
        />
      </div>
    );
  }
  willDestroy() {
    clearTimeout(this.pageTimer);
  }
  didMount() {
    this.schedulePageLoad();
  }
  didUpdate() {
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
    if (this.pageTimer || this.destroyed) return;
    this.pageTimer = setTimeout(() => {
      this.pageTimer = null;
      this.loadNextPage();
    }, PAGE_DELAY);
  }
  loadNextPage = () => {
    /* istanbul ignore if */
    if (this.props.relay.isLoading()) {
      this.schedulePageLoad();
      return;
    }
    this.props.relay.loadMore(PAGE_SIZE);
  };
}
export default createPaginationView(
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
      return {
        ...prevVars,
        totalCount,
      };
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
