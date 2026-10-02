/** @babel */

// Inlined from @pulsar-edit/whats-my-line to avoid transitive dugite/tar vulnerability.
// Reimplemented without @pulsar-edit/superstring (native C++ addon).
//
// Both entry points take an already-parsed diff. They used to also accept a
// raw diff string and parse it with what-the-diff, but every caller passes an
// object: GitHub API patches use git-panel's parser through the bridge, while
// local repository diffs use core's structured records. Normalize both shapes
// here so review positions stay aligned with the current file.

const lineKind = (line) =>
  typeof line === "string"
    ? {
        "+": "added",
        "-": "deleted",
        " ": "context",
        "\\": "nonewline",
      }[line[0]]
    : line.kind;
export function translateLinesGivenDiff(lines, diffInput) {
  if (!diffInput || !diffInput.hunks) {
    throw new Error("Invalid diff input");
  }
  const diff = diffInput;

  // Record edits in old-file coordinates. A zero-length old range names the
  // row before an insertion, so its first added line belongs at the next row.
  const ops = []; // {oldRow, type:'del'|'add'}
  for (const hunk of diff.hunks) {
    let oldRow = hunk.oldStartLine ?? hunk.oldStart;
    if ((hunk.oldLineCount ?? hunk.oldLines) === 0) oldRow++;
    for (const line of hunk.lines) {
      const kind = lineKind(line);
      if (kind === "deleted") {
        ops.push({
          oldRow,
          type: "del",
        });
        oldRow++;
      } else if (kind === "added") {
        ops.push({
          oldRow,
          type: "add",
        });
      } else if (kind !== "nonewline") {
        oldRow++;
      }
    }
  }

  // For each tracked line, compute its new position and whether it was
  // invalidated (touched by a deletion at that exact row).
  const translations = new Map();
  for (const row of lines) {
    let delta = 0;
    let invalidated = false;
    for (const op of ops) {
      if (op.type === "del") {
        if (op.oldRow === row) {
          invalidated = true;
        }
        if (op.oldRow <= row) {
          delta--;
        }
      } else if (op.type === "add") {
        if (op.oldRow <= row) {
          delta++;
        }
      }
    }
    translations.set(row, {
      newPosition: row + delta,
      invalidated,
    });
  }
  return translations;
}
export function diffPositionToFilePosition(positions, diffInput) {
  if (!diffInput || !diffInput.hunks) {
    throw new Error("Invalid diff input");
  }
  const diff = diffInput;
  const positionSet = new Set(positions);
  const diffToFilePosition = new Map();
  let diffPositionCounter = 0;
  diff.hunks.forEach((hunk) => {
    diffPositionCounter++;
    let filePositionCounter = hunk.newStartLine ?? hunk.newStart;
    let hasNewContent = false;
    hunk.lines.forEach((line) => {
      const kind = lineKind(line);
      if (kind !== "deleted" && kind !== "nonewline") {
        if (hasNewContent) {
          filePositionCounter++;
        }
        hasNewContent = true;
      }

      // A no-newline notice occupies a patch line, but has no file position.
      if (kind !== "nonewline" && positionSet.has(diffPositionCounter)) {
        diffToFilePosition.set(diffPositionCounter, filePositionCounter);
      }
      diffPositionCounter++;
    });
  });
  return diffToFilePosition;
}
