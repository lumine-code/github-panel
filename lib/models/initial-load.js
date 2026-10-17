/** @babel */
import { Disposable } from "lumine";

// One presentation waits for every initial model and query snapshot. The
// owner retains a bootstrap hold before mounting consumers, so nested reads
// can join before their parent's accepted view releases its own hold.
export default class InitialLoad {
  constructor({ onChange } = {}) {
    this.onChange = onChange;
    this.pending = new Set();
    this.ready = false;
    this.error = null;
    this.disposed = false;
  }

  fail(error) {
    if (this.ready || this.disposed) return;
    this.error = error;
    this.pending.clear();
    this.ready = true;
    this.onChange?.();
  }

  retain() {
    if (this.ready || this.disposed) return new Disposable();
    const token = {};
    this.pending.add(token);
    return new Disposable(() => {
      if (this.disposed || !this.pending.delete(token) || this.pending.size > 0) return;
      this.ready = true;
      this.onChange?.();
    });
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.pending.clear();
    this.onChange = null;
  }
}
