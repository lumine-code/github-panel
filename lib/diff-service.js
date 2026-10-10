/** @babel */

import { Emitter } from "lumine";

// Rendering availability changes independently of the forge data and drafts.
let service = null;
const events = new Emitter();
export function setDiffService(nextService) {
  if (service === nextService) return;
  const previous = service;
  service = nextService;
  events.emit("did-change", { previous, current: service });
}
export function onDidChangeDiffService(callback) {
  return events.on("did-change", callback);
}
export function getDiffService() {
  return service;
}
