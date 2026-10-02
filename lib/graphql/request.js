/** @babel */
import { Disposable } from "lumine";
import { executeQuery } from "./client";

// Invalidating identity and aborting HTTP are both necessary: even a transport
// or response body that completes after cancellation cannot publish old data.
export default class GraphQLRequest {
  constructor() {
    this.active = null;
    this.destroyed = false;
  }
  run(environment, query, variables, onResult) {
    this.cancel();
    if (this.destroyed) return new Disposable();
    const request = {
      controller: new AbortController(),
    };
    this.active = request;
    request.promise = executeQuery(environment.endpoint, environment.token, {
      query,
      variables,
      signal: request.controller.signal,
    }).then(
      (payload) => {
        if (this.active !== request || this.destroyed) return;
        this.active = null;
        onResult(null, payload.data);
      },
      (error) => {
        if (this.active !== request || this.destroyed) return;
        this.active = null;
        if (error.name !== "AbortError") onResult(error, null);
      },
    );
    return new Disposable(() => {
      if (this.active === request) this.cancel();
    });
  }
  cancel() {
    const active = this.active;
    this.active = null;
    active?.controller.abort();
  }
  destroy() {
    this.destroyed = true;
    this.cancel();
  }
}
export function sameVariables(a = {}, b = {}) {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key]);
}
export function sameEnvironment(a = {}, b = {}) {
  return (
    a.endpoint === b.endpoint && a.token === b.token && sameVariables(a.variables, b.variables)
  );
}

// Clone only the path to a connection; never mutate a shared seed snapshot.
export function replaceConnection(data, connection, replacement) {
  if (data === connection) return replacement;
  if (!data || typeof data !== "object") return data;
  let copy = data;
  for (const key of Object.keys(data)) {
    const next = replaceConnection(data[key], connection, replacement);
    if (next !== data[key]) {
      if (copy === data)
        copy = Array.isArray(data)
          ? [...data]
          : {
              ...data,
            };
      copy[key] = next;
    }
  }
  return copy;
}
