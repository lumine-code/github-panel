/** @babel */
/* istanbul ignore file */
import { deletePrReviewMutation } from "../graphql/queries";
import mutate from "../graphql/mutate";

export default (environment, { reviewID }) => {
  const variables = {
    input: { pullRequestReviewId: reviewID },
  };

  return mutate(environment, { query: deletePrReviewMutation, variables });
};
