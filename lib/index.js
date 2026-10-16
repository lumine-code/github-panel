const { CompositeDisposable, Disposable } = require("lumine");
const registerGlobalCommands = require("./bootstrap-commands");
let pack;
let packageOptions;
let activation;
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
    require("@lumine-code/etch").setScheduler(lumine.views);
    packageOptions ||= createPackageOptions();
    const module = require("./github-package");
    const GithubPanelPackage = module.default || module;
    pack = new GithubPanelPackage(packageOptions);
  }
  const owner = activation;
  if (owner?.error) throw owner.error;
  if (owner && !owner.starting && !pack.activated) {
    owner.starting = true;
    try {
      pack.activate({ ...owner.context, entryPointsRegistered: true });
      for (const connection of Object.values(owner.connections)) syncConnection(owner, connection);
    } catch (error) {
      owner.error = error;
      void pack.deactivate().catch((cleanupError) => console.error(cleanupError));
      throw error;
    } finally {
      owner.starting = false;
    }
  }
  if (owner && activation !== owner) throw new Error("GitHub panel activation was cancelled");
  return pack;
}

function syncConnection(owner, connection) {
  const service = activation === owner ? ([...connection.edges.values()].at(-1) ?? null) : null;
  if (connection.service === service && (!pack?.activated || !service || connection.runtime))
    return;
  const revision = (connection.revision ?? 0) + 1;
  connection.revision = revision;
  const previous = connection.runtime;
  connection.runtime = null;
  connection.service = service;
  previous?.dispose();
  if (connection.revision !== revision) return;
  if (activation !== owner) {
    if (!activation && connection.method === "consumeDiff")
      require("./diff-service").setDiffService(null);
    return;
  }
  // Native patch consumers can use this lightweight holder without opening
  // the GitHub panel or constructing its repository/login model graph.
  if (connection.method === "consumeDiff") require("./diff-service").setDiffService(service);
  if (connection.revision !== revision || activation !== owner) return;
  if (pack?.activated && service) {
    const runtime = pack[connection.method](service);
    if (
      activation === owner &&
      connection.revision === revision &&
      pack.activated &&
      connection.service === service &&
      [...connection.edges.values()].at(-1) === service
    )
      connection.runtime = runtime;
    else runtime.dispose();
  }
}

function consumeService(kind, service) {
  const owner = activation;
  if (!owner) return new Disposable();
  const connection = owner.connections[kind];
  const token = {};
  connection.edges.set(token, service);
  syncConnection(owner, connection);
  const lease = new Disposable(() => {
    owner.subscriptions.remove(lease);
    connection.edges.delete(token);
    syncConnection(owner, connection);
  });
  owner.subscriptions.add(lease);
  return lease;
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
  activate(context = {}) {
    context.signal?.throwIfAborted();
    const owner = (activation = {
      context,
      subscriptions: new CompositeDisposable(),
      connections: {
        gitPanel: { edges: new Map(), method: "consumeGitPanel" },
        diff: { edges: new Map(), method: "consumeDiff" },
      },
    });
    owner.subscriptions.add(
      registerGlobalCommands(lumine.commands, ensurePackage, () => pack),
      lumine.workspace.addOpener((uri) => {
        if (uri === "lumine-github://dock-item/github")
          return ensurePackage().createGitHubPaneItem({ uri });
      }),
    );
    if (pack || lumine.config.get("github-panel.openGitHubTabOnStart")) ensurePackage();
  },
  deactivate() {
    const owner = activation;
    activation = null;
    owner?.subscriptions.dispose();
    return pack?.deactivate();
  },
  // Declared here rather than left to the proxy below. These are the methods
  // `package.json` names — the package's wiring, which belongs in the module a
  // reader opens rather than behind a proxy trap that answers to any name.
  consumeGitPanel(gitPanel) {
    return consumeService("gitPanel", gitPanel);
  },
  consumeDiff(service) {
    return consumeService("diff", service);
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
    if (
      typeof name === "symbol" ||
      [
        "__esModule",
        "default",
        "then",
        "config",
        "activateConfig",
        "deactivateConfig",
        "prepareToSerialize",
        "serialize",
        "restoreState",
        "serializeSessionState",
        "restoreSessionState",
      ].includes(name)
    )
      return undefined;
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
