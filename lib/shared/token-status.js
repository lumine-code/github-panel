/** @babel */

// Sentinel results returned by GithubLoginModel#getToken, distinguishing the
// ways a token can be missing or unusable without surfacing the token string
// itself. Kept separate from any storage backend so views and containers can
// compare against them without importing storage code.

// No token is stored for this account.
export const UNAUTHENTICATED = Symbol("UNAUTHENTICATED");

// The stored token is missing one or more required OAuth scopes.
export const INSUFFICIENT = Symbol("INSUFFICIENT");

// The stored token was rejected by GitHub.
export const UNAUTHORIZED = Symbol("UNAUTHORIZED");
