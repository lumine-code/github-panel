/** @babel */
/* istanbul ignore file */
import { updatePrReviewSummaryMutation } from "../graphql/queries.js";
import mutate from "../graphql/mutate.js";
export default (environment, { reviewId, reviewBody }) => {
  const variables = {
    input: {
      pullRequestReviewId: reviewId,
      body: reviewBody,
    },
  };
  return mutate(environment, {
    query: updatePrReviewSummaryMutation,
    variables,
  });
};
