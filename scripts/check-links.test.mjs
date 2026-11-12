import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { checkLinks } from './check-links.mjs';

function fixture(t, files) {
  const root = mkdtempSync(join(tmpdir(), 'donka-docs-links-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

test('checks relative links, encoded paths, fragments, queries and local assets', (t) => {
  const root = fixture(t, {
    'en/index.html': '<a href="docs/#overview">Read</a><img src="/mark.svg"><a href="/fr/?q=1&amp;x=2">FR</a>',
    'en/docs/index.html': '<h1 id="overview">Overview</h1><a href="../../fr/page%20one.html#titre">FR</a>',
    'fr/index.html': '<a href="https://example.com/external">External</a><a href="mailto:help@example.com">Mail</a>',
    'fr/page one.html': '<h1 id="titre">Titre</h1><style data-href="scrollbar-style"></style>',
    'mark.svg': '<svg/>',
  });
  assert.deepEqual(checkLinks(root), { pages: 4, failures: [] });
});

test('reports missing pages, assets, relative links, anchors and malformed URLs', (t) => {
  const root = fixture(t, {
    'index.html': '<a href="/absent">A</a><img src="missing.svg"><a href="page/#gone">B</a><a href="/%zz">C</a>',
    'page/index.html': '<a href="../nope.html">D</a>',
  });
  const { failures } = checkLinks(root);
  assert.equal(failures.length, 5);
  assert.ok(failures.some((failure) => failure.includes('missing anchor')));
  assert.ok(failures.some((failure) => failure.includes('../nope.html')));
});

test('does not accept an empty export or a directory as a linked asset', (t) => {
  const root = fixture(t, {});
  assert.throws(() => checkLinks(root), /No exported HTML/);
  mkdirSync(join(root, 'empty'));
  writeFileSync(join(root, 'index.html'), '<a href="/empty">Empty</a>');
  assert.equal(checkLinks(root).failures.length, 1);
});
