/** @babel */
import { h, createViewHost, flushViews } from "./helpers/etch";

function deferred() {
  let resolve;
  const promise = new Promise((finish) => {
    resolve = finish;
  });
  return { promise, resolve };
}

function response(data) {
  return { status: 200, headers: { get: () => null }, json: async () => ({ data }) };
}

function failure() {
  return { status: 503, headers: { get: () => null }, text: async () => "Unavailable" };
}

const RAW_DIFF =
  "diff --git a/example.txt b/example.txt\n--- a/example.txt\n+++ b/example.txt\n@@ -1,3 +1,3 @@\n context\n-before\n+after\n tail\n";

describe("GitHub drafts without the patch renderer", () => {
  let host, element, owner, controller, patch, requests, restReads, service, edge, previous;
  let packageMethods, holder, PatchContainer, ReviewsController, reviewProps;

  function moduleDefault(file) {
    const loaded = require(file);
    return loaded.default || loaded;
  }

  beforeEach(async () => {
    await lumine.packages.activatePackage("language-text");
    packageMethods = moduleDefault("../lib/github-package").prototype;
    holder = require("../lib/patch-view");
    PatchContainer = moduleDefault("../lib/containers/pr-patch-container");
    ReviewsController = moduleDefault("../lib/controllers/reviews-controller");
    previous = holder.getPatchView();
    const provider = await lumine.packages.startPackage("patch-view");
    service = provider.mainModule.providePatchView();
    requests = [];
    restReads = 0;
    spyOn(lumine.window, "isSpecMode").and.returnValue(false);
    spyOn(lumine.contextMenu, "show").and.stub();
    spyOn(window, "fetch").and.callFake((_url, options) => {
      if (!options.body) {
        restReads++;
        return Promise.resolve({
          status: 200,
          ok: true,
          headers: { get: () => "etag" },
          text: async () => RAW_DIFF,
        });
      }
      const body = JSON.parse(options.body);
      const pending = deferred();
      const request = {
        name: /\bmutation\s+(\w+)/.exec(body.query)[1],
        variables: body.variables,
        options,
        settled: false,
        resolve(value) {
          this.settled = true;
          pending.resolve(value);
        },
      };
      requests.push(request);
      return pending.promise;
    });
    const endpoint = {
      getHost: () => "github.com",
      getGraphQLRoot: () => "https://api.github.com/graphql",
      getRestURI: (...parts) => `https://api.github.com/${parts.join("/")}`,
    };
    const comment = {
      id: "comment",
      path: "example.txt",
      position: 3,
      body: "Original comment",
      bodyHTML: "<p>Original comment</p>",
      createdAt: "2026-01-01T00:00:00Z",
      url: "https://github.com/a/b/pull/1",
      author: { login: "alice", avatarUrl: "", url: "https://github.com/alice" },
      viewerCanReact: false,
      viewerCanUpdate: true,
      reactionGroups: [],
    };
    reviewProps = {
      host: "github.com",
      owner: "a",
      repo: "b",
      number: 1,
      workdir: "/repository",
      endpoint,
      environment: { endpoint, token: "token" },
      viewer: { id: "viewer", login: "alice" },
      repository: { id: "repository" },
      pullRequest: { id: "pr" },
      isAbsent: true,
      summaries: [],
      commentTranslations: null,
      initThreadID: "thread",
      commentThreads: [{ thread: { id: "thread", isResolved: false }, comments: [comment] }],
      workspace: lumine.workspace,
      commands: lumine.commands,
      keymaps: lumine.keymaps,
      tooltips: lumine.tooltips,
      config: lumine.config,
      confirm() {},
      refetch: jasmine.createSpy("refetch"),
      reportRelayError: jasmine.createSpy("reportRelayError"),
      ref(value) {
        if (value) {
          controller = value;
          owner.controller = value;
        }
      },
    };
    element = document.createElement("div");
    jasmine.attachToDOM(element);
    host = createViewHost(element);
    owner = {
      activated: true,
      element,
      _roots: new WeakMap([[element, host]]),
      controller: null,
      rerender() {
        return host.update(
          h(PatchContainer, {
            owner: "a",
            repo: "b",
            number: 1,
            endpoint,
            token: "token",
            children(error, current) {
              if (error) throw new Error(error);
              patch = current;
              return h(ReviewsController, { ...reviewProps, multiFilePatch: current });
            },
          }),
        );
      },
    };
    edge = packageMethods.consumePatchView.call(owner, service);
    await flushViews(() => {});
    await globalThis.conditionPromise(() => patch && replyEditor());
    spyOn(controller, "addSingleComment").and.callThrough();
    await flushViews(() => controller.invalidate());
  });

  afterEach(async () => {
    await host?.destroy();
    edge?.dispose();
    holder.setPatchView(previous);
    element?.remove();
    for (let pass = 0; pass < 5; pass++) {
      const pending = requests.filter((request) => !request.settled);
      if (!pending.length) break;
      for (const request of pending) request.resolve(failure());
      await globalThis.flushMicrotasks();
    }
  });

  function replyEditor() {
    return element.querySelector(".github-panel-Review-reply lumine-text-editor")?.getModel();
  }

  async function removeRenderer() {
    edge.dispose();
    await flushViews(() => {});
    await globalThis.conditionPromise(() => patch === null);
    await lumine.packages.unloadPackage("patch-view");
  }

  async function restoreRenderer() {
    const provider = await lumine.packages.startPackage("patch-view");
    const current = provider.mainModule.providePatchView();
    expect(current).not.toBe(service);
    service = current;
    edge = packageMethods.consumePatchView.call(owner, current);
    await flushViews(() => {});
    await globalThis.conditionPromise(() => patch !== null);
  }

  function submit(text) {
    const editor = replyEditor();
    editor.selectAll();
    editor.insertText(text);
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

  it("preserves typed reply and edited-comment buffers while replacing only the native preview", async () => {
    const originalController = controller;
    const reply = replyEditor();
    reply.insertText("Unsent reply draft");
    const actions = element.querySelector(".github-panel-Review-actionsMenu");
    actions.click();
    await flushViews(() => lumine.commands.dispatch(actions, "github-panel:edit-review"));
    const commentEditor = element
      .querySelector(".github-panel-Review-editable lumine-text-editor")
      .getModel();
    commentEditor.selectAll();
    commentEditor.insertText("Unsent edited comment");
    const originalPatch = patch;
    const replyBuffer = reply.getBuffer(),
      commentBuffer = commentEditor.getBuffer();

    await removeRenderer();

    expect(owner._roots.get(element)).toBe(host);
    expect(controller).toBe(originalController);
    expect(controller.destroyed).toBe(false);
    expect(replyEditor()).toBe(reply);
    expect(reply.getBuffer()).toBe(replyBuffer);
    expect(replyBuffer.getText()).toBe("Unsent reply draft");
    expect(
      element.querySelector(".github-panel-Review-editable lumine-text-editor").getModel(),
    ).toBe(commentEditor);
    expect(commentBuffer.getText()).toBe("Unsent edited comment");
    expect(replyBuffer.isDestroyed()).toBe(false);
    expect(commentBuffer.isDestroyed()).toBe(false);
    expect(element.querySelector(".github-panel-PatchPreviewView")).toBeNull();
    expect(originalPatch.getBuffer().isDestroyed()).toBe(true);

    await restoreRenderer();

    expect(controller).toBe(originalController);
    expect(replyEditor()).toBe(reply);
    expect(replyBuffer.getText()).toBe("Unsent reply draft");
    expect(
      element.querySelector(".github-panel-Review-editable lumine-text-editor").getModel(),
    ).toBe(commentEditor);
    expect(commentBuffer.getText()).toBe("Unsent edited comment");
    expect(element.querySelector(".github-panel-PatchPreviewView")).not.toBeNull();
    expect(patch).not.toBe(originalPatch);
    expect(restReads).toBe(1);
  });

  for (const succeeds of [false, true]) {
    it(`keeps an in-flight reply's context through renderer reload and ${succeeds ? "clears the confirmed draft" : "preserves the failed draft"}`, async () => {
      const originalController = controller;
      const reply = replyEditor();
      const buffer = reply.getBuffer();
      const submission = submit("Reply sent after renderer reload");
      const activeSubmission = controller.activeSubmission;
      await finishReviewCreation();
      await removeRenderer();
      expect(controller).toBe(originalController);
      expect(controller.activeSubmission).toBe(activeSubmission);
      expect(controller.state.postingToThreadID).toBe("thread");
      expect(replyEditor()).toBe(reply);
      expect(buffer.getText()).toBe("Reply sent after renderer reload");
      await restoreRenderer();
      expect(controller.activeSubmission).toBe(activeSubmission);
      expect(controller.state.postingToThreadID).toBe("thread");
      expect(requests[1].variables.input.inReplyTo).toBe("comment");
      expect(requests[1].options.headers.Authorization).toBe("bearer token");
      if (succeeds) {
        requests[1].resolve(
          response({
            addPullRequestReviewComment: { commentEdge: { node: { id: "new-comment" } } },
          }),
        );
        await flushViews(() => {});
        expect(requests[2].name).toBe("submitPrReviewMutation");
        expect(buffer.getText()).toBe("Reply sent after renderer reload");
        requests[2].resolve(
          response({ submitPullRequestReview: { pullRequestReview: { id: "review" } } }),
        );
      } else {
        requests[1].resolve(failure());
        await flushViews(() => {});
        expect(requests[2].name).toBe("deletePrReviewMutation");
        requests[2].resolve(response({ deletePullRequestReview: {} }));
      }
      expect(await submission).toBe(succeeds);
      await flushViews(() => {});
      expect(controller).toBe(originalController);
      expect(controller.state.postingToThreadID).toBeNull();
      expect(replyEditor()).toBe(reply);
      expect(buffer.getText()).toBe(succeeds ? "" : "Reply sent after renderer reload");
      expect(restReads).toBe(1);
    });
  }
});
