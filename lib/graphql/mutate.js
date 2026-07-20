/** @babel */
import { executeMutation } from "./client";

// Runs a mutation with the `{endpoint, token}` environment and resolves to the
// `data` payload — the value commitMutation's `onCompleted` used to receive.
export default function mutate(environment, { query, variables }) {
  return executeMutation(environment.endpoint, environment.token, { query, variables }).then(
    (payload) => payload.data,
  );
}
