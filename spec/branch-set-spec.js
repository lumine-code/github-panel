/** @babel */
/* global describe, beforeEach, it, expect, jasmine */
// Ported from pulsar-edit/github test/models/branch-set.test.js (chai → Jasmine).
import BranchSet from "../lib/models/branch-set";
import Branch, { nullBranch } from "../lib/models/branch";

describe("BranchSet", () => {
  it("earmarks HEAD", () => {
    const bs = new BranchSet();
    bs.add(new Branch("foo"));
    bs.add(
      new Branch("bar", Branch.createRemoteTracking("upstream/bar", "upstream", "refs/heads/bar")),
    );

    const current = new Branch("currentBranch", nullBranch, nullBranch, true);
    bs.add(current);

    expect(bs.getHeadBranch()).toBe(current);
  });

  it("returns a nullBranch if no ref is HEAD", () => {
    const bs = new BranchSet();
    bs.add(new Branch("foo"));
    bs.add(
      new Branch("bar", Branch.createRemoteTracking("upstream/bar", "upstream", "refs/heads/bar")),
    );

    expect(bs.getHeadBranch().isPresent()).toBe(false);
  });

  describe("getPullTargets() and getPushSources()", () => {
    let bs, bar, boo, sharedUpPush, sharedUp, sharedPush;

    beforeEach(() => {
      bs = new BranchSet();

      // A branch with no upstream or push target
      bs.add(new Branch("foo"));

      // A branch with a consistent upstream and push
      bar = new Branch(
        "bar",
        Branch.createRemoteTracking("upstream/bar", "upstream", "refs/heads/bar"),
      );
      bs.add(bar);

      // A branch with an upstream and push that use some weird-ass refspec
      const baz = new Branch(
        "baz",
        Branch.createRemoteTracking("origin/baz", "origin", "refs/heads/remotes/wat/boop"),
      );
      bs.add(baz);

      // A branch with an upstream and push that differ
      boo = new Branch(
        "boo",
        Branch.createRemoteTracking("upstream/boo", "upstream", "refs/heads/fetch-from-here"),
        Branch.createRemoteTracking("origin/boo", "origin", "refs/heads/push-to-here"),
      );
      bs.add(boo);

      // Branches that fetch and push to the same remote ref as other branches
      sharedUpPush = new Branch(
        "shared/up/push",
        Branch.createRemoteTracking("upstream/shared/up/push", "upstream", "refs/heads/shared/up"),
        Branch.createRemoteTracking("origin/shared/up/push", "origin", "refs/heads/shared/push"),
      );
      bs.add(sharedUpPush);

      sharedUp = new Branch(
        "shared/up",
        Branch.createRemoteTracking("upstream/shared/up", "upstream", "refs/heads/shared/up"),
      );
      bs.add(sharedUp);

      sharedPush = new Branch(
        "shared/push",
        Branch.createRemoteTracking("origin/shared/push", "origin", "refs/heads/shared/push"),
      );
      bs.add(sharedPush);
    });

    it("returns empty results for an unknown remote", () => {
      expect(bs.getPullTargets("unknown", "refs/heads/bar").length).toBe(0);
      expect(bs.getPushSources("unknown", "refs/heads/bar").length).toBe(0);
    });

    it("returns empty results for an unknown ref", () => {
      expect(bs.getPullTargets("upstream", "refs/heads/unknown").length).toBe(0);
      expect(bs.getPushSources("origin", "refs/heads/unknown").length).toBe(0);
    });

    it("locates branches that fetch from a remote ref", () => {
      expect(bs.getPullTargets("upstream", "refs/heads/bar")).toEqual([bar]);
    });

    it("locates multiple branches that fetch from the same ref", () => {
      expect(bs.getPullTargets("upstream", "refs/heads/shared/up")).toEqual(
        jasmine.arrayWithExactContents([sharedUpPush, sharedUp]),
      );
    });

    it("locates branches that push to a remote ref", () => {
      expect(bs.getPushSources("origin", "refs/heads/push-to-here")).toEqual([boo]);
    });

    it("locates multiple branches that push to the same ref", () => {
      expect(bs.getPushSources("origin", "refs/heads/shared/push")).toEqual(
        jasmine.arrayWithExactContents([sharedUpPush, sharedPush]),
      );
    });
  });
});
