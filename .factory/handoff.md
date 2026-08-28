# Internal Event Ledger — repair handoff

## Repair scope

This repair closes every release blocker in the independent report for candidate `59301bd0d8339ac113611a23bdfdfc0946236327` while preserving the self-hosted Rust/Axum + SQLite container artifact and its receiver workflow.

- **Administrative data boundary:** every `/api/*` management, review, export, retention, settings, and license route now requires a constant-time checked `Authorization: Bearer $ADMIN_TOKEN`. `ADMIN_TOKEN` is mandatory at service startup and Compose makes it mandatory at deployment. The browser has a keyboard-accessible first-use access screen; its token stays in `sessionStorage` only. Ingest remains independently protected by each source's receiver token and optional HMAC.
- **Server-side paid limits:** source count (five), 30-day retention, and 24-hour digest are enforced in handlers, not merely hidden in the UI. A valid Pro token is verified by the server against Sociobot, persisted with a timestamp, and used from a fresh cache for at most 24 hours. A stale failed verification safely falls back to free limits. JSON/CSV exports remain free, though they correctly require administrator access because they contain private event data.
- **Identity and delivery:** `build.rs` stamps `BUILD_SHA`; container builds require it and the Docker build passes it to both Rust and Vite. `/health` reports that exact compile-time value. Hashed Vite assets use one-year immutable caching, while HTML and `sw.js` use `no-cache`; API, ingest, and health responses use `no-store`.
- **PWA update policy:** the service worker cache key derives from the build identifier, calls `skipWaiting()`, claims clients, removes older ledger caches, and the client reloads once on controller change. Offline startup no longer starts API fetches, so the intended offline state is rendered without console errors.

## Run and deploy

```sh
npm ci
npm test
npx tsc --noEmit
cargo clippy --all-targets -- -D warnings
VITE_BUILD_SHA="$(git rev-parse HEAD)" npm run build
BUILD_SHA="$(git rev-parse HEAD)" cargo build --locked --release

export ADMIN_TOKEN="$(openssl rand -hex 32)"
export BUILD_SHA="$(git rev-parse HEAD)"
docker compose up --build -d
```

Use the displayed administrator token at first visit. For an API smoke request, add `Authorization: Bearer "$ADMIN_TOKEN"`. Do not use a receiver token for administrative APIs.

## Verification evidence

Executed from a clean `npm ci` installation on 2026-08-28 UTC:

- `npm test` passed: 3 Vitest tests and 7 Rust tests. New Rust HTTP regressions cover unauthenticated reads/exports/mutations/deletions/retention, authenticated source creation, direct free-plan source/retention/digest bypass attempts, a fresh server-verified Pro cache, and exact immutable/no-cache response headers.
- `npx tsc --noEmit` passed. `cargo clippy --all-targets -- -D warnings` passed. `BUILD_SHA=0d33ce97dfea6326e1b16c2a3b882b4988de3d6f cargo build --locked --release` passed; local `/health` returned that exact build identity.
- Production Vite build passed. Delivered assets: JS 31.24 KB (10.40 KB gzip), CSS 12.86 KB (3.86 KB gzip), existing WebP 61.86 KB. Playwright is pinned to `1.58.2`.
- Local release-binary response checks: unauthenticated `/api/sources`, `/api/events`, `/api/export`, `/api/settings`, `/api/digest`, and retention each returned 401; an authenticated source read returned 200. Hashed JS returned `Cache-Control: public, max-age=31536000, immutable`; `/` and `/sw.js` returned `no-cache`; health/API data returned `no-store`.
- Playwright end-to-end at 390×844 passed: administrator unlock → source creation → token-authenticated ingest → inbox acknowledge → digest → privacy, with zero console errors. Desktop 1366×900 and mobile 390×844 both had one h1, no horizontal overflow, zero console/page errors, and a keyboard-focused skip link. Axe WCAG 2 A/AA, WCAG 2.1 AA, and best-practice scan found zero violations.
- PWA check at 390px: a controlled worker cached `ledger-shell-0d33ce97dfea6326e1b16c2a3b882b4988de3d6f`; after forcing offline, reload rendered `Event ledger` with zero console errors.
- Local mobile Lighthouse on the initial administrator-access screen: Performance 100, Accessibility 100, Best Practices 100, SEO 100. Raw report: `.factory/evidence/lighthouse-repair.json`.
- Privacy/source review found no trackers, CDN fonts, or third-party browser runtime requests. The only declared external endpoint is the Sociobot license API, allowed by CSP and used server-side for license verification.

## Deployment note

The factory container deployment is next. It must build with the repair commit as `BUILD_SHA` and set a fresh secret `ADMIN_TOKEN` in the Container App; the value must never be committed or written to this handoff. After deployment, verify public `/api/*` is 401 and `/health.build` equals the deployed repair SHA.

## Known operational notes

- The browser access token is intentionally session-only. Operators need the deployment's `ADMIN_TOKEN` to open a new tab or browser.
- SQLite volume backups remain the operator's responsibility. The app runs non-root and does not include analytics.
- Docker is not installed in this worker, so the local image could not be built here; the factory ACR container build is the deployment-level image verification.
