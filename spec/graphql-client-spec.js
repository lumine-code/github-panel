/** @babel */
/* global describe, afterEach, it, expect */
import { executeQuery, expectGraphQLQuery, clearGraphQLExpectations } from "../lib/graphql/client";
import * as queries from "../lib/graphql/queries";

function fakeEndpoint() {
  return { getGraphQLRoot: () => "https://api.github.com/graphql" };
}

describe("graphql client", () => {
  afterEach(() => clearGraphQLExpectations());

  it("resolves a registered expectation with its data payload in spec mode", async () => {
    const query = "query remoteContainerQuery($owner: String!) {\n  repository { id }\n}";
    const { resolve } = expectGraphQLQuery(
      { name: "remoteContainerQuery", variables: { owner: "me" } },
      { repository: { id: "1" } },
    );
    const promise = executeQuery(fakeEndpoint(), "tok", { query, variables: { owner: "me" } });
    resolve();
    const payload = await promise;
    expect(payload.data.repository.id).toBe("1");
  });

  it("throws an Unexpected GraphQL query error when nothing matches", async () => {
    let message = null;
    try {
      await executeQuery(fakeEndpoint(), "tok", {
        query: "query nopeQuery { x }",
        variables: {},
      });
    } catch (e) {
      message = e.message;
    }
    expect(message).toMatch(/Unexpected GraphQL query: nopeQuery/);
  });

  it("exposes every Relay operation text as an extracted query string", () => {
    expect(typeof queries.remoteContainerQuery).toBe("string");
    expect(queries.remoteContainerQuery).toMatch(/query remoteContainerQuery/);
    expect(typeof queries.createRepositoryMutation).toBe("string");
    expect(typeof queries.issueishDetailContainerQuery).toBe("string");
  });
});
