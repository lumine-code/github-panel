/** @babel */
/** @jsx h */
import { h, flushViews, createViewHost, createViewModel } from "./helpers/etch.js";
import ReviewsView from "../lib/views/reviews-view.js";
import Dialog from "../lib/views/dialog-view.js";

describe("GitHub command routing and availability", () => {
  let roots, elements, models;
  beforeEach(() => {
    roots = [];
    elements = [];
    models = [];
    jasmine.attachToDOM(lumine.workspace.getElement());
  });
  afterEach(async () => {
    for (const root of roots) await flushViews(async () => root.destroy());
    models.forEach((model) => model.willDestroy());
    elements.forEach((element) => element.remove());
  });
  function host() {
    const element = document.createElement("div");
    document.body.appendChild(element);
    elements.push(element);
    const root = createViewHost(element);
    roots.push(root);
    return root;
  }
  function review(id, addSingleComment = () => Promise.resolve()) {
    const element = document.createElement("div"),
      reply = document.createElement("div");
    reply.className = "github-panel-Review-reply";
    reply.dataset.threadId = id;
    element.appendChild(reply);
    lumine.workspace.getElement().appendChild(element);
    elements.push(element);
    const thread = { id },
      comments = [{ id: "comment-" + id, path: "file", position: 1 }];
    const view = createViewModel(ReviewsView, {
      commands: lumine.commands,
      environment: {},
      commentThreads: [{ thread, comments }],
      moreContext() {},
      lessContext() {},
      addSingleComment,
    });
    view.rootHolder.setter(element);
    models.push(view);
    return { view, reply, thread, comments };
  }
  it("dispatches a reply only to its owning review page", async () => {
    const a = review("A"),
      b = review("B");
    a.view.getReplyBuffer("A").setText("draft A");
    b.view.getReplyBuffer("B").setText("draft B");
    a.view.submitCurrentComment = jasmine.createSpy("A");
    b.view.submitCurrentComment = jasmine.createSpy("B");
    await flushViews(async () => {
      host().update(a.view.renderCommands());
      host().update(b.view.renderCommands());
    });
    await lumine.commands.dispatch(a.reply, "github-panel:submit-comment");
    expect(a.view.submitCurrentComment).toHaveBeenCalledTimes(1);
    expect(b.view.submitCurrentComment).not.toHaveBeenCalled();
  });
  it("targets draft validity invalidation without rerendering command registrations", () => {
    const a = review("A"),
      buffer = a.view.getReplyBuffer("A");
    const invalidate = spyOn(lumine.commands, "invalidateAvailability").and.callThrough();
    const render = spyOn(a.view, "invalidate");
    buffer.setText("draft");
    expect(invalidate).toHaveBeenCalledOnceWith({ target: a.view.rootHolder.getOr(null) });
    expect(render).not.toHaveBeenCalled();
  });

  it("uses cached draft validity and disables a pending submission", async () => {
    let finish;
    const request = new Promise((resolve) => (finish = resolve)),
      submit = jasmine.createSpy("HTTP stub").and.returnValue(request);
    const a = review("A", submit),
      buffer = a.view.getReplyBuffer("A");
    const event = { target: a.reply };
    expect(a.view.canSubmitCurrentComment(event)).toBe(false);
    buffer.setText("  ");
    expect(a.view.canSubmitCurrentComment(event)).toBe(false);
    buffer.setText("reply");
    expect(a.view.canSubmitCurrentComment(event)).toBe(true);
    const pending = a.view.submitReply(null, a.thread, a.comments[0]);
    expect(a.view.canSubmitCurrentComment(event)).toBe(false);
    expect(a.view.submitReply(null, a.thread, a.comments[0])).toBe(pending);
    expect(submit).toHaveBeenCalledTimes(1);
    finish();
    await pending;
    expect(a.view.canSubmitCurrentComment(event)).toBe(true);
  });
  it("does not submit disabled busy dialogs through core confirm", async () => {
    const accept = jasmine.createSpy("accept");
    await flushViews(async () =>
      host().update(
        <Dialog
          workspace={lumine.workspace}
          commands={lumine.commands}
          environment={{}}
          tabGroup={{ appendElement() {}, removeElement() {} }}
          accept={accept}
          cancel={() => {}}
          acceptEnabled={false}
          inProgress={true}
        />,
      ),
    );
    const target = document.querySelector(".github-panel-Dialog");
    expect(lumine.commands.canDispatch(target, "core:confirm")).toBe(false);
    await lumine.commands.dispatch(target, "core:confirm");
    expect(accept).not.toHaveBeenCalled();
  });
});
