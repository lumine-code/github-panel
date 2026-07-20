/** @babel */

// Replaces RelayNetworkLayerManager.getEnvironmentForHost: the "environment"
// threaded through the GitHub components is now just the endpoint + token the
// hand-rolled client needs. Kept as a tiny value object so the existing
// environment plumbing (props, tooltip items) flows unchanged.
export function createEnvironment(endpoint, token) {
  if (!token) {
    throw new Error(`You must authenticate to ${endpoint.getHost()} first.`);
  }
  return { endpoint, token };
}
