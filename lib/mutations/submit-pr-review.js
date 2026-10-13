/** @babel */
/* istanbul ignore file */
import { submitPrReviewMutation } from "../graphql/queries.js";
import mutate from "../graphql/mutate.js";
export default (environment, { reviewID, event }) => {
  const variables = {
    input: {
      event,
      pullRequestReviewId: reviewID,
    },
  };
  return mutate(environment, {
    query: submitPrReviewMutation,
    variables,
  });
};
