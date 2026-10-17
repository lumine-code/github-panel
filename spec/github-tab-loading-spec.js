/** @babel */
import { Disposable, Emitter } from "lumine";
import GitHubTabItem from "../lib/items/github-tab-item.js";
import Remote from "../lib/models/remote.js";
import RemoteSet from "../lib/models/remote-set.js";
import Branch from "../lib/models/branch.js";
import BranchSet from "../lib/models/branch-set.js";
import { UNAUTHENTICATED } from "../lib/shared/token-status.js";
import { flushViews } from "./helpers/etch.js";

function deferred() {
  let resolve, reject;
  const promise = new Promise((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

describe("GitHub tab initial presentation", () => {
  let item, repository, emitter, requests, token, remotes;
  const workdir = "C:/github-loading-spec";
  const viewer = {
    viewer: { email: "user@example.com", name: "User", login: "user", avatarUrl: null },
  };

  beforeEach(() => {
    emitter = new Emitter();
    requests = new Map();
    token = deferred();
    remotes = deferred();
    const tracking = Branch.createRemoteTracking(
      "refs/remotes/origin/feature",
      "origin",
      "refs/heads/feature",
    );
    repository = {
      isLoading: () => false,
      isPresent: () => true,
      isAbsent: () => false,
      isAbsentGuess: () => false,
      isEmpty: () => false,
      onDidUpdate: (callback) => emitter.on("did-update", callback),
      getWorkingDirectoryPath: () => workdir,
      getRemotes: jasmine.createSpy("remotes").and.returnValue(remotes.promise),
      getBranches: async () => new BranchSet([new Branch("feature", tracking, tracking, true)]),
      getConfig: async () => "origin",
      getAheadCount: async () => 0,
      getOperationStates: () => ({
        isPushInProgress: () => false,
        isPullInProgress: () => false,
        isFetchInProgress: () => false,
      }),
    };
    spyOn(lumine.window, "isSpecMode").and.returnValue(false);
    spyOn(window, "fetch").and.callFake((_url, options) => {
      const name = JSON.parse(options.body).query.match(/^query (\w+)/)[1];
      const read = deferred();
      requests.set(name, read);
      return read.promise;
    });
  });

  afterEach(async () => {
    await item?.destroy();
    item = null;
    emitter.dispose();
  });

  async function mount(props = {}) {
    item = new GitHubTabItem({
      repository,
      repositoryIsReady: true,
      currentWorkDir: workdir,
      workspace: lumine.workspace,
      commands: lumine.commands,
      loginModel: { getToken: () => token.promise, onDidUpdate: () => new Disposable() },
      getCurrentWorkDirs: () => [workdir],
      onDidChangeWorkDirs: () => new Disposable(),
      ...props,
    });
    jasmine.attachToDOM(item.element);
    await flushViews(async () => {});
    return item.element.querySelector(".github-panel-GitHubTabItem-loading .github-panel-Spinner");
  }

  function expectLoading(spinner) {
    expect(item.element.getAttribute("aria-busy")).toBe("true");
    expect(item.element.querySelector(".github-panel-GitHubTabItem-content").hidden).toBe(true);
    expect(
      item.element.querySelector(".github-panel-GitHubTabItem-loading .github-panel-Spinner"),
    ).toBe(spinner);
  }

  async function answer(name, data) {
    await globalThis.conditionPromise(() => requests.has(name));
    requests.get(name).resolve({
      status: 200,
      headers: { get: () => null },
      json: async () => ({ data }),
    });
    await flushViews(async () => {});
  }

  it("keeps one full loader through startup, local data, credentials and the header request", async () => {
    const spinner = await mount({ startupContextPending: true });
    expectLoading(spinner);
    expect(repository.getRemotes).not.toHaveBeenCalled();
    await flushViews(() => item.update({ ...item.props, startupContextPending: false }));
    expectLoading(spinner);

    token.resolve("token");
    await flushViews(async () => {});
    expectLoading(spinner);
    expect(requests.size).toBe(0);

    remotes.resolve(new RemoteSet());
    await flushViews(async () => {});
    await globalThis.conditionPromise(() => requests.has("githubTabHeaderContainerQuery"));
    expectLoading(spinner);
    expect(item.element.querySelector(".github-panel-Project")).not.toBeNull();

    await answer("githubTabHeaderContainerQuery", viewer);
    await globalThis.conditionPromise(() => item.element.getAttribute("aria-busy") === "false");

    expect(item.element.getAttribute("aria-busy")).toBe("false");
    expect(item.element.querySelector(".github-panel-GitHubTabItem-content").hidden).toBe(false);
    expect(item.element.querySelector(".github-panel-GitHubTabItem-loading")).toBeNull();
    expect(item.element.querySelector(".github-panel-Blank")).not.toBeNull();
  });

  it("reveals the selector and both PR sections only after their nested initial reads settle", async () => {
    const spinner = await mount();
    remotes.resolve(new RemoteSet([new Remote("origin", "https://github.com/owner/repo.git")]));
    token.resolve("token");
    await flushViews(async () => {});
    expectLoading(spinner);

    await answer("githubTabHeaderContainerQuery", viewer);
    expectLoading(spinner);
    await answer("remoteContainerQuery", {
      repository: { id: "repo", defaultBranchRef: { prefix: "refs/heads/", name: "main" } },
    });
    expectLoading(spinner);
    await answer("issueishSearchContainerQuery", { search: { issueCount: 0, nodes: [] } });
    expectLoading(spinner);
    await answer("currentPullRequestContainerQuery", {
      repository: { ref: { associatedPullRequests: { totalCount: 0, nodes: [] } } },
    });
    await globalThis.conditionPromise(() => item.element.getAttribute("aria-busy") === "false");

    expect(item.element.getAttribute("aria-busy")).toBe("false");
    expect(item.element.querySelector(".github-panel-GitHubTabItem-content").hidden).toBe(false);
    expect(item.element.querySelectorAll(".github-panel-Accordion").length).toBe(2);
    expect(item.element.querySelector(".github-panel-IssueishList-loading")).toBeNull();
    expect(item.element.querySelector(".github-panel-GitHubTabItem-loading")).toBeNull();
  });

  it("treats the login screen as a complete presentation after local discovery", async () => {
    const spinner = await mount();
    token.resolve(UNAUTHENTICATED);
    await flushViews(async () => {});
    expectLoading(spinner);
    remotes.resolve(new RemoteSet());
    await flushViews(async () => {});
    await globalThis.conditionPromise(() => item.element.getAttribute("aria-busy") === "false");

    expect(item.element.getAttribute("aria-busy")).toBe("false");
    expect(item.element.querySelector(".github-panel-GitHubTabItem-content").hidden).toBe(false);
    expect(requests.size).toBe(0);
  });

  it("shows an initial read failure and retries without leaving the loader stuck", async () => {
    spyOn(console, "error");
    await mount();
    token.resolve(UNAUTHENTICATED);
    remotes.reject(new Error("Unable to read repository remotes"));
    await globalThis.conditionPromise(() => item.element.getAttribute("aria-busy") === "false");
    expect(item.element.textContent).toMatch(/Unable to read repository remotes/);

    repository.getRemotes.and.resolveTo(new RemoteSet());
    item.element.querySelector(".github-panel-Message-button").click();
    await globalThis.conditionPromise(
      () =>
        item.element.getAttribute("aria-busy") === "false" &&
        !item.element.textContent.includes("Unable to read repository remotes"),
    );

    expect(item.element.querySelector(".github-panel-GitHubTabItem-loading")).toBeNull();
    expect(item.element.textContent).not.toMatch(/Unable to read repository remotes/);
  });
});
