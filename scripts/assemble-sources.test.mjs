import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const evidence = path.join(root, 'content', 'docs', 'evidence');
const runner = path.join(root, 'scripts', 'assemble-sources.mjs');

test('assembles exact pinned sources, translation provenance, and safe links', async () => {
  await mkdir(evidence, { recursive: true });
  await writeFile(path.join(evidence, 'stale-owned-output.txt'), 'stale');
  execFileSync(process.execPath, [runner], { cwd: root, stdio: 'pipe' });

  const manifest = JSON.parse(await readFile(path.join(evidence, 'manifest.json'), 'utf8'));
  const publishedManifest = await readFile(path.join(root, 'public', 'evidence', 'source-manifest.json'), 'utf8');
  assert.equal(publishedManifest, await readFile(path.join(evidence, 'manifest.json'), 'utf8'));
  const definitions = JSON.parse(await readFile(path.join(root, 'content-sources.json'), 'utf8'));
  const sourcesRoot = path.resolve(process.env.DONKA_DOCS_SOURCES_DIR ?? path.join(root, '..'));
  const studioRoot = path.resolve(sourcesRoot, definitions.repositories.studio.directory);
  const documents = new Map(manifest.documents.map((item) => [`${item.repository}:${item.slug}:${item.locale}`, item]));
  const translatedInstall = documents.get('studio:installation:fr');
  const translatedPerformance = documents.get('studio:operations/performance:fr');
  const runtimeGuide = manifest.documents.find((item) => item.slug.endsWith('configuration') && item.locale === 'fr');
  assert.equal(translatedInstall.sourceLanguage, 'fr');
  assert.equal(translatedInstall.sourcePath, 'docs/install.fr.md');
  assert.equal(translatedPerformance.sourceLanguage, 'fr');
  assert.equal(runtimeGuide.sourceLanguage, 'en');
  const originalTranslation = execFileSync('git', [
    '-C',
    studioRoot,
    'show',
    `${manifest.repositories.studio.ref}:docs/install.fr.md`,
  ]);
  assert.equal(translatedInstall.sha256, createHash('sha256').update(originalTranslation).digest('hex'));

  const installText = await readFile(path.join(evidence, translatedInstall.output), 'utf8');
  assert.match(
    installText,
    new RegExp(`github\\.com/youmssi/donka/blob/${manifest.repositories.studio.ref}/docs/install\\.fr\\.md`),
  );
  assert.match(installText, /title: "Installation"/);
  assert.equal(
    await readFile(path.join(evidence, 'runtime/configuration.fr.md'), 'utf8').then((text) =>
      text.includes('English source'),
    ),
    true,
  );
  assert.equal(
    await readFile(path.join(evidence, 'stale-owned-output.txt')).then(
      () => true,
      () => false,
    ),
    false,
  );

  const performance = await readFile(path.join(evidence, 'operations', 'performance.md'), 'utf8');
  assert.match(performance, /github\.com\/youmssi\/donka\/blob\//);
  assert.match(performance, /github\.com\/youmssi\/donka\/blob\/.+docs\/performance\.json/);

  const artifact = await readFile(path.join(root, 'public', 'evidence', 'performance-baseline.json'));
  const source = execFileSync('git', [
    '-C',
    studioRoot,
    'show',
    `${manifest.repositories.studio.ref}:docs/performance.json`,
  ]);
  assert.equal(createHash('sha256').update(artifact).digest('hex'), createHash('sha256').update(source).digest('hex'));
});
