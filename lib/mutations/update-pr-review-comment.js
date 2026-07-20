/** @babel */
/* istanbul ignore file */
import { updatePrReviewCommentMutation } from "../graphql/queries";
import mutate from "../graphql/mutate";

export default (environment, { commentId, commentBody }) => {
  const variables = {
    input: {
      pullRequestReviewCommentId: commentId,
      body: commentBody,
    },
  };

  return mutate(environment, { query: updatePrReviewCommentMutation, variables });
};
