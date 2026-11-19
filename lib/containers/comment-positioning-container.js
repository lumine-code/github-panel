/** @babel */
/** @jsx h */
import { provideEnvironment } from "../graphql/environment.js";
import View, { h } from "../etch/view.js";
import crypto from "crypto";
import { translateLinesGivenDiff, diffPositionToFilePosition } from "../whats-my-line.js";
import CommentWorktreeDiffs from "../models/comment-worktree-diffs.js";
import { toNativePathSep } from "../helpers.js";
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
    this.worktree = null;
    this.observedRepository = null;
    this.initialize();
  }
  static deriveState(props, state) {
    const positionsByFile = new Map();
    for (const thread of props.commentThreads) {
      const comment = thread.comments[0];
      if (!comment) continue;
      const relPath = comment.path;
      const commentPath = toNativePathSep(relPath);
      if (!positionsByFile.has(commentPath)) {
        positionsByFile.set(commentPath, {
          relPath,
          positions: new Set(),
        });
      }
      positionsByFile.get(commentPath).positions.add(comment.position);
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
  didMount() {
    this.syncDiffs();
  }

  didUpdate() {
    this.syncDiffs();
  }

  willDestroy() {
    this.repositorySubscription?.dispose();
    this.worktree?.dispose();
  }

  hasCurrentWorktree() {
    const { localRepository, prCommitSha } = this.props;
    return (
      this.worktree &&
      this.worktree.repository === localRepository &&
      this.worktree.core === localRepository.core &&
      this.worktree.revision === prCommitSha
    );
  }

  syncDiffs() {
    const { localRepository, prCommitSha } = this.props;
    if (this.observedRepository !== localRepository) {
      this.repositorySubscription?.dispose();
      this.observedRepository = localRepository;
      this.repositorySubscription = localRepository?.onDidChangeCore?.(() => {
        this.syncDiffs();
        this.invalidate();
      });
    }
    if (!this.hasCurrentWorktree()) {
      this.worktree?.dispose();
      this.worktree = localRepository
        ? new CommentWorktreeDiffs(localRepository, prCommitSha, () => this.invalidate())
        : null;
    }
    this.worktree?.setPaths(this.state.translationsByFile.keys());
  }

  render() {
    const { multiFilePatch, diffPositionToFilePosition, translateLinesGivenDiff } = this.props;
    let translations = null;
    if (multiFilePatch && this.hasCurrentWorktree()) {
      translations = new Map();
      for (const [filePath, translation] of this.state.translationsByFile) {
        const diffs = this.worktree.diffs.get(filePath);
        if (!diffs) continue;
        translation.updateIfNecessary({
          multiFilePatch,
          diffs,
          diffPositionFn: diffPositionToFilePosition,
          translatePositionFn: translateLinesGivenDiff,
        });
        translations.set(filePath, translation);
      }
    }
    return (
      <span style={{ display: "contents" }}>
        {provideEnvironment(this.props.children(translations), this.props.environment)}
      </span>
    );
  }
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
