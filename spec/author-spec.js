/** @babel */
/* global describe, it, expect */
// Ported from pulsar-edit/github test/models/author.test.js (chai → Jasmine).
import Author, { nullAuthor, NO_REPLY_GITHUB_EMAIL } from "../lib/models/author";

describe("Author", () => {
  it("recognizes the no-reply GitHub email address", () => {
    const a0 = new Author("foo@bar.com", "Eh");
    expect(a0.isNoReply()).toBe(false);

    const a1 = new Author(NO_REPLY_GITHUB_EMAIL, "Whatever");
    expect(a1.isNoReply()).toBe(true);
  });

  it("distinguishes authors with a GitHub handle", () => {
    const a0 = new Author("foo@bar.com", "Eh", "handle");
    expect(a0.hasLogin()).toBe(true);

    const a1 = new Author("other@bar.com", "Nah");
    expect(a1.hasLogin()).toBe(false);
  });

  it("implements matching by email address", () => {
    const a0 = new Author("same@same.com", "Zero");
    const a1 = new Author("same@same.com", "One");
    const a2 = new Author("same@same.com", "Two", "two");
    const a3 = new Author("different@same.com", "Three");

    expect(a0.matches(a1)).toBe(true);
    expect(a0.matches(a2)).toBe(true);
    expect(a0.matches(a3)).toBe(false);
    expect(a0.matches(nullAuthor)).toBe(false);
  });

  it("creates the correct avatar urls", () => {
    const a0 = new Author("same@same.com", "Zero");
    const a1 = new Author("0000000+testing@users.noreply.github.com", "One");
    const a2 = new Author("", "Blank Email");
    const a3 = new Author(null, "Null Email");

    expect(a0.getAvatarUrl()).toBe(
      "https://avatars.githubusercontent.com/u/e?email=same%40same.com&s=32",
    );
    expect(a1.getAvatarUrl()).toBe("https://avatars.githubusercontent.com/u/0000000?s=32");
    expect(a2.getAvatarUrl()).toBe("");
    expect(a3.getAvatarUrl()).toBe("");
    expect(nullAuthor.getAvatarUrl()).toBe("");
  });

  it("returns name and email as a string", () => {
    const a0 = new Author("same@same.com", "Zero");
    expect(a0.toString()).toBe("Zero <same@same.com>");
  });

  it("returns name, email, and login as a string", () => {
    const a0 = new Author("same@same.com", "Zero", "handle");
    expect(a0.toString()).toBe("Zero <same@same.com> @handle");
  });

  it("compares names by alphabetical order", () => {
    const a0 = new Author("same@same.com", "Zero");
    const a1 = new Author("same@same.com", "One");
    const a2 = new Author("same@same.com", "Two", "two");

    expect(Author.compare(a0, a0)).toBe(0);
    expect(Author.compare(a0, a1)).toBe(1);
    expect(Author.compare(a1, a2)).toBe(-1);
    expect(Author.compare(a0, nullAuthor)).toBe(1);
  });

  it("returns null author as a string", () => {
    expect(nullAuthor.toString()).toBe("null author");
  });

  it("assumes 2 null authors are equal", () => {
    expect(nullAuthor.matches(nullAuthor)).toBe(true);
  });

  it("assumes nullAuthors are never present", () => {
    expect(nullAuthor.isPresent()).toBe(false);
  });

  it("assumes nullAuthors are never new", () => {
    expect(nullAuthor.isNew()).toBe(false);
  });

  it("assumes nullAuthors don't have logins", () => {
    expect(nullAuthor.hasLogin()).toBe(false);
    expect(nullAuthor.getLogin()).toBe(null);
  });

  it("assumes nullAuthors don't use a no reply email", () => {
    expect(nullAuthor.isNoReply()).toBe(false);
  });
});
