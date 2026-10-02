/** @babel */
/** @jsx h */
import View, { h } from "../etch/view";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import cx from "classnames";
dayjs.extend(relativeTime);
const clockViews = new Set();
let clockTimer = null;
const shortLabels = {
  s: "Now",
  ss: "<1m",
  m: "1m",
  mm: "%dm",
  h: "1h",
  hh: "%dh",
  d: "1d",
  dd: "%dd",
  M: "1M",
  MM: "%dM",
  y: "1y",
  yy: "%dy",
};
function shortRelativeTime(date, now) {
  const seconds = now.diff(date, "second");
  const minutes = now.diff(date, "minute");
  const hours = now.diff(date, "hour");
  const days = now.diff(date, "day");
  const months = now.diff(date, "month");
  const years = now.diff(date, "year");
  const abs = Math.abs;
  const match = (abs(seconds) <= 44 && ["s", seconds]) ||
    (abs(seconds) < 90 && ["m", 1]) ||
    (abs(minutes) < 45 && ["mm", minutes]) ||
    (abs(minutes) < 90 && ["h", 1]) ||
    (abs(hours) < 22 && ["hh", hours]) ||
    (abs(hours) < 36 && ["d", 1]) ||
    (abs(days) < 26 && ["dd", days]) ||
    (abs(days) < 46 && ["M", 1]) ||
    (abs(months) < 11 && ["MM", months]) ||
    (abs(months) < 18 && ["y", 1]) || ["yy", years];
  const label = shortLabels[match[0]];
  return label.replace("%d", Math.abs(match[1]));
}
export default class Timeago extends View {
  constructor(props, children) {
    super(props, children);
    this.initialize();
  }
  static defaultProps = {
    type: "span",
    displayStyle: "long",
  };
  static getTimeDisplay(time, now, style) {
    const d = dayjs(time);
    if (style === "short") {
      return shortRelativeTime(d, now);
    } else {
      const diff = d.diff(now, "month", true);
      if (Math.abs(diff) <= 1) {
        return d.from(now);
      } else {
        const format = d.format("MMM D, YYYY");
        return `on ${format}`;
      }
    }
  }
  didMount() {
    clockViews.add(this);
    if (!clockTimer)
      clockTimer = setInterval(() => {
        for (const view of clockViews) view.invalidate();
      }, 60000);
  }
  willDestroy() {
    clockViews.delete(this);
    if (clockViews.size === 0) {
      clearInterval(clockTimer);
      clockTimer = null;
    }
  }
  render() {
    const { type, time, displayStyle, ...others } = this.props;
    const display = Timeago.getTimeDisplay(time, dayjs(), displayStyle);
    const className = cx("timeago", others.className);
    return h(type, { ...others, className }, display);
  }
}
