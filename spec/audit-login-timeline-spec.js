/** @babel */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import GithubLoginModel from "../lib/models/github-login-model";
import { OAUTH_CREDENTIAL_KIND } from "../lib/models/github-device-flow";
import { UNAUTHENTICATED } from "../lib/shared/token-status";
import IssueTimeline from "../lib/controllers/issue-timeline-controller";
import PullRequestTimeline from "../lib/controllers/pr-timeline-controller";
import { flushViews } from "./helpers/etch";

function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
const credential = (accessToken) => ({
  kind: OAUTH_CREDENTIAL_KIND,
  accessToken,
  refreshToken: "controlled-refresh",
  expiresAt: 1000,
  clientId: "controlled-client",
  tokenUrl: "https://example.invalid/access-token",
});

describe("GitHub login and timeline audit boundaries", () => {
  let scratch, temporaryRoot, secrets, model, views, gates, work, container;
  beforeEach(async () => {
    for (const name of ["openPath", "openExternal", "openApplication", "showItemInFolder"])
      spyOn(lumine.shell, name).and.resolveTo();
    spyOn(window, "fetch").and.rejectWith(new Error("Unexpected test HTTP request"));
    temporaryRoot = await fs.realpath(os.tmpdir());
    scratch = await fs.realpath(await fs.mkdtemp(path.join(temporaryRoot, "github-audit-")));
    // Use the actual Core store with its documented session-only fallback.
    // No OS credentials are read, and its watcher observes only this owned path.
    secrets = new lumine.secrets.constructor({
      storagePath: path.join(scratch, "secrets.json"),
      safeStorage: { isEncryptionAvailable: () => false },
      notify() {},
      withStorageLock: (callback) => callback(),
    });
    views = [];
    gates = [];
    work = [];
    container = document.createElement("div");
    jasmine.attachToDOM(container);
  });
  afterEach(async () => {
    for (const gate of gates)
      gate.resolve({ ...credential("controlled-next"), expiresAt: 2000000 });
    await Promise.allSettled(work);
    model?.destroy();
    for (const view of views) await view.destroy();
    secrets.dispose();
    container.remove();
    const relative = path.relative(temporaryRoot, scratch);
    if (
      !relative ||
      relative === ".." ||
      relative.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relative)
    )
      throw new Error("Unsafe scratch cleanup target");
    await fs.rm(scratch, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  });

  for (const replacement of [null, "replacement-pat"]) {
    it(`preserves ${replacement === null ? "logout" : "a new PAT"} when an old refresh completes`, async () => {
      const entered = deferred(),
        gate = deferred();
      gates.push(gate);
      model = new GithubLoginModel({
        secrets,
        now: () => 10000,
        withRefreshLock: (_account, callback) => callback(),
        refresh: () => {
          entered.resolve();
          return gate.promise;
        },
      });
      await secrets.watchReady;
      await model.setToken("controlled-account", credential("controlled-old"));
      const reading = model.getToken("controlled-account");
      work.push(reading);
      await entered.promise;
      if (replacement === null) await model.removeToken("controlled-account");
      else await model.setToken("controlled-account", replacement);
      gate.resolve({ ...credential("controlled-next"), expiresAt: 2000000 });
      await reading;
      expect(await model.getToken("controlled-account")).toBe(replacement ?? UNAUTHENTICATED);
      const stored = await secrets.get(model.keyFor("controlled-account"));
      expect(stored === null ? null : JSON.parse(stored).accessToken).toBe(replacement);
    });
  }

  it("still persists an ordinary accepted refresh", async () => {
    model = new GithubLoginModel({
      secrets,
      now: () => 10000,
      withRefreshLock: (_account, callback) => callback(),
      refresh: async () => ({ ...credential("controlled-next"), expiresAt: 2000000 }),
    });
    await secrets.watchReady;
    await model.setToken("controlled-account", credential("controlled-old"));
    expect(await model.getToken("controlled-account")).toBe("controlled-next");
    expect(JSON.parse(await secrets.get(model.keyFor("controlled-account"))).accessToken).toBe(
      "controlled-next",
    );
  });

  it("keeps a PAT submitted while the refreshed credential is being written", async () => {
    const entered = deferred(),
      gate = deferred();
    gates.push(gate);
    model = new GithubLoginModel({
      secrets,
      now: () => 10000,
      withRefreshLock: (_account, callback) => callback(),
      refresh: async () => ({ ...credential("controlled-next"), expiresAt: 2000000 }),
    });
    await secrets.watchReady;
    await model.setToken("controlled-account", credential("controlled-old"));
    const write = secrets.set.bind(secrets);
    spyOn(secrets, "set").and.callFake(async (key, value) => {
      if (JSON.parse(value).accessToken === "controlled-next") {
        entered.resolve();
        await gate.promise;
      }
      return write(key, value);
    });
    const reading = model.getToken("controlled-account");
    work.push(reading);
    await entered.promise;
    const changing = model.setToken("controlled-account", "replacement-pat");
    work.push(changing);
    for (let tick = 0; tick < 30; tick++) await Promise.resolve();
    gate.resolve();
    await Promise.all([reading, changing]);
    expect(await model.getToken("controlled-account")).toBe("replacement-pat");
    expect(JSON.parse(await secrets.get(model.keyFor("controlled-account"))).accessToken).toBe(
      "replacement-pat",
    );
  });

  const comment = (id) => ({
    __typename: "IssueComment",
    id,
    author: null,
    bodyHTML: `<p>${id}</p>`,
    createdAt: "2026-10-09T00:00:00Z",
    url: `https://github.com/controlled/example/issues/1#${id}`,
  });
  for (const [Controller, fragment, type] of [
    [IssueTimeline, "issue", "Issue"],
    [PullRequestTimeline, "pullRequest", "PullRequest"],
  ]) {
    it(`loads a second page from the real ${type} timelineItems response shape`, async () => {
      const gate = deferred();
      gates.push(gate);
      window.fetch.and.returnValue(gate.promise);
      spyOn(lumine.window, "isSpecMode").and.returnValue(false);
      const seed = {
        id: "controlled-issue",
        __typename: type,
        url: "https://github.com/controlled/example/issues/1",
        timelineItems: {
          edges: [{ cursor: "first", node: comment("first comment") }],
          pageInfo: { hasNextPage: true, endCursor: "first" },
        },
      };
      let view;
      expect(() => {
        view = new Controller({
          [fragment]: seed,
          environment: {
            endpoint: { getGraphQLRoot: () => "https://example.invalid/graphql" },
            token: "controlled-token",
          },
        });
      }).not.toThrow();
      if (!view) return;
      views.push(view);
      container.appendChild(view.element);
      await flushViews(() => {});
      const button = view.element.querySelector(".github-panel-PrTimeline-loadMoreButton");
      expect(button).not.toBeNull();
      if (!button) return;
      button.click();
      const options = window.fetch.calls.mostRecent().args[1];
      expect(JSON.parse(options.body).variables.timelineCursor).toBe("first");
      gate.resolve({
        status: 200,
        headers: { get: () => null },
        json: async () => ({
          data: {
            resource: {
              ...seed,
              timelineItems: {
                edges: [{ cursor: "second", node: comment("second comment") }],
                pageInfo: { hasNextPage: false, endCursor: "second" },
              },
            },
          },
        }),
      });
      await flushViews(() => {});
      expect(view.element.textContent).toContain("first comment");
      expect(view.element.textContent).toContain("second comment");
      expect(view.element.querySelector(".github-panel-PrTimeline-loadMoreButton")).toBeNull();
      expect(seed.timelineItems.edges.length).toBe(1);
    });
  }
});
