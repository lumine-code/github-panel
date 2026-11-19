/** @babel */
import path from "node:path";
import { CompositeDisposable, watchDirectory } from "lumine";

// Keep translations warm for unchanged files. Filesystem events, including
// changes to an already-modified file, are independent of Git status snapshots.
export default class CommentWorktreeDiffs {
  constructor(repository, revision, onChange) {
    this.repository = repository;
    this.core = repository.core;
    this.revision = revision;
    this.onChange = onChange;
    this.paths = new Set();
    this.diffs = new Map();
    this.dirty = new Set();
    this.active = null;
    this.stopped = false;
    this.ready = true;
    this.repositorySubscription = this.core?.onDidDestroy?.(() => {
      this.dispose();
      this.onChange();
    });
  }

  setPaths(paths) {
    if (this.stopped) return;
    const previous = this.paths;
    this.paths = new Set(paths);
    for (const filePath of previous) {
      if (this.paths.has(filePath)) continue;
      this.diffs.delete(filePath);
      this.dirty.delete(filePath);
      this.active?.invalidated.add(filePath);
    }
    for (const filePath of this.paths) {
      if (!previous.has(filePath)) this.markDirty(filePath);
    }
    if (this.paths.size && !this.subscriptions) this.watch();
    if (!this.paths.size && this.subscriptions) this.stopWatching();
    if (this.active && !this.active.paths.some((filePath) => this.paths.has(filePath))) {
      this.active.controller.abort();
      this.active = null;
    }
    this.pump();
  }

  watch() {
    const workdir = this.repository.getWorkingDirectoryPath?.();
    if (!workdir || !this.core) return;
    let watcher;
    try {
      watcher = watchDirectory(workdir, { recursive: true });
    } catch (error) {
      console.warn("Unable to watch review comment files", error);
      return;
    }
    this.ready = false;
    const subscriptions = new CompositeDisposable(
      watcher,
      watcher.onDidChange((events) => this.onFilesChanged(workdir, events)),
      watcher.onDidInvalidate(() => {
        for (const filePath of this.paths) this.markDirty(filePath);
        this.pump();
      }),
      watcher.onDidError((error) => console.warn("Unable to watch review comment files", error)),
    );
    this.subscriptions = subscriptions;
    const resume = () => {
      if (this.subscriptions !== subscriptions) return;
      this.ready = true;
      this.pump();
    };
    watcher.ready.then(resume, resume);
  }

  onFilesChanged(workdir, events) {
    const changes = new Set();
    for (const { path: changed, oldPath } of events) {
      if (changed) changes.add(this.pathKey(path.relative(workdir, changed)));
      if (oldPath) changes.add(this.pathKey(path.relative(workdir, oldPath)));
    }
    for (const filePath of this.paths) {
      let current = this.pathKey(filePath);
      while (true) {
        if (changes.has(current)) {
          this.markDirty(filePath);
          break;
        }
        if (!current) break;
        const parent = path.dirname(current);
        if (parent === current) break;
        current = parent === "." ? "" : parent;
      }
    }
    this.pump();
  }

  pathKey(filePath) {
    return process.platform === "win32" ? filePath.toLowerCase() : filePath;
  }

  markDirty(filePath) {
    this.dirty.add(filePath);
    this.active?.invalidated.add(filePath);
  }

  pump() {
    if (this.stopped || !this.ready || this.active || !this.dirty.size) return;
    const request = {
      paths: [...this.dirty],
      controller: new AbortController(),
      invalidated: new Set(),
    };
    this.dirty.clear();
    this.active = request;
    void this.load(request);
  }

  async load(request) {
    let diffs;
    try {
      diffs = await this.repository.getDiffsForFilePaths(request.paths, this.revision, {
        signal: request.controller.signal,
      });
    } catch (error) {
      if (!request.controller.signal.aborted)
        console.warn("Unable to read review file diffs", error);
    }
    if (this.active !== request || this.stopped) return;
    this.active = null;
    let changed = false;
    for (const filePath of request.paths) {
      if (request.invalidated.has(filePath)) continue;
      this.diffs.set(filePath, diffs?.get(filePath) || []);
      changed = true;
    }
    if (changed) this.onChange();
    this.pump();
  }

  dispose() {
    if (this.stopped) return;
    this.stopped = true;
    this.active?.controller.abort();
    this.active = null;
    this.diffs.clear();
    this.dirty.clear();
    this.repositorySubscription?.dispose();
    this.stopWatching();
  }

  stopWatching() {
    this.subscriptions?.dispose();
    this.subscriptions = null;
    this.ready = true;
  }
}
