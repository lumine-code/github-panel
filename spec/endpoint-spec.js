/** @babel */
/* global describe, beforeEach, it, expect */
// Ported from pulsar-edit/github test/models/endpoint.test.js (chai → Jasmine).
import { getEndpoint } from "../lib/models/endpoint";

describe("Endpoint", () => {
  describe("on dotcom", () => {
    let dotcom;

    beforeEach(() => {
      dotcom = getEndpoint("github.com");
    });

    it("identifies the GraphQL resource URI", () => {
      expect(dotcom.getGraphQLRoot()).toBe("https://api.github.com/graphql");
    });

    it("identifies the REST base resource URI", () => {
      expect(dotcom.getRestRoot()).toBe("https://api.github.com");
      expect(dotcom.getRestURI()).toBe("https://api.github.com");
    });

    it("joins additional path segments to a REST URI", () => {
      expect(dotcom.getRestURI("sub", "re?source")).toBe("https://api.github.com/sub/re%3Fsource");
    });

    it("accesses the hostname", () => {
      expect(dotcom.getHost()).toBe("github.com");
    });

    it("accesses a login model account", () => {
      expect(dotcom.getLoginAccount()).toBe("https://api.github.com");
    });
  });

  describe("an enterprise instance", () => {
    let enterprise;

    beforeEach(() => {
      enterprise = getEndpoint("github.horse");
    });

    it("identifies the GraphQL resource URI", () => {
      expect(enterprise.getGraphQLRoot()).toBe("https://github.horse/api/v3/graphql");
    });

    it("identifies the REST base resource URI", () => {
      expect(enterprise.getRestRoot()).toBe("https://github.horse/api/v3");
      expect(enterprise.getRestURI()).toBe("https://github.horse/api/v3");
    });

    it("joins additional path segments to the REST URI", () => {
      expect(enterprise.getRestURI("sub", "re?source")).toBe(
        "https://github.horse/api/v3/sub/re%3Fsource",
      );
    });

    it("accesses the hostname", () => {
      expect(enterprise.getHost()).toBe("github.horse");
    });

    it("accesses a login model key", () => {
      expect(enterprise.getLoginAccount()).toBe("https://github.horse");
    });
  });
});
