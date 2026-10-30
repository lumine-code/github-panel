/** @babel */
/** @jsx h */
import View, { h } from "../etch/view.js";
import SelectBox from "./select-box.js";
import Commands, { Command } from "../lumine/commands.js";
import LumineTextEditor from "../lumine/lumine-text-editor.js";
import RefHolder from "../models/ref-holder.js";
import { unusedProps } from "../helpers.js";
export function makeTabbable(Component, options = {}) {
  return class extends View {
    static propTypes = {
      tabGroup: true,
      autofocus: true,
      commands: true,
      children: true,
    };
    static defaultProps = {
      autofocus: false,
    };
    constructor(props, children) {
      super(props, children);
      this.elementRef = new RefHolder();
      if (options.rootRefProp) {
        this.rootRef = new RefHolder();
        this.rootRefProps = {
          [options.rootRefProp]: this.rootRef,
        };
      } else {
        this.rootRef = this.elementRef;
        this.rootRefProps = {};
      }
      this.initialize();
    }
    render() {
      return (
        <Component
          ref={this.elementRef.setter}
          tabIndex={-1}
          {...unusedProps(this.props, this.constructor.propTypes)}
          {...this.rootRefProps}
          {...(options.passCommands ? { commands: this.props.commands } : {})}
          environment={this.props.environment}
        >
          {this.props.children}
        </Component>
      );
    }
    didMount() {
      this.groupElement = this.elementRef.get();
      this.props.tabGroup.appendElement(this.groupElement, this.props.autofocus);
      this.observeCommands();
    }
    didUpdate(previous) {
      if (previous.commands !== this.props.commands) this.observeCommands();
      if (previous.tabGroup !== this.props.tabGroup) {
        previous.tabGroup.removeElement(this.groupElement);
        this.props.tabGroup.appendElement(this.groupElement, this.props.autofocus);
      }
    }
    observeCommands() {
      this.rootObservation?.dispose();
      this.commandSubscription?.dispose();
      this.rootObservation = this.rootRef.observe((target) => {
        this.commandSubscription?.dispose();
        this.commandSubscription = this.props.commands.add(target, {
          "core:focus-next": this.focusNext,
          "core:focus-previous": this.focusPrevious,
        });
      });
    }
    willDestroy() {
      this.rootObservation?.dispose();
      this.commandSubscription?.dispose();
      if (this.groupElement) this.props.tabGroup.removeElement(this.groupElement);
    }
    focusNext = (e) => {
      this.elementRef.map((element) => this.props.tabGroup.focusAfter(element));
      e.stopPropagation();
    };
    focusPrevious = (e) => {
      this.elementRef.map((element) => this.props.tabGroup.focusBefore(element));
      e.stopPropagation();
    };
  };
}
export const TabbableInput = makeTabbable("input");
export const TabbableButton = makeTabbable("button");
export const TabbableSummary = makeTabbable("summary");
export const TabbableTextEditor = makeTabbable(LumineTextEditor, {
  rootRefProp: "refElement",
});

class OwnerSelect extends View {
  constructor(props, children) {
    super(props, children);
    this.select = new RefHolder();
    this.initialize();
  }
  didMount() {
    this.props.refElement?.setter(this.element);
  }
  willDestroy() {
    this.props.refElement?.setter(null);
  }
  focus() {
    this.select.map((view) => view.focus());
  }
  render() {
    return (
      <span className="github-panel-TabbableWrapper" style={{ display: "contents" }}>
        <SelectBox
          ref={this.select.setter}
          className={this.props.className}
          disabled={this.props.isDisabled}
          value={this.props.value?.id}
          ariaLabel="Repository owner"
          items={this.props.options.map((owner) => ({
            value: owner.id,
            label:
              owner.login +
              (owner.disabled && !owner.placeholder ? " (insufficient permissions)" : ""),
            disabled: owner.disabled,
          }))}
          onDidChange={({ value }) =>
            this.props.onChange(this.props.options.find((owner) => owner.id === value))
          }
        />
        <Commands registry={this.props.commands} target={this.props.refElement}>
          {Object.entries({
            down: "ArrowDown",
            up: "ArrowUp",
            enter: "Enter",
            tab: "Tab",
            backspace: "Backspace",
            pageup: "PageUp",
            pagedown: "PageDown",
            end: "End",
            home: "Home",
            delete: "Delete",
            escape: "Escape",
          }).map(([command, key]) => (
            <Command
              key={command}
              command={"github-panel:selectbox-" + command}
              callback={(event) =>
                this.select.map((view) =>
                  view.controller.onKeyDown({
                    key,
                    preventDefault: () => event.preventDefault(),
                    stopPropagation: () => event.stopPropagation(),
                  }),
                )
              }
            />
          ))}
        </Commands>
      </span>
    );
  }
}
export const TabbableSelect = makeTabbable(OwnerSelect, {
  rootRefProp: "refElement",
  passCommands: true,
});
