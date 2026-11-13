import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const releaseManifest = JSON.parse(await readFile(path.join(root, 'release-manifest.json'), 'utf8'));
const version = releaseManifest.versions.find((entry) => entry.id === releaseManifest.current);
if (!version) throw new Error(`Unknown current documentation version: ${releaseManifest.current}`);
if (!/^[a-z0-9][a-z0-9._-]*$/.test(version.id)) throw new Error(`Invalid documentation version id: ${version.id}`);

const port = 4177;
const server = spawn(
  process.execPath,
  [path.join(root, 'node_modules/serve/build/main.js'), 'out', '--listen', `tcp://127.0.0.1:${port}`, '--no-clipboard'],
  { cwd: root, stdio: 'ignore' },
);
let browser;
try {
  const baseUrl = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/en/print/`);
      ready = response.ok;
      if (ready) break;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!ready) throw new Error('The static documentation export did not start for PDF generation.');

  browser = await chromium.launch({ headless: true });
  const output = path.join(root, 'out', 'pdf');
  await mkdir(output, { recursive: true });
  for (const locale of ['en', 'fr']) {
    const page = await browser.newPage({ locale, colorScheme: 'light' });
    await page.goto(`${baseUrl}/${locale}/print/`, { waitUntil: 'networkidle' });
    const file = path.join(output, `donka-${version.id}-${locale}.pdf`);
    await page.pdf({ path: file, format: 'A4', printBackground: true, preferCSSPageSize: true });
    const result = await stat(file);
    if (result.size < 1000) throw new Error(`Generated PDF is unexpectedly small: ${file}`);
    await page.close();
  }
} finally {
  await browser?.close();
  server.kill();
}
