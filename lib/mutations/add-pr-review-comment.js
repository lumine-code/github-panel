/** @babel */
/* istanbul ignore file */
import { addPrReviewCommentMutation } from "../graphql/queries";
import mutate from "../graphql/mutate";

export default (environment, { body, inReplyTo, reviewID }) => {
  const variables = {
    input: {
      body,
      inReplyTo,
      pullRequestReviewId: reviewID,
    },
  };

  return mutate(environment, { query: addPrReviewCommentMutation, variables });
};
