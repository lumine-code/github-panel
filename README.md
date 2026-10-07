# github-panel

A GitHub integration panel.

Derived from Pulsar's [`github`](https://github.com/pulsar-edit/github) package, keeping only the GitHub-forge features (pull requests, reviews, issues).

## Features

- **Pull requests**: open and inspect pull requests with Overview, Build Status, Commits, and Files Changed tabs, with Unified or Side by Side diffs.
- **Code reviews**: view review comments and threads directly in the editor, with Unified or Side by Side review context.
- **Comment decorations**: show review comments as inline decorations on the current branch.
- **Issue/PR opener**: open any issue or pull request by URL.
- **Repository management**: create and publish repositories to GitHub.

## Installation

To install `github-panel` search for it in the Install pane of the Lumine settings, or run the command `lumine --install lumine-code/github-panel`.

Git operations use the editor's repository API, and pull request diffs use the bundled patch-view renderer.

## Commands

Commands available in `lumine-workspace`:

- `github-panel:toggle`: show or hide the GitHub panel,
- `github-panel:toggle-focus`: focus the GitHub panel, or return focus to the editor,
- `github-panel:open-issue-or-pull-request`: open an issue or PR by URL,
- `github-panel:create-repository`: create a new GitHub repository,
- `github-panel:publish-repository`: publish a local repository to GitHub,
- `github-panel:logout`: remove stored GitHub token,
- `github-panel:show-rate-limit`: show the current GitHub API rate limit in a notification.

Commands available in `.github-panel-Reviews`:

- `github-panel:more-context`: show more review context,
- `github-panel:less-context`: show less review context,
- `github-panel:submit-comment`: submit review comment.

## Customization

Override the package custom properties in your `styles.css` to adjust the issue and pull request state colors and the diff colors of suggested changes:

```css
:root {
  --github-panel-color-green: var(--text-color-success);
  --github-panel-color-purple: var(--text-color-info);
  --github-panel-diff-added: color-mix(in srgb, var(--syntax-color-added) 22%, transparent);
  --github-panel-diff-deleted: color-mix(in srgb, var(--syntax-color-removed) 22%, transparent);
}
```

## Services

- `background-tips.provider`: provided to teach the package's headline workflow on the empty workspace.
- `git-panel`: consumed optionally to open the local Git tab and its init and clone dialogs.
- `patch-view`: consumed to render pull request changes and review context in shared native layouts.
- [`git.commit-links`](docs/git.commit-links.md): provided to resolve GitHub commit URLs from core remote records.

## Contributing

Got ideas to make this package better, found a bug, or want to help add new features? Just drop your thoughts on GitHub. Any feedback is welcome!
