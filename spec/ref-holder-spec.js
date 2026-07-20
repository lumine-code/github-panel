/** @babel */
/* global describe, afterEach, it, expect, jasmine */
// Ported from pulsar-edit/github test/models/ref-holder.test.js (chai/sinon → Jasmine).
import RefHolder from "../lib/models/ref-holder";

describe("RefHolder", () => {
  let sub;

  afterEach(() => {
    if (sub) {
      sub.dispose();
    }
  });

  it("begins empty", () => {
    const h = new RefHolder();
    expect(h.isEmpty()).toBe(true);
    expect(() => h.get()).toThrowError(/empty/);
  });

  it("does not become populated when assigned null", () => {
    const h = new RefHolder();
    h.setter(null);
    expect(h.isEmpty()).toBe(true);
  });

  it("provides synchronous access to its current value", () => {
    const h = new RefHolder();
    h.setter(1234);
    expect(h.isEmpty()).toBe(false);
    expect(h.get()).toBe(1234);
  });

  describe("map", () => {
    it("returns an empty RefHolder as-is", () => {
      const h = new RefHolder();
      expect(h.map(() => 14)).toBe(h);
    });

    it("returns a new RefHolder wrapping the value returned from its present block", () => {
      const h = new RefHolder();
      h.setter(12);
      expect(h.map((x) => x + 1).get()).toBe(13);
    });

    it("returns a RefHolder returned from its present block", () => {
      const h0 = new RefHolder();
      h0.setter(14);

      const o = h0.map(() => {
        const h1 = new RefHolder();
        h1.setter(12);
        return h1;
      });

      expect(o.get()).toBe(12);
    });

    it("returns a new RefHolder wrapping the value returned from its absent block", () => {
      const h = new RefHolder();
      const o = h.map(
        () => 1,
        () => 2,
      );
      expect(o.get()).toBe(2);
    });

    it("returns a RefHolder returned from its absent block", () => {
      const h0 = new RefHolder();
      const o = h0.map(
        () => 1,
        () => {
          const h1 = new RefHolder();
          h1.setter(1);
          return h1;
        },
      );
      expect(o.get()).toBe(1);
    });
  });

  describe("getOr", () => {
    it("returns the RefHolder's value if it is non-empty", () => {
      const h = new RefHolder();
      h.setter(1234);
      expect(h.getOr(5678)).toBe(1234);
    });

    it("returns its argument if the RefHolder is empty", () => {
      const h = new RefHolder();
      expect(h.getOr(5678)).toBe(5678);
    });
  });

  it("notifies subscribers when it becomes available", () => {
    const h = new RefHolder();
    const callback = jasmine.createSpy("callback");
    sub = h.observe(callback);

    h.setter(1);
    expect(callback).toHaveBeenCalledWith(1);

    h.setter(2);
    expect(callback).toHaveBeenCalledWith(2);

    sub.dispose();

    h.setter(3);
    expect(callback).not.toHaveBeenCalledWith(3);
  });

  it("immediately notifies new subscribers if it is already available", () => {
    const h = new RefHolder();
    h.setter(12);

    const callback = jasmine.createSpy("callback");
    sub = h.observe(callback);
    expect(callback).toHaveBeenCalledWith(12);
  });

  it("does not notify subscribers when it is assigned the same value", () => {
    const h = new RefHolder();
    h.setter(12);

    const callback = jasmine.createSpy("callback");
    sub = h.observe(callback);

    callback.calls.reset();
    h.setter(12);
    expect(callback).not.toHaveBeenCalled();
  });

  it("does not notify subscribers when it becomes empty", () => {
    const h = new RefHolder();
    h.setter(12);
    expect(h.isEmpty()).toBe(false);

    const callback = jasmine.createSpy("callback");
    sub = h.observe(callback);

    callback.calls.reset();
    h.setter(null);
    expect(h.isEmpty()).toBe(true);
    expect(callback).not.toHaveBeenCalled();

    callback.calls.reset();
    h.setter(undefined);
    expect(h.isEmpty()).toBe(true);
    expect(callback).not.toHaveBeenCalled();
  });

  it("resolves a promise when it becomes available", async () => {
    const thing = Symbol("Thing");
    const h = new RefHolder();

    const promise = h.getPromise();

    h.setter(thing);
    expect(await promise).toBe(thing);
    expect(await h.getPromise()).toBe(thing);
  });

  describe(".on()", () => {
    it("returns an existing RefHolder as-is", () => {
      const original = new RefHolder();
      const wrapped = RefHolder.on(original);
      expect(original).toBe(wrapped);
    });

    it("wraps a non-RefHolder value with a RefHolder set to it", () => {
      const wrapped = RefHolder.on(9000);
      expect(wrapped.isEmpty()).toBe(false);
      expect(wrapped.get()).toBe(9000);
    });
  });
});
