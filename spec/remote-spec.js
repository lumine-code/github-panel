/** @babel */
/* global describe, it, expect */
// Ported from pulsar-edit/github test/models/remote.test.js (chai → Jasmine).
import Remote, { nullRemote } from "../lib/models/remote";

describe("Remote", () => {
  it("detects and extracts information from GitHub repository URLs", () => {
    const urls = [
      ["git@github.com:atom/github.git", "ssh"],
      ["git@github.com:/atom/github.git", "ssh"],
      ["https://github.com/atom/github.git", "https"],
      ["https://git:pass@github.com/atom/github.git", "https"],
      ["ssh+https://github.com/atom/github.git", "ssh+https"],
      ["git://github.com/atom/github", "git"],
      ["ssh://git@github.com:atom/github.git", "ssh"],
      ["ssh://git@github.com:/atom/github.git", "ssh"],
    ];

    for (const [url, proto] of urls) {
      const remote = new Remote("origin", url);

      expect(remote.isPresent()).toBe(true);
      expect(remote.getName()).toBe("origin");
      expect(remote.getNameOr("else")).toBe("origin");
      expect(remote.getUrl()).toBe(url);
      expect(remote.isGithubRepo()).toBe(true);
      expect(remote.getDomain()).toBe("github.com");
      expect(remote.getProtocol()).toBe(proto);
      expect(remote.getOwner()).toBe("atom");
      expect(remote.getRepo()).toBe("github");
      expect(remote.getSlug()).toBe("atom/github");
    }
  });

  it("detects non-GitHub remotes", () => {
    const urls = ["git@gitlab.com:atom/github.git", "atom/github"];

    for (const url of urls) {
      const remote = new Remote("origin", url);

      expect(remote.isPresent()).toBe(true);
      expect(remote.getName()).toBe("origin");
      expect(remote.getNameOr("else")).toBe("origin");
      expect(remote.getUrl()).toBe(url);
      expect(remote.isGithubRepo()).toBe(false);
      expect(remote.getDomain()).toBeNull();
      expect(remote.getOwner()).toBeNull();
      expect(remote.getRepo()).toBeNull();
      expect(remote.getSlug()).toBeNull();
    }
  });

  it("may be created without a URL", () => {
    const remote = new Remote("origin");

    expect(remote.isPresent()).toBe(true);
    expect(remote.getName()).toBe("origin");
    expect(remote.getNameOr("else")).toBe("origin");
    expect(remote.getUrl()).toBeUndefined();
    expect(remote.isGithubRepo()).toBe(false);
    expect(remote.getDomain()).toBeNull();
    expect(remote.getOwner()).toBeNull();
    expect(remote.getRepo()).toBeNull();
    expect(remote.getSlug()).toBeNull();
  });

  it("has a corresponding null object", () => {
    expect(nullRemote.isPresent()).toBe(false);
    expect(nullRemote.getName()).toBe("");
    expect(nullRemote.getUrl()).toBe("");
    expect(nullRemote.isGithubRepo()).toBe(false);
    expect(nullRemote.getDomain()).toBeNull();
    expect(nullRemote.getProtocol()).toBeNull();
    expect(nullRemote.getOwner()).toBeNull();
    expect(nullRemote.getRepo()).toBeNull();
    expect(nullRemote.getSlug()).toBeNull();
    expect(nullRemote.getNameOr("else")).toBe("else");
    expect(nullRemote.getEndpoint()).toBeNull();
    expect(nullRemote.getEndpointOrDotcom().getGraphQLRoot()).toBe(
      "https://api.github.com/graphql",
    );
  });

  describe("getEndpoint", () => {
    it("accesses an Endpoint for the corresponding GitHub host", () => {
      const remote = new Remote("origin", "git@github.com:atom/github.git");
      expect(remote.getEndpoint().getGraphQLRoot()).toBe("https://api.github.com/graphql");
    });

    it("returns null for non-GitHub URLs", () => {
      const elsewhere = new Remote("mirror", "https://me@bitbucket.org/team/repo.git");
      expect(elsewhere.getEndpoint()).toBeNull();
    });
  });

  describe("getEndpointOrDotcom", () => {
    it("accesses the same Endpoint for the corresponding GitHub host", () => {
      const remote = new Remote("origin", "git@github.com:atom/github.git");
      expect(remote.getEndpointOrDotcom().getGraphQLRoot()).toBe("https://api.github.com/graphql");
    });

    it("returns dotcom for non-GitHub URLs", () => {
      const elsewhere = new Remote("mirror", "https://me@bitbucket.org/team/repo.git");
      expect(elsewhere.getEndpointOrDotcom().getGraphQLRoot()).toBe(
        "https://api.github.com/graphql",
      );
    });
  });
});
