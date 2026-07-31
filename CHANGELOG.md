# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — Unreleased

First release.

### Added

- `api-key`, `project-id`, `integration` and `company-id` inputs, triggering the
  `associateProject` mutation against the Conviso GraphQL API.
- `repository-url` and `branch` inputs, so a scan is recorded against the repository and branch it
  came from. Both default to the workflow's own context (`GITHUB_SERVER_URL`/`GITHUB_REPOSITORY`
  and `GITHUB_BASE_REF`/`GITHUB_REF`), so the common case needs no configuration.
- A warning when `branch` resolves without `repository-url`, the combination Conviso Platform
  discards without a word.
- `asset-id` and `asset-name` outputs, exposing the associated Asset to later steps.
- Masking of the API key through `core.setSecret`, so it appears as `***` in the run log even when
  a workflow passes it literally.
- CI that typechecks, tests, and fails when the committed `dist/` no longer matches the sources.
- A workflow that moves the `v<major>` tag on every published release.

### Notes

- Input names are lowercase and hyphenated, following GitHub Actions convention.
- The `Origin` header sent to Conviso is `GitHub Actions Conviso Task`, identifying which CI the
  call came from.
- Two behaviours are deliberate: a GraphQL error in the response body does not fail the step, and
  branch association depends on a per-company feature flag in Conviso Platform. Both are
  documented in
  [docs/publishing-marketplace.md](docs/publishing-marketplace.md#8-known-behaviour).
