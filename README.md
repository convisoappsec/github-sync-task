<img src="images/logo.jpeg" alt="Conviso Application Security" width="96" align="right">

# Conviso GitHub Sync Task

A GitHub Action, written in TypeScript, that associates a project with the Conviso GraphQL API.
It triggers a sync to Conviso Platform for a project held by an external scanner (Fortify,
Checkmarx, Dependency Track, and any other integration Conviso supports), and can record the
repository and branch the scan came from.

This is the GitHub Actions counterpart of
[convisoappsec/azure-sync-task](https://github.com/convisoappsec/azure-sync-task); the two speak
to the same API and behave the same way. See [Migrating from the Azure task](#migrating-from-the-azure-task).

## Table of Contents

- [Features](#features)
- [Quick start](#quick-start)
- [Inputs](#inputs)
- [Outputs](#outputs)
- [Usage](#usage)
    - [Associating a branch](#associating-a-branch)
    - [Pull requests](#pull-requests)
    - [Using the outputs](#using-the-outputs)
- [Migrating from the Azure task](#migrating-from-the-azure-task)
- [Prerequisites](#prerequisites)
- [Project structure](#project-structure)
- [Development](#development)
    - [Building the bundle](#building-the-bundle)
    - [Running tests](#running-tests)
    - [Trying the action locally](#trying-the-action-locally)
- [Publishing](#publishing)
    - [Releasing a version](#releasing-a-version)
    - [Publishing to the GitHub Marketplace](#publishing-to-the-github-marketplace)
- [Contributing](#contributing)
- [License](#license)

## Features

- **Custom inputs**: accepts `api-key`, `project-id`, `integration` and `company-id`, plus the
  optional `repository-url` and `branch`.
- **Branch awareness**: associates the scan with a specific repository and branch, so findings
  land on the branch they came from — resolved from the workflow's own context, so the common
  case needs no extra YAML.
- **GraphQL integration**: executes a mutation against the Conviso GraphQL API to associate a
  project from Checkmarx, Dependency Track, Fortify, or any other integration Conviso has.
- **Outputs**: exposes the associated Asset's id and name to later steps.
- **Secret masking**: registers the API key with the runner, so it is replaced by `***` in the
  logs even when a workflow passes it literally.
- **Unit testing**: Vitest suite covering the request payload, the context resolution and the
  wiring between them.
- **TypeScript**, bundled with esbuild into a single committed `dist/index.js`.

## Quick start

```yaml
name: Sync to Conviso

on:
  push:
    branches: [main]

jobs:
  conviso-sync:
    runs-on: ubuntu-latest
    steps:
      - uses: convisoappsec/github-sync-task@v1
        with:
          api-key: ${{ secrets.CONVISO_API_KEY }}
          integration: 'CONVISO_SCANNER'
          company-id: '99'
          project-id: '1a-2b-3c'
```

That is the whole integration. `repository-url` and `branch` default to the repository and branch
the workflow is running for, so the scan is associated with the right branch without any further
configuration.

> **Keep the API key in a repository or organization secret**, as above. Anything passed under
> `with:` is visible to anyone who can read the workflow file, and a key written literally there
> would also be readable in the run's YAML. This action calls `core.setSecret` on whatever it
> receives, so the value is masked in the log either way — but that does not un-publish a key
> committed to the repository.

## Inputs

| Input            | Required | Default                                            | Description |
|------------------|----------|----------------------------------------------------|-------------|
| `api-key`        | **yes**  | —                                                  | API key used to authenticate requests to the Conviso GraphQL endpoint. Pass it from a secret. |
| `integration`    | **yes**  | —                                                  | Name of the integration in Conviso's GraphQL schema (e.g. `CONVISO_SCANNER`, `DEPENDENCY_TRACK`, `FORTIFY`, `CHECKMARX`). |
| `company-id`     | **yes**  | —                                                  | Company ID in Conviso Platform. |
| `project-id`     | no       | —                                                  | Project ID from the external scanner. |
| `repository-url` | no       | `$GITHUB_SERVER_URL/$GITHUB_REPOSITORY`            | Repository this scan belongs to. When set, the Asset in Conviso Platform becomes a repository and `branch` is recorded as one of its branches. |
| `branch`         | no       | the branch that triggered the run                   | Branch this scan covers. Only takes effect together with `repository-url`. |

## Outputs

| Output       | Description |
|--------------|-------------|
| `asset-id`   | ID of the Asset associated in Conviso Platform. Empty when the API returned none. |
| `asset-name` | Name of the Asset associated in Conviso Platform. Empty when the API returned none. |

## Usage

### Associating a branch

`repository-url` and `branch` are optional, and both default to the workflow's own context:

| Input            | Resolved from                                                          |
|------------------|------------------------------------------------------------------------|
| `repository-url` | `GITHUB_SERVER_URL` + `GITHUB_REPOSITORY` — e.g. `https://github.com/org/repo` |
| `branch`         | `GITHUB_BASE_REF` when present, otherwise `GITHUB_REF` with `refs/heads/` stripped |

Passing them explicitly overrides the detection:

```yaml
      - uses: convisoappsec/github-sync-task@v1
        with:
          api-key: ${{ secrets.CONVISO_API_KEY }}
          integration: 'CONVISO_SCANNER'
          company-id: '99'
          project-id: '1a-2b-3c'
          repository-url: 'https://github.com/org/repo'  # Optional, defaults to this repository
          branch: 'main'                                 # Optional, defaults to this run's branch
```

Three things to know before turning this on:

- **`branch` only takes effect together with `repository-url`.** Sent on its own, Conviso Platform
  ignores it. The action emits a warning when it detects that combination, but the run still
  succeeds.
- **The Asset gets renamed.** Once associated with a repository, the Asset in Conviso Platform is
  named after the repository (`org/repo`) rather than the project name reported by the scanner.
- Branch association also depends on the feature being enabled for your company in Conviso
  Platform. Until then the action behaves exactly as it would without the two inputs, and sending
  them is harmless.

### Pull requests

On `pull_request` and `pull_request_target` events, `GITHUB_REF` is the temporary merge ref
(`refs/pull/42/merge`) and `GITHUB_REF_NAME` is the literal `42/merge` — neither is a branch name.
The action uses `GITHUB_BASE_REF` there, which carries the branch the pull request is merging
into, matching what the Azure task records. No configuration is needed:

```yaml
on:
  pull_request:

jobs:
  conviso-sync:
    runs-on: ubuntu-latest
    steps:
      - uses: convisoappsec/github-sync-task@v1
        with:
          api-key: ${{ secrets.CONVISO_API_KEY }}
          integration: 'CONVISO_SCANNER'
          company-id: '99'
```

If you would rather record the branch the pull request came *from*, pass it explicitly:
`branch: ${{ github.head_ref }}`.

### Using the outputs

```yaml
      - id: conviso
        uses: convisoappsec/github-sync-task@v1
        with:
          api-key: ${{ secrets.CONVISO_API_KEY }}
          integration: 'DEPENDENCY_TRACK'
          company-id: '99'
          project-id: '1a-2b-3c'

      - run: echo "Associated asset ${{ steps.conviso.outputs.asset-name }} (#${{ steps.conviso.outputs.asset-id }})"
```

## Migrating from the Azure task

The behaviour is identical; only the naming and the surrounding YAML change. GitHub Action inputs
are conventionally lowercase and hyphenated, so the input names differ:

| Azure Pipelines task | This action      | Notes |
|----------------------|------------------|-------|
| `API_KEY`            | `api-key`        | Same meaning. |
| `PROJECT_ID`         | `project-id`     | Same meaning. |
| `INTEGRATION`        | `integration`    | Same meaning, same GraphQL enum values. |
| `COMPANY_ID`         | `company-id`     | Same meaning. |
| `REPOSITORY_URL`     | `repository-url` | Default changes from `Build.Repository.Uri` to `$GITHUB_SERVER_URL/$GITHUB_REPOSITORY`. |
| `BRANCH`             | `branch`         | Default changes from `System.PullRequest.TargetBranch`/`Build.SourceBranch` to `GITHUB_BASE_REF`/`GITHUB_REF`. |
| —                    | `asset-id`, `asset-name` | New: the Azure task only logs the response. |

The request sent to Conviso is the same in both, except for the `Origin` header, which identifies
which CI the call came from (`GitHub Actions Conviso Task` here).

## Prerequisites

- **Node.js**: version 24.x or later, for local development. [Download Node.js](https://nodejs.org/)
- **Yarn**: version 4.x, provided by Corepack (`corepack enable`) — the version is pinned in
  `package.json` under `packageManager`.
- **A GitHub repository** with Actions enabled.
- **GraphQL API access**: credentials for the Conviso GraphQL API at
  `https://app.convisoappsec.com/graphql`.

## Project structure

```
github-sync-task/
├─ .github/
│  └─ workflows/
│     ├─ ci.yml                     # Typecheck, test, and verify dist/ is in sync
│     └─ release.yml                # Moves the v<major> tag on every published release
├─ src/
│  ├─ associateProject.ts           # Core logic for GraphQL API interaction
│  ├─ workflowContext.ts            # Resolves repository/branch from the workflow environment
│  ├─ main.ts                       # The action itself: inputs, fallbacks, outputs
│  ├─ index.ts                      # Entry point named by action.yml
│  └─ tests/
│     ├─ associateProject.test.ts   # Unit tests for the request payload
│     ├─ workflowContext.test.ts    # Unit tests for the context resolution
│     ├─ main.test.ts               # Unit tests for the wiring
│     └─ e2e.ts                     # End-to-end run against Conviso Platform
├─ dist/
│  ├─ index.js                      # Bundled action — committed, this is what runs
│  └─ index.js.LEGAL.txt            # Licence notices of the bundled dependencies
├─ action.yml                       # Action metadata: inputs, outputs, branding, runtime
├─ tsconfig.json                    # TypeScript configuration
├─ vitest.config.mts                # Test configuration
├─ package.json                     # Project dependencies and scripts
├─ yarn.lock                        # Yarn lockfile
└─ README.md                        # Project documentation
```

## Development

```bash
git clone https://github.com/convisoappsec/github-sync-task.git
cd github-sync-task
corepack enable
yarn install
```

### Building the bundle

```bash
yarn build
```

This bundles `src/index.ts` and every runtime dependency into a single `dist/index.js` with
esbuild, and writes the dependencies' licence notices to `dist/index.js.LEGAL.txt`.

**`dist/` is committed on purpose.** A JavaScript action runs straight from the repository — the
runner checks the repo out and executes `runs.main`, and never installs dependencies. A `dist/`
that lags behind `src/` means every consumer keeps running the old behaviour, which is why CI
rebuilds the bundle and fails when it differs from the committed one. Always run `yarn build`
before committing a change under `src/`.

### Running tests

```bash
yarn test           # one-shot run
yarn test:watch     # re-run on change
yarn test:coverage  # with a coverage report
yarn typecheck      # tsc --noEmit
yarn all            # typecheck + test + build, what CI does
```

Tests run on [Vitest](https://vitest.dev/) rather than Jest — `@actions/core` 3.x is published as
ESM only, which Jest can only load through a fair amount of configuration.

### Trying the action locally

`yarn test-e2e` runs the *bundled* action exactly the way the runner does — `node dist/index.js`
with the inputs handed over as `INPUT_*` environment variables — against the real Conviso
Platform. Credentials come from your environment, so nothing of yours ends up committed:

```bash
yarn build
CONVISO_API_KEY=<key> CONVISO_COMPANY_ID=<id> CONVISO_PROJECT_ID=<id> \
  CONVISO_INTEGRATION=DEPENDENCY_TRACK yarn test-e2e
```

`CONVISO_REPOSITORY_URL` and `CONVISO_BRANCH` are optional; leaving them out exercises the
fallback to the workflow variables. The step's outputs are printed at the end.

To exercise the action inside a real workflow before releasing it, reference the checkout itself:

```yaml
      - uses: actions/checkout@v7
      - uses: ./          # the action in this repository, at this commit
        with:
          api-key: ${{ secrets.CONVISO_API_KEY }}
          integration: 'DEPENDENCY_TRACK'
          company-id: '99'
```

## Publishing

Unlike the Azure DevOps task, a GitHub Action needs no packaging step and no `.vsix`: consumers
reference the repository at a git ref (`convisoappsec/github-sync-task@v1`). Publishing to the
Marketplace is about **discoverability** — a release tag is what actually makes a version usable.

### Releasing a version

1. **Rebuild the bundle and run the checks.**

   ```bash
   yarn all
   ```

2. **Raise the version** in `package.json`, and add an entry to `CHANGELOG.md`. Nothing in the
   runtime reads `package.json`, but keeping it aligned with the tag is what makes it possible to
   tell which release a `dist/index.js` came from.

3. **Commit `dist/`** along with the source change. CI fails the pull request otherwise.

4. **Tag and release.** Create a GitHub release from a `vMAJOR.MINOR.PATCH` tag (e.g. `v1.2.0`).
   The `release.yml` workflow then moves the `v1` tag to that release, so everyone pinned to
   `@v1` picks it up.

Recommend to consumers that they pin either the major tag (`@v1`, gets fixes automatically) or a
full commit SHA (`@a1b2c3…`, immutable — the strictest supply-chain option). A branch reference
such as `@master` is the one to avoid.

### Publishing to the GitHub Marketplace

The full walkthrough, including the one-time account setup, the exact release form and how to
update or remove a listing, is in **[docs/publishing-marketplace.md](docs/publishing-marketplace.md)**.
The short version:

1. The repository must be **public**, own a single `action.yml` **in its root**, and have a README.
2. The `name` in `action.yml` must be unique across the Marketplace, and `branding` must be set —
   both are already the case here.
3. Enable **two-factor authentication** on the account or organization that owns the repository.
4. On the repository home page, use the **"Publish this Action to the GitHub Marketplace"** banner
   and accept the GitHub Marketplace Developer Agreement.
5. Draft a release, tick **"Publish this Action to the GitHub Marketplace"**, choose the primary
   and secondary categories, tag it `vX.Y.Z`, and publish.

Every later release repeats step 5 only.

## Contributing

Contributions are welcome! To contribute:

1. **Fork the repository**

2. **Create a feature branch**

   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Commit your changes** — including a rebuilt `dist/`

   ```bash
   yarn all
   git commit -m "Add some feature"
   ```

4. **Push to the branch**

   ```bash
   git push origin feature/your-feature-name
   ```

5. **Open a pull request**

Ensure your code adheres to the project's coding standards and includes relevant tests.

## License

This project is licensed under the [MIT License](LICENSE).
