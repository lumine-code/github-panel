/** @babel */
import {
  requestDeviceCode,
  pollForAccessToken,
  DeviceFlowError,
  getClientId,
  DEFAULT_OAUTH_CLIENT_ID,
  OAUTH_CREDENTIAL_KIND,
  refreshAccessToken,
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
    const requests = [];
    globalThis.fetch = async (...args) => {
      requests.push(args);
      const body = responses[Math.min(i, responses.length - 1)];
      i++;
      return { json: async () => body };
    };
    return requests;
  }

  it("requests a device + user code", async () => {
    const requests = mockFetch([
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
    expect(JSON.parse(requests[0][1].body).scope).toBe("repo read:org user:email offline_access");
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
    const credential = await pollForAccessToken({
      endpoint,
      clientId: "cid",
      deviceCode: "dc",
      interval: 1,
      poll: instant,
    });
    expect(credential).toEqual({
      kind: OAUTH_CREDENTIAL_KIND,
      accessToken: "gho_token",
      refreshToken: null,
      expiresAt: null,
      refreshTokenExpiresAt: null,
      clientId: "cid",
      tokenUrl: "https://github.com/login/oauth/access_token",
    });
  });

  it("keeps the refresh token and both expirations returned by GitHub", async () => {
    const startedAt = Date.now();
    mockFetch([
      {
        access_token: "gho_access",
        expires_in: 28_800,
        refresh_token: "ghr_refresh",
        refresh_token_expires_in: 15_897_600,
      },
    ]);
    const credential = await pollForAccessToken({
      endpoint,
      clientId: "cid",
      deviceCode: "dc",
      interval: 1,
      poll: instant,
    });

    expect(credential.accessToken).toBe("gho_access");
    expect(credential.refreshToken).toBe("ghr_refresh");
    expect(credential.expiresAt).toBeGreaterThanOrEqual(startedAt + 28_800_000);
    expect(credential.refreshTokenExpiresAt).toBeGreaterThanOrEqual(startedAt + 15_897_600_000);
  });

  it("rotates a Device Flow credential without a client secret", async () => {
    let request = null;
    originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, options) => {
      request = { url, body: JSON.parse(options.body) };
      return {
        json: async () => ({
          access_token: "gho_next",
          expires_in: 28_800,
          refresh_token: "ghr_next",
          refresh_token_expires_in: 15_897_600,
        }),
      };
    };

    const credential = await refreshAccessToken({
      kind: OAUTH_CREDENTIAL_KIND,
      accessToken: "gho_old",
      refreshToken: "ghr_old",
      expiresAt: 1,
      refreshTokenExpiresAt: Date.now() + 10_000,
      clientId: "cid",
      tokenUrl: "https://github.com/login/oauth/access_token",
    });

    expect(request).toEqual({
      url: "https://github.com/login/oauth/access_token",
      body: {
        client_id: "cid",
        grant_type: "refresh_token",
        refresh_token: "ghr_old",
      },
    });
    expect(credential.accessToken).toBe("gho_next");
    expect(credential.refreshToken).toBe("ghr_next");
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

  it("resolves the client id from config, falling back to the built-in default", () => {
    expect(getClientId()).toBe(DEFAULT_OAUTH_CLIENT_ID);
    lumine.config.set("github-panel.oauthClientId", "cfg-id");
    try {
      expect(getClientId()).toBe("cfg-id");
    } finally {
      lumine.config.set("github-panel.oauthClientId", "");
    }
  });
});
