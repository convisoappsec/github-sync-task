// File: src/workflowContext.ts
//
// Resolves the repository/branch context of the running workflow. Kept apart from
// index.ts so the resolution rules can be unit tested without a live runner.

/**
 * How the action reads a workflow variable. Mirrors a lookup in `process.env`, and is
 * injected so tests can supply a plain map instead of a GitHub runner environment.
 */
export type VariableReader = (name: string) => string | undefined;

/** Reads from the real environment. Used by index.ts; tests pass their own reader. */
export const envReader: VariableReader = (name: string) => process.env[name];

/** Where github.com lives, for the rare run that reports a repository but no server. */
const DEFAULT_SERVER_URL = 'https://github.com';

/**
 * Strips the `refs/heads/` prefix GitHub puts on branch refs, leaving the branch name
 * the Conviso API expects (`refs/heads/main` -> `main`).
 *
 * Anything else is returned untouched on purpose: a `refs/tags/v1` or a raw name is
 * passed through as-is so the platform records what the workflow actually reported,
 * rather than this action guessing a branch name that was never there.
 */
export function normalizeRef(ref?: string): string {
    if (!ref) { return ''; }

    return ref.replace(/^refs\/heads\//, '');
}

/**
 * The branch this run is for.
 *
 * `GITHUB_BASE_REF` comes first because in a pull request run the ordinary variables are
 * useless as branch names: `GITHUB_REF` is `refs/pull/42/merge` and `GITHUB_REF_NAME` is
 * the literal string `42/merge`. `GITHUB_BASE_REF` carries a real branch name — the
 * branch the PR is merging into — and is only set on `pull_request` and
 * `pull_request_target` events, so push runs fall straight through to `GITHUB_REF`.
 */
export function resolveBranch(getVariable: VariableReader): string {
    return normalizeRef(getVariable('GITHUB_BASE_REF'))
        || normalizeRef(getVariable('GITHUB_REF'));
}

/**
 * The repository this run checked out.
 *
 * GitHub reports it in two halves — `GITHUB_SERVER_URL` (`https://github.com`, or your
 * GitHub Enterprise Server host) and `GITHUB_REPOSITORY` (`org/repo`) — so the URL
 * Conviso stores is assembled here rather than read from a single variable.
 */
export function resolveRepositoryUrl(getVariable: VariableReader): string {
    const repository = getVariable('GITHUB_REPOSITORY');
    if (!repository) { return ''; }

    const serverUrl = getVariable('GITHUB_SERVER_URL') || DEFAULT_SERVER_URL;

    return `${serverUrl.replace(/\/+$/, '')}/${repository}`;
}
