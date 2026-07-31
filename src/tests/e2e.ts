// File: src/tests/e2e.ts
//
// Runs the *bundled* action the way the GitHub runner does — a plain `node dist/index.js`
// with the inputs handed over as INPUT_* environment variables — against the real Conviso
// Platform. Build first:
//
//   yarn build && yarn test-e2e
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// Path to the action's bundled entry point.
const actionPath = path.join(process.cwd(), 'dist', 'index.js');

if (!fs.existsSync(actionPath)) {
    console.error(`${actionPath} not found. Run \`yarn build\` first.`);
    process.exit(1);
}

// Taken from the environment so no credential or company of yours is committed:
//   CONVISO_API_KEY=... CONVISO_COMPANY_ID=... CONVISO_PROJECT_ID=... yarn test-e2e
const API_KEY = process.env.CONVISO_API_KEY || '';
const COMPANY_ID = process.env.CONVISO_COMPANY_ID || '';
const PROJECT_ID = process.env.CONVISO_PROJECT_ID || '';
const INTEGRATION = process.env.CONVISO_INTEGRATION || 'DEPENDENCY_TRACK';

if (!API_KEY || !COMPANY_ID || !PROJECT_ID) {
    console.error(
        'Set CONVISO_API_KEY, CONVISO_COMPANY_ID and CONVISO_PROJECT_ID before running the e2e.'
    );
    process.exit(1);
}

// Optional: left empty, the action falls back to the workflow variables below.
const REPOSITORY_URL = process.env.CONVISO_REPOSITORY_URL || '';
const BRANCH = process.env.CONVISO_BRANCH || '';

// The runner writes step outputs to a file it points GITHUB_OUTPUT at. Standing one up
// here keeps `core.setOutput` on its normal path and lets us show what the step exported.
const outputFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'conviso-e2e-')), 'output');
fs.writeFileSync(outputFile, '');

// Inputs reach an action as INPUT_<NAME>, uppercased. Anything you would set under
// `with:` in a workflow goes here.
const env: NodeJS.ProcessEnv = {
    ...process.env,
    'INPUT_API-KEY': API_KEY,
    'INPUT_PROJECT-ID': PROJECT_ID,
    'INPUT_INTEGRATION': INTEGRATION,
    'INPUT_COMPANY-ID': COMPANY_ID,
    'INPUT_REPOSITORY-URL': REPOSITORY_URL,
    'INPUT_BRANCH': BRANCH,
    GITHUB_OUTPUT: outputFile,

    // Uncomment to exercise the auto-detection instead of passing the two inputs above.
    // GITHUB_SERVER_URL: 'https://github.com',
    // GITHUB_REPOSITORY: 'org/repo',
    // GITHUB_REF: 'refs/heads/main',
    // GITHUB_BASE_REF: '',            // set to a branch name to simulate a pull_request run
};

const result = spawnSync(process.execPath, [actionPath], { env, stdio: 'inherit' });

console.log('\n--- step outputs -------------------------------------------------');
console.log(fs.readFileSync(outputFile, 'utf8').trim() || '(none)');
console.log('------------------------------------------------------------------');

process.exit(result.status ?? 1);
