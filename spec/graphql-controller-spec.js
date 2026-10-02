/** @babel */
import { h, View, createViewHost, flushViews } from "./helpers/etch";
import GraphQLQuery from "../lib/graphql/query";
import createPaginationView from "../lib/graphql/pagination";
import createRefetchView from "../lib/graphql/refetch";
import EmojiReactionsController from "../lib/controllers/emoji-reactions-controller";
import ObserveModel from "../lib/views/observe-model";
import { Disposable } from "lumine";

function deferred() {
  let resolve;
  const promise = new Promise((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}
function response(data) {
  return { status: 200, headers: { get: () => null }, json: () => Promise.resolve({ data }) };
}
function resource(id, ids, hasMore = true) {
  return {
    id,
    connection: {
      edges: ids.map((value) => ({ cursor: value, node: { id: value } })),
      pageInfo: { hasNextPage: hasMore, endCursor: ids[ids.length - 1] },
    },
  };
}
class ResultView extends View {
  constructor(props, children) {
    super(props, children);
    this.initialize();
  }
  render() {
    return h(
      "span",
      {},
      this.props.label ||
        this.props.resource?.connection.edges.map((edge) => edge.node.id).join(","),
    );
  }
}

describe("native GraphQL data views", () => {
  let element, host, requests, environment;
  beforeEach(() => {
    element = document.createElement("div");
    document.body.appendChild(element);
    host = createViewHost(element);
    requests = [];
    environment = {
      endpoint: { getGraphQLRoot: () => "https://api.github.com/graphql" },
      token: "token",
      variables: { commentCount: 17 },
    };
    spyOn(lumine.window, "isSpecMode").and.returnValue(false);
    spyOn(window, "fetch").and.callFake((_url, options) => {
      const request = { ...deferred(), options };
      requests.push(request);
      return request.promise;
    });
  });
  afterEach(async () => {
    await host.destroy();
    element.remove();
  });

  it("replaces query variables without committing an old result or its environment", async () => {
    let childEnvironment;
    const props = (id) => ({
      environment,
      query: "query querySpec($id: ID!) { node(id:$id) { id } }",
      variables: { id },
      render: ({ props: data }) =>
        h(ResultView, {
          label: data?.node.id || "loading",
          ref: (view) => {
            if (view) childEnvironment = view.props.environment;
          },
        }),
    });
    await flushViews(() => host.update(h(GraphQLQuery, props("A"))));
    await flushViews(() => host.update(h(GraphQLQuery, props("B"))));
    expect(requests[0].options.signal.aborted).toBe(true);
    requests[1].resolve(response({ node: { id: "B" } }));
    await flushViews(() => {});
    requests[0].resolve(response({ node: { id: "A" } }));
    await flushViews(() => {});
    expect(element.textContent).toBe("B");
    expect(childEnvironment.token).toBe("token");
    expect(childEnvironment.variables).toEqual({ id: "B" });
  });

  it("passes base variables, appends immutable deduplicated pages and settles cancellation", async () => {
    let view;
    const config = {
      query: "query paginationSpec($id:ID!,$commentCount:Int!){ resource{id} }",
      getConnectionFromProps: (props) => props.resource.connection,
      getVariables: (props, { cursor }, base) => ({
        id: props.resource.id,
        cursor,
        commentCount: base.commentCount,
      }),
    };
    const Paginated = createPaginationView(ResultView, { resource: null }, config);
    const seed = resource("A", ["1"]);
    await flushViews(() =>
      host.update(
        h(Paginated, {
          environment,
          resource: seed,
          ref: (value) => {
            view = value;
          },
        }),
      ),
    );
    view.relay.loadMore(50);
    expect(JSON.parse(requests[0].options.body).variables.commentCount).toBe(17);
    requests[0].resolve(response({ resource: resource("A", ["1", "2"], false) }));
    await flushViews(() => {});
    expect(element.textContent).toBe("1,2");
    expect(seed.connection.edges.length).toBe(1);
    expect(view.relay.hasMore()).toBe(false);
    await flushViews(() =>
      host.update(
        h(Paginated, {
          environment,
          resource: resource("B", ["3"]),
          ref: (value) => {
            view = value;
          },
        }),
      ),
    );
    const cancelled = view.relay.loadMore(50);
    cancelled.dispose();
    expect(requests[1].options.signal.aborted).toBe(true);
    expect(view.relay.isLoading()).toBe(false);
    view.relay.loadMore(50);
    requests[2].resolve(response({ resource: resource("B", ["4"], false) }));
    requests[1].resolve(response({ resource: resource("B", ["old"], false) }));
    await flushViews(() => {});
    expect(element.textContent).toBe("3,4");
  });

  it("refreshes all declared fragments and ignores a late previous refresh", async () => {
    class BothView extends View {
      constructor(props, children) {
        super(props, children);
        this.initialize();
      }
      render() {
        return h("span", {}, `${this.props.repository.id}:${this.props.pullRequest.id}`);
      }
    }
    const Refetched = createRefetchView(
      BothView,
      { repository: null, pullRequest: null },
      "query refetchSpec($id:ID!){ repository{id} pullRequest{id} }",
    );
    let view;
    await flushViews(() =>
      host.update(
        h(Refetched, {
          environment,
          repository: { id: "r0" },
          pullRequest: { id: "p0" },
          ref: (value) => {
            view = value;
          },
        }),
      ),
    );
    view.relay.refetch({ id: "old" });
    view.relay.refetch({ id: "new" });
    requests[1].resolve(response({ repository: { id: "r1" }, pullRequest: { id: "p1" } }));
    requests[0].resolve(response({ repository: { id: "old" }, pullRequest: { id: "old" } }));
    await flushViews(() => {});
    expect(element.textContent).toBe("r1:p1");
  });

  it("invalidates pagination immediately when a connection and token change", async () => {
    const Paginated = createPaginationView(
      ResultView,
      { resource: null },
      {
        query: "query pageIdentitySpec($id:ID!){ resource{id} }",
        getConnectionFromProps: (props) => props.resource.connection,
        getVariables: (props) => ({ id: props.resource.id }),
      },
    );
    let view;
    const first = {
      environment,
      resource: resource("A", ["a"]),
      ref: (value) => {
        if (value) view = value;
      },
    };
    await flushViews(() => host.update(h(Paginated, first)));
    view.relay.loadMore(50);
    view.update({
      ...first,
      resource: resource("B", ["b"]),
      environment: { ...environment, token: "new-token" },
    });
    expect(requests[0].options.signal.aborted).toBe(true);
    expect(view.relay.isLoading()).toBe(false);
    view.relay.loadMore(50);
    requests[0].resolve(response({ resource: resource("A", ["old"], false) }));
    requests[1].resolve(response({ resource: resource("B", ["new"], false) }));
    await flushViews(() => {});
    expect(element.textContent).toBe("b,new");
  });

  it("publishes reaction mutation results without a normalized React data store", async () => {
    let view;
    await flushViews(() =>
      host.update(
        h(EmojiReactionsController, {
          environment,
          reactable: { id: "comment", viewerCanReact: true, reactionGroups: [] },
          tooltips: lumine.tooltips,
          reportRelayError: jasmine.createSpy("reportRelayError"),
          ref: (value) => {
            if (value) view = value;
          },
        }),
      ),
    );
    const added = view.addReaction("THUMBS_UP");
    const groups = [{ content: "THUMBS_UP", viewerHasReacted: true, users: { totalCount: 1 } }];
    requests[0].resolve(
      response({ addReaction: { subject: { id: "comment", reactionGroups: groups } } }),
    );
    await flushViews(() => added);
    expect(element.querySelectorAll(".github-panel-EmojiReactions-group.selected").length).toBe(1);
    const removed = view.removeReaction("THUMBS_UP");
    requests[1].resolve(
      response({ removeReaction: { subject: { id: "comment", reactionGroups: [] } } }),
    );
    await flushViews(() => removed);
    expect(element.querySelectorAll(".github-panel-EmojiReactions-group.selected").length).toBe(0);
  });

  it("passes a query environment through callbacks owned by a nested data view", async () => {
    let inherited;
    const model = { onDidUpdate: () => new Disposable(), isDestroyed: () => false };
    await flushViews(() =>
      host.update(
        h(GraphQLQuery, {
          environment,
          query: "query nestedEnvironment { node { id } }",
          variables: { id: "A" },
          render: () =>
            h(ObserveModel, {
              model,
              fetchData: () => Promise.resolve("nested"),
              children: (value) =>
                h(ResultView, {
                  label: value || "waiting",
                  environment: undefined,
                  ref: (view) => {
                    if (view) inherited = view.props.environment;
                  },
                }),
            }),
        }),
      ),
    );
    requests[0].resolve(response({ node: { id: "A" } }));
    await flushViews(() => {});
    expect(element.textContent).toBe("nested");
    expect(inherited.token).toBe("token");
    expect(inherited.variables).toEqual({ id: "A" });
  });
});
