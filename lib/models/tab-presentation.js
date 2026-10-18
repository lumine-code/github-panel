/** @babel */

// Retain data across tab views, without retaining their observers or DOM.
export default class TabPresentation {
  constructor() {
    this.models = new Map();
    this.queries = [];
    this.revision = 0;
  }

  clear() {
    this.models.clear();
    this.queries.length = 0;
    this.revision++;
  }

  readModel(key, model, params = []) {
    const snapshot = this.models.get(key);
    return snapshot && snapshot.model === model && sameParams(snapshot.params, params)
      ? { data: snapshot.data }
      : null;
  }

  writeModel(key, model, params = [], data, expectedRevision = this.revision) {
    if (expectedRevision !== this.revision || !canRetain(data)) return;
    this.models.set(key, { model, params: [...params], data });
  }

  readQuery(environment, query, variables = {}) {
    const index = this.queries.findIndex((candidate) =>
      matchesQuery(candidate, environment, query, variables),
    );
    if (index === -1) return null;
    const [snapshot] = this.queries.splice(index, 1);
    this.queries.push(snapshot);
    return { data: snapshot.data };
  }

  writeQuery(environment, query, variables, data, expectedRevision = this.revision) {
    if (expectedRevision !== this.revision || !canRetain(data)) return;
    const index = this.queries.findIndex((candidate) =>
      matchesQuery(candidate, environment, query, variables),
    );
    if (index !== -1) this.queries.splice(index, 1);
    this.queries.push({
      endpoint: environment?.endpoint,
      token: environment?.token,
      query,
      variables: { ...variables },
      data,
    });
    if (this.queries.length > 64) this.queries.shift();
  }
}

function canRetain(data) {
  return data !== null && data !== undefined && !(data instanceof Error);
}

function sameParams(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function matchesQuery(snapshot, environment, query, variables = {}) {
  const keys = Object.keys(variables);
  return (
    snapshot.endpoint === environment?.endpoint &&
    snapshot.token === environment?.token &&
    snapshot.query === query &&
    Object.keys(snapshot.variables).length === keys.length &&
    keys.every((key) => snapshot.variables[key] === variables[key])
  );
}
