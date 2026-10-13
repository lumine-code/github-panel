/** @babel */
/* istanbul ignore file */
import { removeReactionMutation } from "../graphql/queries.js";
import mutate from "../graphql/mutate.js";
export default (environment, subjectId, content) => {
  const variables = {
    input: {
      content,
      subjectId,
    },
  };
  return mutate(environment, {
    query: removeReactionMutation,
    variables,
  });
};
