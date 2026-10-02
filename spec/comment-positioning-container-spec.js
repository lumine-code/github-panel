/** @babel */
import { createViewModel } from "./helpers/etch";
import CommentPositioningContainer from "../lib/containers/comment-positioning-container";
import ObserveModel from "../lib/views/observe-model";
import { toNativePathSep } from "../lib/helpers";

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
  let container, observer, requests, repository;

  function setProps(props) {
    container.props = { ...container.props, ...props };
    container.state = reconcile(container.state, container.props.commentThreads);
  }

  function syncObserver() {
    const previous = observer.props;
    observer.props = container.render().props;
    observer.didUpdate(previous);
  }

  beforeEach(() => {
    requests = [];
    repository = {
      onDidUpdate: () => ({ dispose() {} }),
      getDiffsForFilePath: jasmine.createSpy("getDiffsForFilePath").and.callFake(() => {
        let resolve;
        const promise = new Promise((resolvePromise) => {
          resolve = resolvePromise;
        });
        requests.push({ resolve });
        return promise;
      }),
    };
    container = createViewModel(CommentPositioningContainer, {
      ...CommentPositioningContainer.defaultProps,
      commentThreads: threadsAt(path, [1]),
      localRepository: repository,
      prCommitSha: "old-sha",
      multiFilePatch: visiblePatch({ hunks: [{ newStartLine: 10, lines: [" ten"] }] }),
      children: jasmine.createSpy("children").and.callFake((translations) => translations),
    });
    container.state = reconcile(container.state, container.props.commentThreads);
    observer = createViewModel(ObserveModel, container.render().props);
    spyOn(observer, "updateState").and.callFake((state) => {
      observer.state = { ...observer.state, ...state };
    });
    observer.didMount();
  });

  afterEach(() => {
    observer.willDestroy();
    container.willDestroy();
  });

  it("keeps fetch paths stable across renders and comment position changes", () => {
    const originalPaths = observer.props.fetchParams[0];
    syncObserver();
    expect(observer.props.fetchParams[0]).toBe(originalPaths);
    expect(observer.modelObserver.hasPendingUpdate()).toBe(false);

    setProps({ commentThreads: threadsAt(path, [1, 2]) });
    syncObserver();
    expect(observer.props.fetchParams[0]).toBe(originalPaths);
    expect(observer.modelObserver.hasPendingUpdate()).toBe(false);
    expect(repository.getDiffsForFilePath.calls.count()).toBe(1);
  });

  it("waits for current-SHA diffs when ObserveModel publishes a queued older result", async () => {
    const oldRefresh = observer.modelObserver.getLastModelDataRefreshPromise();
    setProps({
      prCommitSha: "new-sha",
      multiFilePatch: visiblePatch({ hunks: [{ newStartLine: 20, lines: [" twenty"] }] }),
    });
    syncObserver();
    expect(observer.modelObserver.hasPendingUpdate()).toBe(true);

    requests[0].resolve([]);
    await oldRefresh;
    expect(observer.state.data.prCommitSha).toBe("old-sha");
    expect(repository.getDiffsForFilePath.calls.argsFor(1)).toEqual([nativePath, "new-sha"]);
    expect(observer.props.children(observer.state.data)).toBeNull();
    expect(container.state.translationsByFile.get(nativePath).digest).toBeNull();

    requests[1].resolve([]);
    await observer.modelObserver.getLastModelDataRefreshPromise();
    const translations = observer.props.children(observer.state.data);
    expect(translations.get(nativePath).diffToFilePosition.get(1)).toBe(20);
  });

  it("waits for current paths when an earlier file-set fetch completes", async () => {
    const oldRefresh = observer.modelObserver.getLastModelDataRefreshPromise();
    const nextPath = "src/other.js";
    setProps({ commentThreads: threadsAt(nextPath, [1]) });
    syncObserver();
    requests[0].resolve([]);
    await oldRefresh;

    expect(observer.props.children(observer.state.data)).toBeNull();
    expect(repository.getDiffsForFilePath.calls.argsFor(1)).toEqual([
      toNativePathSep(nextPath),
      "old-sha",
    ]);
    requests[1].resolve([]);
    await observer.modelObserver.getLastModelDataRefreshPromise();
    expect(observer.props.children(observer.state.data).has(toNativePathSep(nextPath))).toBe(true);
  });

  it("rejects a snapshot from a different local repository", async () => {
    requests[0].resolve([]);
    await observer.modelObserver.getLastModelDataRefreshPromise();
    const oldSnapshot = observer.state.data;
    const nextRepository = { ...repository };
    setProps({ localRepository: nextRepository });
    const nextView = container.render();
    expect(nextView.props.children(oldSnapshot)).toBeNull();
  });
});
