import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(root, 'content-sources.json');
const releaseManifestPath = path.join(root, 'release-manifest.json');
const outputRoot = path.join(root, 'content', 'docs', 'evidence');
const referenceRoot = path.join(root, 'content', 'docs', 'reference');
const artifactRoot = path.join(root, 'public', 'evidence');
const referenceArtifactRoot = path.join(root, 'public', 'reference');
const repoRoot = path.resolve(process.env.DONKA_DOCS_SOURCES_DIR ?? path.join(root, '..'));
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const releaseManifest = JSON.parse(await readFile(releaseManifestPath, 'utf8'));
const selectedVersion = releaseManifest.versions.find((version) => version.id === releaseManifest.current);
if (!selectedVersion) throw new Error(`Unknown current documentation version: ${releaseManifest.current}`);
if (!/^[a-z0-9][a-z0-9._-]*$/.test(selectedVersion.id))
  throw new Error(`Invalid documentation version id: ${selectedVersion.id}`);
for (const [key, repository] of Object.entries(manifest.repositories)) {
  const release = selectedVersion.repositories?.[key];
  if (!release || (release.tag === null ? !/^[a-f0-9]{40}$/.test(release.ref) : release.ref !== release.tag)) {
    throw new Error(`Invalid ${key} source in documentation release ${selectedVersion.id}`);
  }
  repository.ref = release.ref;
  repository.tag = release.tag;
  const sourceDirectory = path.resolve(repoRoot, repository.directory);
  const expectedCommit = execFileSync('git', ['-C', sourceDirectory, 'rev-parse', `${repository.ref}^{commit}`], {
    encoding: 'utf8',
  }).trim();
  const checkoutCommit = execFileSync('git', ['-C', sourceDirectory, 'rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim();
  if (expectedCommit !== checkoutCommit) {
    throw new Error(
      `${repository.directory} checkout does not match release ${selectedVersion.id} (${repository.ref}).`,
    );
  }
  repository.commit = expectedCommit;
}
const relativeOutputRoot = path.relative(root, outputRoot);
if (relativeOutputRoot.startsWith('..') || path.isAbsolute(relativeOutputRoot)) {
  throw new Error(`Generated output must stay inside the documentation repository: ${outputRoot}`);
}
const relativeArtifactRoot = path.relative(root, artifactRoot);
if (relativeArtifactRoot.startsWith('..') || path.isAbsolute(relativeArtifactRoot)) {
  throw new Error(`Generated artifacts must stay inside the documentation repository: ${artifactRoot}`);
}
const relativeReferenceRoot = path.relative(root, referenceRoot);
if (relativeReferenceRoot.startsWith('..') || path.isAbsolute(relativeReferenceRoot)) {
  throw new Error(`Generated references must stay inside the documentation repository: ${referenceRoot}`);
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
  if (typeof repository.ref !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(repository.ref)) {
    throw new Error(`Invalid pinned ref for ${repository.directory}`);
  }
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
      tag: repository.tag,
      commit: repository.commit,
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
      const revision = repository.tag ? `tag ${repository.tag}` : `commit ${repository.commit.slice(0, 12)}`;
      const attribution = `> Source: [${key}/${sourcePath}](${repository.url}/blob/${repository.ref}/${sourcePath}) (${revision})${englishOnly ? ' · English source' : ''}\n\n`;
      const content = `---\ntitle: ${JSON.stringify(localeTitle)}\nsourceLanguage: ${sourceLanguage}\n---\n\n${attribution}${body}\n`;
      const relativeOutput = `${slug}${locale === 'fr' ? '.fr' : ''}.md`;
      generated.push({
        repository: key,
        ref: repository.ref,
        tag: repository.tag,
        commit: repository.commit,
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

const studioOpenApi = readPinned(manifest.repositories.studio, 'apps/web/openapi.json');
const studioEnvironment = readPinned(manifest.repositories.studio, '.env.example');
const artifactFormatSource = readPinned(manifest.repositories.studio, 'docs/rules-sync.md');
let runtimeOpenApi;
try {
  runtimeOpenApi = await readFile(path.join(repoRoot, manifest.repositories.runtime.directory, 'openapi.json'), 'utf8');
} catch (error) {
  throw new Error('Generate the Runtime OpenAPI document from its pinned source before assembling references.', {
    cause: error,
  });
}
const cliDirectory = path.join(repoRoot, manifest.repositories.cli.directory);
const cliCommands = [
  [],
  ['form'],
  ['form', 'pull'],
  ['form', 'check'],
  ['form', 'init'],
  ['mcp'],
  ['mcp', 'start'],
  ['pull'],
];
const cliHelp = cliCommands.map((command) => {
  const args = [...command, '--help'];
  const output = execFileSync(process.execPath, ['dist/main.js', ...args], {
    cwd: cliDirectory,
    encoding: 'utf8',
  });
  return { command: command.length === 0 ? 'donka' : `donka ${command.join(' ')}`, output: output.trimEnd() };
});
const studioDocument = JSON.parse(studioOpenApi);
const runtimeDocument = JSON.parse(runtimeOpenApi);
const studioVariables = studioEnvironment
  .split(/\r?\n/)
  .map((line) => line.match(/^([A-Z][A-Z0-9_]*)=/)?.[1])
  .filter((name) => name !== undefined);
function operationTable(document) {
  const rows = Object.entries(document.paths ?? {}).flatMap(([route, operations]) =>
    Object.entries(operations)
      .filter(([method]) => ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].includes(method))
      .map(
        ([method, operation]) =>
          `| \`${method.toUpperCase()}\` | \`${route}\` | ${operation.summary ?? operation.operationId ?? ''} |`,
      ),
  );
  return ['| Method | Path | Summary |', '| --- | --- | --- |', ...rows].join('\n');
}
const generatedReferences = {
  'index.mdx': `---\ntitle: API and command reference\n---\n\nThis section is generated from the exact source revisions recorded in the [release manifest](/evidence/source-manifest.json). Studio's interactive API explorer is available at \`/api/docs\` on each installation.\n\n- [Studio API](studio-api)\n- [Runtime API](runtime-api)\n- [CLI commands](cli)\n`,
  'index.fr.mdx': `---\ntitle: Référence API et commandes\n---\n\nCette section est générée à partir des révisions exactes indiquées dans le [manifest de publication](/evidence/source-manifest.json). L'explorateur interactif de Studio est disponible sur chaque installation à \`/api/docs\`.\n\n- [API Studio](studio-api)\n- [API Runtime](runtime-api)\n- [Commandes CLI](cli)\n`,
  'studio-api.mdx': `---\ntitle: Studio API\n---\n\nGenerated from [the OpenAPI contract for this exact Studio source revision](/reference/studio-openapi.json). The installed API is served at \`/api/v1/openapi.json\`; its interactive reference is at \`/api/docs\`.\n\n${operationTable(studioDocument)}\n`,
  'studio-api.fr.mdx': `---\ntitle: API Studio\n---\n\nGénéré depuis [le contrat OpenAPI de cette révision exacte de Studio](/reference/studio-openapi.json). L'API installée est disponible sur \`/api/v1/openapi.json\` et sa référence interactive sur \`/api/docs\`.\n\n${operationTable(studioDocument)}\n`,
  'runtime-api.mdx': `---\ntitle: Runtime API\n---\n\nGenerated from [the OpenAPI contract for this exact Runtime source revision](/reference/runtime-openapi.json). The Runtime API is also documented in the [Runtime API guide](/en/docs/evidence/runtime/rules-openapi/).\n\n${operationTable(runtimeDocument)}\n`,
  'runtime-api.fr.mdx': `---\ntitle: API Runtime\n---\n\nGénéré depuis [le contrat OpenAPI de cette révision exacte du Runtime](/reference/runtime-openapi.json). L'API Runtime est également décrite dans le [guide API Runtime](/fr/docs/evidence/runtime/rules-openapi/).\n\n${operationTable(runtimeDocument)}\n`,
  'cli.mdx': `---\ntitle: Donka CLI\n---\n\nGenerated directly from \`donka --help\` for the exact CLI source revision in the release manifest.\n\n${cliHelp.map((item) => `### \`${item.command}\`\n\n\`\`\`text\n${item.output}\n\`\`\``).join('\n\n')}\n`,
  'cli.fr.mdx': `---\ntitle: CLI Donka\n---\n\nSortie générée directement à partir de \`donka --help\` pour la révision CLI exacte du manifest. Les commandes sont affichées dans leur langue d'origine.\n\n${cliHelp.map((item) => `### \`${item.command}\`\n\n\`\`\`text\n${item.output}\n\`\`\``).join('\n\n')}\n`,
};
const artifactSourceLink = `${manifest.repositories.studio.url}/blob/${manifest.repositories.studio.ref}/docs/rules-sync.md`;
const artifactFormatBody = stripFrontmatter(artifactFormatSource).replace(/^# .+\r?\n+/, '');
generatedReferences['artifact-format.mdx'] =
  `---\ntitle: Artifact format and rules sync\n---\n\n> Source: [Studio docs/rules-sync.md](${artifactSourceLink}) (${manifest.repositories.studio.tag ? `tag ${manifest.repositories.studio.tag}` : `commit ${manifest.repositories.studio.commit.slice(0, 12)}`})\n\n${artifactFormatBody}\n`;
generatedReferences['artifact-format.fr.mdx'] =
  `---\ntitle: Format des artefacts et synchronisation\n---\n\n> Source en anglais : [Studio docs/rules-sync.md](${artifactSourceLink})\n\n${artifactFormatBody}\n`;
const studioConfigurationPage = `---\ntitle: Configuration variables\n---\n\nGenerated from the exact Studio environment template pinned in the release manifest. Runtime settings are listed in the [Runtime configuration guide](/en/docs/evidence/runtime/configuration/). CLI options and environment inputs appear in the [generated command reference](cli).\n\n| Variable |\n| --- |\n${studioVariables.map((name) => `| \`${name}\` |`).join('\n')}\n\n[Studio environment template](/evidence/studio-configuration.env)\n`;
const studioConfigurationPageFr = `---\ntitle: Variables de configuration\n---\n\nGénéré depuis le modèle d'environnement Studio épinglé dans le manifest. Les paramètres Runtime figurent dans le [guide de configuration Runtime](/fr/docs/evidence/runtime/configuration/). Les options CLI figurent dans la [référence des commandes générée](cli).\n\n| Variable |\n| --- |\n${studioVariables.map((name) => `| \`${name}\` |`).join('\n')}\n\n[Modèle d'environnement Studio](/evidence/studio-configuration.env)\n`;
Object.assign(generatedReferences, {
  'index.mdx': `${generatedReferences['index.mdx']}\n- [Configuration variables](configuration)\n- [Artifact format](artifact-format)\n- [Release notes](release-notes)\n`,
  'index.fr.mdx': `${generatedReferences['index.fr.mdx']}\n- [Variables de configuration](configuration)\n- [Format des artefacts](artifact-format)\n- [Notes de version](release-notes)\n`,
  'configuration.mdx': studioConfigurationPage,
  'configuration.fr.mdx': studioConfigurationPageFr,
  'release-notes.mdx': `---\ntitle: Release notes\n---\n\nDonka products release independently. Published versions link to their product release pages. This current development snapshot uses pinned commits.\n\n${Object.entries(
    manifest.repositories,
  )
    .map(
      ([key, repository]) =>
        `- [${key} ${repository.tag ?? 'Development'}](${repository.tag ? `${repository.url}/releases/tag/${repository.tag}` : `${repository.url}/releases`})`,
    )
    .join('\n')}\n`,
  'release-notes.fr.mdx': `---\ntitle: Notes de version\n---\n\nLes produits Donka sont publiés indépendamment. Les versions publiées renvoient vers les pages de publication de chaque produit. Cet instantané de développement utilise des commits épinglés.\n\n${Object.entries(
    manifest.repositories,
  )
    .map(
      ([key, repository]) =>
        `- [${key} ${repository.tag ?? 'Développement'}](${repository.tag ? `${repository.url}/releases/tag/${repository.tag}` : `${repository.url}/releases`})`,
    )
    .join('\n')}\n`,
});
await rm(referenceRoot, { recursive: true, force: true });
await rm(referenceArtifactRoot, { recursive: true, force: true });
await mkdir(referenceRoot, { recursive: true });
await mkdir(referenceArtifactRoot, { recursive: true });
for (const [file, content] of Object.entries(generatedReferences)) {
  await writeFile(path.join(referenceRoot, file), content, 'utf8');
}
await writeFile(
  path.join(referenceRoot, 'meta.json'),
  `${JSON.stringify({ title: 'Reference', pages: ['index', 'studio-api', 'runtime-api', 'cli', 'configuration', 'artifact-format', 'release-notes'] }, null, 2)}\n`,
);
await writeFile(
  path.join(referenceRoot, 'meta.fr.json'),
  `${JSON.stringify({ title: 'Référence', pages: ['index', 'studio-api', 'runtime-api', 'cli', 'configuration', 'artifact-format', 'release-notes'] }, null, 2)}\n`,
);
await writeFile(
  path.join(referenceArtifactRoot, 'studio-openapi.json'),
  `${JSON.stringify(studioDocument, null, 2)}\n`,
);
await writeFile(
  path.join(referenceArtifactRoot, 'runtime-openapi.json'),
  `${JSON.stringify(runtimeDocument, null, 2)}\n`,
);

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
  version: selectedVersion,
  repositories: Object.fromEntries(
    Object.entries(manifest.repositories).map(([key, value]) => [
      key,
      { url: value.url, ref: value.ref, tag: value.tag, commit: value.commit },
    ]),
  ),
  documents: index,
  artifacts: generatedArtifacts.map((item) => ({
    repository: item.repository,
    ref: item.ref,
    tag: item.tag,
    commit: item.commit,
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
