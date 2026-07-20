/** @babel */

// GitHub OAuth Device Flow — the modern, secret-less sign-in (what the `gh` CLI
// uses). The user is shown a short code to enter at a GitHub URL in their
// browser; meanwhile the editor polls for the resulting access token. It needs
// only a public OAuth App **Client ID** (no client secret, no redirect handling,
// no backend), so it fits a self-hosted editor.
//
// To enable it: register a GitHub OAuth App with "Enable Device Flow" checked
// (ideally under the lumine-code org) and set its Client ID as the default
// below, or via the `github-panel.oauthClientId` setting.

export const DEFAULT_OAUTH_CLIENT_ID = "";

// Scopes requested for the token. `repo` supersedes `public_repo`, which the
// login model validates for.
export const OAUTH_SCOPES = ["repo", "read:org", "user:email"];

const DEVICE_GRANT_TYPE = "urn:ietf:params:oauth:grant-type:device_code";

export class DeviceFlowError extends Error {
  constructor(message) {
    super(message);
    this.name = "DeviceFlowError";
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// GitHub's OAuth endpoints default to form-encoded responses; ask for JSON.
async function postJSON(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  return response.json();
}

// Resolve the configured OAuth App client id (setting overrides the shipped
// default), or null when none is configured.
export function getClientId() {
  const configured = globalThis.atom && globalThis.atom.config.get("github-panel.oauthClientId");
  return configured || DEFAULT_OAUTH_CLIENT_ID || null;
}

// Step 1 — ask GitHub for a device + user code to show the user.
// Resolves to `{ device_code, user_code, verification_uri, expires_in, interval }`.
export async function requestDeviceCode({ endpoint, clientId, scopes = OAUTH_SCOPES }) {
  const data = await postJSON(`${endpoint.getWebRoot()}/login/device/code`, {
    client_id: clientId,
    scope: scopes.join(" "),
  });
  if (data.error) {
    throw new DeviceFlowError(data.error_description || data.error);
  }
  return data;
}

// Step 2 — poll for the access token until the user authorizes in the browser,
// the code expires, or authorization is denied. `poll` is injectable for specs.
export async function pollForAccessToken({
  endpoint,
  clientId,
  deviceCode,
  interval = 5,
  expiresIn = 900,
  signal,
  poll = wait,
}) {
  const deadline = Date.now() + expiresIn * 1000;
  let delayMs = Math.max(interval, 1) * 1000;

  while (Date.now() < deadline) {
    if (signal && signal.aborted) {
      throw new DeviceFlowError("Sign-in was cancelled.");
    }
    await poll(delayMs);

    const data = await postJSON(`${endpoint.getWebRoot()}/login/oauth/access_token`, {
      client_id: clientId,
      device_code: deviceCode,
      grant_type: DEVICE_GRANT_TYPE,
    });

    if (data.access_token) {
      return data.access_token;
    }

    switch (data.error) {
      case "authorization_pending":
        break;
      case "slow_down":
        // GitHub asks us to back off; it also sends a new interval.
        delayMs = (data.interval ? data.interval : interval + 5) * 1000;
        break;
      case "access_denied":
        throw new DeviceFlowError("Authorization was denied.");
      case "expired_token":
        throw new DeviceFlowError("The code expired before it was entered. Please try again.");
      default:
        throw new DeviceFlowError(data.error_description || data.error || "Sign-in failed.");
    }
  }

  throw new DeviceFlowError("The code expired before it was entered. Please try again.");
}
