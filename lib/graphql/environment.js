/** @babel */

// Replaces RelayNetworkLayerManager.getEnvironmentForHost: the "environment"
// threaded through the GitHub components is now just the endpoint + token the
// hand-rolled client needs. Kept as a tiny value object so the existing
// environment plumbing (props, tooltip items) flows unchanged.
export function createEnvironment(endpoint, token) {
  if (!token) {
    throw new Error(`You must authenticate to ${endpoint.getHost()} first.`);
  }
  return {
    endpoint,
    token,
  };
}
export function provideEnvironment(node, environment) {
  if (!environment) return node;
  if (Array.isArray(node)) return node.map((child) => provideEnvironment(child, environment));
  if (!node || typeof node !== "object") return node;
  if (typeof node.tag === "function")
    node.props = {
      ...node.props,
      environment: node.props?.environment || environment,
    };
  else if (node.children)
    node.children = node.children.map((child) => provideEnvironment(child, environment));
  return node;
}
