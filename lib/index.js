/** @babel */
import GithubPanelPackage from "./github-package";

let pack;
const entry = {
  initialize() {
    pack = new GithubPanelPackage({
      workspace: atom.workspace,
      project: atom.project,
      commands: atom.commands,
      notificationManager: atom.notifications,
      tooltips: atom.tooltips,
      styles: atom.styles,
      keymaps: atom.keymaps,
      grammars: atom.grammars,
      config: atom.config,
      deserializers: atom.deserializers,

      confirm: atom.confirm.bind(atom),
      currentWindow: atom.getCurrentWindow(),
    });
  },

  // Declared here rather than left to the proxy below. These are the methods
  // `package.json` names, and a wiring method reachable only through a proxy
  // trap cannot be verified against the manifest by anything that reads the
  // module — including `npm run check:services`, whose whole purpose is to
  // catch a service that silently never connects.
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
