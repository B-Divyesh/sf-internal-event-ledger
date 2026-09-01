# Internal Event Ledger — independent verification 6 handoff

## Current outcome

**FAIL — do not release candidate `2d241143dac3a5a0ba53c996f488042d72ce7c41` at https://internal-event-ledger.sociobot.in.**

Fresh verification on 2026-09-01 found one release blocker: the live demo's transient loading markup is `<div class="event-list" aria-label="Loading events">` without a valid role. Axe reports `aria-prohibited-attr` with `serious` impact. The settled demo has zero violations, but the accessibility contract explicitly covers loading states and requires all serious/critical findings to be fixed.

Everything else passed: all 14 executable claims, `npm test`, TypeScript, formatting, Clippy, audit, candidate-stamped frontend/release builds, desktop/mobile end-to-end tests, SQLite restart and two-process rolling overlap, shared rate limits, live identity/hash comparison, privacy request capture, headers/caching, service-worker update and offline reload, keyboard/focus/reduced-motion/200%-text checks, and mobile Lighthouse 100/100/100/100. Live `/health` returns the full candidate SHA. No product code was modified by the verifier.

Repair the loading state with valid status/live semantics and add a deliberately delayed Axe regression. Full evidence, commands, severity, and observed allowances are in [`.factory/verification-6.md`](verification-6.md).

---

# Previous builder handoff — repair 9

## Outcome

Repair 9 removes the release-blocking startup lease in candidate `96fab2b5a32deea9bb7894a9b998355a9aaff11b` and preserves the product fixes made for independent verification report commit `449d870892d7c00a00ac9f9512f4cab5a980b30e`. The artifact remains one Rust/axum container serving the Vite frontend on `PORT`; persistent state remains SQLite under `deploy.data_dir=/data`.

## Exact startup failure reproduced first

Docker is not installed in this worker, so the unchanged candidate binary was run as an unprivileged container user with an otherwise empty environment, `PORT`, the image defaults, and a fresh `/data/internal-event-ledger-r10` directory. The first process became healthy. A second process using that mounted database exited code 1 after 4.87 seconds:

```text
SQLite is busy during startup; retrying (attempt 1)
SQLite is busy during startup; retrying (attempt 2)
ledger startup failed; exiting instead of serving an unready response
SQLite remained locked after 3 startup attempts: database is locked
```

The first process still returned `200 {"build":"dev","status":"ok"}`. This isolated the cause: `locking_mode=EXCLUSIVE` retained the SQLite file lease for the entire process lifetime, so a rolling replacement could not initialize on the same mounted database.

## Repair

- SQLite now uses its cross-process `unix-dotfile` VFS, one pool connection, a one-second busy timeout, foreign keys, and the rollback `DELETE` journal. This replaces Azure Files' unreliable POSIX byte-range locks with an atomic sibling lock directory. A running revision and its replacement can briefly share the same durable database without an exclusive lifetime lease.
- The first scoped rollout showed `/data/internal-event-ledger-r10/ledger.db` remained unavailable after the code stopped requesting exclusive locks. A second rollout against `/data/internal-event-ledger/ledger.db` isolated a startup-time `PRAGMA journal_mode` lock. A third rollout removed that probe; its phase-level logs proved the remaining `SQLITE_BUSY` occurred while creating tables directly on Azure Files. A fourth rollout booted from a locally prepared database but proved ordinary mounted-file writes still encountered the unsupported byte-range lock. The final runtime keeps that complete `/data/internal-event-ledger/ledger-v2.sqlite3` and uses dot-file locking for all reads and writes. Its generated administrator token stays beside it, and every restart reuses both files. Tests verify the rollback `DELETE` journal, two-process coordination, and post-restart state. The repair does not delete, rename, or open any earlier ledger.
- Startup logs the non-secret resolved port, SQLite path, static path, and token-file path before opening storage. All fatal paths now emit a structured error chain plus a plain stderr fallback with the failing stage and path. Invalid `PORT` values also fail with a specific message instead of silently selecting another port.
- The rolling-start regression launches two real server processes on the same database, proves both `/health` endpoints are live, proves the old process remains live, verifies their deployment-wide limiter shares one 60-token allowance, stops both, starts a third process, and proves the source and administrator token persisted.
- A second regression supplies an unusable database path and asserts the process exits nonzero while naming both the SQLite initialization stage and exact path.
- Browser smoke now runs at configurable desktop and mobile sizes and proves the skip link and Sources navigation work from the keyboard.

## Independent verifier findings preserved

- The unavailable remote paid checkout and all runtime billing/license calls remain removed. `scripts/forbidden-resource.test.mjs` guards this self-contained boundary.
- The 24-hour demo expiry promise remains listed in `.factory/claims.json` and is tested by advancing persisted server time exactly 86,400 seconds.
- API, receiver, and demo limits remain in shared SQLite. The new two-process storage regression proves the API allowance does not multiply during a rolling overlap.
- The async Digest and browser Back focus repair remains covered by `@claim:review-workflow`, which asserts focus on the final `<h1>` after both transitions.

## Clean local verification

All checks passed on 2026-09-01 UTC.

- `cargo clean`; `npm ci` — clean Rust output; 60 npm packages installed; 0 audit vulnerabilities.
- `npm test` — 4 frontend tests, 6 container/scope tests, 21 Rust tests, 2 real-process startup tests, and all 14 executable claims passed.
- `npx tsc --noEmit`, `cargo fmt --check`, `cargo clippy --locked --all-targets -- -D warnings`, and `npm audit --omit=dev` — passed.
- `VITE_BUILD_SHA=repair-9-local npm run build` — `dist/` produced. Initial JS is 36.69 KB raw / 11.69 KB gzip; CSS is 17.08 KB raw / 4.70 KB gzip; the hero WebP is 61.86 KB.
- `BUILD_SHA=repair-9-local cargo build --locked --release` — passed. `/health` returned `{"build":"repair-9-local","status":"ok"}`.
- Release-binary browser smoke passed at 1366×900 and 390×844: create source, ingest, redact, acknowledge, digest, Privacy, skip link, keyboard navigation, and cleanup; zero console errors.
- `npm run test:a11y -- http://127.0.0.1:18192` scanned landing, Inbox, Sources, Digest, Settings, Privacy, Terms, and Demo at both viewports: 0 Axe violations. Measured legal controls were at least 44×44 CSS px.
- `/opt/fleet/lib/verify-url.sh http://127.0.0.1:18192 .factory/evidence/repair-9-local` passed: HTTP 200, `lang=en`, correct title, one `<h1>`, one `<main>`, alt text, labeled buttons, and zero page/console errors.
- Mobile Lighthouse: Performance 99, Accessibility 100, Best Practices 100, SEO 100; FCP 1.3 s, LCP 2.0 s, TBT 0 ms, CLS 0, total transfer 119 KiB. Raw report: `.factory/evidence/lighthouse-repair-9-local.json`.
- HTML and `sw.js` returned `Cache-Control: no-cache`; the hashed JavaScript returned `public, max-age=31536000, immutable`; CSP, HSTS, no-sniff, frame denial, no-referrer, and permissions policy were present.
- A release-binary restart against the same SQLite file returned health again and retained the `restart-proof` source. The automated test additionally proves generated-token persistence and concurrent replacement startup.

Offline reload, service-worker update, same-origin privacy capture, response policy, demo isolation/expiry, export, redaction, retention, rate limiting, and route focus are exercised by the 14 claim sandboxes. Evidence screenshots and verifier output are in `.factory/evidence/repair-9-local/`.

## Container and deployment

This worker has no Docker, Podman, Buildah, or Nerdctl executable, so the repository Docker contract and both real build stages were run locally; the factory ACR helper built the committed container.

Deployment uses only the work-order configuration:

```sh
WO_DATA_DIR=/data /opt/fleet/lib/deploy-container.sh internal-event-ledger /work/repo Dockerfile 8080
```

Live repair evidence from 2026-09-01 UTC:

- ACR run `ch1r5` deployed commit `b5c2745a77edc655de7c337a37e7a8f1af96d354` as revision `sf-internal-event-ledger--0000042`. The revision reached `Healthy` / `RunningAtMaxScale` with one configured replica, and public `/health` returned that exact 40-character build SHA.
- A live `POST /api/demo` wrote workspace `970ffa5d-585d-4932-ba04-57da3d433c67`; its subsequent read returned 3 sources and 5 events. A scoped revision restart briefly showed two replicas, then drained to the new replica `sf-internal-event-ledger--0000042-f677945d9-dm6f9`. The same workspace and all 3 sources / 5 events remained readable afterward, proving restart persistence and rolling overlap.
- The deployed startup log reports `ledger ready`, `managed_ingress=true`, one SQLite connection, the `/data/internal-event-ledger/ledger-v2.sqlite3` path, and a persisted administrator token without printing the token.
- `/`, `/demo`, `/privacy`, `/terms`, `/robots.txt`, and `/sitemap.xml` returned 200; the designed missing route returned 404. `verify-url.sh` reported the correct title, `lang=en`, one H1, a main landmark, complete image/button labels, and zero console errors.
- Live Playwright covered 1366×900 and 390×844. Eight Axe scans found zero violations. Skip-link and route focus, browser Back focus, same-origin-only requests, service-worker update, and offline demo reload passed with zero console errors.
- A live 100-request management burst returned 61×401 and 39×429; every 429 included `Retry-After: 1`. A concurrent 100-request `/health` smoke returned 100×200 in 114 ms.
- Response policy passed live: shell and service worker revalidate, hashed assets are immutable, API responses are `no-store`, and CSP, HSTS, no-sniff, frame denial, no-referrer, and permissions policy headers are present.

No other app, database, vault, storage share, or secret was read or changed.

## Known gaps

- No local container engine was available. The factory ACR build and scoped live revision provide the container execution proof.
- Earlier abandoned databases, including `internal-event-ledger-r10/ledger.db`, `internal-event-ledger/ledger.db`, and `internal-event-ledger/events.sqlite3`, are deliberately untouched. Any separate historical-data recovery needs explicit operator authorization.

## Run locally

```sh
npm ci
npm test
npm run build
BUILD_SHA=dev cargo run --release
```

Open `http://127.0.0.1:8080/demo` for the isolated sample workspace.
