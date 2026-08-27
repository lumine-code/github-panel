/** @babel */
import GithubLoginModel from "../lib/models/github-login-model";
import { DeviceFlowError, OAUTH_CREDENTIAL_KIND } from "../lib/models/github-device-flow";
import { UNAUTHENTICATED, UNAUTHORIZED } from "../lib/shared/token-status";

// A minimal in-memory stand-in for lumine.secrets so the model can be exercised
// without the OS keychain.
function fakeSecrets() {
  const map = new Map();
  const callbacks = new Set();
  return {
    async get(key) {
      return map.has(key) ? map.get(key) : null;
    },
    async set(key, value) {
      map.set(key, value);
      for (const callback of callbacks) callback({ key });
    },
    async delete(key) {
      if (map.delete(key)) {
        for (const callback of callbacks) callback({ key });
      }
    },
    onDidChange(callback) {
      callbacks.add(callback);
      return { dispose: () => callbacks.delete(callback) };
    },
  };
}

function oauthCredential(overrides = {}) {
  return {
    kind: OAUTH_CREDENTIAL_KIND,
    accessToken: "gho_old",
    refreshToken: "ghr_old",
    expiresAt: 1_000,
    refreshTokenExpiresAt: 100_000,
    clientId: "cid",
    tokenUrl: "https://github.com/login/oauth/access_token",
    ...overrides,
  };
}

describe("GithubLoginModel", () => {
  it("stores, reads back, and removes a token through the core secret store", async () => {
    const secrets = fakeSecrets();
    const model = new GithubLoginModel({ secrets });
    // A non-URL account skips the network scope check, exercising just storage.
    const account = "test-account";

    expect(await model.getToken(account)).toBe(UNAUTHENTICATED);

    await model.setToken(account, "sekret");
    expect(await model.getToken(account)).toBe("sekret");
    expect(JSON.parse(await secrets.get("lumine-github:test-account"))).toEqual({
      kind: "github-pat",
      accessToken: "sekret",
    });

    await model.removeToken(account);
    expect(await model.getToken(account)).toBe(UNAUTHENTICATED);

    model.destroy();
  });

  it("rejects the preproduction store's old unstructured token format", async () => {
    const secrets = fakeSecrets();
    await secrets.set("lumine-github:test-account", "old-token");
    const model = new GithubLoginModel({ secrets });

    expect(await model.getToken("test-account")).toBe(UNAUTHENTICATED);
    model.destroy();
  });

  it("refreshes and persists an OAuth credential before its access token expires", async () => {
    const secrets = fakeSecrets();
    const refreshed = oauthCredential({
      accessToken: "gho_next",
      refreshToken: "ghr_next",
      expiresAt: 2_000_000,
      refreshTokenExpiresAt: 20_000_000,
    });
    const refresh = jasmine.createSpy("refresh").and.returnValue(Promise.resolve(refreshed));
    const model = new GithubLoginModel({
      secrets,
      refresh,
      now: () => 10_000,
      withRefreshLock: (_account, callback) => callback(),
    });
    model.getScopes = async () => model.constructor.REQUIRED_SCOPES;
    const account = "https://api.github.com";
    const original = oauthCredential();
    await model.setToken(account, original);

    expect(await model.getToken(account)).toBe("gho_next");
    expect(refresh).toHaveBeenCalledOnceWith(original);
    expect(JSON.parse(await secrets.get(model.keyFor(account)))).toEqual(refreshed);
    model.destroy();
  });

  it("refreshes an OAuth credential after an unexpected 401", async () => {
    const secrets = fakeSecrets();
    const original = oauthCredential({ expiresAt: 1_000_000 });
    const refreshed = oauthCredential({
      accessToken: "gho_next",
      refreshToken: "ghr_next",
      expiresAt: 2_000_000,
    });
    const model = new GithubLoginModel({
      secrets,
      refresh: async () => refreshed,
      now: () => 1_000,
      withRefreshLock: (_account, callback) => callback(),
    });
    model.getScopes = async (_account, token) =>
      token === original.accessToken ? UNAUTHORIZED : model.constructor.REQUIRED_SCOPES;
    const account = "https://api.github.com";
    await model.setToken(account, original);

    expect(await model.getToken(account)).toBe("gho_next");
    model.destroy();
  });

  it("deduplicates concurrent refreshes in one window", async () => {
    const secrets = fakeSecrets();
    const refreshed = oauthCredential({ accessToken: "gho_next", expiresAt: 2_000_000 });
    let resolveRefresh;
    const refresh = jasmine.createSpy("refresh").and.returnValue(
      new Promise((resolve) => {
        resolveRefresh = resolve;
      }),
    );
    const model = new GithubLoginModel({
      secrets,
      refresh,
      now: () => 10_000,
      withRefreshLock: (_account, callback) => callback(),
    });
    model.getScopes = async () => model.constructor.REQUIRED_SCOPES;
    const account = "https://api.github.com";
    await model.setToken(account, oauthCredential());

    const first = model.getToken(account);
    const second = model.getToken(account);
    await Promise.resolve();
    resolveRefresh(refreshed);

    expect(await Promise.all([first, second])).toEqual(["gho_next", "gho_next"]);
    expect(refresh).toHaveBeenCalledTimes(1);
    model.destroy();
  });

  it("serializes refresh rotation between independent window models", async () => {
    expect(globalThis.navigator.locks).toBeDefined();
    const secrets = fakeSecrets();
    const refreshed = oauthCredential({ accessToken: "gho_next", expiresAt: 2_000_000 });
    const refresh = jasmine.createSpy("refresh").and.returnValue(Promise.resolve(refreshed));
    const options = { secrets, refresh, now: () => 10_000 };
    const firstModel = new GithubLoginModel(options);
    const secondModel = new GithubLoginModel(options);
    firstModel.getScopes = async () => firstModel.constructor.REQUIRED_SCOPES;
    secondModel.getScopes = async () => secondModel.constructor.REQUIRED_SCOPES;
    const account = "https://api.github.com";
    await firstModel.setToken(account, oauthCredential());

    expect(
      await Promise.all([firstModel.getToken(account), secondModel.getToken(account)]),
    ).toEqual(["gho_next", "gho_next"]);
    expect(refresh).toHaveBeenCalledTimes(1);
    firstModel.destroy();
    secondModel.destroy();
  });

  it("invalidates the model five minutes before an OAuth access token expires", async () => {
    const secrets = fakeSecrets();
    let scheduled = null;
    const model = new GithubLoginModel({
      secrets,
      now: () => 10_000,
      setTimer: (callback, delay) => {
        scheduled = { callback, delay, handle: Symbol("timer") };
        return scheduled.handle;
      },
      clearTimer: () => {},
    });
    let updates = 0;
    model.onDidUpdate(() => updates++);
    await model.setToken("test-account", oauthCredential({ expiresAt: 1_000_000 }));
    updates = 0;

    expect(await model.getToken("test-account")).toBe("gho_old");
    expect(scheduled.delay).toBe(690_000);
    scheduled.callback();
    expect(updates).toBe(1);
    model.destroy();
  });

  it("asks for sign-in when the refresh token has been rejected", async () => {
    const secrets = fakeSecrets();
    const model = new GithubLoginModel({
      secrets,
      refresh: async () => {
        throw new DeviceFlowError("bad refresh token", "bad_refresh_token");
      },
      now: () => 10_000,
      withRefreshLock: (_account, callback) => callback(),
    });
    const account = "https://api.github.com";
    await model.setToken(account, oauthCredential());

    expect(await model.getToken(account)).toBe(UNAUTHENTICATED);
    model.destroy();
  });

  it("notifies observers when a token changes", async () => {
    const secrets = fakeSecrets();
    const model = new GithubLoginModel({ secrets });
    let updates = 0;
    const sub = model.onDidUpdate(() => updates++);

    await model.setToken("test-account", "sekret");
    await model.removeToken("test-account");
    expect(updates).toBe(2);

    sub.dispose();
    model.destroy();
  });
});
