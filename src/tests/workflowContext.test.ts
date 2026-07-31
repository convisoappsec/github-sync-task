// File: src/tests/workflowContext.test.ts
import { describe, expect, it } from 'vitest';
import { normalizeRef, resolveBranch, resolveRepositoryUrl } from '../workflowContext';

/** Builds an environment stand-in backed by a plain map. */
function reader(vars: Record<string, string>) {
    return (name: string) => vars[name];
}

describe('normalizeRef', () => {
    it('strips the refs/heads/ prefix', () => {
        expect(normalizeRef('refs/heads/main')).toBe('main');
    });

    it('keeps slashes inside the branch name', () => {
        expect(normalizeRef('refs/heads/feature/foo')).toBe('feature/foo');
    });

    it('leaves an already-bare branch name alone', () => {
        expect(normalizeRef('main')).toBe('main');
    });

    // Passed through rather than mangled: the platform records what the workflow
    // reported instead of a branch name this action invented.
    it('passes through refs it does not recognise', () => {
        expect(normalizeRef('refs/tags/v1')).toBe('refs/tags/v1');
        expect(normalizeRef('refs/pull/42/merge')).toBe('refs/pull/42/merge');
    });

    it('returns an empty string for a missing ref', () => {
        expect(normalizeRef(undefined)).toBe('');
        expect(normalizeRef('')).toBe('');
    });
});

describe('resolveBranch', () => {
    it('uses GITHUB_REF on a push run', () => {
        const branch = resolveBranch(reader({ GITHUB_REF: 'refs/heads/main' }));

        expect(branch).toBe('main');
    });

    // On a pull_request run GITHUB_REF is refs/pull/42/merge and GITHUB_REF_NAME is the
    // literal "42/merge" — only GITHUB_BASE_REF carries a usable branch name.
    it('prefers the pull request base ref when present', () => {
        const branch = resolveBranch(reader({
            GITHUB_BASE_REF: 'main',
            GITHUB_HEAD_REF: 'feature/login',
            GITHUB_REF: 'refs/pull/42/merge',
        }));

        expect(branch).toBe('main');
    });

    // GitHub sends GITHUB_BASE_REF bare, but normalising it costs nothing and keeps a
    // full ref from leaking through on a GitHub Enterprise Server that sends one.
    it('normalises a base ref that arrives as a full ref', () => {
        const branch = resolveBranch(reader({
            GITHUB_BASE_REF: 'refs/heads/release/2.0',
            GITHUB_REF: 'refs/pull/42/merge',
        }));

        expect(branch).toBe('release/2.0');
    });

    it('returns an empty string outside a workflow', () => {
        expect(resolveBranch(reader({}))).toBe('');
    });
});

describe('resolveRepositoryUrl', () => {
    it('joins the server URL and the repository', () => {
        const url = resolveRepositoryUrl(reader({
            GITHUB_SERVER_URL: 'https://github.com',
            GITHUB_REPOSITORY: 'org/repo',
        }));

        expect(url).toBe('https://github.com/org/repo');
    });

    it('honours a GitHub Enterprise Server host', () => {
        const url = resolveRepositoryUrl(reader({
            GITHUB_SERVER_URL: 'https://github.acme.internal',
            GITHUB_REPOSITORY: 'org/repo',
        }));

        expect(url).toBe('https://github.acme.internal/org/repo');
    });

    it('does not double the slash when the server URL ends with one', () => {
        const url = resolveRepositoryUrl(reader({
            GITHUB_SERVER_URL: 'https://github.com/',
            GITHUB_REPOSITORY: 'org/repo',
        }));

        expect(url).toBe('https://github.com/org/repo');
    });

    it('falls back to github.com when only the repository is known', () => {
        const url = resolveRepositoryUrl(reader({ GITHUB_REPOSITORY: 'org/repo' }));

        expect(url).toBe('https://github.com/org/repo');
    });

    it('returns an empty string when the repository is absent', () => {
        expect(resolveRepositoryUrl(reader({}))).toBe('');
        expect(resolveRepositoryUrl(reader({ GITHUB_SERVER_URL: 'https://github.com' }))).toBe('');
    });
});
