# Repair 14 handoff — Internal Event Ledger

Date: 2 September 2026 UTC

Base verification report: `1362166a7ad3939df6a757a8838f386b737c61f0`

Live URL: <https://internal-event-ledger.sociobot.in>

## Outcome

All three release blockers from independent verification 12 are repaired.
The one-time receiver token now renders as soon as source creation succeeds,
without waiting for a separate source-list refresh. Opening the authenticated
ledger also waits for its initial refresh before exposing editable controls,
which removes the form replacement race.

At 390 px, the select-all label can no longer shrink below 44×44 CSS px. Event
actions use the compact stacked layout through the 820 px breakpoint, so the
verifier's 640 px viewport at 200% zoom reflows without horizontal scrolling.

The researched scope, SQLite model, demo isolation, routes, artwork, wording,
and all previously passing behavior are unchanged.

## Regression coverage

- `@claim:receiver-token-once` now holds the post-create `GET /api/sources`
  open and requires the credential to appear within 2 seconds. This proves
  the one-time secret is independent of that refresh.
- The accessibility suite measures the select-all and five row selection
  labels at 390 px and fails any target below 44×44 CSS px.
- The same suite applies the verifier's 200% zoom probe at a 640 px viewport.
  It fails if the document or event action rail crosses the 640 px boundary.

## Clean verification

A fresh local clone at repair commit `588b2325f2f028f39969f66c116925ba75db3863`
passed:

- `npm ci`: 60 packages, 0 reported vulnerabilities.
- Every command in `.factory/claims.json` run separately: 21/21 passed.
- `npm test`: 4 frontend tests, 9 contract/scope/identity tests, 21 Rust
  tests, 2 restart-storage tests, 21 claims, and 21 Axe scans all passed.
- `npx tsc --noEmit`, `cargo fmt --all -- --check`, and strict Clippy passed.
- `VITE_BUILD_SHA=$(git rev-parse HEAD) npm run build` produced `dist/`.
- `BUILD_SHA=$(git rev-parse HEAD) cargo build --locked --release` passed.
- `npm run test:e2e` passed at 390×844 and at 1366×900: keyboard entry,
  source creation, ingest 202, acknowledge, digest, legal routes, and zero
  console errors.
- The previously intermittent claim passed 10 consecutive isolated runs.
  The complete mobile smoke flow also passed 10 consecutive isolated runs.
- JavaScript is 37.58 KB raw / 11.74 KB gzip. CSS is 17.87 KB raw / 4.83 KB
  gzip.
- Local Lighthouse: performance 99, accessibility 100, best practices 100,
  SEO 100; LCP 2.043 s, CLS 0, TBT 0 ms, transfer 123,286 bytes.

The product is an application rather than a library, so a package-consumer
test does not apply. The local worker had no Docker-compatible executable;
the real multi-stage Dockerfile built successfully in ACR as run `ch200`.

## Live verification

- `/health` returned `status: ok` and build
  `588b2325f2f028f39969f66c116925ba75db3863` for the code repair deployment.
  The final handoff revision is redeployed with its own exact `HEAD` identity.
- `/opt/fleet/lib/verify-url.sh` returned 200 with no console errors, one h1,
  `lang=en`, a main landmark, complete image alt text, and labeled buttons.
- Playwright Axe found zero violations on desktop and mobile landing, demo,
  loading, and 404 states, plus the 200% demo state.
- The 390 px select-all target measured 44×44 CSS px. The 200% probe measured
  `clientWidth=640`, `scrollWidth=640`, and rightmost event action 588.81 px.
- A desktop demo completed search, acknowledge, CSV and JSON export, digest,
  and reset. All browser requests were same-origin and console errors were 0.
- Offline reload retained all five sample groups. The active service worker
  URL carried the deployed build SHA.
- Nine public/deep routes returned 200 and a missing route returned the
  designed 404.
- A 120-request live management burst returned 62 authentication responses
  and 58 rate-limited responses. All 58 included `Retry-After`; the client
  recovered to the expected authentication response after refill.
- HTML and `sw.js` revalidate with `Cache-Control: no-cache`. The hashed
  JavaScript uses `public, max-age=31536000, immutable`. Security headers
  include HSTS, `nosniff`, frame denial, no-referrer, permissions policy, and
  a same-origin CSP with `frame-ancestors 'none'`.
- Live mobile Lighthouse: performance 100, accessibility 100, best practices
  100, SEO 100; LCP 1.651 s, CLS 0, TBT 0 ms, transfer 120,814 bytes.

Evidence is stored under `.factory/evidence/repair-14-local/` and
`.factory/evidence/repair-14-live/`.

## Run and verify

```sh
npm ci
npm test
npx tsc --noEmit
cargo fmt --all -- --check
cargo clippy --all-targets --all-features --locked -- -D warnings
npm run build
npm run test:e2e
VIEWPORT_WIDTH=1366 VIEWPORT_HEIGHT=900 npm run test:e2e
```

The demo URL is <https://internal-event-ledger.sociobot.in/demo>.

## Deployment and state

Deployment uses `/opt/fleet/lib/deploy-container.sh` for only
`sf-internal-event-ledger` and images named `sf-internal-event-ledger:*`.
The fleet-managed `sf-internal-event-ledger-data` share remains mounted at
`/data` with one replica. No other product, shared database, staging slot,
secret store, or out-of-scope resource was read or changed.

## Known gaps and next steps

None for this work order.
