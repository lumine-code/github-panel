/** @babel */
import { Emitter } from "lumine";
import LocalRepository from "./local-repository.js";
import Remote from "./models/remote.js";

function remoteKey(host, owner, repo) {
  return `${host.toLowerCase()}\0${owner}\0${repo}`;
}

export default class RepositoryPool {
  constructor() {
    this.contexts = new Map();
    this.leases = new Set();
    this.emitter = new Emitter();
    this.absent = new LocalRepository();
    this.remoteReads = new AbortController();
    this.remoteScan = null;
    this.disposed = false;
  }
  getAbsentRepository() {
    return this.absent;
  }
  add(directory) {
    if (this.disposed) return { getRepository: () => this.absent };
    if (!directory) return { getRepository: () => this.absent };
    let context = this.contexts.get(directory);
    if (!context) {
      const projection = new LocalRepository(directory, lumine.repositories.getForPath(directory));
      context = { getRepository: () => projection };
      this.contexts.set(directory, context);
    }
    return context;
  }
  retain(directory) {
    if (this.disposed) return { context: this.add(null), ready: Promise.resolve(), dispose() {} };
    const context = this.add(directory);
    const projection = context.getRepository();
    let released = false;
    let coreLease = null;
    const edge = {
      context,
      ready: null,
      dispose: () => {
        if (released) return;
        released = true;
        this.leases.delete(edge);
        coreLease?.dispose();
      },
    };
    this.leases.add(edge);
    projection.loading = true;
    const ready = lumine.repositories
      .add(directory, { persist: false })
      .then(async (lease) => {
        if (released || this.disposed) {
          lease?.dispose();
          return;
        }
        coreLease = lease;
        projection.setCore(lease?.repository || null);
        if (lease)
          await Promise.all([
            lease.repository.refreshStatusSnapshot(),
            lease.repository.refreshRefsSnapshot(),
          ]);
        if (!released && !this.disposed) this.emitter.emit("did-change-contexts");
      })
      .catch((error) => {
        if (released || this.disposed) return;
        if (!released && !this.disposed) projection.setCore(null);
        throw error;
      });
    ready.catch(() => {});
    edge.ready = ready;
    return edge;
  }
  onDidChangePoolContexts(callback) {
    return this.emitter.on("did-change-contexts", callback);
  }
  async getMatchingContext(host, owner, repo) {
    if (this.disposed) return this.add(null);
    const repositories = lumine.repositories.getRepositories();
    let scan = this.remoteScan;
    if (
      !scan ||
      repositories.length !== scan.repositories.length ||
      repositories.some((repository, index) => repository !== scan.repositories[index])
    ) {
      scan = { repositories, ready: this.indexRemotes(repositories) };
      this.remoteScan = scan;
      const clear = () => {
        if (this.remoteScan === scan) this.remoteScan = null;
      };
      scan.ready.then(clear, clear);
    }
    // Share concurrent discovery, then read afresh on the next navigation so
    // remote edits made outside a watched project are visible too.
    const index = await scan.ready;
    if (this.disposed) return this.add(null);
    const matches = Array.from(index.get(remoteKey(host, owner, repo)) || []).filter(
      (repository) => !repository.isDestroyed(),
    );
    if (matches.length !== 1) return this.add(null);
    const [repository] = matches;
    const directory = repository.getWorkingDirectory();
    if (!directory) return this.add(null);
    const context = this.add(directory);
    context.getRepository().setCore(repository);
    return context;
  }

  async indexRemotes(repositories) {
    const index = new Map();
    const { signal } = this.remoteReads;
    // The shared git-host runner limits concurrent Git processes across repos.
    await Promise.all(
      repositories.map(async (repository) => {
        let remotes;
        try {
          remotes = await repository.readRemotes({ signal });
        } catch (error) {
          if (
            signal.aborted ||
            [
              "ERR_GIT_REPOSITORY_UNAVAILABLE",
              "ERR_GIT_REPOSITORY_DESTROYED",
              "ERR_GIT_WORKING_DIRECTORY_NOT_FOUND",
            ].includes(error.code)
          )
            return;
          throw error;
        }
        if (signal.aborted) return;
        for (const { name, fetchUrl, pushUrl } of remotes) {
          const remote = new Remote(name, fetchUrl || pushUrl);
          if (!remote.isGithubRepo()) continue;
          const key = remoteKey(remote.getDomain(), remote.getOwner(), remote.getRepo());
          let matches = index.get(key);
          if (!matches) index.set(key, (matches = new Set()));
          matches.add(repository);
        }
      }),
    );
    return index;
  }
  clear() {
    if (this.disposed) return;
    this.disposed = true;
    this.remoteReads.abort();
    this.remoteScan = null;
    for (const lease of this.leases) lease.dispose();
    for (const context of this.contexts.values()) context.getRepository().destroy();
    this.contexts.clear();
    this.absent.destroy();
    this.emitter.dispose();
  }
}
