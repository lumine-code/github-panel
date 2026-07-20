/** @babel */
/* istanbul ignore file */
import { submitPrReviewMutation } from "../graphql/queries";
import mutate from "../graphql/mutate";

export default (environment, { reviewID, event }) => {
  const variables = {
    input: {
      event,
      pullRequestReviewId: reviewID,
    },
  };

  return mutate(environment, { query: submitPrReviewMutation, variables });
};
