import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(root, 'content-sources.json');
const outputRoot = path.join(root, 'content', 'docs', 'evidence');
const artifactRoot = path.join(root, 'public', 'evidence');
const repoRoot = path.resolve(process.env.DONKA_DOCS_SOURCES_DIR ?? path.join(root, '..'));
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const relativeOutputRoot = path.relative(root, outputRoot);
if (relativeOutputRoot.startsWith('..') || path.isAbsolute(relativeOutputRoot)) {
  throw new Error(`Generated output must stay inside the documentation repository: ${outputRoot}`);
}
const relativeArtifactRoot = path.relative(root, artifactRoot);
if (relativeArtifactRoot.startsWith('..') || path.isAbsolute(relativeArtifactRoot)) {
  throw new Error(`Generated artifacts must stay inside the documentation repository: ${artifactRoot}`);
}

function checkedRelativePath(value) {
  if (typeof value !== 'string' || value.length === 0 || path.isAbsolute(value)) {
    throw new Error(`Invalid source path: ${value}`);
  }
  const normalized = value.replaceAll('\\', '/');
  if (normalized.split('/').some((part) => part === '..' || part === '.')) {
    throw new Error(`Invalid source path: ${value}`);
  }
  return normalized;
}

function checkedSlug(value) {
  if (typeof value !== 'string' || !/^[a-z0-9]+(?:[/-][a-z0-9-]+)*$/.test(value)) {
    throw new Error(`Invalid generated document slug: ${value}`);
  }
  return value;
}

function readPinned(repository, filePath) {
  if (!/^[a-f0-9]{40}$/.test(repository.ref)) throw new Error(`Invalid pinned ref for ${repository.directory}`);
  const dir = path.resolve(repoRoot, repository.directory);
  const safePath = checkedRelativePath(filePath);
  try {
    return execFileSync('git', ['-C', dir, 'show', `${repository.ref}:${safePath}`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    throw new Error(
      `Cannot read ${repository.directory}@${repository.ref}:${safePath}. Check the pinned commit and source checkout.`,
      { cause: error },
    );
  }
}

function rewriteLinks(markdown, repository, sourcePath) {
  const lines = markdown.split(/\r?\n/);
  let fence;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const fenceMatch = line.match(/^\s*(```+|~~~+)/);
    if (fenceMatch) {
      const marker = fenceMatch[1][0];
      fence = fence === marker ? undefined : (fence ?? marker);
      continue;
    }
    if (fence) continue;
    lines[index] = line.replace(/(!?\[[^\]]*\]\()([^\s)]+)([^)]*\))/g, (whole, start, href, end) => {
      if (/^(?:[a-z][a-z0-9+.-]*:|\/|#)/i.test(href)) return whole;
      const [file, ...anchor] = href.split('#');
      const base = path.posix.normalize(path.posix.join(path.posix.dirname(sourcePath), file));
      if (base === '..' || base.startsWith('../')) return whole;
      const target = `${repository.url}/blob/${repository.ref}/${base}${anchor.length ? `#${anchor.join('#')}` : ''}`;
      return `${start}${target}${end}`;
    });
  }
  return lines.join('\n');
}

function stripFrontmatter(markdown) {
  return markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').replace(/^# .+\r?\n+/, '');
}

const generated = [];
const generatedArtifacts = [];
for (const [key, repository] of Object.entries(manifest.repositories)) {
  for (const artifact of repository.artifacts ?? []) {
    const sourcePath = checkedRelativePath(artifact.path);
    const output = checkedRelativePath(artifact.output);
    const text = readPinned(repository, sourcePath);
    generatedArtifacts.push({
      repository: key,
      ref: repository.ref,
      sourcePath,
      output,
      sha256: createHash('sha256').update(text).digest('hex'),
      content: text,
    });
  }
  for (const entry of repository.files) {
    const englishPath = checkedRelativePath(entry.path);
    const slug = checkedSlug(entry.slug);
    const frenchPath = entry.translatedPath ? checkedRelativePath(entry.translatedPath) : undefined;
    for (const locale of ['en', 'fr']) {
      const useFrench = locale === 'fr' && frenchPath;
      const sourcePath = useFrench ? frenchPath : englishPath;
      const rawSourceText = readPinned(repository, sourcePath);
      const sourceText = stripFrontmatter(rawSourceText);
      const body = rewriteLinks(sourceText, repository, sourcePath).trim();
      const localeTitle = locale === 'fr' ? (entry.titleFr ?? entry.title) : entry.title;
      const englishOnly = locale === 'fr' && !frenchPath;
      const sourceLanguage = useFrench ? 'fr' : 'en';
      const attribution = `> Source: [${key}/${sourcePath}](${repository.url}/blob/${repository.ref}/${sourcePath}) (commit ${repository.ref.slice(0, 12)})${englishOnly ? ' · English source' : ''}\n\n`;
      const content = `---\ntitle: ${JSON.stringify(localeTitle)}\nsourceLanguage: ${sourceLanguage}\n---\n\n${attribution}${body}\n`;
      const relativeOutput = `${slug}${locale === 'fr' ? '.fr' : ''}.md`;
      generated.push({
        repository: key,
        ref: repository.ref,
        sourcePath,
        locale,
        sourceLanguage,
        slug,
        title: localeTitle,
        sha256: createHash('sha256').update(rawSourceText).digest('hex'),
        output: relativeOutput,
        content,
      });
    }
  }
}

// This generator owns the dedicated evidence directory and every file beneath it.
await rm(outputRoot, { recursive: true, force: true });
await rm(artifactRoot, { recursive: true, force: true });
const evidencePages = [];
for (const item of generated) {
  const target = path.join(outputRoot, item.output);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, item.content, 'utf8');
  const route = item.slug;
  if (!evidencePages.includes(route)) evidencePages.push(route);
}
for (const item of generatedArtifacts) {
  const target = path.join(artifactRoot, item.output);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, item.content, 'utf8');
}
const intro = {
  en: `---\ntitle: Product documentation and evidence\n---\n\nThese guides are assembled from the Studio, Runtime and CLI repositories at the exact commits listed below. The original files remain authoritative. Each page links to its source revision. The [machine-readable source manifest](/evidence/source-manifest.json) records the pinned commits and SHA-256 hashes of the original files.\n\nThe security dossier contains self-assessments and scoped evidence. It does not imply independent certification or a completed external penetration test. Performance figures describe the documented test environment. Installation steps do not establish the separate published-image installation gate.\n\nThe French section includes translated source pages where available. Every English source remains identified on French routes.\n`,
  fr: `---\ntitle: Documentation produit et éléments de preuve\n---\n\nCes guides sont assemblés depuis les dépôts Studio, Runtime et CLI aux commits exacts indiqués ci-dessous. Les fichiers d’origine font autorité. Chaque page renvoie à sa révision source. Le [manifest source lisible par machine](/evidence/source-manifest.json) indique les commits épinglés et les empreintes SHA-256 des fichiers originaux.\n\nLe dossier de sécurité contient des autoévaluations et des éléments de preuve délimités. Il ne vaut ni certification indépendante ni test d’intrusion externe réalisé. Les mesures de performance décrivent l’environnement indiqué. Les étapes d’installation ne valident pas le contrôle distinct d’installation depuis les images publiées.\n\nLa section française reprend les sources traduites lorsqu’elles existent. Chaque source anglaise reste signalée dans les pages françaises.\n`,
};
await writeFile(path.join(outputRoot, 'index.md'), intro.en, 'utf8');
await writeFile(path.join(outputRoot, 'index.fr.md'), intro.fr, 'utf8');
const orderedPages = [
  ...evidencePages.filter((page) => !page.includes('/')),
  ...new Set(evidencePages.filter((page) => page.includes('/')).map((page) => page.split('/')[0])),
];
await writeFile(
  path.join(outputRoot, 'meta.json'),
  `${JSON.stringify({ title: 'Product evidence', pages: ['index', ...orderedPages] }, null, 2)}\n`,
  'utf8',
);
await writeFile(
  path.join(outputRoot, 'meta.fr.json'),
  `${JSON.stringify({ title: 'Éléments de preuve produit', pages: ['index', ...orderedPages] }, null, 2)}\n`,
  'utf8',
);
const index = generated.map((item) => ({
  repository: item.repository,
  ref: item.ref,
  sourcePath: item.sourcePath,
  locale: item.locale,
  sourceLanguage: item.sourceLanguage,
  slug: item.slug,
  title: item.title,
  sha256: item.sha256,
  output: item.output,
}));
const provenance = {
  repositories: Object.fromEntries(
    Object.entries(manifest.repositories).map(([key, value]) => [key, { url: value.url, ref: value.ref }]),
  ),
  documents: index,
  artifacts: generatedArtifacts.map((item) => ({
    repository: item.repository,
    ref: item.ref,
    sourcePath: item.sourcePath,
    output: item.output,
    sha256: item.sha256,
  })),
};
const serializedProvenance = `${JSON.stringify(provenance, null, 2)}\n`;
await writeFile(path.join(outputRoot, 'manifest.json'), serializedProvenance, 'utf8');
await writeFile(path.join(artifactRoot, 'source-manifest.json'), serializedProvenance, 'utf8');
console.log(
  `Assembled ${generated.length} locale documents and ${generatedArtifacts.length} data artifacts from ${Object.keys(manifest.repositories).length} pinned repositories.`,
);
