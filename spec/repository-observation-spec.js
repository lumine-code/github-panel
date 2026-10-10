/** @babel */
import { Disposable } from "lumine";
import fs from "fs";
import os from "os";
import path from "path";
import RepositoryObservation from "../lib/repository-observation";
import RepositoryPool from "../lib/repository-pool";
import { execFile } from "child_process";
import { promisify } from "util";
import ReviewsItem from "../lib/items/reviews-item";
import IssueishDetailItem from "../lib/items/issueish-detail-item";
import GitHubRootController from "../lib/controllers/github-root-controller";
import LoadingView from "../lib/views/loading-view";
import ReviewsContainer from "../lib/containers/reviews-container";
import GitHubTabItem from "../lib/items/github-tab-item";
import GitHubTabContainer from "../lib/containers/github-tab-container";
import GithubPackage from "../lib/github-package";
import PaneItemHost from "../lib/items/pane-item-host";
import { createViewModel, flushViews, h } from "./helpers/etch";
import { mount } from "../lib/etch/view";
import { getDiffService, setDiffService } from "../lib/diff-service";

function deferred() {
  let resolve;
  const promise = new Promise((finish) => (resolve = finish));
  return { promise, resolve };
}

function repository(directory) {
  return {
    getWorkingDirectoryPath: () => directory,
    isAbsent: () => false,
    hasGitHubRemote: jasmine.createSpy("hasGitHubRemote").and.resolveTo(true),
  };
}

function poolFixture(directories) {
  const contexts = new Map();
  const callbacks = new Set();
  const counts = new Map();
  for (const directory of directories) {
    const model = repository(directory);
    contexts.set(directory, {
      repository: model,
      ready: Promise.resolve(),
      context: { getRepository: () => model },
    });
  }
  const pool = {
    counts,
    contexts,
    retain: jasmine.createSpy("retain").and.callFake((directory) => {
      counts.set(directory, (counts.get(directory) || 0) + 1);
      let disposed = false;
      return {
        get context() {
          return contexts.get(directory).context;
        },
        get ready() {
          return contexts.get(directory).ready;
        },
        dispose() {
          if (disposed) return;
          disposed = true;
          counts.set(directory, counts.get(directory) - 1);
        },
      };
    }),
    onDidChangePoolContexts: (callback) => {
      callbacks.add(callback);
      return new Disposable(() => callbacks.delete(callback));
    },
    notify: () => {
      for (const callback of callbacks) callback({ altered: new Set() });
    },
    getMatchingContext: jasmine.createSpy("getMatchingContext"),
  };
  return pool;
}

describe("GitHub repository observation ownership", () => {
  const views = new Set();
  let previousBridge;

  beforeEach(() => {
    previousBridge = getDiffService();
    setDiffService({ getAbsentRepository: () => ({ isAbsent: () => true }) });
  });

  afterEach(async () => {
    for (const view of views) await view.destroy();
    views.clear();
    setDiffService(previousBridge);
  });

  function view(Type, props) {
    const instance = createViewModel(Type, props);
    views.add(instance);
    return instance;
  }

  it("keeps independent active, issue and review edges until each consumer closes", async () => {
    const pool = poolFixture(["/repository"]);
    const active = pool.retain("/repository");
    const review = view(ReviewsItem, { workdir: "/repository", workdirContextPool: pool });
    const issue = view(IssueishDetailItem, {
      workingDirectory: "/repository",
      workdirContextPool: pool,
      owner: "owner",
      repo: "repo",
      issueishNumber: 1,
    });
    expect(pool.counts.get("/repository")).toBe(3);
    await issue.destroy();
    expect(pool.counts.get("/repository")).toBe(2);
    await review.destroy();
    expect(pool.counts.get("/repository")).toBe(1);
    active.dispose();
    expect(pool.counts.get("/repository")).toBe(0);
  });

  it("waits for fresh resumed data before exposing the review model", async () => {
    const pool = poolFixture(["/repository"]);
    const ready = deferred();
    pool.contexts.get("/repository").ready = ready.promise;
    const review = view(ReviewsItem, {
      workdir: "/repository",
      workdirContextPool: pool,
      host: "github.com",
    });
    expect(review.render().tag).toBe(LoadingView);
    ready.resolve();
    await ready.promise;
    const rendered = review.render();
    expect(rendered.tag).toBe(ReviewsContainer);
    expect(rendered.props.repository).toBe(pool.contexts.get("/repository").repository);
  });

  it("retargets the root without leaving the previous active repository observed", async () => {
    const pool = poolFixture(["/first", "/second"]);
    const root = view(GitHubRootController, {
      currentWorkDir: "/first",
      workdirContextPool: pool,
      repository: pool.contexts.get("/first").repository,
    });
    expect(pool.counts.get("/first")).toBe(1);
    await root.update({
      currentWorkDir: "/second",
      workdirContextPool: pool,
      repository: pool.contexts.get("/second").repository,
    });
    root.render();
    expect(pool.counts.get("/first")).toBe(0);
    expect(pool.counts.get("/second")).toBe(1);
    await root.destroy();
    expect(pool.counts.get("/second")).toBe(0);
  });

  it("follows a replaced context and ignores completion from its old generation", async () => {
    const pool = poolFixture(["/repository"]);
    const first = deferred();
    pool.contexts.get("/repository").ready = first.promise;
    const onReady = jasmine.createSpy("onReady");
    const observation = new RepositoryObservation({ onReady });
    observation.select(pool, "/repository");
    const next = deferred();
    const current = repository("/repository");
    pool.contexts.set("/repository", {
      repository: current,
      ready: next.promise,
      context: { getRepository: () => current },
    });
    pool.notify();
    first.resolve();
    await first.promise;
    expect(onReady).not.toHaveBeenCalled();
    next.resolve();
    await next.promise;
    expect(onReady).toHaveBeenCalledOnceWith(current);
    expect(pool.retain).toHaveBeenCalledTimes(1);
    observation.dispose();
    expect(pool.counts.get("/repository")).toBe(0);
  });

  it("releases a pending issue switch immediately when the item closes", async () => {
    const pool = poolFixture(["/first", "/next"]);
    pool.contexts.get("/first").repository.hasGitHubRemote.and.resolveTo(false);
    pool.getMatchingContext.and.resolveTo({
      getRepository: () => pool.contexts.get("/next").repository,
    });
    const ready = deferred();
    pool.contexts.get("/next").ready = ready.promise;
    const issue = view(IssueishDetailItem, {
      workingDirectory: "/first",
      workdirContextPool: pool,
      owner: "first",
      repo: "repo",
      issueishNumber: 1,
    });
    const switching = issue.switchToIssueish("next", "repo", 2);
    await globalThis.conditionPromise(() => pool.counts.get("/next") === 1);
    await issue.destroy();
    expect(pool.counts.get("/first")).toBe(0);
    expect(pool.counts.get("/next")).toBe(0);
    ready.resolve();
    await switching;
    expect(issue.state.owner).toBe("first");
  });

  it("releases a superseded issue lookup before its readiness promise completes", async () => {
    const pool = poolFixture(["/first", "/older", "/latest"]);
    pool.contexts.get("/first").repository.hasGitHubRemote.and.resolveTo(false);
    pool.getMatchingContext.and.callFake((_host, owner) =>
      Promise.resolve(pool.contexts.get(`/${owner}`).context),
    );
    const older = deferred();
    const latest = deferred();
    pool.contexts.get("/older").ready = older.promise;
    pool.contexts.get("/latest").ready = latest.promise;
    const issue = view(IssueishDetailItem, {
      workingDirectory: "/first",
      workdirContextPool: pool,
      owner: "first",
      repo: "repo",
      issueishNumber: 1,
    });
    const oldRequest = issue.switchToIssueish("older", "repo", 2);
    await globalThis.conditionPromise(() => pool.counts.get("/older") === 1);
    const currentRequest = issue.switchToIssueish("latest", "repo", 3);
    await globalThis.conditionPromise(() => pool.counts.get("/latest") === 1);
    expect(pool.counts.get("/older")).toBe(0);
    older.resolve();
    await oldRequest;
    expect(issue.state.owner).toBe("first");
    latest.resolve();
    await currentRequest;
    expect(issue.state.owner).toBe("latest");
    expect(pool.counts.get("/first")).toBe(0);
    expect(pool.counts.get("/latest")).toBe(1);
  });

  it("keeps the hydrated GitHub tab identity while local repository data is loading", async () => {
    spyOn(GitHubTabContainer, "deriveState").and.returnValue(null);
    spyOn(GitHubTabContainer.prototype, "render").and.returnValue(
      h("div", { className: "ready-repository" }),
    );
    const item = new GitHubTabItem({ repositoryIsReady: false });
    views.add(item);
    const host = PaneItemHost.create("github", { uri: GitHubTabItem.buildURI() });
    host.hydrate(item);
    try {
      expect(item.element.classList.contains("github-panel-Loader")).toBe(true);
      await flushViews(() => item.update({ repositoryIsReady: true }));
      expect(item.element.classList.contains("ready-repository")).toBe(true);
      await flushViews(() => item.update({ repositoryIsReady: false }));
      expect(item.element.classList.contains("github-panel-Loader")).toBe(true);
      expect(host.getHydratedView()).toBe(item);
      expect(host.isDestroyed()).toBe(false);
    } finally {
      host.destroy();
    }
  });

  it("keeps a mounted repository observation when its renderer disappears and returns", async () => {
    const pool = poolFixture(["/repository"]);
    pool.contexts.get("/repository").ready = deferred().promise;
    const element = document.createElement("div");
    const roots = new WeakMap();
    const workspace = {
      getPaneItems: () => [],
      onDidAddPaneItem: () => new Disposable(),
      onDidDestroyPaneItem: () => new Disposable(),
      addOpener: () => new Disposable(),
    };
    const owner = {
      element,
      _roots: roots,
      subscriptions: { add() {}, remove() {} },
      rerender() {
        if (roots.has(element)) return;
        roots.set(
          element,
          mount(
            h(GitHubRootController, {
              workspace,
              currentWorkDir: "/repository",
              workdirContextPool: pool,
              repository: pool.contexts.get("/repository").repository,
            }),
            element,
          ),
        );
      },
    };
    const provider = () => ({ onDidUpdate: () => new Disposable() });
    const first = GithubPackage.prototype.consumeDiff.call(owner, provider());
    try {
      expect(pool.counts.get("/repository")).toBe(1);
      const root = roots.get(element);
      first.dispose();
      expect(pool.counts.get("/repository")).toBe(1);
      expect(roots.get(element)).toBe(root);
      const returned = GithubPackage.prototype.consumeDiff.call(owner, provider());
      expect(pool.counts.get("/repository")).toBe(1);
      returned.dispose();
      expect(pool.counts.get("/repository")).toBe(1);
      expect(roots.get(element)).toBe(root);
    } finally {
      first.dispose();
      await roots.get(element)?.destroy();
      expect(pool.counts.get("/repository")).toBe(0);
      element.remove();
    }
  });
  it("reopens the same resident model with external Git changes refreshed", async () => {
    jasmine.useRealClock();
    const pane = lumine.workspace.getCenter().getActivePane();
    const placeholder = {
      getTitle: () => "Repository observation test",
      getURI: () => "lumine-test://repository-observation",
    };
    pane.addItem(placeholder);
    pane.activateItem(placeholder);
    const pool = new RepositoryPool();
    const directory = fs.realpathSync.native(
      fs.mkdtempSync(path.join(os.tmpdir(), "github-observation-resume-")),
    );
    const core = await lumine.repositories.initialize(directory, { initialBranch: "main" });
    const first = new RepositoryObservation();
    const reopened = new RepositoryObservation();
    try {
      await core.getOperations().addRemote("origin", "https://github.com/previous/repository.git");
      first.select(pool, directory);
      await first.ready;
      const model = first.repository;
      expect((await model.getRemotes()).withName("origin").getUrl()).toBe(
        "https://github.com/previous/repository.git",
      );
      expect((await model.getBranches()).getHeadBranch().getName()).toBe("main");
      first.dispose();
      expect(core.statusSnapshotSubscriberCount).toBe(0);
      expect(core.refsSnapshotSubscriberCount).toBe(0);
      const git = promisify(execFile);
      await git(
        lumine.config.get("git.path") || "git",
        ["remote", "set-url", "origin", "https://github.com/current/repository.git"],
        { cwd: directory },
      );
      await git(
        lumine.config.get("git.path") || "git",
        ["symbolic-ref", "HEAD", "refs/heads/after-close"],
        { cwd: directory },
      );

      reopened.select(pool, directory);
      await reopened.ready;
      expect(reopened.repository).toBe(model);
      expect((await model.getRemotes()).withName("origin").getUrl()).toBe(
        "https://github.com/current/repository.git",
      );
      expect((await model.getBranches()).getHeadBranch().getName()).toBe("after-close");
    } finally {
      first.dispose();
      reopened.dispose();
      pool.clear();
      lumine.repositories.forget(core);
      await pane.destroyItem(placeholder, true);
      await fs.promises.rm(directory, {
        recursive: true,
        force: true,
        maxRetries: 10,
        retryDelay: 50,
      });
    }
  }, 30000);
});
