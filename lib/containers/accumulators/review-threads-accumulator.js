/** @babel */
/** @jsx h */
import { provideEnvironment } from "../../graphql/environment";
import View, { h } from "../../etch/view";
import createPaginationView from "../../graphql/pagination";
import * as queries from "../../graphql/queries";
import { PAGE_SIZE, PAGINATION_WAIT_TIME_MS } from "../../helpers";
import Accumulator from "./accumulator";
import ReviewCommentsAccumulator from "./review-comments-accumulator";
export class BareReviewThreadsAccumulator extends View {
  constructor(props, children) {
    super(props, children);
    this.results = new Map();
    this.resultUpdatePending = false;
    this.initialize();
  }
  acceptResult(item, payload) {
    const values = payload.comments;
    const previous = this.results.get(item.id);
    if (
      previous &&
      previous.item === item &&
      previous.error === payload.error &&
      previous.loading === payload.loading &&
      previous.values.length === values.length &&
      values.every((value, index) => value === previous.values[index])
    )
      return null;
    this.results.set(item.id, {
      item,
      values,
      error: payload.error,
      loading: payload.loading,
    });
    if (!this.resultUpdatePending) {
      this.resultUpdatePending = true;
      queueMicrotask(() => {
        this.resultUpdatePending = false;
        if (!this.destroyed) this.invalidate();
      });
    }
    return null;
  }
  render() {
    const items = this.props.pullRequest.reviewThreads.edges.map((edge) => edge.node);
    const current = new Set(items.map((item) => item.id));
    for (const id of this.results.keys()) if (!current.has(id)) this.results.delete(id);
    return (
      <Accumulator
        relay={this.props.relay}
        resultBatch={items}
        onDidRefetch={this.props.onDidRefetch}
        pageSize={PAGE_SIZE}
        waitTimeMs={PAGINATION_WAIT_TIME_MS}
        environment={this.props.environment}
        children={(error, items, loading) => {
          const errors = error ? [error] : [];
          let anyLoading = loading;
          for (const item of items) {
            const result = this.results.get(item.id);
            if (result?.error) errors.push(result.error);
            anyLoading ||= result ? result.loading : true;
          }
          return (
            <span
              style={{
                display: "contents",
              }}
            >
              <span hidden>
                {items.map((item) => (
                  <ReviewCommentsAccumulator
                    key={item.id}
                    reviewThread={item}
                    onDidRefetch={this.props.onDidRefetch}
                    environment={this.props.environment}
                    children={(payload) => this.acceptResult(item, payload)}
                  />
                ))}
              </span>
              {provideEnvironment(
                this.props.children({
                  errors,
                  loading: anyLoading,
                  commentThreads: items.map((thread) => ({
                    thread,
                    comments:
                      this.results.get(thread.id)?.values ||
                      thread.comments.edges.map((edge) => edge.node),
                  })),
                }),
                this.props.environment,
              )}
            </span>
          );
        }}
      />
    );
  }
}
export default createPaginationView(
  BareReviewThreadsAccumulator,
  {
    pullRequest: null,
  },
  {
    direction: "forward",
    /* istanbul ignore next */
    getConnectionFromProps(props) {
      return props.pullRequest.reviewThreads;
    },
    /* istanbul ignore next */
    getFragmentVariables(prevVars, totalCount) {
      return {
        ...prevVars,
        totalCount,
      };
    },
    /* istanbul ignore next */
    getVariables(props, { count, cursor }, fragmentVariables) {
      return {
        url: props.pullRequest.url,
        threadCount: count,
        threadCursor: cursor,
        commentCount: fragmentVariables.commentCount,
      };
    },
    query: queries.reviewThreadsAccumulatorQuery,
  },
);
