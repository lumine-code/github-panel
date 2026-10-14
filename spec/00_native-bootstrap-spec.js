const requireCurrent = require("node:module").createRequire(__filename);

// Unit view fixtures use the current renderer generation's owning module to
// install its Etch scheduler, including after an unload/reactivation test.
beforeEach(() => {
  requireCurrent("../lib/etch/view");
});
