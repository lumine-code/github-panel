/** @babel */
/* global describe, afterEach, it, expect */
import { setGitBridge, getGitBridge } from "../lib/git-bridge";

describe("github-panel git bridge consumption", () => {
  afterEach(() => setGitBridge(null));

  it("holds and returns the consumed git bridge", () => {
    expect(getGitBridge()).toBe(null);
    const bridge = { marker: true };
    setGitBridge(bridge);
    expect(getGitBridge()).toBe(bridge);
    setGitBridge(null);
    expect(getGitBridge()).toBe(null);
  });

  it("loads every rewired module without reaching into git-panel internals", () => {
    // These modules previously used requireFromGitPanel/getGitPanel; importing
    // them verifies their new sources (the bridge holder, `atom`'s GitError, the
    // local patch-preview view) all resolve.
    const modules = [
      "../lib/git-bridge",
      "../lib/github-package",
      "../lib/views/patch-preview-view",
      "../lib/controllers/github-tab-header-controller",
      "../lib/controllers/pr-checkout-controller",
      "../lib/containers/pr-patch-container",
      "../lib/containers/pr-changed-files-container",
      "../lib/items/reviews-item",
      "../lib/items/issueish-detail-item",
    ];
    for (const modulePath of modules) {
      expect(() => require(modulePath)).not.toThrow();
    }
  });
});
