import { spawnSync } from 'node:child_process';

const result = spawnSync(process.execPath, ['node_modules/@playwright/test/cli.js', 'test'], {
  stdio: 'inherit',
  env: { ...process.env, DONKA_DOCS_RELEASE: '1' },
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
