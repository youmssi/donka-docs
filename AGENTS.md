# Donka documentation

Read this file and CONTRIBUTING.md before changes. Product scope and story order live
in Studio's docs/backlog/stage-1.md, docs/ROADMAP.md and docs/delivery-plan.md.
Follow Studio's applicable engineering principles and brand rules.

- DNK-66 is built without deployment until the owner names a hosting target.
- One part per story branch from updated develop; open a draft PR and squash only
  when its latest checks pass and reviews are answered. Never commit to main or develop.
- Use Conventional Commits and a standalone Refs: DNK-<n> trailer. Do not add tool
  authorship references or coauthor trailers to code, commits or PRs.
- Keep English and French complete. Verify light/dark at desktop and 390 px.
- Commit live Playwright regressions for new interactions. Chromium per PR;
  Chromium, Firefox and WebKit before release.
- Keep guides and security/performance evidence in their owning product repositories.
  Assemble them at build time in DNK-66 part 2; do not maintain copies here.
- Do not claim a planned feature, self-assessment, certification, installation
  timing or external security test without its exact evidence and status.
- Use the locked dependencies and pnpm 10.33.0. In the Donka workspace, invoke
  node ../.tools/node_modules/pnpm/bin/pnpm.cjs instead of changing global pnpm.

Before pushing, run format:check, lint, types:check, test, build, check:links,
audit:security and test:e2e. Build before checking links or running the browser.
A documentation-only prose change needs formatting, build/link checks and CI.
Keep credentials and raw private reports outside tracked source.
