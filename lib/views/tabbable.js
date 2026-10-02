/** @babel */
/** @jsx h */
import View, { h, Fragment } from "../etch/view";
import SelectBox from "./select-box";
import Commands, { Command } from "../lumine/commands";
import LumineTextEditor from "../lumine/lumine-text-editor";
import RefHolder from "../models/ref-holder";
import { unusedProps } from "../helpers";
export function makeTabbable(Component, options = {}) {
  return class extends View {
    static propTypes = {
      tabGroup: true,
      autofocus: true,
      commands: true,
    };
    static defaultProps = {
      autofocus: false,
    };
    constructor(props, children) {
      super(props, children);
      this.rootRef = new RefHolder();
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
      if (options.passCommands) {
        this.commandProps = {
          commands: this.props.commands,
        };
      } else {
        this.commandProps = {};
      }
      this.initialize();
    }
    render() {
      return (
        <span
          style={{
            display: "contents",
          }}
        >
          {
            <Fragment>
              <Commands
                registry={this.props.commands}
                target={this.rootRef}
                environment={this.props.environment}
              >
                <Command
                  command="core:focus-next"
                  callback={this.focusNext}
                  environment={this.props.environment}
                />
                <Command
                  command="core:focus-previous"
                  callback={this.focusPrevious}
                  environment={this.props.environment}
                />
              </Commands>
              <Component
                ref={this.elementRef.setter}
                tabIndex={-1}
                {...unusedProps(this.props, this.constructor.propTypes)}
                {...this.rootRefProps}
                {...this.commandProps}
                environment={this.props.environment}
              />
            </Fragment>
          }
        </span>
      );
    }
    didMount() {
      this.elementRef.map((element) =>
        this.props.tabGroup.appendElement(element, this.props.autofocus),
      );
    }
    willDestroy() {
      this.elementRef.map((element) => this.props.tabGroup.removeElement(element));
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
