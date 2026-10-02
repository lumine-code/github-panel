/** @babel */

const READY = Promise.resolve();

// Pane views own interest in a resident Git model, rather than its lifetime.
// Waiting for the edge also prevents a resumed view from reading old caches.
export default class RepositoryObservation {
  constructor({ onReady, onChange } = {}) {
    this.onReady = onReady;
    this.onChange = onChange;
    this.lease = null;
    this.pool = null;
    this.directory = null;
    this.context = null;
    this.ready = READY;
    this.isReady = true;
    this.error = null;
    this.version = 0;
    this.disposed = false;
  }

  select(pool, directory, lease = null) {
    if (this.disposed) {
      lease?.dispose();
      return;
    }
    if (!lease && pool === this.pool && directory === this.directory) {
      this.sync();
      return;
    }
    const nextLease =
      lease ||
      (pool && directory
        ? typeof pool.retain === "function"
          ? pool.retain(directory)
          : { context: pool.add(directory), ready: READY, dispose() {} }
        : null);
    this.poolSubscription?.dispose();
    this.lease?.dispose();
    this.pool = pool;
    this.directory = directory;
    this.lease = nextLease;
    this.context = null;
    this.version++;
    this.poolSubscription = nextLease ? pool.onDidChangePoolContexts?.(() => this.sync()) : null;
    this.sync();
  }

  sync() {
    if (this.disposed) return;
    const context = this.lease?.context || null;
    const ready = this.lease?.ready || READY;
    if (context === this.context && ready === this.ready) return;
    this.context = context;
    this.ready = ready;
    this.error = null;
    this.isReady = !this.lease;
    const version = ++this.version;
    this.onChange?.();
    if (!this.lease) {
      this.onReady?.(null);
      return;
    }
    Promise.resolve(ready).then(
      () => {
        if (this.disposed || version !== this.version) return;
        if (context !== this.lease?.context || ready !== this.lease?.ready) {
          this.sync();
          return;
        }
        this.isReady = true;
        this.onReady?.(this.repository);
        this.onChange?.();
      },
      (error) => {
        if (this.disposed || version !== this.version) return;
        this.error = error;
        this.onChange?.();
      },
    );
  }

  get repository() {
    return this.lease?.context?.getRepository() || null;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.version++;
    this.poolSubscription?.dispose();
    this.lease?.dispose();
    this.poolSubscription = null;
    this.lease = null;
    this.context = null;
  }
}
