/** @babel */
/* global describe, it, expect */
// Ported from pulsar-edit/github test/models/search.test.js (chai → Jasmine).
import Remote, { nullRemote } from "../lib/models/remote";
import Search from "../lib/models/search";

describe("Search", () => {
  const origin = new Remote("origin", "git@github.com:atom/github.git");

  it("generates a dotcom URL", () => {
    const s = new Search("foo", "repo:smashwilson/remote-repo type:pr something with spaces");
    expect(s.getWebURL(origin)).toBe(
      "https://github.com/search?q=repo%3Asmashwilson%2Fremote-repo%20type%3Apr%20something%20with%20spaces",
    );
  });

  it("throws an error when attempting to generate a dotcom URL from a non-dotcom remote", () => {
    const nonDotCom = new Remote("elsewhere", "git://git.gnupg.org/gnupg.git");

    const s = new Search("zzz", "type:pr is:open");
    expect(() => s.getWebURL(nonDotCom)).toThrowError(/non-GitHub remote/);
  });

  describe("when scoped to a remote", () => {
    it("is a null search when the remote is not present", () => {
      const s = Search.inRemote(nullRemote, "name", "query");
      expect(s.isNull()).toBe(true);
      expect(s.getName()).toBe("name");
    });

    it("prepends a repo: criteria to the search query", () => {
      const s = Search.inRemote(origin, "name", "query");
      expect(s.isNull()).toBe(false);
      expect(s.getName()).toBe("name");
      expect(s.createQuery()).toBe("repo:atom/github query");
    });

    it("uses a default empty list tile", () => {
      expect(Search.inRemote(origin, "name", "query").showCreateOnEmpty()).toBe(false);
    });
  });
});
