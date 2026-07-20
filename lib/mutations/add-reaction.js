/** @babel */
/* istanbul ignore file */
import { addReactionMutation } from "../graphql/queries";
import mutate from "../graphql/mutate";

export default (environment, subjectId, content) => {
  const variables = {
    input: {
      content,
      subjectId,
    },
  };

  return mutate(environment, { query: addReactionMutation, variables });
};
