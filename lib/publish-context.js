const path = require("node:path");

function realPath(value) {
  return typeof value === "string" && path.isAbsolute(value);
}

// Copy paths while the command still owns its original target and selection.
// A later await may open a dialog or let the user switch the center document.
function capturePublishContext(event, treeSelection, workspace) {
  const inTree = Boolean(event?.target?.closest?.(".tree-view"));
  let entries;
  if (inTree) {
    entries = treeSelection?.getSelectionSnapshot?.().entries ?? [];
  } else {
    const item = event?.context
      ? event.context.documentItem
      : workspace?.getCenter?.().getActivePaneItem?.();
    entries = [{ path: item?.getPath?.(), kind: null }];
  }
  return Object.freeze({
    entries: Object.freeze(
      entries
        .filter((entry) => realPath(entry.path))
        .map((entry) => Object.freeze({ path: entry.path, kind: entry.kind })),
    ),
  });
}

async function publishDirectories(context, stat) {
  const directories = await Promise.all(
    context.entries.map(async (entry) => {
      if (entry.kind === "directory") return entry.path;
      if (entry.kind === "file") return path.dirname(entry.path);
      try {
        const metadata = await stat(entry.path);
        return metadata.isDirectory() ? entry.path : path.dirname(entry.path);
      } catch (error) {
        // A new document may already have its destination path before its
        // first save. Its containing directory is still the command context.
        if (error.code === "ENOENT") return path.dirname(entry.path);
        throw error;
      }
    }),
  );
  return [...new Set(directories)];
}

function canPublishContext(context, repositories, parseGitRemote) {
  // An empty context opens a manual folder choice. Multiple candidates still
  // need an explicit choice, so keep that dialog reachable.
  if (context.entries.length !== 1) return true;
  const repository = repositories?.getForPath?.(context.entries[0].path);
  const refs = repository?.getRefsSnapshot?.();
  if (!refs?.initialized || !parseGitRemote) return true;
  return !refs.remotes.some((remote) => {
    const descriptor = parseGitRemote(remote.fetchUrl || remote.pushUrl);
    return Boolean(
      descriptor?.host === "github.com" &&
      descriptor.namespace &&
      !descriptor.namespace.includes("/"),
    );
  });
}

module.exports = { capturePublishContext, publishDirectories, canPublishContext };
