/** @babel */
import { CompositeDisposable } from "lumine";
import GithubPackage from "../lib/github-package";
import { getPatchView, setPatchView } from "../lib/patch-view";

describe("native GitHub patch-view edge ownership", () => {
  it("disposes a disconnected provider without removing a replacement bridge", () => {
    const previous = getPatchView();
    const subscriptions = new CompositeDisposable();
    const owner = { subscriptions, rerender: jasmine.createSpy("rerender") };
    const provider = () => ({});
    try {
      const first = provider(),
        next = provider();
      const oldEdge = GithubPackage.prototype.consumePatchView.call(owner, first);
      const newEdge = GithubPackage.prototype.consumePatchView.call(owner, next);
      oldEdge.dispose();
      expect(getPatchView()).toBe(next);
      newEdge.dispose();
      expect(getPatchView()).toBeNull();
    } finally {
      subscriptions.dispose();
      setPatchView(previous);
    }
  });

  it("keeps the forge root and observations mounted while the renderer disappears and returns", () => {
    const previous = getPatchView();
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
      const first = GithubPackage.prototype.consumePatchView.call(owner, provider());
      expect(active).toBe(1);
      const root = roots.get(element);
      const controller = owner.controller;
      first.dispose();
      expect(active).toBe(1);
      expect(root.destroy).not.toHaveBeenCalled();
      expect(owner.controller).toBe(controller);
      expect(getPatchView()).toBeNull();

      const returned = GithubPackage.prototype.consumePatchView.call(owner, provider());
      expect(active).toBe(1);
      returned.dispose();
      expect(active).toBe(1);
      expect(created.length).toBe(1);
      expect(roots.get(element)).toBe(root);
      expect(root.destroy).not.toHaveBeenCalled();
    } finally {
      roots.get(element)?.destroy();
      subscriptions.dispose();
      setPatchView(previous);
    }
  });

  it("finishes a pending forge mount even when its renderer disappears before the callback", async () => {
    const previous = getPatchView();
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
    const edge = GithubPackage.prototype.consumePatchView.call(owner, bridge);
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
      setPatchView(previous);
    }
  });
});
