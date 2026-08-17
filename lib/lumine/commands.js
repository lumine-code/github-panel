/** @babel */
/** @jsx React.createElement */
import React from "react";
import { Disposable } from "lumine";

import RefHolder from "../models/ref-holder";

export default class Commands extends React.Component {
  render() {
    const { registry, target } = this.props;
    return (
      <div>
        {React.Children.map(this.props.children, (child) => {
          return child ? React.cloneElement(child, { registry, target }) : null;
        })}
      </div>
    );
  }
}

export class Command extends React.Component {
  constructor(props, context) {
    super(props, context);
    this.subTarget = new Disposable();
    this.subCommand = new Disposable();
  }

  componentDidMount() {
    this.observeTarget(this.props);
  }

  componentDidUpdate(prevProps) {
    if (
      ["registry", "target", "command", "callback", "description"].some(
        (p) => prevProps[p] !== this.props[p],
      )
    ) {
      this.observeTarget(this.props);
    }
  }

  componentWillUnmount() {
    this.subTarget.dispose();
    this.subCommand.dispose();
  }

  observeTarget(props) {
    this.subTarget.dispose();
    this.subTarget = RefHolder.on(props.target).observe((t) => this.registerCommand(t, props));
  }

  // `description` is optional and reaches the registry as a descriptor, which
  // is what puts the command's second line in the palette. A command whose
  // derived label already says everything passes none, and registers as the
  // bare callback it always did.
  registerCommand(target, { registry, command, callback, description }) {
    this.subCommand.dispose();
    this.subCommand = registry.add(
      target,
      command,
      description ? { description, didDispatch: callback } : callback,
    );
  }

  render() {
    return null;
  }
}
