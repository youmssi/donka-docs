import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(await readFile(path.join(root, 'content-sources.json'), 'utf8'));
const releases = JSON.parse(await readFile(path.join(root, 'release-manifest.json'), 'utf8'));
if (!Array.isArray(releases.versions)) throw new Error('The release manifest must contain a versions array.');
const selected = releases.versions.find((version) => version.id === releases.current);
if (
  !selected ||
  !/^[a-z0-9][a-z0-9._-]*$/.test(selected.id) ||
  new Set(releases.versions.map((version) => version.id)).size !== releases.versions.length
) {
  throw new Error('The release manifest must select one uniquely named version.');
}
const expected = new Map([
  ['studio', 'studio'],
  ['runtime', 'donka-runtime'],
  ['cli', 'donka-cli'],
]);
const refs = {};
for (const [key, directory] of expected) {
  const repository = manifest.repositories[key];
  const product = selected.repositories?.[key];
  const validRef = product?.tag === null ? /^[a-f0-9]{40}$/.test(product.ref) : product?.ref === product?.tag;
  if (!repository || repository.directory !== directory || !validRef) {
    throw new Error(`Missing or invalid pinned checkout for ${key}`);
  }
  refs[key] = product.ref;
}

const outputFile = process.env.GITHUB_OUTPUT;
if (outputFile) {
  await writeFile(
    outputFile,
    `version=${selected.id}\n${Object.entries(refs)
      .map(([key, ref]) => `${key}=${ref}`)
      .join('\n')}\n`,
    { flag: 'a' },
  );
} else {
  process.stdout.write(`${JSON.stringify(refs, null, 2)}\n`);
}
