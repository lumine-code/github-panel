/** @babel */
/* istanbul ignore file */
import { removeReactionMutation } from "../graphql/queries";
import mutate from "../graphql/mutate";

export default (environment, subjectId, content) => {
  const variables = {
    input: {
      content,
      subjectId,
    },
  };

  return mutate(environment, { query: removeReactionMutation, variables });
};
