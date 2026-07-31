// File: src/main.ts
import * as core from '@actions/core';
import { associateProject } from './associateProject';
import { envReader, resolveBranch, resolveRepositoryUrl } from './workflowContext';

/**
 * The action itself. Kept apart from index.ts — which does nothing but call it — so the
 * wiring between inputs, the workflow context and the API call can be unit tested.
 */
export async function run(): Promise<void> {
    try {
        // 1. Read required inputs from the workflow
        const apiKey = core.getInput('api-key', { required: true });          // Required
        const projectId = core.getInput('project-id');                        // Optional
        const integration = core.getInput('integration', { required: true }); // Required
        const companyId = core.getInput('company-id', { required: true });    // Required

        // The runner only masks what it knows is a secret. Registering the key here means
        // that even a workflow which pastes it literally into the YAML gets `***` in the
        // log instead of the key itself.
        if (apiKey) { core.setSecret(apiKey); }

        // 2. Optional repository/branch context. An explicit input always wins; the
        //    workflow's own variables are the fallback, so the common case needs no YAML.
        const repositoryUrl = core.getInput('repository-url')
            || resolveRepositoryUrl(envReader);
        const branch = core.getInput('branch')
            || resolveBranch(envReader);

        // Conviso only records branches for a repository, and drops them without a word
        // otherwise. Say so here, or the branch vanishes with the run still reporting success.
        if (branch && !repositoryUrl) {
            core.warning(
                'branch was resolved but repository-url is empty, so Conviso will ignore the branch. '
                + 'Set the repository-url input to associate this scan with a branch.'
            );
        }

        // 3. Call the external GraphQL API
        const result = await associateProject({
            apiKey,
            integration,
            projectId,
            companyId,
            repositoryUrl,
            branch,
        });

        // 4. Log or handle the result
        core.info(`Response from Conviso: ${JSON.stringify(result, null, 2)}`);

        // 5. Expose the associated Asset to the steps that follow
        const asset = result?.data?.associateProject?.data?.asset;
        core.setOutput('asset-id', asset?.id != null ? String(asset.id) : '');
        core.setOutput('asset-name', asset?.name ?? '');

        core.info('Task completed successfully.');
    } catch (err: unknown) {
        // 6. Mark the step as failed for GitHub Actions
        core.setFailed(err instanceof Error ? err.message : String(err));
    }
}
