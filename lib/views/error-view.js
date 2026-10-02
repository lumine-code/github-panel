/** @babel */
/** @jsx h */
import View, { h } from "../etch/view";
export default class ErrorView extends View {
  constructor(props, children) {
    super(props, children);
    this.initialize();
  }
  static defaultProps = {
    title: "Error",
    descriptions: ["An unknown error occurred"],
    preformatted: false,
  };
  render() {
    return (
      <div className="github-panel-Message">
        <div className="github-panel-Message-wrapper">
          <h1 className="github-panel-Message-title">{this.props.title}</h1>
          {this.props.descriptions.map(this.renderDescription)}
          <div className="github-panel-Message-action">
            {this.props.retry && (
              <button
                className="github-panel-Message-button btn btn-primary"
                onClick={this.props.retry}
              >
                Try Again
              </button>
            )}
            {this.props.logout && (
              <button
                className="github-panel-Message-button btn btn-logout"
                onClick={this.props.logout}
              >
                Logout
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }
  renderDescription = (description, key) => {
    if (this.props.preformatted) {
      return (
        <pre key={key} className="github-panel-Message-description">
          {description}
        </pre>
      );
    } else {
      return (
        <p key={key} className="github-panel-Message-description">
          {description}
        </p>
      );
    }
  };
}
