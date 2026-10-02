/** @babel */
import { h, createViewHost, flushViews } from "./helpers/etch";
import ReviewsController from "../lib/controllers/reviews-controller";

function deferred() {
  let resolve;
  const promise = new Promise((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}
function response(data) {
  return { status: 200, headers: { get: () => null }, json: () => Promise.resolve({ data }) };
}
function failure() {
  return { status: 503, headers: { get: () => null }, text: () => Promise.resolve("Unavailable") };
}

describe("mounted review submission draft safety", () => {
  let host, element, controller, props, requests;

  beforeEach(async () => {
    await lumine.packages.activatePackage("language-text");
    element = document.createElement("div");
    document.body.appendChild(element);
    host = createViewHost(element);
    requests = [];
    spyOn(lumine.window, "isSpecMode").and.returnValue(false);
    spyOn(window, "fetch").and.callFake((_url, options) => {
      const body = JSON.parse(options.body);
      const name = /\bmutation\s+(\w+)/.exec(body.query)[1];
      const pending = deferred();
      const request = {
        promise: pending.promise,
        settled: false,
        name,
        variables: body.variables,
        options,
      };
      request.resolve = (value) => {
        request.settled = true;
        pending.resolve(value);
      };
      requests.push(request);
      return request.promise;
    });
    const endpoint = {
      getHost: () => "github.com",
      getGraphQLRoot: () => "https://api.github.com/graphql",
    };
    const comment = {
      id: "comment",
      path: "example.txt",
      position: null,
      bodyHTML: "<p>Review</p>",
      body: "Review",
      createdAt: "2026-01-01T00:00:00Z",
      url: "https://github.com/a/b/pull/1",
      author: { login: "reviewer", avatarUrl: "", url: "https://github.com/reviewer" },
      viewerCanReact: false,
      viewerCanUpdate: false,
      reactionGroups: [],
    };
    props = {
      host: "github.com",
      owner: "a",
      repo: "b",
      number: 1,
      workdir: "C:/repo",
      endpoint,
      environment: { endpoint, token: "token" },
      viewer: { id: "viewer", login: "alice" },
      repository: { id: "repository" },
      pullRequest: { id: "pr" },
      isAbsent: true,
      summaries: [],
      commentTranslations: null,
      commentThreads: [{ thread: { id: "thread", isResolved: false }, comments: [comment] }],
      commands: lumine.commands,
      tooltips: lumine.tooltips,
      config: lumine.config,
      confirm: () => {},
      refetch: jasmine.createSpy("refetch"),
      reportRelayError: jasmine.createSpy("reportRelayError"),
      ref: (view) => {
        if (view) controller = view;
      },
    };
    await flushViews(() => host.update(h(ReviewsController, props)));
    spyOn(controller, "addSingleComment").and.callThrough();
    await flushViews(() => controller.showThreadID("thread"));
  });

  afterEach(async () => {
    await host.destroy();
    element.remove();
    for (let pass = 0; pass < 4; pass++) {
      const pending = requests.filter((request) => !request.settled);
      if (!pending.length) break;
      pending.forEach((request) => request.resolve(failure()));
      await globalThis.flushMicrotasks();
    }
  });

  function editor() {
    return element.querySelector("lumine-text-editor").getModel();
  }
  function submit(text = "Unsaved reply") {
    editor().setText(text);
    element.querySelector(".github-panel-Review-replyButton").click();
    return controller.addSingleComment.calls.mostRecent().returnValue;
  }
  async function finishReviewCreation() {
    expect(requests[0].name).toBe("addPrReviewMutation");
    requests[0].resolve(
      response({ addPullRequestReview: { reviewEdge: { node: { id: "review" } } } }),
    );
    await flushViews(() => {});
    expect(requests[1].name).toBe("addPrReviewCommentMutation");
  }
  async function finishCleanup(index) {
    expect(requests[index].name).toBe("deletePrReviewMutation");
    requests[index].resolve(response({ deletePullRequestReview: {} }));
    await flushViews(() => {});
  }
  async function finishComment(index = 1) {
    expect(requests[index].name).toBe("addPrReviewCommentMutation");
    requests[index].resolve(
      response({ addPullRequestReviewComment: { commentEdge: { node: { id: "new-comment" } } } }),
    );
    await flushViews(() => {});
    expect(requests[index + 1].name).toBe("submitPrReviewMutation");
  }
  async function finishSubmission(index = 2, reviewID = "review") {
    expect(requests[index].name).toBe("submitPrReviewMutation");
    requests[index].resolve(
      response({ submitPullRequestReview: { pullRequestReview: { id: reviewID } } }),
    );
    await flushViews(() => {});
  }
  async function changeProps(changes) {
    props = { ...props, ...changes };
    await flushViews(() => host.update(h(ReviewsController, props)));
  }

  it("preserves a draft when a comment request fails after the thread collapses", async () => {
    // Do not await the returned mutation until the mocked HTTP stages settle.
    const submission = submit();
    await globalThis.flushMicrotasks();
    await finishReviewCreation();
    await flushViews(() => controller.hideThreadID("thread"));
    expect(element.querySelector("lumine-text-editor")).toBeNull();
    requests[1].resolve(failure());
    await flushViews(() => {});
    await finishCleanup(2);
    await submission;
    await flushViews(() => controller.showThreadID("thread"));
    expect(editor().getText()).toBe("Unsaved reply");
  });

  it("keeps the draft when creating the pending review fails", async () => {
    const submission = submit();
    await flushViews(() => controller.hideThreadID("thread"));
    requests[0].resolve(failure());
    expect(await submission).toBe(false);
    expect(requests.length).toBe(1);
    await flushViews(() => controller.showThreadID("thread"));
    expect(editor().getText()).toBe("Unsaved reply");
    expect(props.reportRelayError).toHaveBeenCalledTimes(1);
  });

  it("keeps the draft and deletes the pending review when submitting it fails", async () => {
    const submission = submit();
    await finishReviewCreation();
    await finishComment();
    await flushViews(() => controller.hideThreadID("thread"));
    requests[2].resolve(failure());
    await flushViews(() => {});
    await finishCleanup(3);
    expect(await submission).toBe(false);
    await flushViews(() => controller.showThreadID("thread"));
    expect(editor().getText()).toBe("Unsaved reply");
    expect(props.reportRelayError).toHaveBeenCalledTimes(1);
  });

  it("clears a collapsed draft only after GitHub confirms the submitted review", async () => {
    const buffer = editor().getBuffer();
    const submission = submit();
    await finishReviewCreation();
    expect(buffer.getText()).toBe("Unsaved reply");
    await flushViews(() => controller.hideThreadID("thread"));
    await finishComment();
    expect(buffer.getText()).toBe("Unsaved reply");
    await finishSubmission();
    expect(await submission).toBe(true);
    expect(buffer.getText()).toBe("");
    expect(element.querySelector("lumine-text-editor")).toBeNull();
    await flushViews(() => controller.showThreadID("thread"));
    expect(editor().getText()).toBe("");
    expect(props.refetch).toHaveBeenCalledTimes(1);
  });

  for (const newerText of ["A newer draft", "Unsaved reply"]) {
    it(`preserves a newer buffer revision containing ${JSON.stringify(newerText)}`, async () => {
      const buffer = editor().getBuffer();
      const submission = submit();
      await finishReviewCreation();
      await flushViews(() => controller.hideThreadID("thread"));
      buffer.setText("An intervening edit");
      buffer.setText(newerText);
      await finishComment();
      await finishSubmission();
      expect(await submission).toBe(true);
      await flushViews(() => controller.showThreadID("thread"));
      expect(editor().getText()).toBe(newerText);
    });
  }

  it("never writes to a draft after its owner was destroyed", async () => {
    const buffer = editor().getBuffer();
    const submission = submit();
    await finishReviewCreation();
    await finishComment();
    await host.destroy();
    expect(buffer.isDestroyed()).toBe(true);
    spyOn(buffer, "setText").and.callThrough();
    await finishSubmission();
    expect(await submission).toBe(true);
    expect(buffer.setText).not.toHaveBeenCalled();
    expect(props.refetch).not.toHaveBeenCalled();
  });

  it("cancels remaining submission stages after the owner disappears", async () => {
    const buffer = editor().getBuffer();
    const submission = submit();
    await finishReviewCreation();
    await host.destroy();
    expect(buffer.isDestroyed()).toBe(true);
    spyOn(buffer, "setText").and.callThrough();
    requests[1].resolve(
      response({ addPullRequestReviewComment: { commentEdge: { node: { id: "new-comment" } } } }),
    );
    await flushViews(() => {});
    await finishCleanup(2);
    expect(await submission).toBe(false);
    expect(requests.some((request) => request.name === "submitPrReviewMutation")).toBe(false);
    expect(buffer.setText).not.toHaveBeenCalled();
    expect(props.reportRelayError).not.toHaveBeenCalled();
  });

  it("does not clear a replacement draft when a removed thread reappears", async () => {
    const originalThreads = props.commentThreads;
    const oldBuffer = editor().getBuffer();
    const submission = submit();
    await finishReviewCreation();
    await finishComment();
    await changeProps({ commentThreads: [] });
    expect(oldBuffer.isDestroyed()).toBe(true);
    spyOn(oldBuffer, "setText").and.callThrough();
    await changeProps({ commentThreads: originalThreads });
    const replacement = editor().getBuffer();
    replacement.setText("Replacement draft");
    await finishSubmission();
    expect(await submission).toBe(true);
    expect(replacement).not.toBe(oldBuffer);
    expect(replacement.getText()).toBe("Replacement draft");
    expect(oldBuffer.setText).not.toHaveBeenCalled();
  });

  it("keeps a new PR draft and its posting state when an old response arrives", async () => {
    const oldBuffer = editor().getBuffer();
    const oldSubmission = submit();
    await finishReviewCreation();
    await finishComment();
    await changeProps({
      number: 2,
      pullRequest: { id: "new-pr" },
      environment: { ...props.environment, token: "new-token" },
    });
    await flushViews(() => controller.showThreadID("thread"));
    const currentBuffer = editor().getBuffer();
    const currentSubmission = submit("New PR draft");
    expect(requests[3].variables.input.pullRequestId).toBe("new-pr");
    expect(requests[3].options.headers.Authorization).toBe("bearer new-token");
    expect(oldBuffer.isDestroyed()).toBe(true);
    await finishSubmission();
    expect(await oldSubmission).toBe(true);
    expect(controller.state.postingToThreadID).toBe("thread");
    expect(currentBuffer.getText()).toBe("New PR draft");
    requests[3].resolve(failure());
    expect(await currentSubmission).toBe(false);
    await flushViews(() => {});
    expect(controller.state.postingToThreadID).toBeNull();
    expect(currentBuffer.getText()).toBe("New PR draft");
  });

  it("cleans an old pending review with its captured credentials after an account switch", async () => {
    const submission = submit();
    await changeProps({
      environment: { ...props.environment, token: "new-token" },
      viewer: { id: "new-viewer" },
    });
    requests[0].resolve(
      response({ addPullRequestReview: { reviewEdge: { node: { id: "old-review" } } } }),
    );
    await flushViews(() => {});
    expect(requests[1].name).toBe("deletePrReviewMutation");
    expect(requests[1].options.headers.Authorization).toBe("bearer token");
    expect(requests[1].variables.input.pullRequestReviewId).toBe("old-review");
    await finishCleanup(1);
    expect(await submission).toBe(false);
    expect(requests.some((request) => request.name === "addPrReviewCommentMutation")).toBe(false);
  });

  it("preserves the same account's draft across credential renewal and a stale success", async () => {
    const buffer = editor().getBuffer();
    const submission = submit();
    await finishReviewCreation();
    await finishComment();
    await changeProps({ environment: { ...props.environment, token: "renewed-token" } });
    expect(editor().getBuffer()).toBe(buffer);
    expect(editor().getText()).toBe("Unsaved reply");
    editor().setText("Draft after renewal");
    await finishSubmission();
    expect(await submission).toBe(true);
    expect(buffer.getText()).toBe("Draft after renewal");
    expect(props.refetch).not.toHaveBeenCalled();
  });

  it("keeps the draft when a successful HTTP response does not confirm submission", async () => {
    const submission = submit();
    await finishReviewCreation();
    await finishComment();
    requests[2].resolve(response({ submitPullRequestReview: null }));
    await flushViews(() => {});
    await finishCleanup(3);
    expect(await submission).toBe(false);
    expect(editor().getText()).toBe("Unsaved reply");
  });
});
