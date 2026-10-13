/** @babel */
/** @jsx h */
import View, { h } from "../etch/view.js";
import DonutChart from "./donut-chart.js";
import { unusedProps } from "../helpers.js";
export default class StatusDonutChart extends View {
  constructor(props, children) {
    super(props, children);
    this.initialize();
  }
  static propTypes = {
    pending: true,
    failure: true,
    success: true,
  };
  render() {
    const slices = ["pending", "failure", "success"].reduce((acc, type) => {
      const count = this.props[type];
      if (count > 0) {
        acc.push({
          type,
          className: type,
          count,
        });
      }
      return acc;
    }, []);
    return (
      <DonutChart
        {...unusedProps(this.props, this.constructor.propTypes)}
        slices={slices}
        environment={this.props.environment}
      />
    );
  }
}
