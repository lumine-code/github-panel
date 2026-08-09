/** @babel */
import GithubPanelPackage from "./github-package";

let pack;
const entry = {
  initialize() {
    pack = new GithubPanelPackage({
      workspace: lumine.workspace,
      project: lumine.project,
      commands: lumine.commands,
      notificationManager: lumine.notifications,
      tooltips: lumine.tooltips,
      styles: lumine.styles,
      keymaps: lumine.keymaps,
      grammars: lumine.grammars,
      config: lumine.config,
      deserializers: lumine.deserializers,

      confirm: lumine.window.confirm.bind(lumine.window),
    });
  },

  // Declared here rather than left to the proxy below. These are the methods
  // `package.json` names — the package's wiring, which belongs in the module a
  // reader opens rather than behind a proxy trap that answers to any name.
  consumeStatusBar(statusBar) {
    return pack?.consumeStatusBar(statusBar);
  },

  consumeGitPanel(gitPanel) {
    return pack?.consumeGitPanel(gitPanel);
  },
};

module.exports = new Proxy(entry, {
  get(target, name) {
    if (pack && Reflect.has(pack, name)) {
      let item = pack[name];
      if (typeof item === "function") {
        item = item.bind(pack);
      }
      return item;
    } else {
      return target[name];
    }
  },
});
