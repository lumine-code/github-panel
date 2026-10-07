const etch = require("@lumine-code/etch");
etch.setScheduler(lumine.views);
let pack;
let packageOptions;
function createPackageOptions() {
  return {
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
  };
}
function ensurePackage() {
  if (!pack) {
    packageOptions ||= createPackageOptions();
    const module = require("./github-package");
    const GithubPanelPackage = module.default || module;
    pack = new GithubPanelPackage(packageOptions);
  }
  return pack;
}
const entry = {
  provideBackgroundTips() {
    return {
      packageName: "github-panel",
      tips: [
        "You can review pull requests and issues from the GitHub panel with {{ 'github-panel:toggle-focus' | keystroke }}",
      ],
    };
  },
  initialize() {
    packageOptions = createPackageOptions();
  },
  // Declared here rather than left to the proxy below. These are the methods
  // `package.json` names — the package's wiring, which belongs in the module a
  // reader opens rather than behind a proxy trap that answers to any name.
  consumeGitPanel(gitPanel) {
    return ensurePackage().consumeGitPanel(gitPanel);
  },
  consumePatchView(service) {
    return ensurePackage().consumePatchView(service);
  },
  provideCommitLinks() {
    const { parseGitRemote } = require("lumine");
    return {
      buildCommitURL(remote, sha) {
        const descriptor = parseGitRemote(remote?.fetchUrl || remote?.pushUrl);
        if (
          descriptor?.host !== "github.com" ||
          !descriptor.namespace ||
          descriptor.namespace.includes("/")
        )
          return null;
        return `${descriptor.webURL}/commit/${encodeURIComponent(sha)}`;
      },
    };
  },
};
module.exports = new Proxy(entry, {
  get(target, name) {
    if (Reflect.has(target, name)) {
      return target[name];
    }
    const packageInstance = ensurePackage();
    if (Reflect.has(packageInstance, name)) {
      let item = packageInstance[name];
      if (typeof item === "function") {
        item = item.bind(packageInstance);
      }
      return item;
    } else {
      return target[name];
    }
  },
});
