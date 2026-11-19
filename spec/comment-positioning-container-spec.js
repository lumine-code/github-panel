/** @babel */
import { createViewModel } from "./helpers/etch.js";
import CommentPositioningContainer from "../lib/containers/comment-positioning-container.js";
import LocalRepository from "../lib/local-repository.js";
import { toNativePathSep } from "../lib/helpers.js";
import nodePath from "node:path";
import { Disposable } from "lumine";

function threadsAt(path, positions) {
  return positions.map((position) => ({ comments: [{ path, position }] }));
}

function reconcile(state, commentThreads) {
  const update = CommentPositioningContainer.deriveState({ commentThreads }, state);
  return update ? { ...state, ...update } : state;
}

function visiblePatch(rawPatch) {
  return {
    getPatchForPath: () => ({
      getRenderStatus: () => ({ isVisible: () => true }),
      getRawContentPatch: () => rawPatch,
    }),
  };
}

describe("comment position snapshots", () => {
  const path = "src/example.js";
  const nativePath = toNativePathSep(path);
  let state;

  beforeEach(() => {
    state = { translationsByFile: new Map() };
  });

  function update(translation, multiFilePatch, diffs = []) {
    return translation.updateIfNecessary({
      multiFilePatch,
      diffs,
      diffPositionFn: CommentPositioningContainer.defaultProps.diffPositionToFilePosition,
      translatePositionFn: CommentPositioningContainer.defaultProps.translateLinesGivenDiff,
    });
  }

  it("removes paths whose last comment thread disappeared", () => {
    state = reconcile(state, threadsAt(path, [1]));
    state = reconcile(state, []);
    expect(state.translationsByFile.size).toBe(0);
  });

  it("recomputes new comment positions with the same patch and local diff objects", () => {
    const patch = visiblePatch({ hunks: [{ newStartLine: 10, lines: [" ten", " eleven"] }] });
    const diffs = [];
    state = reconcile(state, threadsAt(path, [1]));
    const original = state.translationsByFile.get(nativePath);
    update(original, patch, diffs);
    const originalDigest = original.digest;
    expect(update(original, patch, diffs)).toBe(false);

    state = reconcile(state, threadsAt(path, [1, 2]));
    const next = state.translationsByFile.get(nativePath);
    update(next, patch, diffs);

    expect([...next.rawPositions]).toEqual([1, 2]);
    expect([...next.diffToFilePosition]).toEqual([
      [1, 10],
      [2, 11],
    ]);
    expect(next.digest).not.toBe(originalDigest);
    expect([...original.rawPositions]).toEqual([1]);
  });

  it("discards positions of removed threads while keeping the file's remaining threads", () => {
    state = reconcile(state, threadsAt(path, [1, 2]));
    state = reconcile(state, threadsAt(path, [2]));
    expect([...state.translationsByFile.get(nativePath).rawPositions]).toEqual([2]);
  });

  it("keeps the cached snapshot for unchanged positions", () => {
    state = reconcile(state, threadsAt(path, [1, 2]));
    const original = state;
    state = reconcile(state, threadsAt(path, [2, 1]));
    expect(state).toBe(original);
  });

  it("refreshes the digest when a patch becomes hidden or disappears", () => {
    state = reconcile(state, threadsAt(path, [1]));
    const translation = state.translationsByFile.get(nativePath);
    update(translation, visiblePatch({ hunks: [{ newStartLine: 10, lines: [" ten"] }] }));
    const visibleDigest = translation.digest;

    update(translation, {
      getPatchForPath: () => ({ getRenderStatus: () => ({ isVisible: () => false }) }),
    });
    const hiddenDigest = translation.digest;
    expect(translation.removed).toBe(true);
    expect(translation.diffToFilePosition.size).toBe(0);
    expect(hiddenDigest).not.toBe(visibleDigest);

    update(translation, { getPatchForPath: () => null });
    expect(translation.removed).toBe(false);
    expect(translation.fileTranslations).toBe(null);
    expect(translation.digest).not.toBe(hiddenDigest);
    expect(translation.digest).not.toBe(visibleDigest);
  });

  it("translates PR rows through the local repository's structured diff", () => {
    state = reconcile(state, threadsAt(path, [1]));
    const translation = state.translationsByFile.get(nativePath);
    const patch = visiblePatch({ hunks: [{ newStartLine: 2, lines: [" second"] }] });
    const diffs = [
      {
        hunks: [
          {
            oldStart: 1,
            oldLines: 1,
            newStart: 1,
            newLines: 2,
            lines: [
              { kind: "added", text: "inserted" },
              { kind: "context", text: "first" },
            ],
          },
        ],
      },
    ];
    update(translation, patch, diffs);
    expect(translation.fileTranslations.get(2)).toEqual({ newPosition: 3, invalidated: false });
    expect(translation.digest).toEqual(jasmine.any(String));
  });

  it("retranslates a hidden file expanded within the same patch and diff objects", () => {
    state = reconcile(state, threadsAt(path, [1]));
    const translation = state.translationsByFile.get(nativePath);
    let visible = false;
    const rawPatch = { hunks: [{ newStartLine: 10, lines: [" ten"] }] };
    const patch = {
      getPatchForPath: () => ({
        getRenderStatus: () => ({ isVisible: () => visible }),
        getRawContentPatch: () => rawPatch,
      }),
    };
    const diffs = [];
    update(translation, patch, diffs);
    const hiddenDigest = translation.digest;
    expect(translation.removed).toBe(true);

    visible = true;
    expect(update(translation, patch, diffs)).toBe(true);
    expect(translation.removed).toBe(false);
    expect(translation.diffToFilePosition.get(1)).toBe(10);
    expect(translation.digest).not.toBe(hiddenDigest);
    expect(update(translation, patch, diffs)).toBe(false);

    visible = false;
    expect(update(translation, patch, diffs)).toBe(true);
    expect(translation.removed).toBe(true);
    expect(translation.diffToFilePosition.size).toBe(0);
  });
});

describe("comment position local diff fetching", () => {
  const path = "src/example.js";
  const nativePath = toNativePathSep(path);
  const workdir = nodePath.resolve("comment-position-worktree");
  let container, requests, repository, notify;

  function setProps(props) {
    container.props = { ...container.props, ...props };
    container.state = reconcile(container.state, container.props.commentThreads);
    container.didUpdate();
  }

  function translations() {
    container.render();
    return container.props.children.calls.mostRecent().args[0];
  }

  function resolve(index) {
    const request = requests[index];
    request.resolve(new Map(request.paths.map((filePath) => [filePath, []])));
    return Promise.resolve();
  }

  beforeEach(async () => {
    requests = [];
    repository = {
      core: {},
      getWorkingDirectoryPath: () => workdir,
      onDidUpdate: jasmine.createSpy("onDidUpdate"),
      getDiffsForFilePaths: jasmine
        .createSpy("getDiffsForFilePaths")
        .and.callFake((paths, revision, { signal }) => {
          let resolve;
          const promise = new Promise((resolvePromise) => (resolve = resolvePromise));
          requests.push({ paths, revision, signal, resolve });
          return promise;
        }),
    };
    spyOn(lumine.fileWatchClient, "watchDirectory").and.callFake(() => ({
      ready: Promise.resolve(),
      onDidChange(callback) {
        notify = callback;
        return new Disposable();
      },
      onDidInvalidate: () => new Disposable(),
      onDidError: () => new Disposable(),
      dispose() {},
    }));
    container = createViewModel(CommentPositioningContainer, {
      ...CommentPositioningContainer.defaultProps,
      commentThreads: threadsAt(path, [1]),
      localRepository: repository,
      prCommitSha: "old-sha",
      multiFilePatch: visiblePatch({ hunks: [{ newStartLine: 10, lines: [" ten"] }] }),
      children: jasmine.createSpy("children").and.callFake((translations) => translations),
    });
    container.state = reconcile(container.state, container.props.commentThreads);
    container.didMount();
    await Promise.resolve();
  });

  afterEach(() => container.willDestroy());

  it("keeps fetch paths stable across renders and comment position changes", async () => {
    await resolve(0);
    expect(translations().get(nativePath).diffToFilePosition.get(1)).toBe(10);

    setProps({ commentThreads: threadsAt(path, [1, 2]) });
    expect(translations().get(nativePath).rawPositions.size).toBe(2);
    expect(requests.length).toBe(1);
    expect(repository.onDidUpdate).not.toHaveBeenCalled();
  });

  it("cancels old-SHA diffs and waits for the current comparison", async () => {
    setProps({
      prCommitSha: "new-sha",
      multiFilePatch: visiblePatch({ hunks: [{ newStartLine: 20, lines: [" twenty"] }] }),
    });
    expect(requests[0].signal.aborted).toBe(true);
    await resolve(0);
    expect(requests[1].revision).toBe("new-sha");
    expect(translations().has(nativePath)).toBe(false);
    expect(container.state.translationsByFile.get(nativePath).digest).toBeNull();
    await resolve(1);
    expect(translations().get(nativePath).diffToFilePosition.get(1)).toBe(20);
  });

  it("cancels a comparison whose entire file set is no longer required", async () => {
    const nextPath = "src/other.js";
    setProps({ commentThreads: threadsAt(nextPath, [1]) });
    expect(requests[0].signal.aborted).toBe(true);
    await resolve(0);
    expect(translations().size).toBe(0);
    expect(requests[1].paths).toEqual([toNativePathSep(nextPath)]);
    await resolve(1);
    expect(translations().has(toNativePathSep(nextPath))).toBe(true);
  });

  it("drops the previous repository results while the new repository loads", async () => {
    await resolve(0);
    expect(translations().size).toBe(1);
    setProps({ localRepository: { ...repository } });
    expect(translations().size).toBe(0);
    expect(requests.length).toBe(1);
    await Promise.resolve();
    expect(requests.length).toBe(2);
  });

  it("refreshes only affected comment paths after a worktree change", async () => {
    await resolve(0);
    const otherPath = toNativePathSep("src/other.js");
    setProps({ commentThreads: [...threadsAt(path, [1]), ...threadsAt(otherPath, [1])] });
    expect(requests[1].paths).toEqual([otherPath]);
    await resolve(1);
    const otherTranslation = translations().get(otherPath);

    notify([{ action: "updated", path: nodePath.join(workdir, "unrelated.js") }]);
    expect(requests.length).toBe(2);
    notify([{ action: "updated", path: nodePath.join(workdir, nativePath) }]);
    expect(requests[2].paths).toEqual([nativePath]);
    expect(translations().get(otherPath)).toBe(otherTranslation);
    await resolve(2);

    notify([
      {
        action: "renamed",
        path: nodePath.join(workdir, "lib"),
        oldPath: nodePath.join(workdir, "src"),
      },
    ]);
    expect(requests[3].paths).toEqual([nativePath, otherPath]);
    container.willDestroy();
    expect(requests[3].signal.aborted).toBe(true);
  });
});

describe("working-tree comment diff batches", () => {
  it("isolates an oversized file and still attaches other diffs to their literal paths", async () => {
    const largePath = toNativePathSep("src/large.js");
    const smallPath = toNativePathSep("src/[small].js");
    const small = { oldPath: null, newPath: "src/[small].js", hunks: [] };
    const oversized = Object.assign(new Error("Diff exceeds its budget"), {
      code: "ERR_GIT_DIFF_TOO_LARGE",
    });
    const core = {
      isDestroyed: () => false,
      getDiff: jasmine.createSpy("getDiff").and.callFake(async ({ paths }) => {
        if (paths.includes(largePath)) throw oversized;
        return { files: [small] };
      }),
    };
    const repository = new LocalRepository("/repo", core);
    const { signal } = new AbortController();

    try {
      const result = await repository.getDiffsForFilePaths([largePath, smallPath], "head", {
        signal,
      });
      expect(core.getDiff.calls.allArgs().map(([options]) => options.paths)).toEqual([
        [largePath, smallPath],
        [largePath],
        [smallPath],
      ]);
      expect(core.getDiff.calls.mostRecent().args[0]).toEqual(
        jasmine.objectContaining({ signal, detectRenames: false, format: "structured" }),
      );
      expect(result.get(largePath)).toEqual([]);
      expect(result.get(smallPath)).toEqual([small]);
    } finally {
      repository.destroy();
    }
  });
});
