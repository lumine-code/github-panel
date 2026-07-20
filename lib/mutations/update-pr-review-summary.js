/** @babel */
/* istanbul ignore file */
import { updatePrReviewSummaryMutation } from "../graphql/queries";
import mutate from "../graphql/mutate";

export default (environment, { reviewId, reviewBody }) => {
  const variables = {
    input: {
      pullRequestReviewId: reviewId,
      body: reviewBody,
    },
  };

  return mutate(environment, { query: updatePrReviewSummaryMutation, variables });
};
