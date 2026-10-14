const { Emitter } = require("lumine");

// Rendering availability changes independently of the forge data and drafts.
let service = null;
const events = new Emitter();
exports.setDiffService = function setDiffService(nextService) {
  if (service === nextService) return;
  const previous = service;
  service = nextService;
  events.emit("did-change", { previous, current: service });
};
exports.onDidChangeDiffService = function onDidChangeDiffService(callback) {
  return events.on("did-change", callback);
};
exports.getDiffService = function getDiffService() {
  return service;
};
