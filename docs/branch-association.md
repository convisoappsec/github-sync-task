# Branch association

How `repository-url` and `branch` behave, and why the action is built the way it is. This is the
GitHub port of the behaviour specified and validated for
[`azure-sync-task`](https://github.com/convisoappsec/azure-sync-task); the API contract described
here was verified against the Conviso backend during that work and is unchanged.

## The contract

The `associateProject` mutation accepts:

| Argument         | Type       | Required | Sent by this action |
|------------------|------------|----------|---------------------|
| `companyId`      | `ID`       | yes      | always              |
| `integration`    | enum       | yes      | always              |
| `projectId`      | `ID`       | no       | always              |
| `repositoryUrl`  | `String`   | no       | when resolved       |
| `branches`       | `[String]` | no       | only alongside `repositoryUrl` |
| `subprojectPath` | `String`   | no       | never — out of scope (monorepos) |
| `projectIds`     | `[ID]`     | no       | never — deprecated, and incompatible with `repositoryUrl` |

## The gate that defines everything

`branches` **only takes effect** when both conditions hold:

1. `repositoryUrl` is present, **and**
2. the `asset-branch-model-write` feature flag is enabled for the company.

Two consequences the action is designed around:

- **Sending `branches` without `repositoryUrl` is a silent no-op.** No error, no warning from the
  API — the value is discarded and the association falls back to the legacy, name-based path. That
  is why the action warns locally instead of relying on the response, and why `repositoryUrl` and
  `branch` were introduced together rather than one after the other.
- **The flag is per company.** With it off, behaviour is identical to not sending the fields at
  all. The change is backward-compatible by construction.

When the gate passes, the backend identifies the Asset by repository rather than by name, creates
a `Branch` per declared branch, and stamps a separate `ImportedScan` per branch. An older scan
with no branch is adopted by the default branch instead of being duplicated.

### One project per repository URL

`repositoryUrl` may only accompany a **single** project id — one URL identifies one repository, and
applying it to several projects would fold them all into the same Asset. The action sends the
singular `projectId`, so it is compliant by construction. Do not migrate it to `projectIds`.

## Why the values travel in GraphQL variables

The mutation is a static document and every value is sent under `variables`. `repository-url` and
`branch` are free-form strings coming from the workflow environment; interpolated into the query
text, a branch named `x") { id } } mutation evil {` would rewrite the document. There is a
regression test for exactly that name in
[src/tests/associateProject.test.ts](../src/tests/associateProject.test.ts).

`integration` is a GraphQL enum server-side, but as a variable it travels as a plain string
(`"DEPENDENCY_TRACK"`) and is coerced on arrival, so it needs no special casing.

## How the context is resolved on GitHub

[src/workflowContext.ts](../src/workflowContext.ts) reads the runner's environment:

| Value            | Source                                                                 |
|------------------|------------------------------------------------------------------------|
| `repositoryUrl`  | `GITHUB_SERVER_URL` + `/` + `GITHUB_REPOSITORY`                        |
| `branch`         | `GITHUB_BASE_REF`, else `GITHUB_REF` with `refs/heads/` stripped       |

- **`GITHUB_BASE_REF` comes first** because on `pull_request` and `pull_request_target` events the
  ordinary variables are useless as branch names: `GITHUB_REF` is `refs/pull/42/merge` and
  `GITHUB_REF_NAME` is the literal `42/merge`. `GITHUB_BASE_REF` carries the branch the pull
  request is merging into, and is unset on other events, so push runs fall straight through.
  This mirrors the Azure task's use of `System.PullRequest.TargetBranch`.
- **The repository URL is assembled from two halves**, unlike Azure's single
  `Build.Repository.Uri`. Reading `GITHUB_SERVER_URL` rather than hardcoding `https://github.com`
  is what makes the action work on GitHub Enterprise Server.
- **Unrecognised refs are passed through untouched** (`refs/tags/v1` stays as it is). The platform
  then records what the workflow actually reported, instead of a branch name the action invented.

## Out of scope, on purpose

- `subprojectPath` (monorepo support).
- More than one branch per call.
- Making the API endpoint configurable — it is hardcoded to
  `https://app.convisoappsec.com/graphql`. On-premise installations would need an input here; the
  local end-to-end run currently requires editing the constant.
