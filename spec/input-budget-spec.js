/** @babel */
import { createRequire } from "node:module";
import { createViewModel } from "./helpers/etch.js";
const require = createRequire(import.meta.url);

describe("GitHub complete form input budgets", () => {
  let view;
  afterEach(async () => {
    await view?.destroy();
    if (view?.url && !view.url.isDestroyed()) view.url.destroy();
  });

  it("rejects oversized URLs before reading and restores availability after shortening", async () => {
    const loaded = require("../lib/views/open-issueish-dialog");
    const accept = jasmine.createSpy("accept");
    view = createViewModel(loaded.default || loaded, { request: { accept } });
    const read = spyOn(view.url, "getText").and.throwError("oversized URL read");
    view.url.setText("x".repeat(4097));
    expect(view.state.acceptEnabled).toBe(false);
    expect(view.parseUrl()).toBe(false);
    await view.accept();
    expect(read).not.toHaveBeenCalled();
    expect(accept).not.toHaveBeenCalled();
    read.and.callThrough();
    view.url.setText("https://github.com/owner/repo/pull/42");
    expect(view.state.acceptEnabled).toBe(true);
    expect(view.parseUrl()).toEqual({ repoOwner: "owner", repoName: "repo", issueishNumber: "42" });
  });

  it("keeps a comment draft and refuses its oversized request without materialization", async () => {
    const loaded = require("../lib/views/actionable-review-view");
    const update = jasmine.createSpy("update");
    view = createViewModel(loaded.default || loaded, {
      originalContent: { id: "comment", body: "original" },
      contentUpdater: update,
      confirm: async () => 1,
    });
    const read = spyOn(view.buffer, "getText").and.throwError("oversized comment read");
    view.buffer.setText("x".repeat(65537));
    await view.onSubmitUpdate();
    await view.onCancel();
    expect(update).not.toHaveBeenCalled();
    expect(read).not.toHaveBeenCalled();
    expect(view.buffer.getLength()).toBe(65537);
  });

  it("preserves a newer draft when an older update fails", async () => {
    const loaded = require("../lib/views/actionable-review-view");
    let reject;
    view = createViewModel(loaded.default || loaded, {
      originalContent: { id: "comment", body: "original" },
      contentUpdater: () =>
        new Promise((_resolve, failure) => {
          reject = failure;
        }),
    });
    view.buffer.setText("submitted");
    const pending = view.onSubmitUpdate();
    view.buffer.setText("newer draft");
    reject(new Error("failed"));
    await pending;
    expect(view.buffer.getText()).toBe("newer draft");
  });
});
