# Donka documentation

Static English/French product documentation built with Fumadocs and Next.js.
The site is delivered in three DNK-66 parts. Part 1 provides the English/French
foundation, Discover/Architecture pages, responsive diagram, local search and CI
checks. Part 2 assembles source guides and security/performance evidence from
pinned Studio, Runtime and CLI commits. Part 3 will add tagged-release API
references, version/PDF support and the product repository checks. It does not
deploy a website.

## Development

Use Node 22+ and pnpm 10.33.0:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

In the Donka workspace, use node ../.tools/node_modules/pnpm/bin/pnpm.cjs instead
of the global pnpm. On Windows, run dependency and verification commands in
Ubuntu WSL; a native Linux checkout avoids mounted-filesystem build overhead.
Open the development server's local address at /en/ or /fr/.

## Verify and preview

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
pnpm start
```

The build writes out/. Serve that directory with any static HTTP server that
supports directory index files. The root page offers English and French links.
Search loads an exported local index and requires no hosted search service.
No browser code, fonts or diagrams load from a CDN.

Build and type-check assemble `content/docs/evidence/` and `public/evidence/`
from the commit pins in `content-sources.json`. These generated directories are
ignored by Git. Locally, the source repositories are expected beside this repo
inside the Donka workspace; set `DONKA_DOCS_SOURCES_DIR` to their common parent
when using a different layout. CI checks out the exact commits into `.sources/`.
The downloadable `source-manifest.json` records the source revisions and hashes
of the original files. Source guides in the product repositories remain
authoritative.

The link checker resolves relative and absolute internal links, assets and
fragment targets. Its tests include missing pages, missing anchors and malformed
URLs. Playwright runs against the actual static server, with no browser retries.
CI retains its synthetic screenshots and reports as artifacts; it publishes no site.

## DNK-66 delivery

1. Site foundation, i18n, architecture diagram and CI checks (this PR).
2. Reviewed content, including Trust and Performance; assemble source guides
   and evidence at build time from Studio, Runtime and CLI (this PR).
3. Tagged-release generated references, version selector, PDF export, Scalar in
   Studio and the documentation checks in the three product repositories.

Part 1 documents development source. It does not claim that a five-minute
published-image install, external penetration test or release gate has passed.
Hosting and domain remain the owner's decision. Read AGENTS.md and
CONTRIBUTING.md before contributing.

The Donka mark in public/donka-mark.svg follows Studio's docs/brand/README.md.
