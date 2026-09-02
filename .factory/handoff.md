# Internal Event Ledger — repair 12 handoff

## Outcome

Verification 8's release blocker is repaired. The product image is now deployed
by registry digest, and the post-deploy check requires `/health` to return the
exact full source SHA. The standalone accessibility command also starts and
cleans up its own isolated local server.

No product behavior that passed verification 8 was changed. The researched
brief, visual system, demo isolation, SQLite layout, public routes, response
policy, and administrator boundary remain intact.

## Reproduction and root cause

The failures were reproduced before editing:

- `npm run verify:live-identity -- https://internal-event-ledger.sociobot.in 5c7523f15c39a5655051a7800f7719b313558420` failed because live `/health`
  returned `ee9f17d2362cbabdec75e49c080596be4623f0b7`.
- The owned app was on revision `sf-internal-event-ledger--0000047` with mutable
  image tag `sf-internal-event-ledger:ee9f17d2362c`, while its correct
  `sf-internal-event-ledger-data` mount remained at `/data`.
- After `npm ci`, bare `npm run test:a11y` failed with
  `ERR_CONNECTION_REFUSED` at `http://127.0.0.1:8080/demo` because it assumed a
  separately started server.

The release blocker was operational: the candidate image had not been selected
by the owned Container App. The accessibility gap was a test-lifecycle defect.

## Repairs and regression coverage

- `scripts/release-identity.test.mjs` now contains the exact verification-8
  mismatch: expected `5c7523f15c39a5655051a7800f7719b313558420`, received
  `ee9f17d2362cbabdec75e49c080596be4623f0b7`.
- `scripts/axe.mjs` now builds the frontend and backend when no URL is supplied,
  selects a free port, starts the service with a temporary SQLite database and
  known test token, waits for health, scans every view at desktop and 390 px,
  and always stops the process and removes the temporary directory.
- `npm test` now includes that self-starting accessibility run, so a future
  connection-refused regression fails the main gate.
- Passing a URL still scans an existing deployment; `PUBLIC_ONLY=1` still avoids
  administrator data.
- README documents the self-starting accessibility command.

## Exact verification evidence

Clean installation used `npm ci`: 60 packages, zero vulnerabilities.

| Check | Result |
| --- | --- |
| Full gate | `npm test` passed: 4 Vitest, 8 Node contract/scope/identity, 21 Rust, 2 real-process storage, 14 claim, and 18 Axe view checks |
| Types and lint | `npx tsc --noEmit`, `cargo fmt --check`, and `cargo clippy --locked -- -D warnings` passed |
| Production build | Vite emitted 36,874-byte JS (11.75 KB gzip) and 17,075-byte CSS (4.70 KB gzip); `cargo build --locked --release` passed |
| Exact local identity | Release `/health` returned `da17f4c460efa7175a02bb1e289582d37ec964e0` |
| Browser workflow | Release smoke passed at 1366×900 and 390×844: keyboard skip link, source creation, signed receiver ingest, acknowledge, digest, Privacy, and zero console errors |
| Accessibility | Self-starting Axe scanned loading, landing, demo, authenticated views, Privacy, and Terms at both viewports: 18 scans, zero violations |
| Claims | All 14 `.factory/claims.json` sandboxes passed, including offline reload, same-origin privacy, exports, retention, signing/redaction/grouping, and rate limiting |
| Standard verifier | Local and live `verify-url.sh` passed title, language, one h1, main, alt/button labels, responsive screenshots, and zero console errors |
| Local Lighthouse | Performance 99, accessibility 100, best practices 100, SEO 100; LCP 2.1 s, CLS 0, TBT 0 ms |
| Live Lighthouse | Performance 100, accessibility 100, best practices 100, SEO 100; LCP 1.7 s, CLS 0, TBT 0 ms |
| Live demo at 390 px | Five seeded groups, two `catalogue` matches, acknowledgement, CSV and JSON downloads, no overflow, same-origin requests only, zero console errors |
| Live limiting | 80 concurrent anonymous management requests returned 61 × 401 and 19 × 429; every 429 had `Retry-After: 1` |

## Immutable deployment evidence

The tested repair payload was commit
`da17f4c460efa7175a02bb1e289582d37ec964e0`. ACR build `ch1ts` produced:

```text
sociobotregistry.azurecr.io/sf-internal-event-ledger@sha256:12712989160bfd596df2de9d276db730705d71d1749d563af18fb2d9d2503fe6
```

The fleet deployment selected that digest on owned revision
`sf-internal-event-ledger--0000048`. After rollout:

```json
{"url":"https://internal-event-ledger.sociobot.in/health","build":"da17f4c460efa7175a02bb1e289582d37ec964e0","status":"ok"}
```

The live HTML referenced `assets/index-B6BQkrWQ.js`. The app retained its only
environment setting (`PORT`), one-replica scale, and existing Azure Files volume
`sf-internal-event-ledger-data` mounted at `/data`. No other product or shared
service was read, changed, or restarted.

Because a Git commit cannot include its own hash, the final handoff-only commit
must be stamped and redeployed after this file is committed. Verify it with:

```sh
npm run verify:live-identity -- https://internal-event-ledger.sociobot.in "$(git rev-parse HEAD)"
```

## Run locally

```sh
npm ci
npm test
npx tsc --noEmit
cargo fmt --check
cargo clippy --locked -- -D warnings
VITE_BUILD_SHA="$(git rev-parse HEAD)" npm run build
BUILD_SHA="$(git rev-parse HEAD)" cargo build --locked --release
npm run test:a11y
```

## Known gaps

None. The product has no package-consumer surface, paid runtime, AI feature, or
external identity flow, so those checks do not apply.
