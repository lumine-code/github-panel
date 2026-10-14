// Authentic package usage. Run with lumine/script/demo.js; fixtures stay in demo/.
module.exports = {
  version: 1,
  secrets: ["lumine-github:https://api.github.com"],
  dependencies: [],
  viewport: { width: 1200, height: 880 },
  async before() {},
  async prepare(context) {
    const { lumine, state, fixture, open } = context;
    state.editor = await open("github-example/README.md");
    await lumine.project.setPaths([fixture("github-example")]);
  },
  scenes: [
    {
      id: "scene-1",
      file: "demo.png",
      caption: "Read a public upstream issue and its discussion without leaving the editor.",
      timeout: 60000,
      async run(context) {
        const { lumine, state, packagePath } = context;
        {
          const m = require(packagePath("github-panel", "lib/items/issueish-detail-item"));
          const View = m.default || m;
          await lumine.workspace.open(
            View.buildURI({
              host: "github.com",
              owner: "pulsar-edit",
              repo: "pulsar",
              number: 1646,
            }),
          );
          await lumine.workspace.paneForItem(state.editor).destroyItem(state.editor, true);
          lumine.workspace.getRightDock().hide();
        }
      },
      ready() {
        return Boolean(
          document.body.innerText.includes("Text selection is deselected") &&
          !document.body.innerText.includes("Received an error response"),
        );
      },
    },
  ],
  async cleanup() {},
};
