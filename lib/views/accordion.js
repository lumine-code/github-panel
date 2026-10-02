/** @babel */
/** @jsx h */
import { provideEnvironment } from "../graphql/environment";
import View, { h, Fragment } from "../etch/view";
import { autobind } from "../helpers";
export default class Accordion extends View {
  static defaultProps = {
    renderLoading: () => null,
    renderEmpty: () => null,
    renderMore: () => null,
    onClickItem: () => {},
    reviewsButton: () => null,
  };
  constructor(props, children) {
    super(props, children);
    autobind(this, "toggle");
    this.state = {
      expanded: true,
    };
    this.initialize();
  }
  render() {
    return (
      <details className="github-panel-Accordion" open={this.state.expanded}>
        <summary className="github-panel-Accordion-header" onClick={this.toggle}>
          {this.renderHeader()}
        </summary>
        <main className="github-panel-Accordion-content">{this.renderContent()}</main>
      </details>
    );
  }
  renderHeader() {
    return (
      <Fragment>
        <span className="github-panel-Accordion--leftTitle">{this.props.leftTitle}</span>
        {this.props.rightTitle && (
          <span className="github-panel-Accordion--rightTitle">{this.props.rightTitle}</span>
        )}
        {this.props.reviewsButton()}
      </Fragment>
    );
  }
  renderContent() {
    if (this.props.isLoading) {
      return this.props.renderLoading();
    }
    if (this.props.results.length === 0) {
      return this.props.renderEmpty();
    }
    if (!this.state.expanded) {
      return null;
    }
    return (
      <Fragment>
        <ul className="github-panel-Accordion-list">
          {this.props.results.map((item, index) => {
            const key = item.key !== undefined ? item.key : index;
            return (
              <li
                className="github-panel-Accordion-listItem"
                key={key}
                onClick={() => this.props.onClickItem(item)}
              >
                {provideEnvironment(this.props.children(item), this.props.environment)}
              </li>
            );
          })}
        </ul>
        {this.props.results.length < this.props.total && this.props.renderMore()}
      </Fragment>
    );
  }
  toggle(e) {
    e.preventDefault();
    return this.updateState((prevState) => ({
      expanded: !prevState.expanded,
    }));
  }
}
