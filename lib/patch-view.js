/** @babel */

import { Emitter } from "lumine";

// Rendering availability changes independently of the forge data and drafts.
let bridge = null;
const events = new Emitter();
export function setPatchView(nextBridge) {
  if (bridge === nextBridge) return;
  const previous = bridge;
  bridge = nextBridge;
  events.emit("did-change", { previous, current: bridge });
}
export function onDidChangePatchView(callback) {
  return events.on("did-change", callback);
}
export function getPatchView() {
  return bridge;
}
