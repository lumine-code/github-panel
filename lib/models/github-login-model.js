/** @babel */
import crypto from "crypto";
import { Disposable, Emitter } from "lumine";

import { UNAUTHENTICATED, INSUFFICIENT, UNAUTHORIZED } from "../shared/token-status";
import { DeviceFlowError, OAUTH_CREDENTIAL_KIND, refreshAccessToken } from "./github-device-flow";

// Tokens are persisted through the editor's core secret store (`lumine.secrets`),
// which encrypts them at rest with the OS keychain. They are namespaced under a
// single service so multiple GitHub endpoints (github.com, Enterprise) can each
// keep their own token, keyed by account (the API host).
const SERVICE = "lumine-github";
const PAT_CREDENTIAL_KIND = "github-pat";
const REFRESH_SKEW_MS = 5 * 60 * 1000;

let instance = null;

function defaultWithRefreshLock(account, callback) {
  const locks = globalThis.navigator?.locks;
  if (locks) {
    return locks.request(`${SERVICE}:refresh:${account}`, callback);
  }
  return callback();
}

function normalizeCredential(value) {
  const credential =
    typeof value === "string" ? { kind: PAT_CREDENTIAL_KIND, accessToken: value } : { ...value };
  if (
    (credential.kind !== PAT_CREDENTIAL_KIND && credential.kind !== OAUTH_CREDENTIAL_KIND) ||
    typeof credential.accessToken !== "string" ||
    credential.accessToken.length === 0
  ) {
    throw new TypeError("Invalid GitHub credential");
  }
  return credential;
}

function parseCredential(value) {
  if (!value) return null;
  try {
    return normalizeCredential(JSON.parse(value));
  } catch {
    return null;
  }
}

function serializeCredential(value) {
  return JSON.stringify(normalizeCredential(value));
}

export default class GithubLoginModel {
  // Require enough scopes for repository, organization, and email features.
  static REQUIRED_SCOPES = ["public_repo", "read:org", "user:email"];

  static get() {
    if (!instance) {
      instance = new GithubLoginModel();
    }
    return instance;
  }

  constructor({
    secrets,
    refresh = refreshAccessToken,
    now = Date.now,
    withRefreshLock,
    setTimer = setTimeout,
    clearTimer = clearTimeout,
  } = {}) {
    this._secrets = secrets || null;
    this.refresh = refresh;
    this.now = now;
    this.withRefreshLock = withRefreshLock || defaultWithRefreshLock;
    this.setTimer = setTimer;
    this.clearTimer = clearTimer;
    this.emitter = new Emitter();
    this.checked = new Map();
    this.refreshes = new Map();
    this.refreshTimers = new Map();
    this.secretSubscription = new Disposable();
    this.observingSecretChanges = false;
    if (this._secrets) this.observeSecretChanges();
  }

  get secrets() {
    if (!this._secrets) {
      this._secrets = globalThis.lumine && globalThis.lumine.secrets;
      this.observeSecretChanges();
    }
    return this._secrets;
  }

  keyFor(account) {
    return `${SERVICE}:${account}`;
  }

  async getToken(account) {
    const credential = parseCredential(await this.secrets.get(this.keyFor(account)));
    if (!credential) {
      this.clearRefreshTimer(account);
      return UNAUTHENTICATED;
    }

    let current = credential;
    this.scheduleRefresh(account, current);
    let refreshed = false;
    if (this.shouldRefresh(current)) {
      const result = await this.tryRefresh(account, current);
      if (result instanceof Error || result === UNAUTHENTICATED) return result;
      current = result;
      this.scheduleRefresh(account, current);
      refreshed = true;
    }

    let result = await this.validateAccessToken(account, current.accessToken);
    if (
      result === UNAUTHENTICATED &&
      !refreshed &&
      current.kind === OAUTH_CREDENTIAL_KIND &&
      current.refreshToken
    ) {
      const refreshResult = await this.tryRefresh(account, current);
      if (refreshResult instanceof Error || refreshResult === UNAUTHENTICATED) {
        return refreshResult;
      }
      current = refreshResult;
      this.scheduleRefresh(account, current);
      result = await this.validateAccessToken(account, current.accessToken);
    }
    return result;
  }

  shouldRefresh(credential) {
    return (
      credential.kind === OAUTH_CREDENTIAL_KIND &&
      credential.refreshToken &&
      Number.isFinite(credential.expiresAt) &&
      this.now() >= credential.expiresAt - REFRESH_SKEW_MS
    );
  }

  scheduleRefresh(account, credential) {
    this.clearRefreshTimer(account);
    if (
      credential.kind !== OAUTH_CREDENTIAL_KIND ||
      !credential.refreshToken ||
      !Number.isFinite(credential.expiresAt)
    ) {
      return;
    }
    const delay = credential.expiresAt - REFRESH_SKEW_MS - this.now();
    if (delay <= 0) return;
    const timer = this.setTimer(() => {
      if (this.refreshTimers.get(account) !== timer) return;
      this.refreshTimers.delete(account);
      this.didUpdate();
    }, delay);
    this.refreshTimers.set(account, timer);
  }

  clearRefreshTimer(account) {
    const timer = this.refreshTimers.get(account);
    if (timer === undefined) return;
    this.clearTimer(timer);
    this.refreshTimers.delete(account);
  }

  async tryRefresh(account, credential) {
    try {
      return await this.refreshCredential(account, credential);
    } catch (error) {
      if (error instanceof DeviceFlowError && error.code === "bad_refresh_token") {
        return UNAUTHENTICATED;
      }
      if (error instanceof DeviceFlowError && error.code === "expired_refresh_token") {
        return UNAUTHENTICATED;
      }
      return error;
    }
  }

  refreshCredential(account, credential) {
    if (this.refreshes.has(account)) return this.refreshes.get(account);
    const promise = this.withRefreshLock(account, async () => {
      const key = this.keyFor(account);
      const latest = parseCredential(await this.secrets.get(key));
      if (!latest) {
        throw new DeviceFlowError("GitHub credentials were removed.", "bad_refresh_token");
      }

      let current = latest;
      if (current.accessToken !== credential.accessToken && !this.shouldRefresh(current)) {
        return current;
      }
      if (!current.refreshToken) {
        throw new DeviceFlowError("GitHub did not issue a refresh token.", "bad_refresh_token");
      }
      if (
        Number.isFinite(current.refreshTokenExpiresAt) &&
        this.now() >= current.refreshTokenExpiresAt
      ) {
        throw new DeviceFlowError("The GitHub refresh token expired.", "expired_refresh_token");
      }

      const refreshed = normalizeCredential(await this.refresh(current));
      await this.secrets.set(key, serializeCredential(refreshed));
      return refreshed;
    });
    this.refreshes.set(account, promise);
    const cleanup = () => {
      if (this.refreshes.get(account) === promise) this.refreshes.delete(account);
    };
    promise.then(cleanup, cleanup);
    return promise;
  }

  async validateAccessToken(account, token) {
    if (!/^https?:\/\//.test(account)) return token;

    // Avoid storing tokens in memory longer than necessary. Cache validation
    // outcomes by a checksum rather than by the token itself.
    const hash = crypto.createHash("md5");
    hash.update(token);
    const fingerprint = hash.digest("base64");
    const outcome = this.checked.get(fingerprint);
    if (outcome === UNAUTHENTICATED || outcome === INSUFFICIENT) return outcome;
    if (outcome) return token;

    try {
      const scopes = await this.getScopes(account, token);
      if (scopes === UNAUTHORIZED) {
        this.checked.set(fingerprint, UNAUTHENTICATED);
        return UNAUTHENTICATED;
      }
      const scopeSet = new Set(scopes);
      for (const scope of this.constructor.REQUIRED_SCOPES) {
        if (scopeSet.has(scope)) continue;
        if (scope === "public_repo" && scopeSet.has("repo")) continue;
        if (scope === "read:org" && scopeSet.has("admin:org")) {
          console.warn(
            "Excessive scopes detected on your github token.",
            "Please only set the actually needed scopes on your PAT.",
          );
          console.warn('Excessive scope "admin:org" should be "read:org" instead.');
          continue;
        }
        if (scope === "user:email" && scopeSet.has("user")) {
          console.warn(
            "Excessive scopes detected on your github token.",
            "Please only set the actually needed scopes on your PAT.",
          );
          console.warn('Excessive scope "user" should be "user:email" instead.');
          continue;
        }
        console.log("GitHub token doesn't have a required scope! Missing: " + scope);
        this.checked.set(fingerprint, INSUFFICIENT);
        return INSUFFICIENT;
      }
      this.checked.set(fingerprint, true);
      return token;
    } catch (error) {
      return error;
    }
  }

  observeSecretChanges() {
    if (this.observingSecretChanges || !this._secrets?.onDidChange) return false;
    this.observingSecretChanges = true;
    this.secretSubscription = this._secrets.onDidChange(({ key }) => {
      if (!key.startsWith(`${SERVICE}:`)) return;
      this.clearRefreshTimer(key.slice(SERVICE.length + 1));
      this.checked.clear();
      this.didUpdate();
    });
    return true;
  }

  async setToken(account, token) {
    const observesChanges = this.observeSecretChanges();
    await this.secrets.set(this.keyFor(account), serializeCredential(token));
    if (!observesChanges && !this.observingSecretChanges) this.didUpdate();
  }

  async removeToken(account) {
    const observesChanges = this.observeSecretChanges();
    this.clearRefreshTimer(account);
    await this.secrets.delete(this.keyFor(account));
    if (!observesChanges && !this.observingSecretChanges) this.didUpdate();
  }

  /* istanbul ignore next */
  async getScopes(host, token) {
    if (lumine.window.isSpecMode()) {
      if (token === "good-token") {
        return this.constructor.REQUIRED_SCOPES;
      }

      throw new Error("Attempt to check token scopes in specs");
    }

    let response;
    try {
      response = await fetch(host, {
        method: "HEAD",
        headers: { Authorization: `bearer ${token}` },
      });
    } catch (e) {
      e.network = true;
      throw e;
    }

    if (response.status === 401) {
      return UNAUTHORIZED;
    }

    if (response.status !== 200) {
      const e = new Error(`Unable to check token for OAuth scopes against ${host}`);
      e.response = response;
      e.responseText = await response.text();
      throw e;
    }

    const scopeHeader = response.headers.get("X-OAuth-Scopes");
    if (scopeHeader === null) {
      // GitHub App user-to-server tokens (and some proxies) don't report OAuth
      // scopes. The 200 above means the token is valid and its permissions come
      // from the app's configuration, so treat the required scopes as satisfied
      // rather than reporting them as insufficient.
      return this.constructor.REQUIRED_SCOPES;
    }
    return scopeHeader.split(/\s*,\s*/);
  }

  didUpdate() {
    this.emitter.emit("did-update");
  }

  onDidUpdate(cb) {
    return this.emitter.on("did-update", cb);
  }

  destroy() {
    this.secretSubscription.dispose();
    for (const account of this.refreshTimers.keys()) this.clearRefreshTimer(account);
    this.emitter.dispose();
  }
}
