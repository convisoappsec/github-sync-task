// File: src/tests/main.test.ts
//
// Covers the wiring: which inputs are read, when the workflow environment is used as a
// fallback, what reaches associateProject, and what the step reports back.
import {
    afterAll, beforeEach, describe, expect, it, vi,
    type Mocked, type MockedFunction,
} from 'vitest';
import * as core from '@actions/core';
import { run } from '../main';
import { associateProject } from '../associateProject';

vi.mock('@actions/core');
vi.mock('../associateProject');

const mockedCore = core as Mocked<typeof core>;
const mockedAssociateProject = associateProject as MockedFunction<typeof associateProject>;

const requiredInputs = {
    'api-key': 'testApiKey',
    'integration': 'CONVISO_SCANNER',
    'company-id': '99',
    'project-id': '42',
};

/**
 * Stands in for `core.getInput`, including its habit of throwing on a missing required
 * input — that throw is what turns into a failed step.
 */
function withInputs(inputs: Record<string, string>) {
    mockedCore.getInput.mockImplementation((name: string, options?: core.InputOptions) => {
        const value = inputs[name] ?? '';
        if (!value && options?.required) {
            throw new Error(`Input required and not supplied: ${name}`);
        }

        return value;
    });
}

/** Replaces the GITHUB_* variables for the duration of one test. */
function withEnvironment(vars: Record<string, string>) {
    for (const name of Object.keys(process.env)) {
        if (name.startsWith('GITHUB_')) { delete process.env[name]; }
    }
    Object.assign(process.env, vars);
}

/** The single call made to associateProject. */
function sentArgs() {
    return mockedAssociateProject.mock.calls[0][0];
}

const originalEnv = { ...process.env };

describe('run', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        withInputs(requiredInputs);
        withEnvironment({});
        mockedAssociateProject.mockResolvedValue({
            data: { associateProject: { data: { asset: { id: 1234, name: 'org/repo' } } } },
        });
    });

    afterAll(() => {
        process.env = { ...originalEnv };
    });

    it('passes the required inputs through to the API call', async () => {
        await run();

        expect(mockedAssociateProject).toHaveBeenCalledTimes(1);
        expect(sentArgs()).toMatchObject({
            apiKey: 'testApiKey',
            integration: 'CONVISO_SCANNER',
            companyId: '99',
            projectId: '42',
        });
        expect(mockedCore.setFailed).not.toHaveBeenCalled();
    });

    // Even a key pasted literally into the YAML gets masked in the log this way.
    it('registers the API key as a secret', async () => {
        await run();

        expect(mockedCore.setSecret).toHaveBeenCalledWith('testApiKey');
    });

    it('publishes the associated Asset as step outputs', async () => {
        await run();

        expect(mockedCore.setOutput).toHaveBeenCalledWith('asset-id', '1234');
        expect(mockedCore.setOutput).toHaveBeenCalledWith('asset-name', 'org/repo');
    });

    it('publishes empty outputs when the API associated no Asset', async () => {
        mockedAssociateProject.mockResolvedValue({ data: { associateProject: { data: {} } } });

        await run();

        expect(mockedCore.setOutput).toHaveBeenCalledWith('asset-id', '');
        expect(mockedCore.setOutput).toHaveBeenCalledWith('asset-name', '');
        expect(mockedCore.setFailed).not.toHaveBeenCalled();
    });

    it('falls back to the workflow repository and branch when the inputs are empty', async () => {
        withEnvironment({
            GITHUB_SERVER_URL: 'https://github.com',
            GITHUB_REPOSITORY: 'org/repo',
            GITHUB_REF: 'refs/heads/release/2.0',
        });

        await run();

        expect(sentArgs()).toMatchObject({
            repositoryUrl: 'https://github.com/org/repo',
            branch: 'release/2.0',
        });
        expect(mockedCore.warning).not.toHaveBeenCalled();
    });

    it('lets the explicit inputs win over the workflow environment', async () => {
        withInputs({
            ...requiredInputs,
            'repository-url': 'https://github.com/other/repo',
            'branch': 'develop',
        });
        withEnvironment({
            GITHUB_SERVER_URL: 'https://github.com',
            GITHUB_REPOSITORY: 'org/repo',
            GITHUB_REF: 'refs/heads/main',
        });

        await run();

        expect(sentArgs()).toMatchObject({
            repositoryUrl: 'https://github.com/other/repo',
            branch: 'develop',
        });
    });

    // The API drops a branch that arrives without a repository, so this combination has
    // to be called out — otherwise the step is green and the branch is nowhere.
    it('warns when a branch was resolved without a repository, and still succeeds', async () => {
        withInputs({ ...requiredInputs, branch: 'develop' });

        await run();

        expect(mockedCore.warning).toHaveBeenCalledWith(expect.stringContaining('repository-url'));
        expect(mockedCore.setFailed).not.toHaveBeenCalled();
    });

    it('fails the step when a required input is missing', async () => {
        withInputs({ integration: 'CONVISO_SCANNER', 'company-id': '99' });

        await run();

        expect(mockedAssociateProject).not.toHaveBeenCalled();
        expect(mockedCore.setFailed).toHaveBeenCalledWith(
            'Input required and not supplied: api-key'
        );
    });

    it('fails the step when the API call throws', async () => {
        mockedAssociateProject.mockRejectedValue(new Error('Network error'));

        await run();

        expect(mockedCore.setFailed).toHaveBeenCalledWith('Network error');
    });
});
