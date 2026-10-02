/** @babel */
import GraphQLRequest from "../lib/graphql/request";

export function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
export function graphqlResponse(data) {
  return { status: 200, headers: { get: () => null }, json: () => Promise.resolve({ data }) };
}

describe("GraphQL request ownership", () => {
  let request, pending, environment;
  beforeEach(() => {
    request = new GraphQLRequest();
    pending = [];
    environment = {
      endpoint: { getGraphQLRoot: () => "https://api.github.com/graphql" },
      token: "token",
    };
    spyOn(lumine.window, "isSpecMode").and.returnValue(false);
    spyOn(window, "fetch").and.callFake((_url, options) => {
      const operation = { ...deferred(), options };
      pending.push(operation);
      return operation.promise;
    });
  });
  afterEach(() => request.destroy());

  it("aborts the previous HTTP operation and only publishes the current result", async () => {
    const publish = jasmine.createSpy("publish");
    request.run(environment, "query a { node { id } }", {}, publish);
    request.run(environment, "query b { node { id } }", {}, publish);
    expect(pending[0].options.signal.aborted).toBe(true);
    pending[1].resolve(graphqlResponse({ node: { id: "new" } }));
    await globalThis.flushMicrotasks();
    pending[0].resolve(graphqlResponse({ node: { id: "old" } }));
    await globalThis.flushMicrotasks();
    expect(publish.calls.count()).toBe(1);
    expect(publish.calls.mostRecent().args).toEqual([null, { node: { id: "new" } }]);
  });

  it("does not publish a body that completes after its owner is destroyed", async () => {
    const body = deferred();
    const publish = jasmine.createSpy("publish");
    request.run(environment, "query a { node { id } }", {}, publish);
    pending[0].resolve({ ...graphqlResponse(null), json: () => body.promise });
    await globalThis.flushMicrotasks();
    request.destroy();
    body.resolve({ data: { node: { id: "old" } } });
    await globalThis.flushMicrotasks();
    expect(pending[0].options.signal.aborted).toBe(true);
    expect(publish).not.toHaveBeenCalled();
  });

  it("disposes only its own operation after a replacement begins", async () => {
    const old = request.run(environment, "query a { node { id } }", {}, () => {});
    const publish = jasmine.createSpy("publish");
    request.run(environment, "query b { node { id } }", {}, publish);
    old.dispose();
    expect(pending[1].options.signal.aborted).toBe(false);
    pending[1].resolve(graphqlResponse({ node: { id: "new" } }));
    await globalThis.flushMicrotasks();
    expect(publish).toHaveBeenCalled();
  });
});
