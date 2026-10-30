/** @babel */
/** @jsx h */
import { h, View, flushViews, createViewHost } from "./helpers/etch.js";
import { makeTabbable, TabbableButton, TabbableSummary } from "../lib/views/tabbable.js";
import TabGroup from "../lib/tab-group.js";

describe("Tabbable native controls", () => {
  let container, root, tabGroup, commands, registries;

  beforeEach(() => {
    container = document.createElement("div");
    jasmine.attachToDOM(container);
    root = createViewHost(container);
    tabGroup = new TabGroup();
    commands = new lumine.commands.constructor();
    commands.attach(container);
    registries = [commands];
  });

  afterEach(async () => {
    await flushViews(async () => root.destroy());
    for (const registry of registries) registry.destroy();
    container.remove();
  });

  it("renders dialog button labels from JSX children and an explicit children prop", async () => {
    await flushViews(async () =>
      root.update(
        <div>
          <TabbableButton tabGroup={tabGroup} commands={commands}>
            Cancel
          </TabbableButton>
          <TabbableButton tabGroup={tabGroup} commands={commands} children="Publish" />
        </div>,
      ),
    );
    const buttons = container.querySelectorAll("button");
    expect(Array.from(buttons, (button) => button.textContent)).toEqual(["Cancel", "Publish"]);
    expect(buttons[0].parentElement).toBe(buttons[1].parentElement);
    expect(buttons[0].parentElement.children.length).toBe(2);
    expect(buttons[0].tabIndex).toBe(-1);
    expect(buttons[0].children.length).toBe(0);
  });

  it("updates button text and the native disabled state without replacing the control", async () => {
    const clicked = jasmine.createSpy("publish");
    const buttonView = (label, disabled) => (
      <TabbableButton
        tabGroup={tabGroup}
        commands={commands}
        children={label}
        disabled={disabled}
        onClick={clicked}
      />
    );
    await flushViews(async () => root.update(buttonView("Publish", true)));
    const button = container.querySelector("button");
    expect(button.disabled).toBe(true);
    button.click();
    expect(clicked).not.toHaveBeenCalled();

    await flushViews(async () => root.update(buttonView("Publishing…", false)));
    expect(container.querySelector("button")).toBe(button);
    expect(button.textContent).toBe("Publishing…");
    expect(button.disabled).toBe(false);
    button.click();
    expect(clicked).toHaveBeenCalledTimes(1);
  });

  it("renders Advanced as the direct summary and preserves native details toggling", async () => {
    await flushViews(async () =>
      root.update(
        <details>
          <TabbableSummary tabGroup={tabGroup} commands={commands}>
            Advanced
          </TabbableSummary>
          <p>Remote configuration</p>
        </details>,
      ),
    );
    const details = container.querySelector("details");
    const summary = details.querySelector(":scope > summary");
    expect(summary).not.toBeNull();
    expect(summary.textContent).toBe("Advanced");
    expect(details.firstElementChild).toBe(summary);
    expect(details.open).toBe(false);
    summary.click();
    expect(details.open).toBe(true);
    summary.click();
    expect(details.open).toBe(false);
  });

  it("routes focus commands between controls and releases them on destruction", async () => {
    await flushViews(async () =>
      root.update(
        <div>
          <TabbableButton tabGroup={tabGroup} commands={commands} autofocus>
            Cancel
          </TabbableButton>
          <TabbableButton tabGroup={tabGroup} commands={commands}>
            Publish
          </TabbableButton>
        </div>,
      ),
    );
    const [cancel, publish] = container.querySelectorAll("button");
    tabGroup.autofocus();
    expect(document.activeElement).toBe(cancel);
    await commands.dispatch(cancel, "core:focus-next");
    expect(document.activeElement).toBe(publish);
    await commands.dispatch(publish, "core:focus-previous");
    expect(document.activeElement).toBe(cancel);

    await flushViews(async () => root.destroy());
    expect(commands.canDispatch(cancel, "core:focus-next")).toBe(false);
    expect(commands.canDispatch(publish, "core:focus-previous")).toBe(false);
    expect(tabGroup.nodesByElement.size).toBe(0);
  });

  it("binds class controls to their DOM root and refreshes a changed command registry", async () => {
    class FocusControl extends View {
      constructor(props, children) {
        super(props, children);
        this.initialize();
      }
      render() {
        return (
          <div>
            <button ref={this.props.refElement.setter} tabIndex={this.props.tabIndex}>
              Owner
            </button>
          </div>
        );
      }
      focus() {
        this.element.querySelector("button").focus();
      }
    }
    const TabbableControl = makeTabbable(FocusControl, {
      rootRefProp: "refElement",
      passCommands: true,
    });
    let view;
    const controls = (registry) => (
      <div>
        <TabbableControl
          tabGroup={tabGroup}
          commands={registry}
          ref={(control) => (view = control)}
        />
        <TabbableButton tabGroup={tabGroup} commands={registry}>
          Publish
        </TabbableButton>
      </div>
    );
    await flushViews(async () => root.update(controls(commands)));
    const [owner, publish] = container.querySelectorAll("button");
    const control = view.elementRef.get();
    expect(view.rootRef.get()).toBe(owner);
    expect(tabGroup.nodesByElement.has(control)).toBe(true);
    await commands.dispatch(owner, "core:focus-next");
    expect(document.activeElement).toBe(publish);

    const replacement = new lumine.commands.constructor();
    replacement.attach(container);
    registries.push(replacement);
    await flushViews(async () => root.update(controls(replacement)));
    expect(control.props.commands).toBe(replacement);
    expect(commands.canDispatch(owner, "core:focus-next")).toBe(false);
    expect(replacement.canDispatch(owner, "core:focus-next")).toBe(true);
    await replacement.dispatch(publish, "core:focus-previous");
    expect(document.activeElement).toBe(owner);

    const retainedView = view;
    await flushViews(async () => root.destroy());
    retainedView.rootRef.setter(document.createElement("button"));
    expect(replacement.canDispatch(owner, "core:focus-next")).toBe(false);
    expect(replacement.canDispatch(retainedView.rootRef.get(), "core:focus-next")).toBe(false);
    expect(tabGroup.nodesByElement.size).toBe(0);
  });
});
