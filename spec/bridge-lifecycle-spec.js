/** @babel */
import { CompositeDisposable, Disposable } from "lumine";
import GithubPackage from "../lib/github-package";
import { getGitBridge, setGitBridge } from "../lib/git-bridge";

describe("native GitHub bridge edge ownership", () => {
  it("disposes a disconnected provider without removing a replacement bridge", () => {
    const previous = getGitBridge();
    const subscriptions = new CompositeDisposable();
    const owner = { subscriptions, gitPanelWaiters: [], rerender: jasmine.createSpy("rerender") };
    const provider = () => {
      const callbacks = new Set();
      return {
        callbacks,
        onDidUpdate: (callback) => {
          callbacks.add(callback);
          return new Disposable(() => callbacks.delete(callback));
        },
      };
    };
    try {
      const first = provider(),
        next = provider();
      const oldEdge = GithubPackage.prototype.consumeGitPanel.call(owner, first);
      const newEdge = GithubPackage.prototype.consumeGitPanel.call(owner, next);
      oldEdge.dispose();
      expect(first.callbacks.size).toBe(0);
      expect(getGitBridge()).toBe(next);
      newEdge.dispose();
      expect(next.callbacks.size).toBe(0);
      expect(getGitBridge()).toBeNull();
    } finally {
      subscriptions.dispose();
      setGitBridge(previous);
    }
  });

  it("tears down provider-dependent observations and remounts when a provider returns", () => {
    const previous = getGitBridge();
    const subscriptions = new CompositeDisposable();
    const element = document.createElement("div");
    const roots = new WeakMap();
    let active = 0;
    const created = [];
    const owner = {
      subscriptions,
      gitPanelWaiters: [],
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
    const provider = () => ({ onDidUpdate: () => new Disposable() });
    try {
      const first = GithubPackage.prototype.consumeGitPanel.call(owner, provider());
      expect(active).toBe(1);
      first.dispose();
      expect(active).toBe(0);
      expect(created[0].destroy).toHaveBeenCalledTimes(1);
      expect(owner.controller).toBeNull();
      expect(getGitBridge()).toBeNull();

      const returned = GithubPackage.prototype.consumeGitPanel.call(owner, provider());
      expect(active).toBe(1);
      returned.dispose();
      expect(active).toBe(0);
      expect(created[1].destroy).toHaveBeenCalledTimes(1);
    } finally {
      subscriptions.dispose();
      setGitBridge(previous);
    }
  });

  it("rejects a pending mount when the provider disappears before its callback", async () => {
    const previous = getGitBridge();
    const subscriptions = new CompositeDisposable();
    const owner = {
      activated: true,
      activationGeneration: 0,
      subscriptions,
      gitPanelWaiters: [],
      waitForGitPanel: GithubPackage.prototype.waitForGitPanel,
      rerender: jasmine.createSpy("rerender"),
    };
    const bridge = { onDidUpdate: () => new Disposable() };
    const edge = GithubPackage.prototype.consumeGitPanel.call(owner, bridge);
    try {
      const pending = GithubPackage.prototype.ensureRootController.call(owner);
      const result = expectAsync(pending).toBeRejectedWithError("Git panel provider disappeared");
      await globalThis.conditionPromise(() => typeof owner.controllerReadyReject === "function");
      edge.dispose();
      await result;
    } finally {
      edge.dispose();
      subscriptions.dispose();
      setGitBridge(previous);
    }
  });
});
