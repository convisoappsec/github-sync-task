// File: src/tests/associateProject.test.ts
import { beforeEach, describe, expect, it, vi, type Mocked } from 'vitest';
import axios from 'axios';
import { associateProject } from '../associateProject';

// Tell Vitest to mock axios
vi.mock('axios');
const mockedAxios = axios as Mocked<typeof axios>;

const baseArgs = {
    apiKey: 'testApiKey',
    integration: 'CONVISO_SCANNER',
    projectId: '42',
    companyId: '99',
};

const mockResponseData = {
    data: {
        associateProject: {
            clientMutationId: null,
            data: { asset: { id: 1234, name: 'MyApp' } },
        },
    },
};

/** The `variables.input` of the single POST that was made. */
function sentInput(): Record<string, unknown> {
    const [, body] = mockedAxios.post.mock.calls[0] as [string, any];

    return body.variables.input;
}

/** The mutation document of the single POST that was made. */
function sentQuery(): string {
    const [, body] = mockedAxios.post.mock.calls[0] as [string, any];

    return body.query;
}

describe('associateProject', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockedAxios.post.mockResolvedValue({ data: mockResponseData });
    });

    it('posts to the GraphQL endpoint with the expected headers', async () => {
        await associateProject(baseArgs);

        expect(mockedAxios.post).toHaveBeenCalledTimes(1);

        const [url, , config] = mockedAxios.post.mock.calls[0] as [string, any, any];
        expect(url).toContain('/graphql');
        expect(config.headers).toEqual({
            'Content-Type': 'application/json',
            'x-api-key': 'testApiKey',
            'Origin': 'GitHub Actions Conviso Task',
        });
    });

    it('returns the response data', async () => {
        const result = await associateProject(baseArgs);

        expect(result).toEqual(mockResponseData);
    });

    it('sends the required fields in variables, not interpolated into the query', async () => {
        await associateProject(baseArgs);

        expect(sentInput()).toEqual({
            integration: 'CONVISO_SCANNER',
            projectId: '42',
            companyId: '99',
        });
        expect(sentQuery()).toContain('$input: AssociateProjectInput!');
        expect(sentQuery()).not.toContain('CONVISO_SCANNER');
    });

    it('omits repositoryUrl and branches when neither is provided', async () => {
        await associateProject(baseArgs);

        expect(sentInput()).not.toHaveProperty('repositoryUrl');
        expect(sentInput()).not.toHaveProperty('branches');
    });

    it('sends repositoryUrl and branches together', async () => {
        await associateProject({
            ...baseArgs,
            repositoryUrl: 'https://github.com/org/repo',
            branch: 'main',
        });

        expect(sentInput()).toMatchObject({
            repositoryUrl: 'https://github.com/org/repo',
            branches: ['main'],
        });
    });

    it('sends repositoryUrl without branches when no branch is provided', async () => {
        await associateProject({ ...baseArgs, repositoryUrl: 'https://github.com/org/repo' });

        expect(sentInput()).toMatchObject({ repositoryUrl: 'https://github.com/org/repo' });
        expect(sentInput()).not.toHaveProperty('branches');
    });

    // The API drops branches that arrive without a repositoryUrl, so sending one alone
    // would silently do nothing. Keep it out of the request entirely.
    it('never sends branches without a repositoryUrl', async () => {
        await associateProject({ ...baseArgs, branch: 'develop' });

        expect(sentInput()).not.toHaveProperty('branches');
        expect(sentInput()).not.toHaveProperty('repositoryUrl');
    });

    // Regression: these values come from the workflow environment. Interpolated into the
    // query text, a name like this one would rewrite the document.
    it('keeps the query intact when a branch name contains GraphQL syntax', async () => {
        const hostileBranch = 'x") { id } } mutation evil {';

        await associateProject({
            ...baseArgs,
            repositoryUrl: 'https://github.com/org/repo',
            branch: hostileBranch,
        });

        expect(sentInput()).toMatchObject({ branches: [hostileBranch] });
        expect(sentQuery()).not.toContain(hostileBranch);
        expect(sentQuery()).not.toContain('mutation evil');
    });

    it('should throw an error if the GraphQL request fails', async () => {
        mockedAxios.post.mockReset();
        mockedAxios.post.mockRejectedValueOnce(new Error('Network error'));

        await expect(associateProject(baseArgs)).rejects.toThrow('Network error');
    });
});
