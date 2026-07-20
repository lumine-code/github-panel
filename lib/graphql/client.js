/** @babel */
import util from "util";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
dayjs.extend(relativeTime);

// A thin GraphQL-over-HTTP client for the GitHub API, replacing the Relay
// network layer. It POSTs `{query, variables}` with bearer auth and surfaces
// errors the way QueryErrorView/ErrorView expect (`e.network`, `e.response`,
// `e.errors`, `e.rawStack`). In spec mode it consults registered expectations
// instead of hitting the network.

const responsesByQuery = new Map();

// A small deep-equal for GraphQL variable objects (JSON-serializable values),
// used to match spec expectations without pulling in a dependency.
function deepEqual(a, b) {
  if (a === b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key) => deepEqual(a[key], b[key]));
}

let lastRateLimit = null;

// Every GitHub response carries the current rate-limit headers; remember the
// latest so the "show rate limit" command can report them without spending a
// request.
function captureRateLimit(headers) {
  const remaining = headers.get("x-ratelimit-remaining");
  const limit = headers.get("x-ratelimit-limit");
  const reset = headers.get("x-ratelimit-reset");
  if (remaining !== null && limit !== null) {
    lastRateLimit = { remaining, limit, reset };
  }
}

// A human-readable summary of the most recent rate-limit headers, or null when
// no request has been made yet this session.
export function getRateLimitSummary() {
  if (!lastRateLimit) {
    return null;
  }
  const { remaining, limit, reset } = lastRateLimit;
  const resetsIn = dayjs.unix(parseInt(reset, 10)).fromNow();
  return `${remaining}/${limit} requests remaining, resets ${resetsIn}`;
}

// Register a canned response for an operation, used by specs. `operationPattern`
// is `{name, variables?, trace?}`; `response` is the `data` payload or a
// function returning `{data}`. Returns `{promise, resolve, reject, disable}` so
// the spec controls when the response settles.
export function expectGraphQLQuery(operationPattern, response) {
  let resolve, reject;
  const handler = typeof response === "function" ? response : () => ({ data: response });

  const promise = new Promise((resolve0, reject0) => {
    resolve = resolve0;
    reject = reject0;
  });

  const existing = responsesByQuery.get(operationPattern.name) || [];
  existing.push({
    promise,
    handler,
    variables: operationPattern.variables || {},
    trace: operationPattern.trace,
  });
  responsesByQuery.set(operationPattern.name, existing);

  const disable = () => responsesByQuery.delete(operationPattern.name);

  return { promise, resolve, reject, disable };
}

export function clearGraphQLExpectations() {
  responsesByQuery.clear();
}

function operationName(query) {
  const match = /\b(?:query|mutation)\s+(\w+)/.exec(query);
  return match ? match[1] : "(anonymous)";
}

function specExecute(query, variables) {
  const name = operationName(query);
  const expectations = responsesByQuery.get(name) || [];
  const match = expectations.find((expectation) => deepEqual(expectation.variables, variables));

  if (!match) {
    console.log(
      `GraphQL query ${name} was:\n  ${query.replace(/\n/g, "\n  ")}\n` + util.inspect(variables),
    );
    const e = new Error(`Unexpected GraphQL query: ${name}`);
    e.rawStack = e.stack;
    throw e;
  }

  const responsePromise = match.promise.then(() => match.handler({ name, text: query }));

  if (match.trace) {
    console.log(`[GraphQL] query "${name}":\n${query}`);
    responsePromise.then(
      (result) => console.log(`[GraphQL] response "${name}":`, result),
      (err) => {
        console.error(`[GraphQL] error "${name}":\n${err.stack || err}`);
        throw err;
      },
    );
  }

  return responsePromise;
}

// Execute a GraphQL operation against `endpoint` with `token`, resolving to the
// full `{data, errors?}` payload. Throws with the error markers the views rely
// on when the network fails, the response is non-200, or the payload carries
// GraphQL errors.
export async function executeQuery(endpoint, token, { query, variables }) {
  if (globalThis.atom && globalThis.atom.inSpecMode()) {
    return specExecute(query, variables);
  }

  const url = endpoint.getGraphQLRoot();
  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `bearer ${token}`,
        Accept: "application/vnd.github.antiope-preview+json",
      },
      body: JSON.stringify({ query, variables }),
    });
  } catch (e) {
    // Mark network errors so QueryErrorView/ErrorView can distinguish them from
    // GraphQL errors; fetch failures are otherwise opaque TypeErrors.
    e.network = true;
    e.rawStack = e.stack;
    throw e;
  }

  captureRateLimit(response.headers);

  if (response.status !== 200) {
    const e = new Error(`GraphQL API endpoint at ${url} returned ${response.status}`);
    e.response = response;
    e.responseText = await response.text();
    e.rawStack = e.stack;
    throw e;
  }

  const payload = await response.json();

  if (payload && payload.errors && payload.errors.length > 0) {
    const e = new Error(
      `GraphQL API endpoint at ${url} returned an error for query ${operationName(query)}.`,
    );
    e.response = response;
    e.errors = payload.errors;
    e.rawStack = e.stack;
    throw e;
  }

  return payload;
}

// A mutation is just a GraphQL operation; kept as a named export so mutation
// modules read clearly.
export function executeMutation(endpoint, token, { query, variables }) {
  return executeQuery(endpoint, token, { query, variables });
}
