/** @babel */
import { CompositeDisposable } from "lumine";
import GithubPackage from "../lib/github-package";
import { getDiffService, setDiffService } from "../lib/diff-service";

describe("native GitHub git-panel.diff edge ownership", () => {
  it("keeps a newer edge when the provider reuses its service object", () => {
    const previous = getDiffService();
    const owner = { rerender: jasmine.createSpy("rerender") };
    const service = {};
    const oldEdge = GithubPackage.prototype.consumeDiff.call(owner, service);
    const newEdge = GithubPackage.prototype.consumeDiff.call(owner, service);
    try {
      oldEdge.dispose();
      expect(getDiffService()).toBe(service);
      newEdge.dispose();
      expect(getDiffService()).toBeNull();
    } finally {
      oldEdge.dispose();
      newEdge.dispose();
      setDiffService(previous);
    }
  });

  it("disposes a disconnected provider without removing a replacement bridge", () => {
    const previous = getDiffService();
    const subscriptions = new CompositeDisposable();
    const owner = { subscriptions, rerender: jasmine.createSpy("rerender") };
    const provider = () => ({});
    try {
      const first = provider(),
        next = provider();
      const oldEdge = GithubPackage.prototype.consumeDiff.call(owner, first);
      const newEdge = GithubPackage.prototype.consumeDiff.call(owner, next);
      oldEdge.dispose();
      expect(getDiffService()).toBe(next);
      newEdge.dispose();
      expect(getDiffService()).toBeNull();
    } finally {
      subscriptions.dispose();
      setDiffService(previous);
    }
  });

  it("keeps the forge root and observations mounted while the renderer disappears and returns", () => {
    const previous = getDiffService();
    const subscriptions = new CompositeDisposable();
    const element = document.createElement("div");
    const roots = new WeakMap();
    let active = 0;
    const created = [];
    const owner = {
      subscriptions,
      element,
      _roots: roots,
      controller: {},
      rerender() {
        if (!roots.has(element)) {
          active++;
          const root = {
            destroy: jasmine.createSpy("destroy").and.callFake(() => active--),
          };
          created.push(root);
          roots.set(element, root);
        }
      },
    };
    const provider = () => ({});
    try {
      const first = GithubPackage.prototype.consumeDiff.call(owner, provider());
      expect(active).toBe(1);
      const root = roots.get(element);
      const controller = owner.controller;
      first.dispose();
      expect(active).toBe(1);
      expect(root.destroy).not.toHaveBeenCalled();
      expect(owner.controller).toBe(controller);
      expect(getDiffService()).toBeNull();

      const returned = GithubPackage.prototype.consumeDiff.call(owner, provider());
      expect(active).toBe(1);
      returned.dispose();
      expect(active).toBe(1);
      expect(created.length).toBe(1);
      expect(roots.get(element)).toBe(root);
      expect(root.destroy).not.toHaveBeenCalled();
    } finally {
      roots.get(element)?.destroy();
      subscriptions.dispose();
      setDiffService(previous);
    }
  });

  it("finishes a pending forge mount even when its renderer disappears before the callback", async () => {
    const previous = getDiffService();
    const subscriptions = new CompositeDisposable();
    let mountReady;
    const owner = {
      activated: true,
      activationGeneration: 0,
      subscriptions,
      rerender: jasmine.createSpy("rerender").and.callFake((callback) => {
        if (callback) mountReady = callback;
      }),
    };
    const bridge = {};
    const edge = GithubPackage.prototype.consumeDiff.call(owner, bridge);
    try {
      const pending = GithubPackage.prototype.ensureRootController.call(owner);
      await globalThis.conditionPromise(() => typeof mountReady === "function");
      edge.dispose();
      const controller = {};
      owner.controller = controller;
      mountReady();
      expect(await pending).toBe(controller);
    } finally {
      edge.dispose();
      subscriptions.dispose();
      setDiffService(previous);
    }
  });
});
