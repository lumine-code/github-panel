/** @babel */
/* global describe, it, expect */
// Ported from pulsar-edit/github test/models/branch.test.js (chai → Jasmine).
import Branch, { nullBranch } from "../lib/models/branch";

describe("Branch", () => {
  it("creates a branch with no upstream", () => {
    const b = new Branch("feature");
    expect(b.getName()).toBe("feature");
    expect(b.getShortRef()).toBe("feature");
    expect(b.getFullRef()).toBe("refs/heads/feature");
    expect(b.getRemoteName()).toBe("");
    expect(b.getRemoteRef()).toBe("");
    expect(b.getShortRemoteRef()).toBe("");
    expect(b.getSha()).toBe("");
    expect(b.getUpstream().isPresent()).toBe(false);
    expect(b.getPush().isPresent()).toBe(false);
    expect(b.isHead()).toBe(false);
    expect(b.isDetached()).toBe(false);
    expect(b.isRemoteTracking()).toBe(false);
    expect(b.isPresent()).toBe(true);
  });

  it("creates a branch with an upstream", () => {
    const upstream = new Branch("upstream");
    const b = new Branch("feature", upstream);
    expect(b.getUpstream()).toBe(upstream);
    expect(b.getPush()).toBe(upstream);
  });

  it("creates a branch with separate upstream and push destinations", () => {
    const upstream = new Branch("upstream");
    const push = new Branch("push");
    const b = new Branch("feature", upstream, push);
    expect(b.getUpstream()).toBe(upstream);
    expect(b.getPush()).toBe(push);
  });

  it("creates a head branch", () => {
    const b = new Branch("current", nullBranch, nullBranch, true);
    expect(b.isHead()).toBe(true);
  });

  it("creates a detached branch", () => {
    const b = Branch.createDetached("master~2");
    expect(b.isDetached()).toBe(true);
    expect(b.getFullRef()).toBe("");
  });

  it("creates a remote tracking branch", () => {
    const b = Branch.createRemoteTracking(
      "refs/remotes/origin/feature",
      "origin",
      "refs/heads/feature",
    );
    expect(b.isRemoteTracking()).toBe(true);
    expect(b.getFullRef()).toBe("refs/remotes/origin/feature");
    expect(b.getShortRemoteRef()).toBe("feature");
    expect(b.getRemoteName()).toBe("origin");
    expect(b.getRemoteRef()).toBe("refs/heads/feature");
  });

  it("getShortRef() truncates the refs/<type> prefix from a ref", () => {
    expect(new Branch("refs/heads/feature").getShortRef()).toBe("feature");
    expect(new Branch("heads/feature").getShortRef()).toBe("feature");
    expect(new Branch("feature").getShortRef()).toBe("feature");
  });

  it("getFullRef() reconstructs the full ref name", () => {
    expect(new Branch("refs/heads/feature").getFullRef()).toBe("refs/heads/feature");
    expect(new Branch("heads/feature").getFullRef()).toBe("refs/heads/feature");
    expect(new Branch("feature").getFullRef()).toBe("refs/heads/feature");

    const r0 = Branch.createRemoteTracking(
      "refs/remotes/origin/feature",
      "origin",
      "refs/heads/feature",
    );
    expect(r0.getFullRef()).toBe("refs/remotes/origin/feature");
    const r1 = Branch.createRemoteTracking(
      "remotes/origin/feature",
      "origin",
      "refs/heads/feature",
    );
    expect(r1.getFullRef()).toBe("refs/remotes/origin/feature");
    const r2 = Branch.createRemoteTracking("origin/feature", "origin", "refs/heads/feature");
    expect(r2.getFullRef()).toBe("refs/remotes/origin/feature");
  });

  it("getRemoteName() returns the name of a remote", () => {
    expect(
      Branch.createRemoteTracking("origin/master", "origin", "refs/heads/master").getRemoteName(),
    ).toBe("origin");
    expect(
      Branch.createRemoteTracking("origin/master", undefined, "refs/heads/master").getRemoteName(),
    ).toBe("");
  });

  it("getRemoteRef() returns the name of the remote ref", () => {
    expect(
      Branch.createRemoteTracking("origin/master", "origin", "refs/heads/master").getRemoteRef(),
    ).toBe("refs/heads/master");
    expect(Branch.createRemoteTracking("origin/master", "origin", undefined).getRemoteRef()).toBe(
      "",
    );
  });
});
