/** @babel */

// Holds the `github-panel.git-bridge` service once consumed, so containers,
// items, and views can reach git-panel's shared diff pipeline and active-
// repository context without depending on git-panel's module layout.
let bridge = null;

export function setGitBridge(nextBridge) {
  bridge = nextBridge;
}

export function getGitBridge() {
  return bridge;
}
