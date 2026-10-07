/** @babel */
import fs from "fs/promises";
import path from "path";
import { CompositeDisposable, Disposable, Emitter } from "lumine";
import Branch, { nullBranch } from "./models/branch";
import BranchSet from "./models/branch-set";
import Remote, { nullRemote } from "./models/remote";
import RemoteSet from "./models/remote-set";

function trackingBranch(target) {
  if (!target?.ref) return nullBranch;
  const match = /^refs\/remotes\/([^/]+)\/(.+)$/.exec(target.ref);
  return match
    ? Branch.createRemoteTracking(target.ref, match[1], `refs/heads/${match[2]}`)
    : new Branch(target.ref);
}

// This is a forge-facing projection of one core repository, not a repository
// backend. Reads use the authoritative snapshots and typed APIs, writes use
// core operations, and each observing view owns its snapshot subscriptions.
export default class LocalRepository {
  constructor(directory = null, repository = null) {
    this.directory = directory;
    this.core = repository;
    this.loading = false;
    this.emitter = new Emitter();
  }
  setCore(repository, loading = false) {
    if (this.core === repository && this.loading === loading) return;
    this.core = repository;
    this.loading = loading;
    this.emitter.emit("did-update");
  }
  isLoading() {
    return this.loading;
  }
  isAbsent() {
    return !this.directory && !this.core;
  }
  isAbsentGuess() {
    return this.isAbsent();
  }
  isEmpty() {
    return Boolean(this.directory) && !this.core && !this.loading;
  }
  isPresent() {
    return Boolean(this.core && !this.core.isDestroyed());
  }
  isPublishable() {
    return this.isEmpty() || this.isPresent();
  }
  getWorkingDirectoryPath() {
    return this.core?.getWorkingDirectory() || this.directory;
  }
  getOperations() {
    return this.core?.getOperations();
  }
  getOperationStates() {
    const running = (name) =>
      Boolean(
        this.getOperations()
          ?.getPendingOperations()
          .some((operation) => operation.name.replace(/^workflow:/, "") === name),
      );
    return {
      isPushInProgress: () => running("push"),
      isPullInProgress: () => running("pull"),
      isFetchInProgress: () => running("fetch"),
    };
  }
  onDidUpdate(callback) {
    const subscriptions = new CompositeDisposable(this.emitter.on("did-update", callback));
    let observed = null;
    let coreSubscriptions = new CompositeDisposable();
    const observe = () => {
      if (observed === this.core) return;
      coreSubscriptions.dispose();
      coreSubscriptions = new CompositeDisposable();
      observed = this.core;
      if (!observed) return;
      coreSubscriptions.add(
        observed.onDidChangeStatusSnapshot(callback),
        observed.onDidChangeRefsSnapshot(callback),
        observed.onDidDestroy(callback),
      );
      const operations = observed.getOperations();
      if (operations)
        coreSubscriptions.add(
          operations.onDidQueueOperation(callback),
          operations.onDidStartOperation(callback),
          operations.onDidFinishOperation(callback),
        );
    };
    subscriptions.add(
      this.emitter.on("did-update", observe),
      new Disposable(() => coreSubscriptions.dispose()),
    );
    observe();
    return subscriptions;
  }
  async getRemotes({ fresh = false } = {}) {
    if (!this.isPresent()) return new RemoteSet();
    const snapshot = await (fresh
      ? this.core.refreshRefsSnapshot()
      : this.core.ensureRefsSnapshot());
    return new RemoteSet(
      snapshot.remotes.map((remote) => new Remote(remote.name, remote.fetchUrl || remote.pushUrl)),
    );
  }
  async getBranches() {
    if (!this.isPresent()) return new BranchSet();
    const snapshot = await this.core.ensureRefsSnapshot();
    const branches = new BranchSet(
      snapshot.branches.map(
        (branch) =>
          new Branch(
            branch.name,
            trackingBranch(branch.upstream),
            trackingBranch(branch.push || branch.upstream),
            branch.isHead,
            { sha: branch.oid },
          ),
      ),
    );
    if (snapshot.head?.detached)
      branches.add(Branch.createDetached(snapshot.head.oid?.slice(0, 7) || "HEAD"));
    else if (snapshot.head?.name && !snapshot.branches.some((branch) => branch.isHead))
      branches.add(
        new Branch(snapshot.head.name, nullBranch, nullBranch, true, { sha: snapshot.head.oid }),
      );
    return branches;
  }
  async getCurrentBranch() {
    return (await this.getBranches()).getHeadBranch();
  }
  async getCurrentGitHubRemote() {
    const remotes = (await this.getRemotes()).filter((remote) => remote.isGithubRepo());
    const selected = remotes.withName(await this.getConfig("lumineGithub.currentRemote"));
    if (selected.isPresent()) return selected;
    if (remotes.size() === 1) return Array.from(remotes)[0];
    return remotes.withName("origin");
  }
  async hasGitHubRemote(host, owner, repo) {
    return (await this.getRemotes({ fresh: true }))
      .matchingGitHubRepository(owner, repo)
      .some((remote) => remote.getDomain()?.toLowerCase() === host.toLowerCase());
  }
  getConfig(key) {
    return this.core ? this.core.getConfigValueAsync(key) : Promise.resolve(null);
  }
  setConfig(key, value) {
    return this.getOperations().setConfig(key, value);
  }
  async getAheadCount(branch) {
    if (!this.isPresent()) return 0;
    await this.core.ensureRefsSnapshot();
    return this.core.getAheadBehindCount(branch).ahead;
  }
  async metadataExists(name) {
    if (!this.isPresent()) return false;
    try {
      await fs.access(path.join(this.core.getPath(), name));
      return true;
    } catch {
      return false;
    }
  }
  isMerging() {
    return this.metadataExists("MERGE_HEAD");
  }
  async isRebasing() {
    return (await this.metadataExists("rebase-merge")) || this.metadataExists("rebase-apply");
  }
  async getDiffsForFilePath(filePath, revision) {
    if (!this.isPresent()) return [];
    const snapshot = await this.core.getDiff({
      from: { type: "commit", revision },
      to: { type: "worktree" },
      paths: [filePath],
      format: "structured",
    });
    return snapshot.files;
  }
  async init() {
    this.setCore(await lumine.repositories.initialize(this.directory));
    return this;
  }
  async addRemote(name, url) {
    await this.getOperations().addRemote(name, url);
    return (await this.getRemotes()).withName(name);
  }
  checkout(reference, options) {
    return this.getOperations().checkout(reference, options);
  }
  fetch(reference, { remoteName = null } = {}) {
    return this.getOperations().fetch(remoteName, reference);
  }
  pull(reference, { remoteName = null, ...options } = {}) {
    return this.getOperations().pull(remoteName, reference, options);
  }
  async push(reference, { remote = nullRemote, ...options } = {}) {
    const remoteName = remote.getNameOr(null);
    return this.getOperations().push(remoteName, reference, options);
  }
  destroy() {
    this.emitter.dispose();
  }
}
