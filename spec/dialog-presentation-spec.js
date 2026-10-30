/** @babel */
/** @jsx h */
import { h, flushViews, createViewHost } from "./helpers/etch.js";
import OpenIssueishDialog from "../lib/views/open-issueish-dialog.js";
import CreateDialogController from "../lib/controllers/create-dialog-controller.js";
import os from "node:os";
import path from "node:path";

describe("GitHub issue dialog presentation", () => {
  let host, root, view, request;

  beforeEach(() => {
    jasmine.attachToDOM(lumine.workspace.getElement());
    host = document.createElement("div");
    document.body.append(host);
    root = createViewHost(host);
    request = {
      accept: jasmine.createSpy("accept").and.resolveTo(undefined),
      cancel: jasmine.createSpy("cancel"),
    };
  });

  afterEach(async () => {
    await flushViews(async () => root.destroy());
    host.remove();
  });

  function render(inProgress = false, error = null) {
    return flushViews(async () =>
      root.update(
        <OpenIssueishDialog
          ref={(instance) => (view = instance)}
          workspace={lumine.workspace}
          commands={lumine.commands}
          environment={{}}
          request={request}
          inProgress={inProgress}
          error={error}
        />,
      ),
    );
  }

  it("preserves the URL and focus through busy and failed states with consistent action order", async () => {
    await render();
    const url = "https://github.com/lumine-code/lumine/issues/1";
    await flushViews(async () => view.url.setText(url));
    const form = document.querySelector(".github-panel-Dialog");
    const input = form.querySelector("lumine-text-editor[mini]");
    const editor = input.getModel();
    const [cancel, accept] = form.querySelectorAll(".dialog-actions button");
    expect(form.getAttribute("role")).toBe("dialog");
    expect(form.getAttribute("aria-label")).toBe("Open Issue or Pull Request");
    expect(input.getAttribute("aria-label")).toBe("Issue or pull request URL");
    expect(form.closest("lumine-panel").classList.contains("dialog-panel")).toBe(true);
    expect(cancel.textContent).toBe("Cancel");
    expect(accept.textContent).toBe("Open Issue or Pull Request");
    expect(getComputedStyle(cancel.parentElement).flexDirection).toBe("row");
    input.focus();
    await lumine.commands.dispatch(input, "core:focus-next");
    expect(document.activeElement).toBe(cancel);
    await lumine.commands.dispatch(cancel, "core:focus-previous");
    expect(input.hasFocus()).toBe(true);

    await render(true);
    expect(form.querySelector("lumine-text-editor")).toBe(input);
    expect(editor.isReadOnly()).toBe(true);
    expect(input.hasFocus()).toBe(true);
    expect(accept.disabled).toBe(true);
    await lumine.commands.dispatch(input, "core:confirm");
    expect(request.accept).not.toHaveBeenCalled();

    await render(false, new Error("The issue could not be opened"));
    expect(editor.isReadOnly()).toBe(false);
    expect(editor.getText()).toBe(url);
    expect(form.querySelector(".dialog-status").textContent).toContain(
      "The issue could not be opened",
    );
    expect(accept.disabled).toBe(false);
    await lumine.commands.dispatch(input, "core:confirm");
    expect(request.accept).toHaveBeenCalledOnceWith(url);
    await flushViews(async () => root.destroy());
    expect(editor.isDestroyed()).toBe(true);
  });

  it("locks every publish field while pending and preserves the complete form for retry", async () => {
    lumine.packages.loadPackage("github-panel");
    let controller;
    const localPath = path.join(os.tmpdir(), "github-dialog-repository");
    request.identifier = "publish";
    request.getParams = () => ({ localDir: localPath, pathEditable: true });
    const user = { id: "owner", login: "example", organizations: { edges: [] } };
    const publish = (inProgress = false, error = null) =>
      flushViews(async () =>
        root.update(
          <CreateDialogController
            ref={(instance) => (controller = instance)}
            workspace={lumine.workspace}
            commands={lumine.commands}
            config={lumine.config}
            environment={{}}
            request={request}
            user={user}
            inProgress={inProgress}
            error={error}
          />,
        ),
      );
    await publish();
    const form = document.querySelector(".github-panel-Dialog");
    expect(form.closest("lumine-panel").classList.contains("dialog-panel-wide")).toBe(true);
    expect(form.querySelector(".dialog-title").textContent).toBe("Publish GitHub repository");
    const inputs = [...form.querySelectorAll("lumine-text-editor[mini]")];
    const editors = inputs.map((input) => input.getModel());
    expect(inputs.map((input) => input.getAttribute("aria-label"))).toEqual([
      "Repository name",
      "Local path",
      "Source remote name",
    ]);
    await flushViews(async () => controller.repoName.setText("published-name"));
    await publish(true);
    expect(editors.every((editor) => editor.isReadOnly())).toBe(true);
    expect([...form.querySelectorAll('input[type="radio"]')].every((radio) => radio.disabled)).toBe(
      true,
    );
    expect(form.querySelector(".dialog-status").textContent).toContain("Publishing repository");
    expect(form.querySelector("button.btn-primary").disabled).toBe(true);

    await publish(false, new Error("Repository already exists"));
    expect(editors.every((editor) => !editor.isReadOnly())).toBe(true);
    expect(controller.localPath.getText()).toBe(localPath);
    expect(controller.repoName.getText()).toBe("published-name");
    expect(form.querySelector(".dialog-status").textContent).toContain("Repository already exists");
    await lumine.commands.dispatch(inputs[0], "core:confirm");
    expect(request.accept).toHaveBeenCalledTimes(1);
    const submitted = request.accept.calls.mostRecent().args[0];
    expect(submitted.name).toBe("published-name");
    expect(submitted.localPath).toBe(localPath);
    expect(submitted.sourceRemoteName).toBe("origin");
    expect(submitted.ownerID).toBe("owner");
  });
});
