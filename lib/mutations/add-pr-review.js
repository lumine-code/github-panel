/** @babel */
/* istanbul ignore file */
import { addPrReviewMutation } from "../graphql/queries.js";
import mutate from "../graphql/mutate.js";
export default (environment, { body, event, pullRequestID }) => {
  const variables = {
    input: {
      pullRequestId: pullRequestID,
    },
  };
  if (body) {
    variables.input.body = body;
  }
  if (event) {
    variables.input.event = event;
  }
  return mutate(environment, {
    query: addPrReviewMutation,
    variables,
  });
};
