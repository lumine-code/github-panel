// Unit view fixtures also use the current package generation's owning entry
// to install its Etch scheduler, including after an unload/reactivation test.
beforeEach(() => {
  require("../lib/index");
});
