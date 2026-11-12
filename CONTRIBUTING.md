# Contributing

The development branch is develop. Each DNK-66 part gets its own dnk-66-<slug>
branch and draft PR. Finish the current part before starting the next.
Nothing is deployed by this repository's CI.

Use Node 22 or later and pnpm 10.33.0. Install with pnpm install --frozen-lockfile.
Inside the Donka workspace, use node ../.tools/node_modules/pnpm/bin/pnpm.cjs
where the examples say pnpm.

The TypeScript 7 compiler is installed as @typescript/native. The typescript
alias provides the TypeScript 6 API required by typescript-eslint, following
[Microsoft's compatibility guidance](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/#running-side-by-side-with-typescript-6-0).
ESLint 9 matches the eslint-plugin-import peer range used by eslint-config-next.

Run the following before a push:

```sh
pnpm format:check
pnpm lint
pnpm types:check
pnpm test
pnpm build
pnpm check:links
pnpm audit:security
pnpm exec playwright install chromium
pnpm test:e2e
```

Browser tests serve the built static export on an isolated loopback port. They
exercise actual navigation, per-language search, language switching, theme
switching and the mobile sidebar in English/French, light/dark, desktop/390 px.
Install Chromium, Firefox and WebKit and run pnpm test:e2e:release before release.
Do not weaken checks, add retries or skip a failing test to obtain a pass.

Use Conventional Commits, a clear description of the change and a standalone
Refs: DNK-66 trailer. Open a draft PR with the template. Attach the eight UI-mode
screenshots or link the CI artifact. State what passed and any remaining gates.
Mark ready and squash-merge only after latest CI is green and reviews are answered.
Product documentation and tests change alongside the behavior they describe.
