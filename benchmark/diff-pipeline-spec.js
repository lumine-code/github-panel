/** @babel */
import path from "path";
import {
  profilePipeline,
  rawReplacement,
  trackBuffers,
  releasePatch,
  started,
  milliseconds,
  memorySample,
  nextUsefulFrame,
  paintOpportunity,
  summarize,
  report,
  noop,
  disposable,
  normalEditorScheduling,
  ensureNormalEditors,
} from "./helpers/pipeline";

describe("expanded GitHub review pipeline benchmark", () => {
  for (const count of [1, 20, 100]) {
    it(`profiles ${count} expanded reviews through patch refreshes and native preview disposal`, async () => {
      const gitPackage = await lumine.packages.startPackage("patch-view");
      require("../lib/index");
      require("../lib/patch-view").setPatchView(gitPackage.mainModule.providePatchView());
      await lumine.packages.activatePackage("language-text");
      const restoreScheduling = normalEditorScheduling();
      const loadedView = require("../lib/views/reviews-view");
      const ReviewsView = loadedView.default || loadedView;
      const build = profilePipeline(gitPackage.path);
      const tracker = trackBuffers();
      const legacyReleased = new Set();
      const stylesheet = lumine.themes.requireStylesheet(
        path.join(__dirname, "..", "styles", "main.css"),
      );
      const container = document.createElement("div");
      container.style.cssText = "width:950px;height:600px;overflow:auto";
      jasmine.attachToDOM(container);
      const fixture = { pairs: 512 };
      const threads = Array.from({ length: count }, (_, index) => ({
        thread: { id: `thread-${index}`, isResolved: false, viewerCanResolve: true },
        comments: [
          {
            id: `comment-${index}`,
            path: "fixture-0.txt",
            position: fixture.pairs + 3 + index,
            isMinimized: true,
            body: "Existing review",
            createdAt: "2026-10-01T12:00:00Z",
            author: { login: "reviewer", avatarUrl: "", url: "" },
          },
        ],
      }));
      const openThreads = new Set(threads.map(({ thread }) => thread.id));
      const propsFor = (patch, expanded = openThreads) => ({
        commands: lumine.commands,
        tooltips: { add: disposable, addComposite: disposable },
        config: lumine.config,
        checkoutOp: { isEnabled: () => true, why: () => null, run: noop },
        moreContext: noop,
        lessContext: noop,
        openPR: noop,
        showComments: noop,
        hideComments: noop,
        showSummaries: noop,
        hideSummaries: noop,
        showThreadID: noop,
        hideThreadID: noop,
        openIssueish: noop,
        refetch: () => disposable(),
        updateComment: noop,
        reportRelayError: noop,
        owner: "fixture-owner",
        repo: "fixture-repo",
        number: 1,
        summaries: [],
        summarySectionOpen: false,
        commentSectionOpen: true,
        threadIDsOpen: expanded,
        highlightedThreadIDs: new Set(),
        commentTranslations: null,
        postingToThreadID: null,
        commentThreads: threads,
        multiFilePatch: patch,
        contextLines: 9,
      });
      const samples = [],
        frames = [],
        retainedByRefresh = [];
      const memoryBefore = await memorySample();
      let currentPatch = null,
        view = null;
      try {
        for (let refresh = 0; refresh < 20; refresh++) {
          ensureNormalEditors(container);
          const raw = rawReplacement({ ...fixture, version: refresh });
          const fullPipeline = started();
          const pipeline = build(raw);
          samples.push(pipeline.times);
          const startedFrame = started();
          const previous = currentPatch;
          currentPatch = pipeline.patch;
          if (view) await view.update(propsFor(currentPatch));
          else {
            view = new ReviewsView(propsFor(currentPatch));
            container.appendChild(view.element);
          }
          const constructOrUpdateMs = milliseconds(startedFrame);
          const useful = await nextUsefulFrame(container);
          const firstUsefulFrameMs = milliseconds(startedFrame);
          const rawToUsefulFrameMs = milliseconds(fullPipeline);
          await paintOpportunity();
          const secondRafOpportunityMs = milliseconds(startedFrame);
          releasePatch(previous, legacyReleased);
          expect(container.querySelectorAll(".github-panel-Review").length).toBe(count);
          expect(useful.editors).toBe(count * 2);
          expect(
            [...container.querySelectorAll("lumine-text-editor")].every(
              (element) => !element.isUpdatedSynchronously(),
            ),
          ).toBe(true);
          expect(useful.renderedRows).toBeLessThan(count * 100);
          expect(container.querySelector("lumine-text-editor").getModel().getText()).toContain(
            `current_${refresh}`,
          );
          frames.push({
            constructOrUpdateMs,
            firstUsefulFrameMs,
            rawToUsefulFrameMs,
            secondRafOpportunityMs,
            renderedRows: useful.renderedRows,
          });
          retainedByRefresh.push(tracker.sample());
        }
        const memoryOpen = await memorySample();
        await view.update(propsFor(currentPatch, new Set()));
        await nextUsefulFrame(container);
        expect(container.querySelectorAll("lumine-text-editor").length).toBe(0);
        const buffersCollapsed = tracker.sample();
        await view.update(propsFor(currentPatch));
        await nextUsefulFrame(container);
        expect(container.querySelectorAll("lumine-text-editor").length).toBe(count * 2);
        const buffersReopened = tracker.sample();
        await view.destroy();
        view = null;
        releasePatch(currentPatch, legacyReleased);
        currentPatch = null;
        await nextUsefulFrame(container);
        const buffersClosed = tracker.sample();
        const memoryClosed = await memorySample();
        expect(buffersClosed.liveRetainedBuffers).toBe(0);
        report(`expanded-${count}-reviews`, {
          package: "github-panel",
          count,
          refreshes: samples.length,
          minimizedCommentBodies: true,
          pipelineCpuMs: summarize(samples),
          nativeAndFrameMs: summarize(frames),
          retainedByRefresh,
          buffersCollapsed,
          buffersReopened,
          buffersClosed,
          memoryBefore,
          memoryOpen,
          memoryClosed,
          compositorMeasured: false,
          nativeSamples: frames,
          baselinePath: __dirname.includes("large-diff-baseline"),
        });
        expect(container.querySelectorAll("lumine-text-editor").length).toBe(0);
      } finally {
        await view?.destroy();
        releasePatch(currentPatch, legacyReleased);
        tracker.cleanup();
        restoreScheduling();
        container.remove();
        stylesheet.dispose();
      }
    }, 120000);
  }
});
