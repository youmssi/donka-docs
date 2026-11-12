import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(await readFile(path.join(root, 'content-sources.json'), 'utf8'));
const expected = new Map([
  ['studio', 'studio'],
  ['runtime', 'donka-runtime'],
  ['cli', 'donka-cli'],
]);
const refs = {};
for (const [key, directory] of expected) {
  const repository = manifest.repositories[key];
  if (!repository || repository.directory !== directory || !/^[a-f0-9]{40}$/.test(repository.ref)) {
    throw new Error(`Missing or invalid pinned checkout for ${key}`);
  }
  refs[key] = repository.ref;
}

const outputFile = process.env.GITHUB_OUTPUT;
if (outputFile) {
  await writeFile(
    outputFile,
    `${Object.entries(refs)
      .map(([key, ref]) => `${key}=${ref}`)
      .join('\n')}\n`,
    { flag: 'a' },
  );
} else {
  process.stdout.write(`${JSON.stringify(refs, null, 2)}\n`);
}
