/** @babel */
/** @jsx h */
import { h, flushViews, createViewHost } from "./helpers/etch.js";
import OpenIssueishDialog from "../lib/views/open-issueish-dialog.js";
import CreateDialogController from "../lib/controllers/create-dialog-controller.js";
import os from "node:os";
import path from "node:path";

describe("GitHub issue dialog presentation", () => {
  let host, root, view, request, bindings;

  beforeEach(() => {
    jasmine.useRealClock();
    jasmine.attachToDOM(lumine.workspace.getElement());
    host = document.createElement("div");
    document.body.append(host);
    root = createViewHost(host);
    bindings = lumine.keymaps.add(
      "github-dialog-presentation-spec",
      lumine.keymaps.readKeymap(path.join(import.meta.dirname, "../keymaps/main.json")),
    );
    request = {
      accept: jasmine.createSpy("accept").and.resolveTo(undefined),
      cancel: jasmine.createSpy("cancel"),
    };
  });

  afterEach(async () => {
    await flushViews(async () => root.destroy());
    host.remove();
    bindings.dispose();
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
    expect(cancel.disabled).toBe(true);
    await lumine.commands.dispatch(input, "core:cancel");
    expect(request.cancel).not.toHaveBeenCalled();
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
    expect(form.querySelector(".dialog-title").textContent).toBe("Publish GitHub repository");
    const inputs = [...form.querySelectorAll("lumine-text-editor[mini]")];
    const editors = inputs.map((input) => input.getModel());
    expect(inputs.map((input) => input.getAttribute("aria-label"))).toEqual([
      "Repository name",
      "Local path",
      "Source remote name",
    ]);
    const owner = form.querySelector(".github-panel-RepositoryHome-owner");
    owner.click();
    await flushViews(async () => {});
    const popup = document.querySelector(".select-box-context-view");
    expect(popup).not.toBeNull();
    expect(form.closest("lumine-panel").style.display).not.toBe("none");
    expect(request.cancel).not.toHaveBeenCalled();
    popup.querySelector('[role="option"]').click();
    await flushViews(async () => {});
    owner.focus();
    lumine.keymaps.handleKeyboardEvent(
      lumine.keymaps.constructor.buildKeydownEvent("Tab", { target: owner }),
    );
    await flushViews(async () => {});
    expect(inputs[0].hasFocus()).toBe(true);
    let chooseFolder;
    spyOn(lumine.window, "pickFolder").and.returnValue(
      new Promise((resolve) => (chooseFolder = resolve)),
    );
    const windowFocused = spyOn(document, "hasFocus").and.returnValue(false);
    form.querySelector(".github-panel-Dialog-rightBumper").click();
    inputs[0].dispatchEvent(new FocusEvent("focusout", { bubbles: true, relatedTarget: null }));
    window.dispatchEvent(new Event("blur"));
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    expect(form.closest("lumine-panel").style.display).not.toBe("none");
    expect(request.cancel).not.toHaveBeenCalled();
    chooseFolder([localPath]);
    await flushViews(async () => {});
    windowFocused.and.callThrough();
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
    owner.focus();
    lumine.keymaps.handleKeyboardEvent(
      lumine.keymaps.constructor.buildKeydownEvent("Escape", { target: owner }),
    );
    expect(request.cancel).toHaveBeenCalledTimes(1);
  });

  it("dismisses an idle outside click but preserves a pending request", async () => {
    await render(true);
    const form = document.querySelector(".github-panel-Dialog");
    const panel = lumine.workspace
      .getModalPanels()
      .find((item) => item.getElement().contains(form));
    const outside = document.createElement("button");
    document.body.append(outside);
    const clickOutside = async () => {
      outside.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    };
    try {
      await clickOutside();
      expect(panel.isVisible()).toBe(true);
      expect(request.cancel).not.toHaveBeenCalled();
      await render(false);
      await clickOutside();
      expect(panel.isVisible()).toBe(false);
      expect(request.cancel).toHaveBeenCalledTimes(1);
    } finally {
      outside.remove();
    }
  });
});
