/** @babel */
/* istanbul ignore file */
import { createRepositoryMutation } from "../graphql/queries";
import mutate from "../graphql/mutate";

export default (environment, { name, ownerID, visibility }) => {
  const variables = {
    input: {
      name,
      ownerId: ownerID,
      visibility,
    },
  };

  return mutate(environment, { query: createRepositoryMutation, variables });
};
