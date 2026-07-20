# github-panel

A GitHub integration panel for Lumine.

Derived from Pulsar's [`github`](https://github.com/pulsar-edit/github) package, keeping only the GitHub-forge features (pull requests, reviews, issues).

## Features

- **Pull requests**: Open and inspect pull requests with Overview, Build Status, Commits, and Files Changed tabs.
- **Code reviews**: View review comments and threads directly in the editor.
- **Comment decorations**: Show review comments as inline decorations on the current branch.
- **Issue/PR opener**: Open any issue or pull request by URL.
- **Repository management**: Create and publish repositories to GitHub.
- **Status bar**: GitHub icon for quick panel access.

## Installation

`github-panel` is delivered as a bundled Lumine package and does not need to be installed separately. It requires the [git-panel](https://github.com/lumine-code/git-panel) package for Git operations.

## Commands

Commands available in `.workspace`:

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

## Contributing

Got ideas to make this package better, found a bug, or want to help add new features? Just drop your thoughts on GitHub. Any feedback is welcome!
