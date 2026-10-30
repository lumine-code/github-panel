const path = require("node:path");
const os = require("node:os");
const {
  capturePublishContext,
  publishDirectories,
  canPublishContext,
} = require("../lib/publish-context");
const registerGlobalCommands = require("../lib/bootstrap-commands");

describe("GitHub publication command context", () => {
  const root = path.join(os.tmpdir(), "github-publication-context");
  const treeTarget = { closest: (selector) => selector === ".tree-view" };

  it("copies the tree selection before lazy runtime loading can change it", async () => {
    const entries = [{ path: path.join(root, "chosen"), kind: "directory" }];
    const treeSelection = { getSelectionSnapshot: () => ({ entries }) };
    let commands;
    let captured;
    registerGlobalCommands(
      { add: (_selector, listeners) => (commands = listeners) },
      () => {
        entries[0].path = path.join(root, "later");
        return { openPublishFromContext: (context) => (captured = context) };
      },
      () => null,
      () => treeSelection,
    );
    commands["github-panel:publish-repository"].didDispatch({ target: treeTarget });
    expect(await publishDirectories(captured)).toEqual([path.join(root, "chosen")]);
  });

  it("uses the center document path instead of a notebook's embedded editor or stale tree", async () => {
    const notebookPath = path.join(root, "notebooks", "analysis.ipynb");
    const event = {
      target: { closest: () => null },
      context: {
        documentItem: { getPath: () => notebookPath },
        fileEditor: { getPath: () => path.join(root, "wrong.py") },
      },
    };
    const selection = { getSelectionSnapshot: jasmine.createSpy("tree snapshot") };
    const context = capturePublishContext(event, selection);
    event.context.documentItem = { getPath: () => path.join(root, "later.txt") };
    const stat = jasmine.createSpy("stat").and.resolveTo({ isDirectory: () => false });
    expect(await publishDirectories(context, stat)).toEqual([path.dirname(notebookPath)]);
    expect(selection.getSelectionSnapshot).not.toHaveBeenCalled();
  });

  it("keeps selected folders and collapses files sharing a containing directory", async () => {
    const context = capturePublishContext(
      { target: treeTarget },
      {
        getSelectionSnapshot: () => ({
          entries: [
            { path: path.join(root, "a", "one.txt"), kind: "file" },
            { path: path.join(root, "a", "two.txt"), kind: "file" },
            { path: path.join(root, "b"), kind: "directory" },
          ],
        }),
      },
    );
    expect(await publishDirectories(context)).toEqual([path.join(root, "a"), path.join(root, "b")]);
  });

  it("uses the containing folder of a new document before its first save", async () => {
    const filePath = path.join(root, "new-project", "unsaved.py");
    const context = capturePublishContext({
      context: { documentItem: { getPath: () => filePath } },
    });
    const stat = jasmine
      .createSpy("stat")
      .and.rejectWith(Object.assign(new Error("Not saved yet"), { code: "ENOENT" }));
    expect(await publishDirectories(context, stat)).toEqual([path.dirname(filePath)]);
    expect(stat).toHaveBeenCalledOnceWith(filePath);
  });

  it("preserves filesystem failures other than a missing new document", async () => {
    const context = { entries: [{ path: path.join(root, "denied.py"), kind: null }] };
    const failure = Object.assign(new Error("Access denied"), { code: "EACCES" });
    await expectAsync(publishDirectories(context, () => Promise.reject(failure))).toBeRejectedWith(
      failure,
    );
  });

  it("leaves a pathless or synthetic document for manual folder selection", async () => {
    for (const itemPath of [undefined, "lumine://settings"]) {
      const context = capturePublishContext({
        context: { documentItem: { getPath: () => itemPath } },
      });
      expect(await publishDirectories(context)).toEqual([]);
    }
    expect(await publishDirectories(capturePublishContext({ target: treeTarget }, null))).toEqual(
      [],
    );
  });

  it("keeps availability synchronous and uses only cached refs for the explicit path", () => {
    const refs = { initialized: true, remotes: [{ fetchUrl: "github-remote" }] };
    const repositories = {
      getForPath: jasmine.createSpy("getForPath").and.returnValue({ getRefsSnapshot: () => refs }),
    };
    const context = { entries: [{ path: path.join(root, "chosen.txt") }] };
    const parseRemote = () => ({ host: "github.com", namespace: "owner" });
    expect(canPublishContext(context, repositories, parseRemote)).toBe(false);
    expect(repositories.getForPath).toHaveBeenCalledOnceWith(context.entries[0].path);
    refs.initialized = false;
    expect(canPublishContext(context, repositories, parseRemote)).toBe(true);
    expect(canPublishContext({ entries: [] }, repositories, parseRemote)).toBe(true);
  });
});
