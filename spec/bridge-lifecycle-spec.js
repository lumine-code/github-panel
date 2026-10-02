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
});
