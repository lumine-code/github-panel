/** @babel */
import { h, createViewHost, flushViews } from "./helpers/etch";
import ReviewsView from "../lib/views/reviews-view";
import { checkoutStates } from "../lib/controllers/pr-checkout-controller";

describe("native review thread ownership", () => {
  let host, element, props, view;
  beforeEach(async () => {
    await lumine.packages.activatePackage("language-text");
    element = document.createElement("div");
    document.body.appendChild(element);
    host = createViewHost(element);
    const comment = {
      id: "comment",
      path: "example.txt",
      position: null,
      bodyHTML: "<p>A review</p>",
      body: "A review",
      createdAt: "2026-01-01T00:00:00Z",
      url: "https://github.com/a/b/pull/1",
      author: { login: "reviewer", avatarUrl: "", url: "https://github.com/reviewer" },
      viewerCanReact: false,
      viewerCanUpdate: false,
      reactionGroups: [],
    };
    props = {
      owner: "a",
      repo: "b",
      number: 1,
      summaries: [],
      commentThreads: [{ thread: { id: "thread", isResolved: false }, comments: [comment] }],
      threadIDsOpen: new Set(),
      highlightedThreadIDs: new Set(),
      summarySectionOpen: true,
      commentSectionOpen: true,
      postingToThreadID: null,
      commentTranslations: null,
      checkoutOp: {
        isEnabled: () => false,
        why: () => checkoutStates.CURRENT,
        getMessage: () => "Current",
        run: () => {},
      },
      commands: lumine.commands,
      tooltips: lumine.tooltips,
      config: lumine.config,
      confirm: () => {},
      environment: { endpoint: {}, token: "token" },
      openIssueish: () => {},
      moreContext: () => {},
      lessContext: () => {},
      reportRelayError: jasmine.createSpy("reportRelayError"),
      ref: (value) => {
        if (value) view = value;
      },
    };
    props.showThreadID = (id) => {
      props = { ...props, threadIDsOpen: new Set([id]) };
      return host.update(h(ReviewsView, props));
    };
    props.hideThreadID = () => {
      props = { ...props, threadIDsOpen: new Set() };
      return host.update(h(ReviewsView, props));
    };
    await flushViews(() => host.update(h(ReviewsView, props)));
  });
  afterEach(async () => {
    await host.destroy();
    element.remove();
  });

  it("mounts replies on demand and preserves their draft across collapse", async () => {
    expect(element.querySelector("lumine-text-editor")).toBeNull();
    await flushViews(() => props.showThreadID("thread"));
    const first = element.querySelector("lumine-text-editor").getModel();
    first.setText("Unsaved reply");
    const buffer = first.getBuffer();
    await flushViews(() => props.hideThreadID("thread"));
    expect(element.querySelector("lumine-text-editor")).toBeNull();
    expect(first.isDestroyed()).toBe(true);
    expect(buffer.isDestroyed()).toBe(false);
    await flushViews(() => props.showThreadID("thread"));
    const second = element.querySelector("lumine-text-editor").getModel();
    expect(second).not.toBe(first);
    expect(second.getText()).toBe("Unsaved reply");
    await view.destroy();
    expect(second.isDestroyed()).toBe(true);
    expect(buffer.isDestroyed()).toBe(true);
  });
});
