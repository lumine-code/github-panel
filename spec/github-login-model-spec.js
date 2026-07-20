/** @babel */
import GithubLoginModel from "../lib/models/github-login-model";
import { UNAUTHENTICATED } from "../lib/shared/token-status";

// A minimal in-memory stand-in for atom.secrets so the model can be exercised
// without the OS keychain.
function fakeSecrets() {
  const map = new Map();
  return {
    async get(key) {
      return map.has(key) ? map.get(key) : null;
    },
    async set(key, value) {
      map.set(key, value);
    },
    async delete(key) {
      map.delete(key);
    },
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
    // Namespaced under the atom-github service.
    expect(await secrets.get("atom-github:test-account")).toBe("sekret");

    await model.removeToken(account);
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
