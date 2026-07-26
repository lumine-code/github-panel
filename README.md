# github-panel

A GitHub integration panel.

Derived from Pulsar's [`github`](https://github.com/pulsar-edit/github) package, keeping only the GitHub-forge features (pull requests, reviews, issues).

## Features

- **Pull requests**: open and inspect pull requests with Overview, Build Status, Commits, and Files Changed tabs.
- **Code reviews**: view review comments and threads directly in the editor.
- **Comment decorations**: show review comments as inline decorations on the current branch.
- **Issue/PR opener**: open any issue or pull request by URL.
- **Repository management**: create and publish repositories to GitHub.
- **Status bar**: reach the panel from a GitHub item in the status bar.

## Installation

To install `github-panel` search for _github-panel_ in the Install pane of the Lumine settings or run `lumine --install lumine-code/github-panel`. It also needs the [git-panel](https://github.com/lumine-code/git-panel) package, which performs the Git operations.

## Commands

Commands available in `atom-workspace`:

- `github-panel:toggle-github-panel-tab`: toggle GitHub panel visibility,
- `github-panel:toggle-github-panel-tab-focus`: toggle and focus the GitHub panel,
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

- **git-panel** (`^1.0.0`): consumed to reach the repository model, its diffs, and its remotes through git-panel.
- **status-bar** (`^1.0.0`): consumed to display the GitHub item that opens the panel.

## Contributing

Got ideas to make this package better, found a bug, or want to help add new features? Just drop your thoughts on GitHub. Any feedback is welcome!
