/** @babel */
/* istanbul ignore file */
import { addReactionMutation } from "../graphql/queries.js";
import mutate from "../graphql/mutate.js";
export default (environment, subjectId, content) => {
  const variables = {
    input: {
      content,
      subjectId,
    },
  };
  return mutate(environment, {
    query: addReactionMutation,
    variables,
  });
};
