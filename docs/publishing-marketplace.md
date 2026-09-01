# Publishing to the GitHub Marketplace

Everything needed to get **Sync External Scans with Conviso** listed on the
[GitHub Marketplace](https://github.com/marketplace?type=actions), and to keep it updated
afterwards.

Read this once end to end before the first publish. After that, only
[§5 Releasing a new version](#5-releasing-a-new-version) applies.

---

## 0. What publishing actually does

An action does **not** need to be on the Marketplace to be usable. Anyone can already run it with:

```yaml
- uses: convisoappsec/github-sync-task@v1
```

as long as the repository is public and the tag exists. Publishing adds:

- a listing page with the README rendered on it, and a Marketplace search entry;
- the action showing up in the workflow editor's sidebar;
- a version dropdown on the listing, tied to your releases;
- a verified-creator badge, if the owning organization has one.

So the release is what makes a version *work*; the Marketplace is what makes it *found*. If the
listing step ever blocks you, publish the release anyway — consumers are unaffected.

---

## 1. Requirements checklist

GitHub refuses the listing unless all of these hold. Everything under "already done" is committed
in this repository; the rest is account configuration that only a person can do.

### Already done in this repository

- [x] **A metadata file in the repository root** named `action.yml`. It must be at the root, not
      in a subdirectory, and the repository must contain a single action.
- [x] **`name`, `description`, `runs`** set in `action.yml`.
- [x] **`branding`** set in `action.yml` (`icon: shield`, `color: blue`). The Marketplace uses it
      for the listing's tile; `icon` must be a [Feather](https://feathericons.com/) icon name and
      `color` one of `white`, `yellow`, `blue`, `green`, `orange`, `red`, `purple`, `gray-dark`.
- [x] **A README.md** — it becomes the body of the listing page.
- [x] **A LICENSE** file.
- [x] **`dist/index.js` committed**, because the runner executes it directly. See
      [README → Building the bundle](../README.md#building-the-bundle).

### To be done once, by a person

- [ ] **The repository is public.** Private repositories cannot be listed.
- [ ] **The `name` in `action.yml` is unique across the Marketplace.** GitHub rejects a name that
      another listing already uses, that matches an existing GitHub user or organization, or that
      collides with a Marketplace category. `Sync External Scans with Conviso` is specific enough
      to be safe, but the check happens at publish time — if it fails, change `name` in
      `action.yml` (the `uses:` reference is the repository path, so renaming does not break
      consumers).
- [ ] **Two-factor authentication is enabled** for the account that owns the repository. For
      `convisoappsec`, that means 2FA on the organization; an owner enables it under
      *Organization settings → Authentication security*.
- [ ] **The GitHub Marketplace Developer Agreement is accepted**, which the publish flow prompts
      for the first time.
- [ ] **You have write (or admin) access** to the repository.

---

## 2. One-time setup of the listing

1. Push `action.yml` to the default branch, if it is not there yet.

2. Open the repository home page on GitHub. A banner appears:

   > **Publish this Action to the GitHub Marketplace** — this repository has an `action.yml`…

   Click **Draft a release** on it. If the banner is missing, the usual causes are: the repository
   is private, `action.yml` is not in the root, or it is missing `name`/`description`/`runs`.

3. Accept the **GitHub Marketplace Developer Agreement** when prompted. This is per account or
   organization, and asked only once.

4. Continue into the release form described next.

---

## 3. Publishing the first release

On the release form (**Releases → Draft a new release**):

| Field | What to enter |
|---|---|
| **Publish this Action to the GitHub Marketplace** | Tick it. This checkbox is the actual "publish" — it only appears once §1 and §2 are satisfied. |
| **Primary category** | `Security` |
| **Secondary category** | `Continuous integration` |
| **Choose a tag** | `v1.0.0` — create it from the form. Semantic versioning, `v`-prefixed. |
| **Target** | `master` |
| **Release title** | `v1.0.0` |
| **Describe this release** | The `CHANGELOG.md` entry for this version. |
| **Set as the latest release** | Leave ticked. |

GitHub validates the metadata when you tick the checkbox and reports anything missing inline —
fix it, push, and reload the form.

Click **Publish release**. The listing goes live at
`https://github.com/marketplace/actions/<slugified-action-name>`, and the `release.yml` workflow
moves the `v1` tag onto this release so `@v1` starts resolving.

---

## 4. After publishing — verify

1. Open the Marketplace listing and check that the README renders and the version appears in the
   dropdown.
2. In a scratch repository, run the published reference end to end:

   ```yaml
   - uses: convisoappsec/github-sync-task@v1
     with:
       api-key: ${{ secrets.CONVISO_API_KEY }}
       integration: 'DEPENDENCY_TRACK'
       company-id: '99'
       project-id: '<a project in that integration>'
   ```

   A green step whose log ends in `Task completed successfully.` means the tag, the bundle and the
   metadata all line up. This is worth doing once per major version: it is the only check that
   exercises what consumers actually download.

---

## 5. Releasing a new version

For every subsequent version:

1. `yarn all` — typecheck, test, and rebuild `dist/`.
2. Bump `version` in `package.json` and add a `CHANGELOG.md` entry.
3. Commit, including `dist/`, and merge to `master`.
4. **Releases → Draft a new release**, new tag `vX.Y.Z`, keep **Publish this Action to the GitHub
   Marketplace** ticked, paste the changelog entry, publish.
5. Confirm the `Move the major version tag` workflow succeeded — that is what re-points `v1`.

Version numbers follow [semver](https://semver.org/), read from the consumer's point of view:

| Change | Bump |
|---|---|
| A new optional input, a new output, a better default | minor |
| A bug fix, a dependency update, docs | patch |
| A renamed or removed input, a changed default that alters what Conviso records, a new Node runtime in `runs.using` | **major** |

A major bump means consumers pinned to `@v1` keep the old behaviour until they move to `@v2`
themselves. That is the point of the moving major tag — do not "fix" a breaking change into `v1`.

---

## 6. Updating or removing the listing

- **Listing text**: it is the README of the released tag. Update the README and cut a release; the
  listing follows.
- **Categories, or the listing itself**: edit the release and re-open the Marketplace section, or
  use the *Marketplace* tab on the repository.
- **Unlist a version**: delete or unpublish that release. Consumers referencing the tag or a SHA
  keep working — unlisting affects discovery, not resolution.
- **Remove the listing entirely**: untick the Marketplace checkbox on every published release. As
  above, existing `uses:` references keep resolving.

---

## 7. Troubleshooting

| Symptom | Cause and fix |
|---|---|
| No "Publish this Action" banner | Repository is private, `action.yml` is not in the root, or it lacks `name`/`description`/`runs`. |
| *"The name is already taken"* | Another listing, a GitHub user/organization, or a Marketplace category uses it. Change `name` in `action.yml` — it does not affect `uses:` references. |
| *"You must enable two-factor authentication"* | 2FA on the owning account/organization. See §1. |
| Consumers get *"Can't find 'action.yml'"* | The tag they reference predates `action.yml`, or points at a commit where it is missing. |
| The action runs old behaviour after a release | `dist/` was not rebuilt before tagging. Run `yarn build`, commit, and cut a new patch release; CI's `check-dist` job exists to prevent exactly this. |
| *"Missing download info for actions/…"* or a Node version error | `runs.using` names a runtime the consumer's runner does not have. This action targets `node24`; a self-hosted runner on an older runner release may need updating. |
| The step is green but Conviso recorded nothing | The API answered `200` with a GraphQL error — see [Known behaviour](#8-known-behaviour). |

---

## 8. Known behaviour

Two behaviours are deliberate, not oversights. They are documented here so a future change is a
decision rather than a surprise:

1. **A GraphQL error does not fail the step.** The action marks success whenever the HTTP call
   does not throw, including when the response body carries `errors` and `data: null` — for
   example when Conviso rejects the association. Changing this would turn currently-green
   workflows red, so it is a product decision rather than an implementation one. The full response
   is printed in the log.

2. **A branch without a repository is dropped silently by the API.** The action warns
   (`branch was resolved but repository-url is empty…`) but still succeeds, because the API's
   answer is a `200`. Branch association additionally depends on a per-company feature flag in
   Conviso Platform; while it is off, the two inputs are accepted and have no effect.

---

## 9. Reference

- [Publishing actions in GitHub Marketplace](https://docs.github.com/actions/creating-actions/publishing-actions-in-github-marketplace)
- [Metadata syntax for GitHub Actions](https://docs.github.com/actions/creating-actions/metadata-syntax-for-github-actions)
- [Creating a JavaScript action](https://docs.github.com/actions/creating-actions/creating-a-javascript-action)
- [Security hardening for GitHub Actions](https://docs.github.com/actions/security-guides/security-hardening-for-github-actions)
