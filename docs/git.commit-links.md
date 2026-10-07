# git.commit-links

Resolve commit links for remotes recognized by a forge integration.

| Field       | Value                      |
| ----------- | -------------------------- |
| Version     | 1.0.0                      |
| Provided by | Forge integration packages |
| Consumed by | Commit detail views        |
| Owner       | github-panel               |

## Registration

Provide `git.commit-links` at `1.0.0`. Consumers request `^1.0.0` and return a disposable that removes that provider edge. A provider never initializes a repository or starts a network request to resolve a link.

## Contract

| Required field   | Type                              | Description                                                                                                                 |
| ---------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `buildCommitURL` | `(remote, sha) => string \| null` | Return an HTTPS URL when the plain core remote record names a repository this provider recognizes; otherwise return `null`. |

## Minimal example

```js
provideCommitLinks() {
  return {
    buildCommitURL(remote, sha) {
      const identity = parseGitRemote(remote?.fetchUrl || remote?.pushUrl);
      return identity?.host === "github.com"
        ? `${identity.webURL}/commit/${encodeURIComponent(sha)}`
        : null;
    },
  };
}
```

## Behavior

Consumers may combine several providers and use the first recognized URL. An unrecognized remote remains an ordinary commit identifier. The provider owns host-specific URL routes and recognition; the consumer owns whether the commit has been pushed.

## Teardown

Remove the provider's resolver when its edge disappears. Reacquire the new generation when it returns.

## Versioning

Incompatible changes require a new service major version.
