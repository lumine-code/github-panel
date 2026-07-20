/** @babel */
/* global describe, afterEach, it, expect */
import {
  requestDeviceCode,
  pollForAccessToken,
  DeviceFlowError,
  getClientId,
} from "../lib/models/github-device-flow";

const endpoint = { getWebRoot: () => "https://github.com" };
const instant = () => Promise.resolve();

describe("github device flow", () => {
  let originalFetch;

  afterEach(() => {
    if (originalFetch) {
      globalThis.fetch = originalFetch;
      originalFetch = undefined;
    }
  });

  function mockFetch(responses) {
    originalFetch = globalThis.fetch;
    let i = 0;
    globalThis.fetch = async () => {
      const body = responses[Math.min(i, responses.length - 1)];
      i++;
      return { json: async () => body };
    };
  }

  it("requests a device + user code", async () => {
    mockFetch([
      {
        device_code: "dc",
        user_code: "ABCD-1234",
        verification_uri: "https://github.com/login/device",
        interval: 5,
        expires_in: 900,
      },
    ]);
    const data = await requestDeviceCode({ endpoint, clientId: "cid" });
    expect(data.user_code).toBe("ABCD-1234");
  });

  it("throws a DeviceFlowError when the device-code request errors", async () => {
    mockFetch([{ error: "unauthorized_client", error_description: "bad client" }]);
    let error = null;
    try {
      await requestDeviceCode({ endpoint, clientId: "cid" });
    } catch (e) {
      error = e;
    }
    expect(error instanceof DeviceFlowError).toBe(true);
    expect(error.message).toBe("bad client");
  });

  it("polls past authorization_pending until the token is issued", async () => {
    mockFetch([
      { error: "authorization_pending" },
      { error: "authorization_pending" },
      { access_token: "gho_token" },
    ]);
    const token = await pollForAccessToken({
      endpoint,
      clientId: "cid",
      deviceCode: "dc",
      interval: 1,
      poll: instant,
    });
    expect(token).toBe("gho_token");
  });

  it("maps access_denied to a DeviceFlowError", async () => {
    mockFetch([{ error: "access_denied" }]);
    let message = null;
    try {
      await pollForAccessToken({ endpoint, clientId: "cid", deviceCode: "dc", poll: instant });
    } catch (e) {
      message = e.message;
    }
    expect(message).toMatch(/denied/i);
  });

  it("resolves the client id from config, or null when unset", () => {
    expect(getClientId()).toBe(null);
    atom.config.set("github-panel.oauthClientId", "cfg-id");
    try {
      expect(getClientId()).toBe("cfg-id");
    } finally {
      atom.config.set("github-panel.oauthClientId", "");
    }
  });
});
