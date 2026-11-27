# Contributing to Nesso

Feedback from people learning with Nesso is what shapes the beta. Questions, experiences, and ideas you'd like to explore belong in [Discussions](https://github.com/nesso-how/nesso/discussions), while a reproducible bug or a concrete improvement deserves an [issue](https://github.com/nesso-how/nesso/issues/new/choose) with the matching template. Please report suspected vulnerabilities [privately](SECURITY.md).

External pull requests are welcome. For a change to behavior, describe the problem and agree on the intended outcome in the issue before building it. A small documentation correction can go straight to a pull request.

## Run the app locally

Clone the repository (fork it first if you need a place to push). Use Node.js 24 and the pnpm version in [`package.json`](package.json). From the checkout:

```sh
pnpm install
pnpm desktop
```

For live reload, run `pnpm dev --host 127.0.0.1 --strictPort` in one terminal and `pnpm desktop:dev` in another. To use a port other than 5173, pass `--port <port>` to `pnpm dev` and set `NESSO_DEV_PORT=<port>` for `pnpm desktop:dev`. Both desktop commands use `.nesso-dev/` in the checkout, separate from the installed app. For the web demo alone, run `pnpm dev`.

## Send a change

1. Start a branch from the latest `main`, named for the change, such as `fix/map-selection`. The [architecture and package index](docs/architecture.md) can help you find the owning module.
2. Try the change in the app or through its public API, and extend a nearby test if there's behavior worth protecting. Before pushing, run the usual checks (`pnpm lint`, `pnpm format:check`, `pnpm build`, and `pnpm test`), plus `pnpm test:e2e` when the change touches UI integration. After code changes, also run `pnpm analyze --summary` and look at what your branch introduced with `pnpm analyze audit --base origin/main`.
3. Push to your fork or branch and open a PR against `main`. Fill in the [PR template](.github/pull_request_template.md) with what changed and how you tested it. Link the issue when there is one.
4. Use a [Conventional Commit](https://www.conventionalcommits.org/) title such as `fix(maps): preserve selection after rename`. Squash merges turn the PR title into the changelog entry, so keep it under 72 characters and describe the result. The [title check](.github/workflows/pr-title.yml) lists the accepted types.

Maintainers also use an optional [OpenCode workflow](docs/development.md) for issue, review, and release commands. See [profiling](docs/profiling.md) for performance work and [releases](docs/releases.md) for publishing.
