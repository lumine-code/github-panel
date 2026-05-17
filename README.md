# github-panel

A GitHub integration panel.

Fork of [github](https://github.com/pulsar-edit/github), but GitHub-specific features only (PRs, reviews, issues).

## Features

- **Pull requests**: Open and inspect pull requests with Overview, Build Status, Commits, and Files Changed tabs.
- **Code reviews**: View review comments and threads directly in the editor.
- **Comment decorations**: Show review comments as inline decorations on the current branch.
- **Issue/PR opener**: Open any issue or pull request by URL.
- **Repository management**: Create and publish repositories to GitHub.
- **Status bar**: GitHub icon for quick panel access.

## Installation

To install, search for [github-panel](https://web.pulsar-edit.dev/packages/github-panel) in the Install pane of the Pulsar settings or run `ppm install github-panel`. Alternatively, run `ppm install asiloisad/pulsar-github-panel` to install directly from the GitHub repository.

Requires [git-panel](https://web.pulsar-edit.dev/packages/git-panel).

**Note**: This package automatically disables the built-in `github` package to avoid conflicts.

## Commands

Commands available in `.workspace`:

- `github-panel:toggle-github-panel-tab`: <kbd>Ctrl+8</kbd> toggle GitHub panel visibility,
- `github-panel:toggle-github-panel-tab-focus`: <kbd>Ctrl+Shift+8</kbd> toggle and focus the GitHub panel,
- `github-panel:open-issue-or-pull-request`: open an issue or PR by URL,
- `github-panel:create-repository`: create a new GitHub repository,
- `github-panel:publish-repository`: publish a local repository to GitHub,
- `github-panel:logout`: remove stored GitHub token.

Commands available in `.github-panel-Reviews`:

- `github-panel:more-context`: <kbd>Cmd/Ctrl+=</kbd> show more review context,
- `github-panel:less-context`: <kbd>Cmd/Ctrl+-</kbd> show less review context,
- `github-panel:submit-comment`: <kbd>Cmd/Ctrl+Enter</kbd> submit review comment.

## Contributing

Got ideas to make this package better, found a bug, or want to help add new features? Just drop your thoughts on GitHub. Any feedback is welcome!
