/** @babel */
import createPaginationView from "../graphql/pagination";
import * as queries from "../graphql/queries";
import IssueishTimelineView from "../views/issueish-timeline-view";
export default createPaginationView(
  IssueishTimelineView,
  {
    pullRequest: null,
  },
  {
    direction: "forward",
    getConnectionFromProps(props) {
      return props.pullRequest.timelineItems;
    },
    getFragmentVariables(prevVars, totalCount) {
      return {
        ...prevVars,
        timelineCount: totalCount,
      };
    },
    getVariables(props, { count, cursor }, fragmentVariables) {
      return {
        url: props.pullRequest.url,
        timelineCount: count,
        timelineCursor: cursor,
      };
    },
    query: queries.prTimelineControllerQuery,
  },
);
