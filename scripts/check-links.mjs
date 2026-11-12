import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const origin = 'https://docs.invalid';
const attributes = /(?:^|\s)(href|src)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

function* htmlFiles(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) yield* htmlFiles(path);
    else if (entry.name.endsWith('.html')) yield path;
  }
}

function findTarget(root, pathname) {
  const path = resolve(root, `.${decodeURIComponent(pathname)}`);
  if (path !== root && !path.startsWith(root + sep)) return;
  return [path, `${path}.html`, join(path, 'index.html')].find(
    (candidate) => existsSync(candidate) && statSync(candidate).isFile(),
  );
}

/** Checks local pages, assets and fragment targets in a static export, without network access. */
export function checkLinks(directory) {
  const root = resolve(directory);
  const failures = [];
  const files = [...htmlFiles(root)];
  if (files.length === 0) throw new Error(`No exported HTML pages in ${root}`);
  for (const file of files) {
    const page =
      '/' +
      relative(root, file)
        .split(sep)
        .join('/')
        .replace(/index\.html$/, '');
    for (const match of readFileSync(file, 'utf8').matchAll(attributes)) {
      const value = (match[2] ?? match[3]).replaceAll('&amp;', '&');
      try {
        const url = new URL(value, origin + page);
        if (url.origin !== origin) continue;
        const target = findTarget(root, url.pathname);
        if (!target) throw new Error('missing file');
        if (url.hash && target.endsWith('.html')) {
          const id = decodeURIComponent(url.hash.slice(1));
          const ids = [...readFileSync(target, 'utf8').matchAll(/\b(?:id|name)\s*=\s*["']([^"']*)["']/g)];
          if (!ids.some((attribute) => attribute[1] === id)) throw new Error('missing anchor');
        }
      } catch (error) {
        failures.push(`${relative(root, file)}: ${value} (${error.message})`);
      }
    }
  }
  return { pages: files.length, failures };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const root = process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), '../out');
  const result = checkLinks(root);
  for (const failure of result.failures) console.error(failure);
  if (result.failures.length > 0) process.exitCode = 1;
  else console.log(`All internal links resolve across ${result.pages} exported pages.`);
}
