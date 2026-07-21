/** @babel */
/* global describe, it, expect */
import path from "path";
import {
  autobind,
  extractProps,
  unusedProps,
  toNativePathSep,
  toSentence,
  pushAtKey,
} from "../lib/helpers";

describe("helpers", () => {
  describe("autobind", () => {
    it("binds the named methods to the instance", () => {
      const obj = {
        value: 42,
        getValue() {
          return this.value;
        },
      };
      autobind(obj, "getValue");

      const detached = obj.getValue;
      expect(detached()).toBe(42);
    });

    it("throws when a named method is not a function", () => {
      expect(() => autobind({ notAMethod: 1 }, "notAMethod")).toThrowError(/Unable to autobind/);
    });
  });

  describe("extractProps", () => {
    it("keeps only the props named in the type map", () => {
      const props = { zero: 0, one: 1, two: 2, extra: 3 };
      expect(extractProps(props, { zero: true, one: true, two: true })).toEqual({
        zero: 0,
        one: 1,
        two: 2,
      });
    });

    it("skips undefined props and renames through the name map", () => {
      const props = { a: 1, c: undefined };
      expect(extractProps(props, { a: true, c: true }, { a: "alpha" })).toEqual({ alpha: 1 });
    });
  });

  describe("unusedProps", () => {
    it("returns the props not named in the type map", () => {
      const props = { known: 1, alsoKnown: 2, unknown: 3 };
      expect(unusedProps(props, { known: true, alsoKnown: true })).toEqual({ unknown: 3 });
    });
  });

  describe("toNativePathSep", () => {
    it("converts forward slashes to the platform separator", () => {
      expect(toNativePathSep("a/b/c")).toBe(["a", "b", "c"].join(path.sep));
    });
  });

  describe("toSentence", () => {
    it("renders lists with an Oxford comma", () => {
      expect(toSentence(["toast"])).toBe("toast");
      expect(toSentence(["toast", "eggs"])).toBe("toast and eggs");
      expect(toSentence(["toast", "eggs", "cheese"])).toBe("toast, eggs, and cheese");
      expect(toSentence(["a", "b", "c", "d"])).toBe("a, b, c, and d");
    });
  });

  describe("pushAtKey", () => {
    it("appends to an array stored at the key, creating it when absent", () => {
      const map = new Map();
      pushAtKey(map, "k", 1);
      pushAtKey(map, "k", 2);
      pushAtKey(map, "other", 3);

      expect(map.get("k")).toEqual([1, 2]);
      expect(map.get("other")).toEqual([3]);
    });
  });
});
