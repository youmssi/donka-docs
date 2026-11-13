import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const developmentSources = JSON.parse(
  readFileSync(new URL('../release-manifest.json', import.meta.url), 'utf8'),
).versions.find((version: { id: string }) => version.id === 'development').repositories;

const copy = {
  en: {
    home: 'Understand how Donka fits together.',
    discover: 'Discover Donka',
    diagram: 'How Donka connects',
    planned: 'Phase 2 · planned',
    search: 'Open Search',
    searchPlaceholder: 'Search',
    noResults: 'No results found',
    language: 'Choose a language',
    sidebar: 'Open Sidebar',
    theme: 'Toggle Theme',
    overview: 'Who uses it',
    searchTerm: 'Production',
  },
  fr: {
    home: 'Comprendre comment Donka s’assemble.',
    discover: 'Découvrir Donka',
    diagram: 'Les connexions de Donka',
    planned: 'Phase 2 · prévu',
    search: 'Ouvrir la recherche',
    searchPlaceholder: 'Rechercher',
    noResults: 'Aucun résultat',
    language: 'Choisir une langue',
    sidebar: 'Ouvrir le panneau latéral',
    theme: 'Basculer le thème',
    overview: 'Qui l’utilise',
    searchTerm: 'Production',
  },
} as const;

async function fitsViewport(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(
    true,
  );
}

test('read the diagram, navigate documentation and search in the current language', async ({ page }, testInfo) => {
  const { locale, colorScheme, size } = testInfo.project.metadata as {
    locale: 'en' | 'fr';
    colorScheme: 'light' | 'dark';
    size: 'desktop' | 'phone';
  };
  const t = copy[locale];
  const errors: string[] = [];
  const external: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (new URL(request.url()).hostname !== '127.0.0.1') external.push(request.url());
  });

  await page.goto('/');
  await page.getByRole('link', { name: locale === 'fr' ? 'Français' : 'English', exact: true }).click();
  const pdf = page.getByRole('link', {
    name: locale === 'fr' ? 'Télécharger le PDF français' : 'Download the English PDF',
  });
  const pdfHref = await pdf.getAttribute('href');
  expect(pdfHref).toBe(`/pdf/donka-development-${locale}.pdf`);
  if (!pdfHref) throw new Error('The documentation PDF link has no target.');
  const pdfResponse = await page.request.get(new URL(pdfHref, page.url()).toString());
  expect(pdfResponse.ok()).toBe(true);
  expect((await pdfResponse.body()).subarray(0, 4).toString()).toBe('%PDF');
  await expect(page.locator('html')).toHaveAttribute('lang', locale);
  await expect(page.locator('html')).toHaveClass(new RegExp(colorScheme));
  await expect(page.getByRole('heading', { level: 1, name: t.home })).toBeVisible();
  const diagram = page.getByRole('figure', { name: t.diagram });
  await expect(diagram.getByRole('heading', { name: 'Runtime', exact: true })).toBeVisible();
  await expect(diagram.getByText(t.planned, { exact: true })).toBeVisible();
  await expect(diagram.getByRole('heading', { name: /MCP/ })).toBeVisible();
  expect(
    await diagram
      .locator('p')
      .evaluateAll((nodes) => nodes.every((node) => parseFloat(getComputedStyle(node).fontSize) >= 12)),
  ).toBe(true);
  await fitsViewport(page);
  await page.screenshot({ path: testInfo.outputPath('home.png'), fullPage: true });
  await testInfo.attach('Home', { path: testInfo.outputPath('home.png'), contentType: 'image/png' });

  await page.getByRole('link', { name: t.discover, exact: true }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: t.discover })).toBeVisible();
  await page.getByRole('link', { name: 'Architecture', exact: true }).last().click();
  await expect(page).toHaveURL(new RegExp(`/${locale}/docs/architecture/$`));
  await expect(page.getByRole('figure', { name: t.diagram })).toBeVisible();
  await fitsViewport(page);
  await page.screenshot({ path: testInfo.outputPath('architecture.png'), fullPage: true });
  await testInfo.attach('Architecture', { path: testInfo.outputPath('architecture.png'), contentType: 'image/png' });

  const searchButton = page.getByRole('button', {
    name: size === 'phone' ? t.search : new RegExp(`^${t.searchPlaceholder}`),
    exact: size === 'phone',
  });
  await searchButton.click();
  const search = page.getByRole('dialog');
  await search.getByRole('combobox').fill(t.discover);
  const result = search.getByRole('option').filter({ hasText: t.discover });
  await expect(result.first()).toBeVisible();
  await expect(
    search.getByRole('option').filter({ hasText: locale === 'fr' ? copy.en.discover : copy.fr.discover }),
  ).toHaveCount(0);
  await result.first().click();
  await expect(page).toHaveURL(new RegExp(`/${locale}/docs/`));
  await searchButton.click();
  await page.getByRole('dialog').getByRole('combobox').fill('zzzzdonkamissingzzzz');
  await expect(page.getByRole('dialog').getByText(t.noResults, { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test('language, theme and mobile navigation controls preserve the reading context', async ({ page }, testInfo) => {
  const { locale, colorScheme, size } = testInfo.project.metadata as {
    locale: 'en' | 'fr';
    colorScheme: 'light' | 'dark';
    size: 'desktop' | 'phone';
  };
  const t = copy[locale];
  const other = locale === 'en' ? 'fr' : 'en';
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const { promise: scriptsReady, resolve: releaseScripts } = Promise.withResolvers<void>();
  await page.route('**/_next/static/chunks/*.js', async (route) => {
    await scriptsReady;
    await route.continue();
  });
  await page.goto(`/${locale}/docs/architecture/`, { waitUntil: 'commit' });
  const themeButton = page.getByRole('button', { name: t.theme, exact: true, includeHidden: true });
  try {
    await expect(themeButton).toBeDisabled();
  } finally {
    releaseScripts();
  }
  await expect(themeButton).toBeEnabled();
  if (size === 'phone') await page.getByRole('button', { name: t.sidebar, exact: true }).click();
  await page.getByRole('button', { name: t.theme, exact: true }).click();
  const switchedTheme = colorScheme === 'light' ? 'dark' : 'light';
  await expect(page.locator('html')).toHaveClass(new RegExp(switchedTheme));
  await page.reload();
  await expect(page.locator('html')).toHaveClass(new RegExp(switchedTheme));

  if (size === 'phone') {
    await page.getByRole('button', { name: t.sidebar, exact: true }).click();
    await expect(page.getByRole('link', { name: t.discover, exact: true }).first()).toBeVisible();
  }
  await page.getByRole('button', { name: t.language, exact: true }).click();
  await page.getByRole('button', { name: other === 'fr' ? 'Français' : 'English', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/${other}/docs/architecture/$`));
  await expect(page.locator('html')).toHaveAttribute('lang', other);
  await expect(page.getByRole('heading', { level: 1, name: 'Architecture', exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveClass(new RegExp(switchedTheme));
  await fitsViewport(page);
  expect(errors).toEqual([]);
});

test('review trust evidence and the pinned performance baseline', async ({ page }, testInfo) => {
  const { locale } = testInfo.project.metadata as {
    locale: 'en' | 'fr';
  };
  const trustTitle = locale === 'fr' ? 'Confiance et sécurité' : 'Trust and security';
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto(`/${locale}/docs/trust/`);
  const sourceManifestResponse = await page.request.get(
    new URL('/evidence/source-manifest.json', page.url()).toString(),
  );
  expect(sourceManifestResponse.ok()).toBe(true);
  const sourceManifest = await sourceManifestResponse.json();
  expect(sourceManifest.repositories.studio.ref).toBe(developmentSources.studio.ref);
  expect(sourceManifest.documents.length).toBeGreaterThan(0);
  await expect(page.getByRole('heading', { level: 1, name: trustTitle })).toBeVisible();
  await expect(page.getByText(/self-assessment|autoévaluation/i).first()).toBeVisible();
  await fitsViewport(page);
  await page.screenshot({ path: testInfo.outputPath('trust.png'), fullPage: true });
  await testInfo.attach('Trust', { path: testInfo.outputPath('trust.png'), contentType: 'image/png' });

  await page.getByRole('link', { name: /OWASP ASVS|évaluation OWASP ASVS/i }).click();
  await expect(page).toHaveURL(new RegExp(`/${locale}/docs/evidence/security/asvs/$`));
  await expect(page.getByRole('heading', { level: 1, name: /OWASP ASVS/ })).toBeVisible();
  if (locale === 'fr') await expect(page.getByText(/English source/)).toBeVisible();
  await expect(page.getByRole('link', { name: /studio\/docs\/security\/asvs\.md/ })).toHaveAttribute(
    'href',
    new RegExp(`^https://github\\.com/youmssi/donka/blob/${sourceManifest.repositories.studio.ref}/`),
  );
  await fitsViewport(page);

  await page.goto(`/${locale}/docs/performance/`);
  await expect(
    page.getByRole('heading', { level: 1, name: locale === 'fr' ? 'Performances' : 'Performance' }),
  ).toBeVisible();
  await expect(
    page.getByText(locale === 'fr' ? /trois fenêtres distinctes de 10 secondes/ : /three separate 10-second windows/),
  ).toBeVisible();
  const baselineResponse = await page.request.get(
    new URL('/evidence/performance-baseline.json', page.url()).toString(),
  );
  expect(baselineResponse.ok()).toBe(true);
  const baseline = await baselineResponse.json();
  expect(baseline.targets.runtime).toMatchObject({ rate: 100, p95_ms: 20, p99_ms: 50 });
  expect(baseline.baseline.runtime.profiles.length).toBeGreaterThan(0);
  const performanceReport = page.getByRole('link', { name: /performance test report|rapport de performance/i });
  await expect(performanceReport).toBeVisible();
  await performanceReport.click();
  await expect(page).toHaveURL(new RegExp(`/${locale}/docs/evidence/operations/performance/$`));
  await expect(page.getByRole('heading', { level: 1, name: /Performance|Performances/ })).toBeVisible();
  await fitsViewport(page);
  await page.screenshot({ path: testInfo.outputPath('performance.png'), fullPage: true });
  await testInfo.attach('Performance', { path: testInfo.outputPath('performance.png'), contentType: 'image/png' });
  expect(errors).toEqual([]);
});

test('review references generated from the curated source set', async ({ page }, testInfo) => {
  const { locale } = testInfo.project.metadata as { locale: 'en' | 'fr' };
  const manifestResponse = await page.request.get('/evidence/source-manifest.json');
  expect(manifestResponse.ok()).toBe(true);
  const manifest = await manifestResponse.json();
  expect(manifest.version.id).toBe('development');
  expect(manifest.repositories.studio.commit).toBe(developmentSources.studio.ref);
  expect(manifest.repositories.runtime.commit).toBe(developmentSources.runtime.ref);
  expect(manifest.repositories.cli.commit).toBe(developmentSources.cli.ref);

  await page.goto(`/${locale}/docs/reference/studio-api/`);
  await expect(
    page.getByRole('heading', { level: 1, name: locale === 'fr' ? 'API Studio' : 'Studio API' }),
  ).toBeVisible();
  await expect(page.getByText('/health', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: /OpenAPI contract|contrat OpenAPI/i })).toHaveAttribute(
    'href',
    '/reference/studio-openapi.json',
  );

  await page.goto(`/${locale}/docs/reference/cli/`);
  await expect(
    page.getByRole('heading', { level: 1, name: locale === 'fr' ? 'CLI Donka' : 'Donka CLI' }),
  ).toBeVisible();
  await expect(page.getByText(/USAGE form pull \[OPTIONS\]/)).toBeVisible();

  await page.goto(`/${locale}/docs/reference/artifact-format/`);
  await expect(page.getByRole('heading', { level: 1, name: /Artifact format|Format des artefacts/ })).toBeVisible();
});
