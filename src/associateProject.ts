// File: src/associateProject.ts
import axios from 'axios';

/**
 * Defines the parameters needed for associateProject.
 */
export interface AssociateProjectInput {
    apiKey: string;
    integration: string;   // e.g. "CONVISO_SCANNER" (GraphQL enum)
    projectId: string;
    companyId: string;
    repositoryUrl?: string;
    branch?: string;
}

/**
 * Shape of the GraphQL response for the mutation.
 * You can expand/refine this as needed.
 */
export interface AssociateProjectResponse {
    data?: {
        associateProject?: {
            clientMutationId?: string;
            data?: {
                asset?: {
                    id?: number;
                    name?: string;
                };
            };
        };
    };
    errors?: any;
}

/** Conviso's GraphQL endpoint. */
export const CONVISO_GRAPHQL_ENDPOINT = 'https://app.convisoappsec.com/graphql';

/**
 * The mutation is a static document and every value travels in `variables`.
 *
 * Interpolating values into the query text would let a branch or repository name
 * containing quotes or braces rewrite the document, since both come from the workflow
 * environment rather than from us. `integration` is a GraphQL enum, but as a variable it
 * is sent as a plain string ("DEPENDENCY_TRACK") and coerced server-side, so it needs no
 * special casing either.
 */
const ASSOCIATE_PROJECT_MUTATION = `
    mutation AssociateProject($input: AssociateProjectInput!) {
      associateProject(input: $input) {
        clientMutationId
        data {
          asset {
            id
            name
          }
        }
      }
    }
`;

/**
 * Calls the GQL endpoint with the given input, sending x-api-key as a header.
 */
export async function associateProject(
    { apiKey, integration, projectId, companyId, repositoryUrl, branch }: AssociateProjectInput
): Promise<AssociateProjectResponse> {

    const input: Record<string, unknown> = { integration, projectId, companyId };

    // Both fields are omitted rather than sent empty, so a call that does not use the
    // feature stays byte-for-byte the request this action has always made.
    if (repositoryUrl) {
        input.repositoryUrl = repositoryUrl;

        // The API only honours branches alongside a repositoryUrl — without one it
        // discards them silently. Sending a branch on its own would look like it worked.
        if (branch) {
            input.branches = [branch];
        }
    }

    // POST to the Conviso GraphQL endpoint
    const response = await axios.post<AssociateProjectResponse>(
        CONVISO_GRAPHQL_ENDPOINT,
        { query: ASSOCIATE_PROJECT_MUTATION, variables: { input } },
        {
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'Origin': 'GitHub Actions Conviso Task',
            },
        }
    );

    return response.data;
}
