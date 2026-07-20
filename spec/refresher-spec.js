/** @babel */
/* global describe, beforeEach, afterEach, it, expect, jasmine */
// Ported from pulsar-edit/github test/models/refresher.test.js (chai/sinon → Jasmine).
import Refresher from "../lib/models/refresher";

describe("Refresher", () => {
  let refresher;

  beforeEach(() => {
    refresher = new Refresher();
  });

  afterEach(() => {
    refresher.dispose();
  });

  it("calls the latest retry method registered per key instance when triggered", () => {
    const keyOne = Symbol("one");
    const keyTwo = Symbol("two");

    const one0 = jasmine.createSpy("one0");
    const one1 = jasmine.createSpy("one1");
    const two0 = jasmine.createSpy("two0");

    refresher.setRetryCallback(keyOne, one0);
    refresher.setRetryCallback(keyOne, one1);
    refresher.setRetryCallback(keyTwo, two0);

    refresher.trigger();

    expect(one0).not.toHaveBeenCalled();
    expect(one1).toHaveBeenCalled();
    expect(two0).toHaveBeenCalled();
  });

  it("deregisters a retry callback for a key", () => {
    const keyOne = Symbol("one");
    const keyTwo = Symbol("two");

    const one = jasmine.createSpy("one");
    const two = jasmine.createSpy("two");

    refresher.setRetryCallback(keyOne, one);
    refresher.setRetryCallback(keyTwo, two);

    refresher.deregister(keyOne);

    refresher.trigger();

    expect(one).not.toHaveBeenCalled();
    expect(two).toHaveBeenCalled();
  });

  it("deregisters all retry callbacks on dispose", () => {
    const keyOne = Symbol("one");
    const keyTwo = Symbol("two");

    const one = jasmine.createSpy("one");
    const two = jasmine.createSpy("two");

    refresher.setRetryCallback(keyOne, one);
    refresher.setRetryCallback(keyTwo, two);

    refresher.dispose();
    refresher.trigger();

    expect(one).not.toHaveBeenCalled();
    expect(two).not.toHaveBeenCalled();
  });
});
