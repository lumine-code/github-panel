/** @babel */
/* istanbul ignore file */
import { resolveReviewThreadMutation } from "../graphql/queries.js";
import mutate from "../graphql/mutate.js";
export default (environment, { threadID }) => {
  const variables = {
    input: {
      threadId: threadID,
    },
  };
  return mutate(environment, {
    query: resolveReviewThreadMutation,
    variables,
  });
};
