/** @babel */
/** @jsx h */
import { provideEnvironment } from "../graphql/environment";
import View, { h } from "../etch/view";
import crypto from "crypto";
import { CompositeDisposable } from "lumine";
import { resolveQuery } from "../helpers";
import { translateLinesGivenDiff, diffPositionToFilePosition } from "../whats-my-line";
import ObserveModel from "../views/observe-model";
import { toNativePathSep } from "../helpers";
export default class CommentPositioningContainer extends View {
  static defaultProps = {
    translateLinesGivenDiff,
    diffPositionToFilePosition,
    didTranslate: /* istanbul ignore next */ () => {},
  };
  constructor(props, children) {
    super(props, children);
    this.state = {
      translationsByFile: new Map(),
    };
    this.subs = new CompositeDisposable();
    this.initialize();
  }
  static deriveState(props, state) {
    const positionsByFile = new Map();
    for (const thread of props.commentThreads) {
      const relPath = thread.comments[0].path;
      const commentPath = toNativePathSep(relPath);
      if (!positionsByFile.has(commentPath)) {
        positionsByFile.set(commentPath, {
          relPath,
          positions: new Set(),
        });
      }
      positionsByFile.get(commentPath).positions.add(thread.comments[0].position);
    }
    const translationsByFile = new Map();
    let changed = positionsByFile.size !== state.translationsByFile.size;
    for (const [commentPath, { relPath, positions }] of positionsByFile) {
      const existing = state.translationsByFile.get(commentPath);
      if (existing && existing.hasPositions(positions)) {
        translationsByFile.set(commentPath, existing);
      } else {
        translationsByFile.set(commentPath, new FileTranslation(relPath, positions));
        changed = true;
      }
    }
    if (changed) {
      return {
        translationsByFile,
      };
    } else {
      return null;
    }
  }
  willDestroy() {
    this.subs.dispose();
  }
  getCommentPaths() {
    const commentPaths = [...this.state.translationsByFile.keys()].sort();
    if (
      !this.commentPaths ||
      this.commentPaths.length !== commentPaths.length ||
      this.commentPaths.some((path, index) => path !== commentPaths[index])
    ) {
      this.commentPaths = commentPaths;
    }
    return this.commentPaths;
  }
  render() {
    const commentPaths = this.getCommentPaths();
    return (
      <ObserveModel
        model={this.props.localRepository}
        fetchData={this.fetchData}
        fetchParams={[commentPaths, this.props.prCommitSha]}
        children={(diffData) => {
          if (
            diffData === null ||
            !this.props.multiFilePatch ||
            diffData.localRepository !== this.props.localRepository ||
            diffData.prCommitSha !== this.props.prCommitSha ||
            diffData.commentPaths !== commentPaths
          ) {
            return provideEnvironment(this.props.children(null), this.props.environment);
          }
          const { diffsByPath } = diffData;
          for (const commentPath of commentPaths) {
            this.state.translationsByFile.get(commentPath).updateIfNecessary({
              multiFilePatch: this.props.multiFilePatch,
              diffs: diffsByPath[commentPath] || [],
              diffPositionFn: this.props.diffPositionToFilePosition,
              translatePositionFn: this.props.translateLinesGivenDiff,
            });
          }
          return provideEnvironment(
            this.props.children(this.state.translationsByFile),
            this.props.environment,
          );
        }}
        environment={this.props.environment}
      />
    );
  }
  fetchData = (localRepository, commentPaths, prCommitSha) => {
    const promises = {};
    for (const commentPath of commentPaths) {
      promises[commentPath] = localRepository
        .getDiffsForFilePath(commentPath, prCommitSha)
        .catch(() => []);
    }
    return resolveQuery(promises).then((diffsByPath) => ({
      localRepository,
      commentPaths,
      prCommitSha,
      diffsByPath,
    }));
  };
}
class FileTranslation {
  constructor(relPath, positions = new Set()) {
    this.relPath = relPath;
    this.nativeRelPath = toNativePathSep(relPath);
    this.rawPositions = positions;
    this.diffToFilePosition = new Map();
    this.removed = false;
    this.fileTranslations = null;
    this.digest = null;
    this.last = {
      multiFilePatch: null,
      diffs: null,
      visible: null,
    };
  }
  hasPositions(positions) {
    return (
      positions.size === this.rawPositions.size &&
      [...positions].every((position) => this.rawPositions.has(position))
    );
  }
  updateIfNecessary({ multiFilePatch, diffs, diffPositionFn, translatePositionFn }) {
    const filePatch = multiFilePatch.getPatchForPath(this.nativeRelPath);
    const visible = filePatch ? filePatch.getRenderStatus().isVisible() : null;
    if (
      this.last.multiFilePatch === multiFilePatch &&
      this.last.diffs === diffs &&
      this.last.visible === visible
    ) {
      return false;
    }
    this.update({
      multiFilePatch,
      diffs,
      diffPositionFn,
      translatePositionFn,
    });
    this.last = {
      multiFilePatch,
      diffs,
      visible,
    };
    return true;
  }
  update({ multiFilePatch, diffs, diffPositionFn, translatePositionFn }) {
    const filePatch = multiFilePatch.getPatchForPath(this.nativeRelPath);
    // Comment on a file that used to exist in a PR but no longer does. Skip silently.
    if (!filePatch) {
      this.diffToFilePosition = new Map();
      this.removed = false;
      this.fileTranslations = null;
      this.updateDigest();
      return;
    }

    // This comment was left on a file that was too large to parse.
    if (!filePatch.getRenderStatus().isVisible()) {
      this.diffToFilePosition = new Map();
      this.removed = true;
      this.fileTranslations = null;
      this.updateDigest();
      return;
    }
    this.diffToFilePosition = diffPositionFn(this.rawPositions, filePatch.getRawContentPatch());
    this.removed = false;
    let contentChangeDiff;
    if (diffs.length === 1) {
      contentChangeDiff = diffs[0];
    } else if (diffs.length === 2) {
      const [diff1, diff2] = diffs;
      const SYMLINK_MODE = "120000";
      if (diff1.oldMode === SYMLINK_MODE || diff1.newMode === SYMLINK_MODE) {
        contentChangeDiff = diff2;
      } else {
        contentChangeDiff = diff1;
      }
    }
    if (contentChangeDiff) {
      const filePositions = [...this.diffToFilePosition.values()];
      this.fileTranslations = translatePositionFn(filePositions, contentChangeDiff);
    } else {
      this.fileTranslations = null;
    }
    this.updateDigest();
  }
  updateDigest() {
    const hash = crypto.createHash("sha256");
    hash.update(
      JSON.stringify({
        removed: this.removed,
        diffToFilePosition: [...this.diffToFilePosition.entries()],
        fileTranslations: this.fileTranslations ? [...this.fileTranslations.entries()] : null,
      }),
    );
    this.digest = hash.digest("hex");
  }
}
