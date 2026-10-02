/** @babel */
/** @jsx h */
import { provideEnvironment } from "../../graphql/environment";
import View, { h } from "../../etch/view";
import { Disposable } from "lumine";
export default class Accumulator extends View {
  constructor(props, children) {
    super(props, children);
    this.refetchSub = new Disposable();
    this.loadMoreSub = new Disposable();
    this.nextUpdateSub = new Disposable();
    this.nextUpdateID = null;
    this.state = {
      error: null,
    };
    this.initialize();
  }
  didMount() {
    this.refetchSub = this.props.onDidRefetch(this.attemptToLoadMore);
    this.attemptToLoadMore();
  }
  willDestroy() {
    this.refetchSub.dispose();
    this.loadMoreSub.dispose();
    this.nextUpdateSub.dispose();
  }
  render() {
    return (
      <span
        style={{
          display: "contents",
        }}
      >
        {provideEnvironment(
          this.props.children(this.state.error, this.props.resultBatch, this.props.relay.hasMore()),
          this.props.environment,
        )}
      </span>
    );
  }
  attemptToLoadMore = () => {
    if (this.destroyed || this.props.relay.isLoading()) return;
    this.loadMoreSub.dispose();
    this.nextUpdateSub.dispose();
    this.nextUpdateID = null;

    /* istanbul ignore if */
    if (!this.props.relay.hasMore() || this.props.relay.isLoading()) {
      return;
    }
    this.loadMoreSub = this.props.relay.loadMore(this.props.pageSize, this.accumulate);
  };
  accumulate = (error) => {
    if (this.destroyed) return;
    if (error) {
      this.updateState({
        error,
      });
    } else {
      if (this.props.waitTimeMs > 0 && this.nextUpdateID === null) {
        this.nextUpdateID = setTimeout(this.attemptToLoadMore, this.props.waitTimeMs);
        this.nextUpdateSub = new Disposable(() => {
          clearTimeout(this.nextUpdateID);
          this.nextUpdateID = null;
        });
      } else {
        this.attemptToLoadMore();
      }
    }
  };
}
