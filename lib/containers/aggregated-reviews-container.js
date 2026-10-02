/** @babel */
/** @jsx h */
import { provideEnvironment } from "../graphql/environment";
import View, { h } from "../etch/view";
import { Emitter } from "lumine";
import createRefetchView from "../graphql/refetch";
import * as queries from "../graphql/queries";
import { PAGE_SIZE } from "../helpers";
import ReviewSummariesAccumulator from "./accumulators/review-summaries-accumulator";
import ReviewThreadsAccumulator from "./accumulators/review-threads-accumulator";
export class BareAggregatedReviewsContainer extends View {
  constructor(props, children) {
    super(props, children);
    this.emitter = new Emitter();
    this.initialize();
  }
  render() {
    return (
      <ReviewSummariesAccumulator
        onDidRefetch={this.onDidRefetch}
        pullRequest={this.props.pullRequest}
        children={({ error: summaryError, summaries, loading: summariesLoading }) => {
          return (
            <ReviewThreadsAccumulator
              onDidRefetch={this.onDidRefetch}
              pullRequest={this.props.pullRequest}
              children={(payload) => {
                const result = {
                  errors: [],
                  refetch: this.refetch,
                  summaries,
                  commentThreads: payload.commentThreads,
                  loading: payload.loading || summariesLoading,
                };
                if (summaryError) {
                  result.errors.push(summaryError);
                }
                result.errors.push(...payload.errors);
                return provideEnvironment(this.props.children(result), this.props.environment);
              }}
              environment={this.props.environment}
            />
          );
        }}
        environment={this.props.environment}
      />
    );
  }
  refetch = (callback) =>
    this.props.relay.refetch(
      {
        prId: this.props.pullRequest.id,
        reviewCount: PAGE_SIZE,
        reviewCursor: null,
        threadCount: PAGE_SIZE,
        threadCursor: null,
        commentCount: PAGE_SIZE,
        commentCursor: null,
      },
      null,
      (err) => {
        if (err) {
          this.props.reportRelayError("Unable to refresh reviews", err);
        } else {
          this.emitter.emit("did-refetch");
        }
        callback();
      },
      {
        force: true,
      },
    );
  onDidRefetch = (callback) => this.emitter.on("did-refetch", callback);
}
export default createRefetchView(
  BareAggregatedReviewsContainer,
  {
    pullRequest: null,
  },
  queries.aggregatedReviewsContainerRefetchQuery,
);
