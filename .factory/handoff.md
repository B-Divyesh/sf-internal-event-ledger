# Internal Event Ledger — repair 13 handoff

## Outcome

Repaired the release-blocking findings recorded in
[`verification-9.md`](verification-9.md) for candidate
`df710f7e6c5272e4d18a43403e52e25a15375068`.

Repair commit: `d4b303b0d7f909b4cdc670024073fea4be5c2acb`.

## What changed

- Reproduced the reported cache failure before changing code: the candidate
  emitted `/assets/index-BVE-f5_C.js`, which returned `Cache-Control: public,
  max-age=86400`.
- Vite now emits its manifest. The Rust server reads that manifest at startup
  and applies one-year immutable caching only to the exact emitted JS/CSS
  files. It never guesses from a filename, so URL-safe Vite hashes containing
  `-` or `_` work correctly and ordinary static files retain conservative
  caching.
- Added unit coverage for the reported `index-BVE-f5_C.js` form, actual
  release-manifest handling, CSS caching, conservative non-hashed caching,
  and every real application route. The response-policy claim now discovers
  all JS/CSS URLs in the built HTML and checks every emitted asset.
- Replaced hash application routes with `/inbox`, `/sources`, `/digest`, and
  `/settings`, plus `/demo`-scoped equivalents. The server, sitemap, history,
  title, canonical URL, deep links, and back/forward handling support them.
- Legal navigation now exits demo atomically: it deletes the ephemeral
  workspace, removes `demo:internal-event-ledger:workspace`, clears sample
  state, restores administrator access, and never renders sample records
  without the demo banner. Direct non-demo navigation does the same.
- Added semantic product footers to demo and legal routes, including Privacy,
  Terms, Param Factory attribution, and build identity. Footer text uses the
  high-contrast ink token on the deep paper surface.
- `npm run test:e2e` now builds and starts its own isolated production-like
  server by default. Passing an explicit URL or `SMOKE_URL` still tests an
  existing server.

## Verification

Run from a clean checkout:

```sh
npm ci
npm test
npx tsc --noEmit
cargo fmt --all -- --check
cargo clippy --all-targets --all-features --locked -- -D warnings
npm run test:e2e
VIEWPORT_WIDTH=1366 VIEWPORT_HEIGHT=900 npm run test:e2e
npm run build
cargo build --locked --release
```

Evidence from this repair:

- `npm ci`: 60 packages, zero vulnerabilities.
- `npm test`: 4 Vitest checks, 8 Node contract/scope/identity checks, 21 Rust
  tests, 2 storage/restart tests, all 14 registered claim sandboxes, and 18
  desktop/mobile Axe scans passed.
- The cache claim inspects the release HTML's actual generated JS/CSS paths;
  the isolated server returned `public, max-age=31536000, immutable` for each.
- The `demo-isolation` claim reproduces `/demo → Privacy → Inbox`, asserts the
  banner and storage namespace are gone, confirms no sample rows appear, and
  confirms administrator access is required.
- Bare E2E passed at 390×844 and 1366×900. It verifies keyboard skip-link
  behavior, source creation/ingest/acknowledge/digest, semantic application
  paths, legal and demo footers, and zero page/console errors.
- Axe scanned loading, landing, inbox, sources, digest, settings, Privacy,
  Terms, and demo at both sizes with zero WCAG A/AA, WCAG 2.1 AA, or
  best-practice violations.

## Deployment and post-deploy checks

Released with the fleet container deployment for
`sf-internal-event-ledger`. The container retains the work-order durable
`/data` mount and one replica for SQLite state.

- `/health` returned HTTP 200 with the full deployed source identity, and
  `npm run verify:live-identity -- https://internal-event-ledger.sociobot.in
  <release-sha>` passed.
- The factory URL verifier returned HTTP 200 in 703 ms with zero browser
  errors, one `<h1>`, a `main` landmark, `lang="en"`, and complete image and
  button labels.
- Public live Axe checks passed for loading, landing, and demo at desktop and
  390 px with zero violations.
- The deployed HTML's actual emitted JS and CSS both returned
  `public, max-age=31536000, immutable`; `/`, `/privacy`, `/terms`, `sw.js`,
  and all new application routes returned their expected responses.
- A live 390 px browser check repeated `/demo → Privacy → Inbox`: the banner
  and sample rows disappeared, and Inbox required the administrator token.

## Known gaps

No local Docker/Podman/Buildah executable is available in this worker image.
The Dockerfile contract is covered by repository tests; the fleet's ACR build
is the container-build verification.
