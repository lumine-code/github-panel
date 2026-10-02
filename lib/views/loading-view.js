/** @babel */
/** @jsx h */
import View, { h } from "../etch/view";
export default class LoadingView extends View {
  constructor(props, children) {
    super(props, children);
    this.initialize();
  }
  render() {
    return (
      <div className="github-panel-Loader">
        <span className="github-panel-Spinner" />
      </div>
    );
  }
}
