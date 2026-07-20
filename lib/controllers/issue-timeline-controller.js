/** @babel */
import createPaginationContainer from "../graphql/pagination";
import * as queries from "../graphql/queries";

import IssueishTimelineView from "../views/issueish-timeline-view";

export default createPaginationContainer(
  IssueishTimelineView,
  {
    issue: null,
  },
  {
    direction: "forward",
    getConnectionFromProps(props) {
      return props.issue.timeline;
    },
    getFragmentVariables(prevVars, totalCount) {
      return {
        ...prevVars,
        timelineCount: totalCount,
      };
    },
    getVariables(props, { count, cursor }, fragmentVariables) {
      return {
        url: props.issue.url,
        timelineCount: count,
        timelineCursor: cursor,
      };
    },
    query: queries.issueTimelineControllerQuery,
  },
);
