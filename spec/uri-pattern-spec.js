/** @babel */
import URIPattern from "../lib/lumine/uri-pattern";
import { getDataFromGithubUrl } from "../lib/views/issueish-link";

// The real PaneItem patterns registered by the item classes. These route every
// `lumine-github://` workspace item, so the WHATWG-URL migration of URIPattern
// must keep matching them and capturing the same params.
const ISSUEISH_PATTERN =
  "lumine-github://issueish/{host}/{owner}/{repo}/{issueishNumber}?workdir={workingDirectory}";
const REVIEWS_PATTERN = "lumine-github://reviews/{host}/{owner}/{repo}/{number}?workdir={workdir}";
const TAB_PATTERN = "lumine-github://dock-item/github";

describe("URIPattern (WHATWG URL migration)", () => {
  it("matches an issueish-detail URI and decodes its captured params", () => {
    // buildURI encodes the workdir, so use an encoded value with a separator and
    // a space to prove the query value is decoded on the way back out.
    const workingDirectory = "C:\\Users\\me\\my repo";
    const uri =
      "lumine-github://issueish/github.com/example/project/1807?workdir=" +
      encodeURIComponent(workingDirectory);

    const match = new URIPattern(ISSUEISH_PATTERN).matches(uri);
    expect(match.ok()).toBe(true);
    expect(match.getParams()).toEqual({
      host: "github.com",
      owner: "example",
      repo: "project",
      issueishNumber: "1807",
      workingDirectory,
    });
  });

  it("matches a reviews URI and captures its params", () => {
    const uri =
      "lumine-github://reviews/github.com/example/project/42?workdir=" +
      encodeURIComponent("/home/me/repo");

    const match = new URIPattern(REVIEWS_PATTERN).matches(uri);
    expect(match.ok()).toBe(true);
    expect(match.getParams()).toEqual({
      host: "github.com",
      owner: "example",
      repo: "project",
      number: "42",
      workdir: "/home/me/repo",
    });
  });

  it("matches the static dock-item tab URI exactly", () => {
    const pattern = new URIPattern(TAB_PATTERN);
    expect(pattern.matches("lumine-github://dock-item/github").ok()).toBe(true);
    expect(pattern.matches("lumine-github://dock-item/other").ok()).toBe(false);
  });

  it("does not match a URI aimed at a different host segment", () => {
    const match = new URIPattern(ISSUEISH_PATTERN).matches(
      "lumine-github://reviews/github.com/example/project/1?workdir=/x",
    );
    expect(match.ok()).toBe(false);
  });

  it("captures a splat of trailing path segments", () => {
    const pattern = new URIPattern("lumine-github://host/root/{segments...}");
    const match = pattern.matches("lumine-github://host/root/foo/bar/baz");
    expect(match.ok()).toBe(true);
    expect(match.getParams()).toEqual({ segments: ["foo", "bar", "baz"] });
  });

  it("captures a single query value but rejects a repeated one", () => {
    const pattern = new URIPattern("lumine-github://hostname?q={value}");
    expect(pattern.matches("lumine-github://hostname?q=foo").getParams()).toEqual({ value: "foo" });
    expect(pattern.matches("lumine-github://hostname?q=one&q=two").ok()).toBe(false);
  });

  it("captures repeated query values with a splat", () => {
    const pattern = new URIPattern("lumine-github://hostname?q={value...}");
    const match = pattern.matches("lumine-github://hostname?q=one&q=two");
    expect(match.ok()).toBe(true);
    expect(match.getParams()).toEqual({ value: ["one", "two"] });
  });

  it("returns a non-match instead of throwing on unparseable input", () => {
    const pattern = new URIPattern(ISSUEISH_PATTERN);
    expect(pattern.matches("not a url").ok()).toBe(false);
    expect(pattern.matches(null).ok()).toBe(false);
    expect(pattern.matches(undefined).ok()).toBe(false);
  });
});

describe("getDataFromGithubUrl (WHATWG URL migration)", () => {
  it("extracts owner/repo/type/number from a github issue or PR URL", () => {
    expect(getDataFromGithubUrl("https://github.com/example/project/pull/1807")).toEqual({
      hostname: "github.com",
      repoOwner: "example",
      repoName: "project",
      type: "pull",
      issueishNumber: 1807,
    });
  });

  it("yields empty fields without throwing for an unparseable URL", () => {
    const data = getDataFromGithubUrl("not a url");
    expect(data.hostname).toBe("");
    expect(isNaN(data.issueishNumber)).toBe(true);
  });
});
