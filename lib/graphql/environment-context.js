/** @babel */
import React from "react";

// Carries the `{endpoint, token}` environment down the tree the way Relay's
// RelayEnvironmentProvider did, so nested fetchers (pagination and refetch
// containers) can reach the client without threading it through every prop.
// GraphQLQuery provides it; pagination/refetch containers read it via
// `static contextType = EnvironmentContext`.
export default React.createContext(null);
