// File: src/index.ts
//
// Entry point named in action.yml (`runs.main`). It only starts the action — the logic
// lives in main.ts so it can be tested without loading this file's side effect.
import { run } from './main';

void run();
