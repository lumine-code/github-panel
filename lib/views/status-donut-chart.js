/** @babel */
/** @jsx h */
import View, { h } from "../etch/view";
import DonutChart from "./donut-chart";
import { unusedProps } from "../helpers";
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
