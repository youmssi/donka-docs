import { defineConfig } from '@playwright/test';

const browsers =
  process.env.DONKA_DOCS_RELEASE === '1' ? (['chromium', 'firefox', 'webkit'] as const) : (['chromium'] as const);

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4176',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    reducedMotion: 'reduce',
  },
  projects: browsers.flatMap((browserName) =>
    (['en', 'fr'] as const).flatMap((locale) =>
      (['light', 'dark'] as const).flatMap((colorScheme) =>
        (['desktop', 'phone'] as const).map((size) => ({
          name: `${browserName}-${locale}-${colorScheme}-${size}`,
          use: {
            browserName,
            locale,
            colorScheme,
            viewport: size === 'phone' ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
          },
          metadata: { locale, colorScheme, size },
        })),
      ),
    ),
  ),
  webServer: {
    command: 'node node_modules/serve/build/main.js out --listen tcp://127.0.0.1:4176 --no-clipboard',
    url: 'http://127.0.0.1:4176/en/',
    reuseExistingServer: false,
  },
});
