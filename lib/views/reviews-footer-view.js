/** @babel */
/** @jsx h */
import View, { h } from "../etch/view";
export default class ReviewsFooterView extends View {
  constructor(props, children) {
    super(props, children);
    this.initialize();
  }
  render() {
    return (
      <footer className="github-panel-ReviewsFooterView-footer">
        <span className="github-panel-ReviewsFooterView-footerTitle">Reviews</span>
        <span className="github-panel-ReviewsFooterView">
          <span className="github-panel-ReviewsFooterView-commentCount">
            Resolved{" "}
            <span className="github-panel-ReviewsFooterView-commentsResolved">
              {this.props.commentsResolved}
            </span>{" "}
            of{" "}
            <span className="github-panel-ReviewsFooterView-totalComments">
              {this.props.totalComments}
            </span>{" "}
            comments
          </span>
          <progress
            className="github-panel-ReviewsFooterView-progessBar"
            value={this.props.commentsResolved}
            max={this.props.totalComments}
          >
            {" "}
            comments{" "}
          </progress>
        </span>
        <button
          className="github-panel-ReviewsFooterView-openReviewsButton btn btn-primary"
          onClick={this.props.openReviews}
        >
          See reviews
        </button>
        <a
          href={this.props.pullRequestURL}
          className="github-panel-ReviewsFooterView-reviewChangesButton btn"
        >
          Start a new review
        </a>
      </footer>
    );
  }
}
