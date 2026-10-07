/** @babel */
import { Emitter } from "lumine";
import LocalRepository from "./local-repository";

export default class RepositoryPool {
  constructor() {
    this.contexts = new Map();
    this.leases = new Set();
    this.emitter = new Emitter();
    this.absent = new LocalRepository();
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
    const matches = [];
    for (const repository of lumine.repositories.getRepositories()) {
      const context = this.add(repository.getWorkingDirectory());
      context.getRepository().setCore(repository);
      let matchesRemote;
      try {
        matchesRemote = await context.getRepository().hasGitHubRemote(host, owner, repo);
      } catch (error) {
        if (
          [
            "ERR_GIT_REPOSITORY_UNAVAILABLE",
            "ERR_GIT_REPOSITORY_DESTROYED",
            "ERR_GIT_WORKING_DIRECTORY_NOT_FOUND",
          ].includes(error.code)
        )
          continue;
        throw error;
      }
      if (this.disposed) return this.add(null);
      if (matchesRemote) matches.push(context);
    }
    return matches.length === 1 ? matches[0] : this.add(null);
  }
  clear() {
    if (this.disposed) return;
    this.disposed = true;
    for (const lease of this.leases) lease.dispose();
    for (const context of this.contexts.values()) context.getRepository().destroy();
    this.contexts.clear();
    this.absent.destroy();
    this.emitter.dispose();
  }
}
