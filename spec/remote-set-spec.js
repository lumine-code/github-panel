/** @babel */
/* global describe, it, expect, jasmine */
// Ported from pulsar-edit/github test/models/remote-set.test.js (chai → Jasmine).
import RemoteSet from "../lib/models/remote-set";
import Remote from "../lib/models/remote";

describe("RemoteSet", () => {
  const remotes = [
    new Remote("origin", "git@github.com:origin/repo.git"),
    new Remote("upstream", "git@github.com:upstream/repo.git"),
  ];

  it("creates an empty set", () => {
    const set = new RemoteSet();
    expect(set.isEmpty()).toBe(true);
    expect(set.size()).toBe(0);
  });

  it("creates a set containing one or more Remotes", () => {
    const set = new RemoteSet(remotes);
    expect(set.isEmpty()).toBe(false);
    expect(set.size()).toBe(2);
  });

  it("retrieves a Remote from the set by name", () => {
    const set = new RemoteSet(remotes);
    const remote = set.withName("upstream");
    expect(remote).toBe(remotes[1]);
  });

  it("returns a nullRemote for unknown remote names", () => {
    const set = new RemoteSet(remotes);
    const remote = set.withName("unknown");
    expect(remote.isPresent()).toBe(false);
  });

  it("iterates over the Remotes", () => {
    const set = new RemoteSet(remotes);
    expect(Array.from(set)).toEqual(remotes);
  });

  it("filters remotes by a predicate", () => {
    const set0 = new RemoteSet(remotes);
    const set1 = set0.filter((remote) => remote.getName() === "upstream");

    expect(set0).not.toBe(set1);
    expect(set1.withName("upstream").isPresent()).toBe(true);
    expect(set1.withName("origin1").isPresent()).toBe(false);
  });

  it("identifies all remotes that correspond to a GitHub repository", () => {
    const set = new RemoteSet([
      new Remote("no0", "git@github.com:aaa/bbb.git"),
      new Remote("yes1", "git@github.com:xxx/yyy.git"),
      new Remote("yes2", "https://github.com/xxx/yyy.git"),
      new Remote("no3", "git@github.com:aaa/yyy.git"),
      new Remote("no4", "git@elsewhere.com:nnn/qqq.git"),
    ]);

    const chosen = set.matchingGitHubRepository("xxx", "yyy");
    expect(chosen.map((remote) => remote.getName())).toEqual(
      jasmine.arrayWithExactContents(["yes1", "yes2"]),
    );

    expect(set.matchingGitHubRepository("no", "no").length).toBe(0);
  });

  describe("the most-used protocol", () => {
    it("defaults to the first option if no remotes are present", () => {
      expect(new RemoteSet().mostUsedProtocol(["https", "ssh"])).toBe("https");
      expect(new RemoteSet().mostUsedProtocol(["ssh", "https"])).toBe("ssh");
    });

    it("returns the most frequently occurring protocol", () => {
      const set = new RemoteSet([
        new Remote("one", "https://github.com/aaa/bbb.git"),
        new Remote("two", "https://github.com/aaa/ccc.git"),
        new Remote("four", "git@github.com:aaa/bbb.git"),
        new Remote("five", "git@github.com:ddd/zzz.git"),
        new Remote("six", "ssh://git@github.com:aaa/bbb.git"),
      ]);
      expect(set.mostUsedProtocol(["https", "ssh"])).toBe("ssh");
    });

    it("ignores protocols not in the provided set", () => {
      const set = new RemoteSet([
        new Remote("one", "http://github.com/aaa/bbb.git"),
        new Remote("two", "http://github.com/aaa/ccc.git"),
        new Remote("three", "git@github.com:aaa/bbb.git"),
        new Remote("four", "git://github.com:aaa/bbb.git"),
        new Remote("five", "git://github.com:ccc/ddd.git"),
      ]);
      expect(set.mostUsedProtocol(["https", "ssh"])).toBe("ssh");
    });
  });
});
