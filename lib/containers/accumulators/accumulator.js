/** @babel */
import React from "react";
import { Disposable } from "lumine";

export default class Accumulator extends React.Component {
  constructor(props) {
    super(props);

    this.refetchSub = new Disposable();
    this.loadMoreSub = new Disposable();
    this.nextUpdateSub = new Disposable();

    this.nextUpdateID = null;
    this.state = { error: null };
  }

  componentDidMount() {
    this.refetchSub = this.props.onDidRefetch(this.attemptToLoadMore);
    this.attemptToLoadMore();
  }

  componentWillUnmount() {
    this.refetchSub.dispose();
    this.loadMoreSub.dispose();
    this.nextUpdateSub.dispose();
  }

  render() {
    return this.props.children(
      this.state.error,
      this.props.resultBatch,
      this.props.relay.hasMore(),
    );
  }

  attemptToLoadMore = () => {
    this.loadMoreSub.dispose();
    this.nextUpdateID = null;

    /* istanbul ignore if */
    if (!this.props.relay.hasMore() || this.props.relay.isLoading()) {
      return;
    }

    this.loadMoreSub = this.props.relay.loadMore(this.props.pageSize, this.accumulate);
  };

  accumulate = (error) => {
    if (error) {
      this.setState({ error });
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
