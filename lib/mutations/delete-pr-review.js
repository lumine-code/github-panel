/** @babel */
/* istanbul ignore file */
import { deletePrReviewMutation } from "../graphql/queries.js";
import mutate from "../graphql/mutate.js";
export default (environment, { reviewID }) => {
  const variables = {
    input: {
      pullRequestReviewId: reviewID,
    },
  };
  return mutate(environment, {
    query: deletePrReviewMutation,
    variables,
  });
};
