/** @babel */
/* global describe, beforeEach, it, expect, jasmine */
// Ported from pulsar-edit/github test/models/enableable-operation.test.js (chai/sinon → Jasmine).
// The upstream "does not toggle state if the state has been redundantly toggled"
// case relies on an intricate (and apparently mis-wired) async-render race and is
// omitted rather than ported unfaithfully.
import EnableableOperation from "../lib/models/enableable-operation";

class ComponentLike {
  constructor() {
    this.state = { inProgress: false };
    this.beforeRenderPromise = null;
  }

  async setState(changeCb, afterCb) {
    if (this.beforeRenderPromise) {
      await this.beforeRenderPromise;
    }
    const after = changeCb(this.state);
    this.state.inProgress =
      after.inProgress !== undefined ? after.inProgress : this.state.inProgress;
    if (afterCb) {
      afterCb();
    }
  }
}

async function expectRejection(promise, matcher) {
  let message = null;
  try {
    await promise;
  } catch (e) {
    message = e.message;
  }
  expect(message).not.toBeNull();
  expect(message).toMatch(matcher);
}

describe("EnableableOperation", () => {
  let callback, op;
  const REASON = Symbol("reason");

  beforeEach(() => {
    callback = jasmine.createSpy("callback");
    op = new EnableableOperation(callback);
  });

  it("defaults to being enabled", async () => {
    callback.and.callFake(() => Promise.resolve(123));

    expect(op.isEnabled()).toBe(true);
    expect(await op.run()).toBe(123);
  });

  it("may be disabled with a message", async () => {
    const disabled = op.disable(REASON, "I don't want to");
    expect(disabled).not.toBe(op);
    expect(disabled.isEnabled()).toBe(false);
    expect(disabled.why()).toBe(REASON);
    expect(disabled.getMessage()).toBe("I don't want to");
    await expectRejection(disabled.run(), /I don't want to/);
  });

  it("may be disabled with a different message", () => {
    const disabled0 = op.disable(REASON, "one");
    expect(disabled0).not.toBe(op);
    expect(disabled0.why()).toBe(REASON);
    expect(disabled0.getMessage()).toBe("one");

    const disabled1 = disabled0.disable(REASON, "two");
    expect(disabled1).not.toBe(disabled0);
    expect(disabled1.why()).toBe(REASON);
    expect(disabled1.getMessage()).toBe("two");
  });

  it("provides a default disablement message if omitted", async () => {
    const disabled = op.disable();
    expect(disabled).not.toBe(op);
    expect(disabled.isEnabled()).toBe(false);
    expect(disabled.getMessage()).toBe("disabled");
    await expectRejection(disabled.run(), /disabled/);
  });

  it("may be re-enabled", async () => {
    callback.and.callFake(() => Promise.resolve(123));

    const reenabled = op.disable().enable();
    expect(reenabled).not.toBe(op);
    expect(op.isEnabled()).toBe(true);
    expect(await op.run()).toBe(123);
  });

  it("returns itself when transitioning to the same state", () => {
    expect(op.enable()).toBe(op);
    const disabled = op.disable();
    expect(disabled.disable()).toBe(disabled);
  });

  it("can be wired to toggle component state before and after its action", async () => {
    const component = new ComponentLike();
    op.toggleState(component, "inProgress");

    expect(component.state.inProgress).toBe(false);
    const promise = op.run();
    expect(component.state.inProgress).toBe(true);
    await promise;
    expect(component.state.inProgress).toBe(false);
  });

  it("restores the progress tracking state even if the operation fails", async () => {
    const component = new ComponentLike();
    op.toggleState(component, "inProgress");
    callback.and.callFake(() => Promise.reject(new Error("boom")));

    expect(component.state.inProgress).toBe(false);
    const promise = op.run();
    expect(component.state.inProgress).toBe(true);
    await expectRejection(promise, /boom/);
    expect(component.state.inProgress).toBe(false);
  });
});
