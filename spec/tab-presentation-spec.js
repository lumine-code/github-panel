/** @babel */
import { Disposable } from "lumine";
import TabPresentation from "../lib/models/tab-presentation.js";
import InitialLoad from "../lib/models/initial-load.js";
import ObserveModel from "../lib/views/observe-model.js";
import { createViewHost, flushViews, h } from "./helpers/etch.js";

describe("GitHub tab presentation snapshots", () => {
  it("matches model, parameters, query variables and authentication identities", () => {
    const cache = new TabPresentation();
    const model = {};
    const endpoint = {};
    const environment = { endpoint, token: "first" };
    const data = { value: "accepted" };
    cache.writeModel("token", model, [endpoint], data);
    expect(cache.readModel("token", model, [endpoint])).toEqual({ data });
    expect(cache.readModel("token", {}, [endpoint])).toBeNull();
    expect(cache.readModel("token", model, [{}])).toBeNull();
    expect(cache.readModel("repository", model, [endpoint])).toBeNull();

    cache.writeQuery(environment, "query", { owner: "one", name: "repo" }, data);
    expect(cache.readQuery(environment, "query", { name: "repo", owner: "one" })).toEqual({
      data,
    });
    expect(cache.readQuery(environment, "other", { owner: "one", name: "repo" })).toBeNull();
    expect(cache.readQuery(environment, "query", { owner: "two", name: "repo" })).toBeNull();
    expect(
      cache.readQuery({ endpoint, token: "second" }, "query", { owner: "one", name: "repo" }),
    ).toBeNull();
    expect(
      cache.readQuery({ endpoint: {}, token: "first" }, "query", { owner: "one", name: "repo" }),
    ).toBeNull();
  });

  it("ignores failed values and responses from before invalidation", () => {
    const cache = new TabPresentation();
    const model = {};
    const environment = { endpoint: {}, token: "token" };
    const revision = cache.revision;
    cache.writeModel("repository", model, [], { old: true });
    cache.writeQuery(environment, "query", {}, { old: true });
    cache.clear();
    cache.writeModel("repository", model, [], { late: true }, revision);
    cache.writeQuery(environment, "query", {}, { late: true }, revision);
    expect(cache.readModel("repository", model, [])).toBeNull();
    expect(cache.readQuery(environment, "query", {})).toBeNull();
    for (const data of [null, undefined, new Error("Failed")]) {
      cache.writeModel("repository", model, [], data);
      cache.writeQuery(environment, "query", {}, data);
    }
    expect(cache.readModel("repository", model, [])).toBeNull();
    expect(cache.readQuery(environment, "query", {})).toBeNull();
    cache.writeModel("repository", model, [], { restored: true });
    cache.writeModel("repository", model, [], null);
    expect(cache.readModel("repository", model, [])).toBeNull();
  });

  it("evicts the least recently read or written query after 64 identities", () => {
    const cache = new TabPresentation();
    const environment = { endpoint: {}, token: "token" };
    for (let branch = 0; branch < 64; branch++) {
      cache.writeQuery(environment, "query", { branch }, { branch });
    }
    cache.readQuery(environment, "query", { branch: 0 });
    cache.writeQuery(environment, "query", { branch: 1 }, { updated: true });
    cache.writeQuery(environment, "query", { branch: 64 }, { branch: 64 });
    expect(cache.readQuery(environment, "query", { branch: 2 })).toBeNull();
    expect(cache.readQuery(environment, "query", { branch: 0 })).toEqual({ data: { branch: 0 } });
    expect(cache.readQuery(environment, "query", { branch: 1 })).toEqual({
      data: { updated: true },
    });
    expect(cache.readQuery(environment, "query", { branch: 64 })).toEqual({
      data: { branch: 64 },
    });
  });
});

describe("GitHub tab repository snapshot acceptance", () => {
  let element, host, cache, load, loading, destroyed, model, settle;

  beforeEach(() => {
    element = document.createElement("div");
    jasmine.attachToDOM(element);
    host = createViewHost(element);
    cache = new TabPresentation();
    load = new InitialLoad();
    load.presentationCache = cache;
    loading = false;
    destroyed = false;
    model = {
      isLoading: () => loading,
      isDestroyed: () => destroyed,
      onDidUpdate: () => new Disposable(),
    };
  });

  afterEach(async () => {
    await host.destroy();
    load.dispose();
    element.remove();
  });

  async function mountRead() {
    await flushViews(() =>
      host.update(
        h(ObserveModel, {
          model,
          snapshotKey: "repository",
          environment: { initialLoad: load },
          fetchData: () => new Promise((resolve) => (settle = resolve)),
          children: (data) => h("div", {}, data?.value || "loading"),
        }),
      ),
    );
  }

  it("does not cache a provisional read that settles after the repository is ready", async () => {
    loading = true;
    await mountRead();
    loading = false;
    await flushViews(() => settle({ value: "provisional" }));
    expect(cache.readModel("repository", model, [])).toBeNull();
  });

  it("does not cache a read whose repository was destroyed while it was pending", async () => {
    await mountRead();
    destroyed = true;
    await flushViews(() => settle({ value: "discarded" }));
    expect(cache.readModel("repository", model, [])).toBeNull();
    expect(element.textContent).toBe("loading");
  });

  it("caches an accepted live read and rejects its late write after invalidation", async () => {
    await mountRead();
    await flushViews(() => settle({ value: "accepted" }));
    expect(cache.readModel("repository", model, [])).toEqual({ data: { value: "accepted" } });
    await host.destroy();
    host = createViewHost(element);
    cache.clear();
    await mountRead();
    cache.clear();
    await flushViews(() => settle({ value: "old generation" }));
    expect(cache.readModel("repository", model, [])).toBeNull();
  });
});
