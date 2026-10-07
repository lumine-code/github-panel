/** @babel */
require("../lib/index");
import path from "path";
import ReviewsView from "../lib/views/reviews-view";

const percentile = (values, fraction) => {
  const sorted = [...values].sort((a, b) => a - b);
  return Number(sorted[Math.ceil(sorted.length * fraction) - 1].toFixed(3));
};
const elapsed = (start) => Number(process.hrtime.bigint() - start) / 1e6;

describe("GitHub panel rendering performance", () => {
  for (const count of [10, 100]) {
    it(`measures mounting ${count} collapsed review threads`, async () => {
      const stylesheet = lumine.themes.requireStylesheet(
        path.join(__dirname, "..", "styles", "main.css"),
      );
      const container = document.createElement("div");
      container.style.cssText = "width:700px;height:600px;overflow:auto";
      jasmine.attachToDOM(container);
      const props = {
        commands: lumine.commands,
        tooltips: { add: () => ({ dispose() {} }) },
        config: lumine.config,
        checkoutOp: { isEnabled: () => true, why: () => null, run() {} },
        moreContext() {},
        lessContext() {},
        openPR() {},
        showComments() {},
        hideComments() {},
        showSummaries() {},
        hideSummaries() {},
        showThreadID() {},
        hideThreadID() {},
        owner: "owner",
        repo: "repo",
        number: 1,
        summaries: [],
        summarySectionOpen: false,
        commentSectionOpen: true,
        threadIDsOpen: new Set(),
        highlightedThreadIDs: new Set(),
        commentTranslations: null,
        postingToThreadID: null,
        commentThreads: Array.from({ length: count }, (_, index) => ({
          thread: { id: `thread-${index}`, isResolved: false, viewerCanResolve: true },
          comments: [
            {
              id: `comment-${index}`,
              path: `src/file-${index}.txt`,
              position: null,
              isMinimized: true,
              createdAt: "2026-10-01T12:00:00Z",
              author: { login: "reviewer", avatarUrl: "", url: "https://github.com/reviewer" },
            },
          ],
        })),
      };
      const mounts = [];
      let editorCount;
      try {
        for (let cycle = 0; cycle < 31; cycle++) {
          const start = process.hrtime.bigint();
          const view = new ReviewsView(props);
          container.appendChild(view.element);
          lumine.views.performDocumentUpdate();
          if (cycle) mounts.push(elapsed(start));
          editorCount = container.querySelectorAll("lumine-text-editor").length;
          expect(container.querySelectorAll(".github-panel-Review").length).toBe(count);
          expect(editorCount).toBe(0);
          await view.destroy();
          lumine.views.performDocumentUpdate();
          expect(container.children.length).toBe(0);
        }
        console.log(
          "LUMINE_PERFORMANCE=" +
            JSON.stringify({
              renderer: "etch",
              scenario: "collapsed-reviews",
              count,
              mount: { p50: percentile(mounts, 0.5), p95: percentile(mounts, 0.95) },
              samples: mounts.length,
              mountedEditors: editorCount,
              editorsAfterDestroy: container.querySelectorAll("lumine-text-editor").length,
            }),
        );
      } finally {
        container.remove();
        stylesheet.dispose();
      }
    }, 60000);
  }
});
