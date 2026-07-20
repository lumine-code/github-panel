/** @babel */
/* istanbul ignore file */
import { unresolveReviewThreadMutation } from "../graphql/queries";
import mutate from "../graphql/mutate";

export default (environment, { threadID }) => {
  const variables = {
    input: {
      threadId: threadID,
    },
  };

  return mutate(environment, { query: unresolveReviewThreadMutation, variables });
};
