/** @babel */
// Ported from pulsar-edit/github test/models/model-observer.test.js (chai/sinon → Jasmine).
import { Emitter } from "lumine";
import ModelObserver from "../lib/models/model-observer";

function deferred() {
  let resolve, reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function until(predicate) {
  for (let tick = 0; tick < 10000; tick++) {
    if (predicate()) return;
    await Promise.resolve();
  }
  throw new Error("Model refresh did not finish");
}

class Model {
  constructor(a, b) {
    this.a = a;
    this.b = b;
    this.emitter = new Emitter();
    this.fetchA = jasmine.createSpy("fetchA").and.callFake(() => Promise.resolve(this.a));
    this.fetchB = jasmine.createSpy("fetchB").and.callFake(() => Promise.resolve(this.b));
  }

  onDidUpdate(cb) {
    return this.emitter.on("did-update", cb);
  }

  didUpdate() {
    return this.emitter.emit("did-update");
  }

  destroy() {
    this.emitter.dispose();
  }
}

describe("ModelObserver", () => {
  let model1, model2, observer, fetchDataStub, didUpdateStub;

  beforeEach(() => {
    model1 = new Model("a", "b");
    model2 = new Model("A", "B");
    didUpdateStub = jasmine.createSpy("didUpdate");
    fetchDataStub = jasmine
      .createSpy("fetchData")
      .and.callFake(async (model) => ({ a: await model.fetchA(), b: await model.fetchB() }));
    observer = new ModelObserver({
      fetchData: fetchDataStub,
      didUpdate: didUpdateStub,
    });
  });

  afterEach(() => {
    observer.destroy();
    model1.destroy();
    model2.destroy();
  });

  it("fetches data asynchronously when the active model is set", async () => {
    observer.setActiveModel(model1);
    expect(didUpdateStub.calls.count()).toBe(1);
    expect(observer.getActiveModel()).toBe(model1);
    expect(didUpdateStub.calls.argsFor(0)).toEqual([model1]);
    expect(observer.getActiveModelData()).toBeNull();

    await observer.lastFetchDataPromise;
    expect(model1.fetchA.calls.count()).toBe(1);
    expect(model1.fetchB.calls.count()).toBe(1);
    expect(didUpdateStub.calls.count()).toBe(2);
    expect(didUpdateStub.calls.argsFor(1)).toEqual([model1]);
    expect(observer.getActiveModelData()).toEqual({ a: "a", b: "b" });

    observer.setActiveModel(model2);
    expect(observer.getActiveModel()).toBe(model2);
    expect(didUpdateStub.calls.count()).toBe(3);
    expect(didUpdateStub.calls.argsFor(2)).toEqual([model2]);
    expect(observer.getActiveModelData()).toBeNull();

    await observer.lastFetchDataPromise;
    expect(model2.fetchA.calls.count()).toBe(1);
    expect(model2.fetchB.calls.count()).toBe(1);
    expect(didUpdateStub.calls.count()).toBe(4);
    expect(observer.getActiveModelData()).toEqual({ a: "A", b: "B" });

    observer.setActiveModel(null);
    expect(observer.getActiveModel()).toBeNull();
    expect(observer.getActiveModelData()).toBeNull();
    expect(didUpdateStub.calls.count()).toBe(5);
    expect(didUpdateStub.calls.argsFor(4)).toEqual([null]);
  });

  it("fetches data asynchronously when the model is updated", async () => {
    observer.setActiveModel(model1);
    await observer.lastFetchDataPromise;
    expect(model1.fetchA.calls.count()).toBe(1);
    expect(model1.fetchB.calls.count()).toBe(1);
    expect(didUpdateStub.calls.count()).toBe(2);
    expect(observer.getActiveModelData()).toEqual({ a: "a", b: "b" });

    model1.a = "Ayy";
    model1.b = "Bee";
    model1.didUpdate();

    await observer.lastFetchDataPromise;
    expect(model1.fetchA.calls.count()).toBe(2);
    expect(model1.fetchB.calls.count()).toBe(2);
    expect(didUpdateStub.calls.count()).toBe(3);
    expect(observer.getActiveModelData()).toEqual({ a: "Ayy", b: "Bee" });
  });

  it("enqueues a fetch if the model changes during a fetch", async () => {
    observer.setActiveModel(model1);
    await observer.lastFetchDataPromise;
    expect(model1.fetchA.calls.count()).toBe(1);
    expect(model1.fetchB.calls.count()).toBe(1);
    expect(didUpdateStub.calls.count()).toBe(2);
    expect(observer.getActiveModelData()).toEqual({ a: "a", b: "b" });

    fetchDataStub.calls.reset();
    didUpdateStub.calls.reset();
    // Update once...
    model1.didUpdate();
    // fetchData called immediately
    expect(fetchDataStub.calls.count()).toBe(1);

    // Update again on the same tick
    model1.didUpdate();
    // second fetchData not yet called
    expect(fetchDataStub.calls.count()).toBe(1);

    expect(didUpdateStub.calls.count()).toBe(0);
    await observer.lastFetchDataPromise;
    expect(didUpdateStub.calls.count()).toBe(0);
    // second fetchData started immediately after the previous one ends
    expect(fetchDataStub.calls.count()).toBe(2);

    await observer.lastFetchDataPromise;
    expect(didUpdateStub.calls.count()).toBe(1);
  });

  it("enqueues at most one pending fetch", async () => {
    observer.setActiveModel(model1);
    await observer.lastFetchDataPromise;
    expect(model1.fetchA.calls.count()).toBe(1);
    expect(model1.fetchB.calls.count()).toBe(1);
    expect(didUpdateStub.calls.count()).toBe(2);
    expect(observer.getActiveModelData()).toEqual({ a: "a", b: "b" });

    fetchDataStub.calls.reset();
    didUpdateStub.calls.reset();
    // Update once...
    model1.didUpdate();
    // fetchData called immediately
    expect(fetchDataStub.calls.count()).toBe(1);

    for (let i = 0; i < 10; i++) {
      model1.didUpdate();
    }

    // no updates triggered immediate fetches
    expect(fetchDataStub.calls.count()).toBe(1);

    expect(didUpdateStub.calls.count()).toBe(0);
    await observer.lastFetchDataPromise;
    expect(didUpdateStub.calls.count()).toBe(0);
    // second fetchData started immediately after the previous one ends
    expect(fetchDataStub.calls.count()).toBe(2);

    await observer.lastFetchDataPromise;
    expect(didUpdateStub.calls.count()).toBe(1);
    // none of the other 9 updates trigger, as they were essentially duplicates
    expect(fetchDataStub.calls.count()).toBe(2);
  });

  it("keeps accepted repository data while a queued update supersedes an older local diff", async () => {
    await observer.setActiveModel(model1);
    const accepted = observer.getActiveModelData();
    const stale = deferred();
    const latest = deferred();
    fetchDataStub.and.returnValues(stale.promise, latest.promise);
    didUpdateStub.calls.reset();
    model1.didUpdate();
    model1.didUpdate();
    stale.resolve({ a: "old local diff", b: "unchanged file and PR SHA" });
    await until(() => fetchDataStub.calls.count() === 3);

    expect(observer.getActiveModelData()).toBe(accepted);
    expect(didUpdateStub).not.toHaveBeenCalled();
    latest.resolve({ a: "current local diff", b: "unchanged file and PR SHA" });
    await observer.getLastModelDataRefreshPromise();
    expect(observer.getActiveModelData().a).toBe("current local diff");
    expect(didUpdateStub).toHaveBeenCalledOnceWith(model1);
  });

  for (const error of [
    Object.assign(new Error("Repository read was superseded"), { code: "ABORT_ERR" }),
    Object.assign(new Error("Repository read was superseded"), { name: "AbortError" }),
  ]) {
    it(`keeps accepted data during a live ${error.code || error.name} and publishes its pending replacement`, async () => {
      await observer.setActiveModel(model1);
      const accepted = observer.getActiveModelData();
      const superseded = deferred();
      const latest = deferred();
      fetchDataStub.and.returnValues(superseded.promise, latest.promise);
      didUpdateStub.calls.reset();
      spyOn(console, "error");
      model1.didUpdate();
      model1.didUpdate();
      superseded.reject(error);
      await until(() => fetchDataStub.calls.count() === 3);

      expect(observer.getActiveModelData()).toBe(accepted);
      expect(didUpdateStub).not.toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
      latest.resolve({ a: "latest", b: "valid repository" });
      await observer.getLastModelDataRefreshPromise();
      expect(observer.getActiveModelData()).toEqual({ a: "latest", b: "valid repository" });
      expect(didUpdateStub).toHaveBeenCalledOnceWith(model1);
    });
  }

  it("does not retry a live aborted read without a newer model update", async () => {
    await observer.setActiveModel(model1);
    const accepted = observer.getActiveModelData();
    const error = Object.assign(new Error("Read canceled"), { name: "AbortError" });
    fetchDataStub.and.callFake(() => Promise.reject(error));
    didUpdateStub.calls.reset();
    spyOn(console, "error");
    await observer.refreshModelData();

    expect(observer.getActiveModelData()).toBe(accepted);
    expect(didUpdateStub).not.toHaveBeenCalled();
    expect(fetchDataStub).toHaveBeenCalledTimes(2);
    expect(console.error).not.toHaveBeenCalled();
  });

  it("clears accepted data for a terminal repository failure with an abort name and pending read", async () => {
    await observer.setActiveModel(model1);
    const terminal = deferred();
    const replacement = deferred();
    fetchDataStub.and.returnValues(terminal.promise, replacement.promise);
    didUpdateStub.calls.reset();
    model1.didUpdate();
    model1.didUpdate();
    terminal.reject(
      Object.assign(new Error("Repository removed"), {
        code: "ERR_GIT_REPOSITORY_UNAVAILABLE",
        name: "AbortError",
      }),
    );
    await until(() => fetchDataStub.calls.count() === 3);

    expect(observer.getActiveModelData()).toBeNull();
    expect(didUpdateStub).toHaveBeenCalledOnceWith(model1);
    replacement.resolve({ a: "replacement", b: "repository" });
    await observer.getLastModelDataRefreshPromise();
    expect(observer.getActiveModelData().a).toBe("replacement");
  });

  it("does not restore an aborted model after a different model has published data", async () => {
    await observer.setActiveModel(model1);
    const old = deferred();
    fetchDataStub.and.returnValues(old.promise, Promise.resolve({ a: "current", b: "account" }));
    const oldRefresh = observer.refreshModelData();
    await observer.setActiveModel(model2);
    didUpdateStub.calls.reset();
    old.reject(Object.assign(new Error("Previous read canceled"), { code: "ABORT_ERR" }));
    await oldRefresh;

    expect(observer.getActiveModel()).toBe(model2);
    expect(observer.getActiveModelData()).toEqual({ a: "current", b: "account" });
    expect(didUpdateStub).not.toHaveBeenCalled();
  });

  it("clears any pending update and fetches immediately when the active model is set", async () => {
    observer.setActiveModel(model1);
    await observer.lastFetchDataPromise;
    expect(model1.fetchA.calls.count()).toBe(1);
    expect(model1.fetchB.calls.count()).toBe(1);
    expect(didUpdateStub.calls.count()).toBe(2);
    expect(observer.getActiveModelData()).toEqual({ a: "a", b: "b" });

    fetchDataStub.calls.reset();
    didUpdateStub.calls.reset();
    // Update once...
    model1.didUpdate();
    // fetchData called immediately
    expect(fetchDataStub.calls.count()).toBe(1);
    // Update again...
    model1.didUpdate();
    const originalFetchPromise = observer.lastFetchDataPromise;

    observer.setActiveModel(model2);
    // Model changed, so we fetch new data immediately
    expect(fetchDataStub.calls.count()).toBe(2);
    expect(fetchDataStub.calls.argsFor(1)).toEqual([model2]);
    await originalFetchPromise;
    // Original fetch data has been discarded as it is now stale
    expect(observer.getActiveModelData()).toBeNull();
    await observer.lastFetchDataPromise;
    // The previously pending fetch does not occur
    expect(fetchDataStub.calls.count()).toBe(2);
    expect(observer.getActiveModelData()).toEqual({ a: "A", b: "B" });
  });

  it("clears unavailable repository data and recovers on the next update", async () => {
    await observer.setActiveModel(model1);
    const request = deferred();
    fetchDataStub.and.returnValue(request.promise);
    spyOn(console, "error");
    model1.didUpdate();
    request.reject(
      Object.assign(new Error("Git repository is unavailable during history"), {
        code: "ERR_GIT_REPOSITORY_UNAVAILABLE",
        reason: "working-directory-missing",
      }),
    );

    await expectAsync(observer.getLastModelDataRefreshPromise()).toBeResolved();
    expect(observer.getActiveModelData()).toBeNull();
    expect(console.error).not.toHaveBeenCalled();
    expect(didUpdateStub.calls.mostRecent().args).toEqual([model1]);

    fetchDataStub.and.returnValue(Promise.resolve({ a: "moved", b: "repository" }));
    model1.didUpdate();
    await observer.getLastModelDataRefreshPromise();
    expect(observer.getActiveModelData()).toEqual({ a: "moved", b: "repository" });
  });

  it("reports an unexpected background read failure and keeps the last valid data", async () => {
    await observer.setActiveModel(model1);
    const error = new Error("Permission denied reading Git config");
    fetchDataStub.and.returnValue(Promise.reject(error));
    spyOn(console, "error");
    model1.didUpdate();

    await expectAsync(observer.getLastModelDataRefreshPromise()).toBeResolved();
    expect(console.error).toHaveBeenCalledWith("GitHub panel model data refresh failed", error);
    expect(observer.getActiveModelData()).toEqual({ a: "a", b: "b" });
  });

  it("clears data when repository destruction aborts an in-flight read", async () => {
    await observer.setActiveModel(model1);
    const request = deferred();
    fetchDataStub.and.returnValue(request.promise);
    spyOn(console, "error");
    model1.didUpdate();
    model1.isDestroyed = () => true;
    request.reject(Object.assign(new Error("The operation was aborted"), { code: "ABORT_ERR" }));
    await expectAsync(observer.getLastModelDataRefreshPromise()).toBeResolved();

    expect(observer.getActiveModelData()).toBeNull();
    expect(console.error).not.toHaveBeenCalled();
    model1.didUpdate();
    expect(fetchDataStub.calls.count()).toBe(2);
  });

  it("does not restore a model cleared while its read is in flight", async () => {
    const request = deferred();
    fetchDataStub.and.returnValue(request.promise);
    const refresh = observer.setActiveModel(model1);
    observer.setActiveModel(null);
    didUpdateStub.calls.reset();
    request.resolve({ a: "old", b: "repository" });
    await refresh;

    expect(observer.getActiveModel()).toBeNull();
    expect(observer.getActiveModelData()).toBeNull();
    expect(didUpdateStub).not.toHaveBeenCalled();
  });

  for (const outcome of ["resolve", "reject"]) {
    it(`does not drain a new model's queued refresh when an old read ${outcome}s`, async () => {
      const oldRequest = deferred();
      const currentRequest = deferred();
      const queuedRequest = deferred();
      fetchDataStub.and.returnValues(
        oldRequest.promise,
        currentRequest.promise,
        queuedRequest.promise,
      );
      spyOn(console, "error");
      const oldRefresh = observer.setActiveModel(model1);
      const currentRefresh = observer.setActiveModel(model2);
      model2.didUpdate();
      didUpdateStub.calls.reset();

      oldRequest[outcome](outcome === "resolve" ? { a: "stale" } : new Error("Old read failed"));
      await oldRefresh;
      expect(fetchDataStub.calls.count()).toBe(2);
      expect(observer.hasPendingUpdate()).toBe(true);
      expect(observer.getActiveModelData()).toBeNull();
      expect(didUpdateStub).not.toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();

      currentRequest.resolve({ a: "current" });
      await currentRefresh;
      expect(fetchDataStub.calls.count()).toBe(3);
      expect(fetchDataStub.calls.mostRecent().args).toEqual([model2]);
      queuedRequest.resolve({ a: "latest" });
      await observer.getLastModelDataRefreshPromise();
      expect(observer.getActiveModelData()).toEqual({ a: "latest" });
    });
  }

  for (const outcome of ["resolve", "reject"]) {
    it(`discards a read that ${outcome}s after the observer is destroyed`, async () => {
      const request = deferred();
      fetchDataStub.and.returnValue(request.promise);
      spyOn(console, "error");
      const refresh = observer.setActiveModel(model1);
      model1.didUpdate();
      observer.destroy();
      didUpdateStub.calls.reset();

      request[outcome](outcome === "resolve" ? { a: "stale" } : new Error("Destroyed read failed"));
      await refresh;
      model1.didUpdate();
      observer.refreshModelData();
      observer.setActiveModel(model2);
      expect(fetchDataStub.calls.count()).toBe(1);
      expect(didUpdateStub).not.toHaveBeenCalled();
      expect(observer.getActiveModelData()).toBeNull();
      expect(observer.hasPendingUpdate()).toBe(false);
      expect(console.error).not.toHaveBeenCalled();
    });
  }
});
