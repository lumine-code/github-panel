/** @babel */
import { translateLinesGivenDiff, diffPositionToFilePosition } from "../lib/whats-my-line";

describe("review comment line translation", () => {
  it("translates structured local diff records and invalidates deleted rows", () => {
    const diff = {
      hunks: [
        {
          oldStart: 1,
          oldLines: 2,
          newStart: 1,
          newLines: 3,
          lines: [
            { kind: "context", text: "one" },
            { kind: "added", text: "inserted" },
            { kind: "context", text: "two" },
          ],
        },
        {
          oldStart: 5,
          oldLines: 1,
          newStart: 5,
          newLines: 0,
          lines: [{ kind: "deleted", text: "five" }],
        },
      ],
    };

    expect([...translateLinesGivenDiff([1, 2, 4, 5, 6], diff)]).toEqual([
      [1, { newPosition: 1, invalidated: false }],
      [2, { newPosition: 3, invalidated: false }],
      [4, { newPosition: 5, invalidated: false }],
      [5, { newPosition: 5, invalidated: true }],
      [6, { newPosition: 6, invalidated: false }],
    ]);
  });

  it("places an insertion-only hunk after the row named by its empty old range", () => {
    const diff = {
      hunks: [
        {
          oldStartLine: 3,
          oldLineCount: 0,
          newStartLine: 4,
          newLineCount: 1,
          lines: ["+inserted"],
        },
      ],
    };

    expect([...translateLinesGivenDiff([3, 4], diff)]).toEqual([
      [3, { newPosition: 3, invalidated: false }],
      [4, { newPosition: 5, invalidated: false }],
    ]);
  });

  it("does not consume file rows for legacy or structured no-newline notices", () => {
    const legacy = {
      hunks: [
        {
          oldStartLine: 1,
          oldLineCount: 3,
          newStartLine: 1,
          newLineCount: 3,
          lines: [" one", "-two", "\\ No newline at end of file", "+changed", " three"],
        },
      ],
    };
    const structured = {
      hunks: [
        {
          oldStart: 1,
          oldLines: 3,
          newStart: 1,
          newLines: 3,
          lines: [
            { kind: "context", text: "one" },
            { kind: "deleted", text: "two" },
            { kind: "nonewline" },
            { kind: "added", text: "changed" },
            { kind: "context", text: "three" },
          ],
        },
      ],
    };
    const expected = [
      [1, { newPosition: 1, invalidated: false }],
      [2, { newPosition: 1, invalidated: true }],
      [3, { newPosition: 3, invalidated: false }],
      [4, { newPosition: 4, invalidated: false }],
    ];

    expect([...translateLinesGivenDiff([1, 2, 3, 4], legacy)]).toEqual(expected);
    expect([...translateLinesGivenDiff([1, 2, 3, 4], structured)]).toEqual(expected);
  });

  it("maps an addition after leading deletions to the first new-file row", () => {
    const diff = {
      hunks: [{ newStartLine: 8, lines: ["-old one", "-old two", "+new", " context"] }],
    };
    expect([...diffPositionToFilePosition([1, 2, 3, 4], diff)]).toEqual([
      [1, 8],
      [2, 8],
      [3, 8],
      [4, 9],
    ]);
  });

  it("counts hunk headers and no-newline notices in patch positions only", () => {
    const diff = {
      hunks: [
        {
          newStartLine: 1,
          lines: ["-old", "\\ No newline at end of file", "+new", " context"],
        },
        {
          newStart: 10,
          lines: [
            { kind: "context", text: "ten" },
            { kind: "deleted", text: "old eleven" },
            { kind: "added", text: "new eleven" },
          ],
        },
      ],
    };
    expect([...diffPositionToFilePosition([1, 2, 3, 4, 5, 6, 7, 8], diff)]).toEqual([
      [1, 1],
      [3, 1],
      [4, 2],
      [6, 10],
      [7, 10],
      [8, 11],
    ]);
  });
});
