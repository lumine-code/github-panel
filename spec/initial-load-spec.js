/** @babel */
import { Disposable } from "lumine";
import InitialLoad from "../lib/models/initial-load.js";
import { createEnvironment } from "../lib/graphql/environment.js";
import ObserveModel from "../lib/views/observe-model.js";
import GraphQLQuery from "../lib/graphql/query.js";
import { createViewHost, flushViews, h } from "./helpers/etch.js";

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function response(data) {
  return { status: 200, headers: { get: () => null }, json: () => Promise.resolve({ data }) };
}

describe("GitHub initial presentation data", () => {
  it("waits for nested reads and latches readiness for later refreshes", () => {
    const changed = jasmine.createSpy("initial presentation changed");
    const load = new InitialLoad({ onChange: changed });
    const bootstrap = load.retain();
    const parent = load.retain();
    bootstrap.dispose();
    const nested = load.retain();
    parent.dispose();
    expect(load.ready).toBe(false);
    expect(load.pending.size).toBe(1);
    nested.dispose();
    expect(load.ready).toBe(true);
    expect(changed).toHaveBeenCalledTimes(1);
    load.retain().dispose();
    nested.dispose();
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it("settles a failed presentation and ignores late or disposed leases", () => {
    const changed = jasmine.createSpy("initial presentation changed");
    const load = new InitialLoad({ onChange: changed });
    const hold = load.retain();
    const error = new Error("Unable to read repository");
    load.fail(error);
    hold.dispose();
    load.fail(new Error("Late failure"));
    expect(load.ready).toBe(true);
    expect(load.error).toBe(error);
    expect(load.pending.size).toBe(0);
    expect(changed).toHaveBeenCalledTimes(1);

    const abandoned = new InitialLoad({ onChange: changed });
    const stale = abandoned.retain();
    abandoned.dispose();
    stale.dispose();
    abandoned.fail(error);
    abandoned.retain().dispose();
    expect(abandoned.ready).toBe(false);
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it("carries presentation ownership without inheriting another query's variables", () => {
    const initialLoad = new InitialLoad();
    const endpoint = {};
    expect(createEnvironment(endpoint, "token", { initialLoad, variables: { old: true } })).toEqual(
      {
        endpoint,
        token: "token",
        initialLoad,
      },
    );
    expect(createEnvironment(endpoint, "token")).toEqual({ endpoint, token: "token" });
  });
});

describe("GitHub initial presentation consumers", () => {
  let element, host, requests, endpoint;
  const loads = new Set();

  function initialLoad() {
    const load = new InitialLoad();
    loads.add(load);
    return load;
  }

  function model() {
    return { onDidUpdate: () => new Disposable() };
  }

  beforeEach(() => {
    element = document.createElement("div");
    jasmine.attachToDOM(element);
    host = createViewHost(element);
    requests = [];
    endpoint = { getGraphQLRoot: () => "https://api.github.com/graphql" };
    spyOn(lumine.window, "isSpecMode").and.returnValue(false);
    spyOn(window, "fetch").and.callFake((_url, options) => {
      const request = { ...deferred(), options };
      requests.push(request);
      return request.promise;
    });
  });

  afterEach(async () => {
    await host.destroy();
    for (const load of loads) load.dispose();
    loads.clear();
    element.remove();
  });

  it("keeps the model hold until its accepted view mounts a nested query", async () => {
    const load = initialLoad();
    const bootstrap = load.retain();
    const read = deferred();
    const environment = createEnvironment(endpoint, "token", { initialLoad: load });
    await flushViews(() =>
      host.update(
        h(ObserveModel, {
          model: model(),
          environment,
          fetchData: () => read.promise,
          children: (data) =>
            data
              ? h(GraphQLQuery, {
                  environment,
                  query: "query initialNested { viewer { login } }",
                  variables: {},
                  render: ({ props }) => h("div", {}, props?.viewer.login || "query loading"),
                })
              : h("div", {}, "model loading"),
        }),
      ),
    );
    bootstrap.dispose();
    expect(load.ready).toBe(false);
    read.resolve({ accepted: true });
    await flushViews(() => {});
    expect(requests.length).toBe(1);
    expect(load.ready).toBe(false);
    expect(load.pending.size).toBe(1);
    requests[0].resolve(response({ viewer: { login: "ready" } }));
    await flushViews(() => {});
    expect(load.ready).toBe(true);
    expect(element.textContent).toBe("ready");
  });

  it("ignores a previous model and releases cached data after a tracker change", async () => {
    const first = initialLoad();
    const next = initialLoad();
    const cached = initialLoad();
    const oldRead = deferred();
    const nextRead = deferred();
    const oldModel = model();
    const nextModel = model();
    const fetchData = jasmine
      .createSpy("read model")
      .and.callFake((active) => (active === oldModel ? oldRead.promise : nextRead.promise));
    const node = (activeModel, load) =>
      h(ObserveModel, {
        model: activeModel,
        environment: { initialLoad: load },
        fetchData,
        children: (data) => h("div", {}, data?.value || "loading"),
      });
    await flushViews(() => host.update(node(oldModel, first)));
    await flushViews(() => host.update(node(nextModel, next)));
    oldRead.resolve({ value: "stale" });
    await flushViews(() => {});
    expect(next.ready).toBe(false);
    nextRead.resolve({ value: "current" });
    await flushViews(() => {});
    expect(next.ready).toBe(true);
    await flushViews(() => host.update(node(nextModel, cached)));
    expect(cached.ready).toBe(true);
    expect(fetchData).toHaveBeenCalledTimes(2);
    expect(element.textContent).toBe("current");
  });

  it("reports an initial read failure without exposing provisional null data", async () => {
    spyOn(console, "error");
    const load = initialLoad();
    const read = deferred();
    const error = new Error("Repository read failed");
    await flushViews(() =>
      host.update(
        h(ObserveModel, {
          model: model(),
          environment: { initialLoad: load },
          fetchData: () => read.promise,
          children: () => h("div", {}, "provisional"),
        }),
      ),
    );
    read.reject(error);
    await flushViews(() => {});
    expect(load.ready).toBe(true);
    expect(load.error).toBe(error);
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it("does not release a model snapshot superseded before its DOM update", async () => {
    const load = initialLoad();
    const first = deferred();
    const next = deferred();
    const activeModel = model();
    const fetchData = jasmine
      .createSpy("read parameterized model")
      .and.callFake((_model, parameter) => (parameter === "first" ? first.promise : next.promise));
    const node = (parameter) =>
      h(ObserveModel, {
        model: activeModel,
        environment: { initialLoad: load },
        fetchData,
        fetchParams: [parameter],
        children: (data) => h("div", {}, data?.value || "loading"),
      });
    await flushViews(() => host.update(node("first")));
    first.resolve({ value: "superseded" });
    await globalThis.flushMicrotasks();
    await flushViews(() => host.update(node("next")));
    expect(fetchData).toHaveBeenCalledTimes(2);
    expect(load.ready).toBe(false);
    next.resolve({ value: "accepted" });
    await flushViews(() => {});
    expect(load.ready).toBe(true);
    expect(element.textContent).toBe("accepted");
  });

  it("waits for nested GraphQL results and keeps accepted content during a same-query retry", async () => {
    const load = initialLoad();
    const bootstrap = load.retain();
    const environment = createEnvironment(endpoint, "token", { initialLoad: load });
    let retry;
    const node = h(GraphQLQuery, {
      environment,
      query: "query initialParent { viewer { login } }",
      variables: {},
      render: ({ props, retry: retryQuery }) => {
        retry = retryQuery;
        return props
          ? h(GraphQLQuery, {
              environment,
              query: "query initialChild { viewer { login } }",
              variables: {},
              render: ({ props: child }) => h("div", {}, child?.viewer.login || "child loading"),
            })
          : h("div", {}, "parent loading");
      },
    });
    await flushViews(() => host.update(node));
    bootstrap.dispose();
    requests[0].resolve(response({ viewer: { login: "parent" } }));
    await flushViews(() => {});
    expect(load.ready).toBe(false);
    expect(requests.length).toBe(2);
    requests[1].resolve(response({ viewer: { login: "accepted" } }));
    await flushViews(() => {});
    expect(load.ready).toBe(true);
    expect(element.textContent).toBe("accepted");
    await flushViews(() => retry());
    expect(element.textContent).toBe("accepted");
    requests[2].resolve(response({ viewer: { login: "refreshed" } }));
    await flushViews(() => {});
    expect(element.textContent).toBe("accepted");
    expect(requests.length).toBe(3);
  });

  it("releases an accepted query after moving to a new presentation tracker", async () => {
    const first = initialLoad();
    const next = initialLoad();
    const node = (load) =>
      h(GraphQLQuery, {
        environment: createEnvironment(endpoint, "token", { initialLoad: load }),
        query: "query initialCached { viewer { login } }",
        variables: {},
        render: ({ props }) => h("div", {}, props?.viewer.login || "loading"),
      });
    await flushViews(() => host.update(node(first)));
    requests[0].resolve(response({ viewer: { login: "cached" } }));
    await flushViews(() => {});
    await flushViews(() => host.update(node(next)));
    expect(next.ready).toBe(true);
    expect(requests.length).toBe(1);
    expect(element.textContent).toBe("cached");
  });

  it("does not release the current tracker when an old query result arrives", async () => {
    const first = initialLoad();
    const next = initialLoad();
    const node = (load, id) =>
      h(GraphQLQuery, {
        environment: createEnvironment(endpoint, "token", { initialLoad: load }),
        query: "query initialStale($id: ID!) { node(id: $id) { id } }",
        variables: { id },
        render: ({ props }) => h("div", {}, props?.node.id || "loading"),
      });
    await flushViews(() => host.update(node(first, "old")));
    await flushViews(() => host.update(node(next, "current")));
    requests[0].resolve(response({ node: { id: "stale" } }));
    await flushViews(() => {});
    expect(next.ready).toBe(false);
    expect(element.textContent).toBe("loading");
    requests[1].resolve(response({ node: { id: "accepted" } }));
    await flushViews(() => {});
    expect(next.ready).toBe(true);
    expect(element.textContent).toBe("accepted");
  });

  it("keeps a cached query handoff pending when its variables change before the DOM flush", async () => {
    const first = initialLoad();
    const next = initialLoad();
    let view;
    const props = (load, id) => ({
      environment: createEnvironment(endpoint, "token", { initialLoad: load }),
      query: "query initialHandoff($id: ID!) { node(id: $id) { id } }",
      variables: { id },
      render: ({ props: data }) => h("div", {}, data?.node.id || "loading"),
      ref: (value) => {
        if (value) view = value;
      },
    });
    await flushViews(() => host.update(h(GraphQLQuery, props(first, "first"))));
    requests[0].resolve(response({ node: { id: "cached" } }));
    await flushViews(() => {});
    view.update(props(next, "first"));
    view.update(props(next, "next"));
    await flushViews(() => {});
    expect(requests.length).toBe(2);
    expect(next.ready).toBe(false);
    requests[1].resolve(response({ node: { id: "accepted" } }));
    await flushViews(() => {});
    expect(next.ready).toBe(true);
    expect(element.textContent).toBe("accepted");
  });

  for (const refresh of ["parameters", "model update"]) {
    it(`keeps a cached model handoff pending when ${refresh} change before the DOM flush`, async () => {
      const first = initialLoad();
      const next = initialLoad();
      const read = deferred();
      let updateModel,
        view,
        reads = 0;
      const activeModel = {
        onDidUpdate: (callback) => {
          updateModel = callback;
          return new Disposable();
        },
      };
      const props = (load, parameter) => ({
        model: activeModel,
        environment: { initialLoad: load },
        fetchParams: [parameter],
        fetchData: () => (++reads === 1 ? Promise.resolve({ value: "cached" }) : read.promise),
        children: (data) => h("div", {}, data?.value || "loading"),
        ref: (value) => {
          if (value) view = value;
        },
      });
      await flushViews(() => host.update(h(ObserveModel, props(first, "first"))));
      expect(first.ready).toBe(true);
      view.update(props(next, "first"));
      if (refresh === "parameters") view.update(props(next, "next"));
      else updateModel();
      await flushViews(() => {});
      expect(reads).toBe(2);
      expect(next.ready).toBe(false);
      read.resolve({ value: "accepted" });
      await flushViews(() => {});
      expect(next.ready).toBe(true);
      expect(element.textContent).toBe("accepted");
    });
  }

  it("retains a refreshing query before removing its pending nested request", async () => {
    const load = initialLoad();
    const environment = createEnvironment(endpoint, "token", { initialLoad: load });
    let retry;
    await flushViews(() =>
      host.update(
        h(GraphQLQuery, {
          environment,
          query: "query initialRefreshParent { viewer { login } }",
          variables: {},
          render: ({ props, retry: retryQuery }) => {
            retry = retryQuery;
            return props
              ? h(GraphQLQuery, {
                  environment,
                  query: "query initialRefreshChild { viewer { login } }",
                  variables: {},
                  render: ({ props: child }) => h("div", {}, child?.viewer.login || "loading"),
                })
              : null;
          },
        }),
      ),
    );
    requests[0].resolve(response({ viewer: { login: "parent" } }));
    await flushViews(() => {});
    expect(load.pending.size).toBe(1);
    await flushViews(() => retry());
    expect(requests[1].options.signal.aborted).toBe(true);
    expect(load.ready).toBe(false);
    expect(load.pending.size).toBe(1);
    requests[2].resolve(response({ viewer: { login: "parent refreshed" } }));
    await flushViews(() => {});
    expect(requests.length).toBe(4);
    expect(load.ready).toBe(false);
    requests[3].resolve(response({ viewer: { login: "accepted" } }));
    await flushViews(() => {});
    expect(load.ready).toBe(true);
    expect(element.textContent).toBe("accepted");
  });

  it("retains a refreshing model while its accepted view replaces a pending nested query", async () => {
    const load = initialLoad();
    const environment = createEnvironment(endpoint, "token", { initialLoad: load });
    const read = deferred();
    let updateModel,
      reads = 0;
    const activeModel = {
      onDidUpdate: (callback) => {
        updateModel = callback;
        return new Disposable();
      },
    };
    await flushViews(() =>
      host.update(
        h(ObserveModel, {
          model: activeModel,
          environment,
          fetchData: () => (++reads === 1 ? Promise.resolve({ stage: "first" }) : read.promise),
          children: (data) =>
            data
              ? h(
                  data.stage === "first" ? "div" : "section",
                  {},
                  h(GraphQLQuery, {
                    environment,
                    query: "query initialRefreshModelChild { viewer { login } }",
                    variables: {},
                    render: ({ props }) => h("div", {}, props?.viewer.login || "loading"),
                  }),
                )
              : null,
        }),
      ),
    );
    expect(requests.length).toBe(1);
    expect(load.pending.size).toBe(1);
    updateModel();
    expect(load.pending.size).toBe(2);
    read.resolve({ stage: "next" });
    await flushViews(() => {});
    expect(requests[0].options.signal.aborted).toBe(true);
    expect(requests.length).toBe(2);
    expect(load.ready).toBe(false);
    expect(load.pending.size).toBe(1);
    requests[1].resolve(response({ viewer: { login: "accepted" } }));
    await flushViews(() => {});
    expect(load.ready).toBe(true);
    expect(element.textContent).toBe("accepted");
  });

  it("shows progress when retrying a terminal query error after the presentation is ready", async () => {
    const load = initialLoad();
    let retry;
    await flushViews(() =>
      host.update(
        h(GraphQLQuery, {
          environment: createEnvironment(endpoint, "token", { initialLoad: load }),
          query: "query initialRetryError { viewer { login } }",
          variables: {},
          render: ({ error, props, retry: retryQuery }) => {
            retry = retryQuery;
            return h("div", {}, error ? "failed" : props?.viewer.login || "loading");
          },
        }),
      ),
    );
    requests[0].reject(new Error("Query failed"));
    await flushViews(() => {});
    expect(load.ready).toBe(true);
    expect(element.textContent).toBe("failed");
    await flushViews(() => retry());
    expect(element.textContent).toBe("loading");
    requests[1].resolve(response({ viewer: { login: "accepted" } }));
    await flushViews(() => {});
    expect(element.textContent).toBe("accepted");
  });
});
