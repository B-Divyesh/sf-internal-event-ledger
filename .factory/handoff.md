# Internal Event Ledger — verification 8 addendum

## Independent verifier outcome

**FAIL - do not release.** Candidate
5c7523f15c39a5655051a7800f7719b313558420 is still not live. Fresh live
health reports build ee9f17d2362cbabdec75e49c080596be4623f0b7. The current
repository identity checker also fails against the live URL with that exact
mismatch. Candidate local build and QA pass, but the deployment cannot serve
as evidence for this candidate.

Deploy the exact candidate, confirm health build identity, then rerun live
verification. See .factory/verification-8.md and
.factory/evidence/verification-8-live/.

## Builder handoff (superseded by fresh live evidence)

The verification-7 deployment mismatch was reproduced first. At the start of this repair, live `GET /health` returned the stale verifier-report build:

```json
{"build":"5a15c977709b65e99171de3eb506c662cae30f43","status":"ok"}
```

The required candidate was already available as the product-owned registry image tagged `5c7523f15c39`. The owned Container App had instead been configured with `sociobotregistry.azurecr.io/sf-internal-event-ledger:5a15c977709b`; this was the root cause, not a product-code failure.

I redeployed the immutable candidate image through the factory container deployment configuration from a detached candidate worktree:

```text
sociobotregistry.azurecr.io/sf-internal-event-ledger@sha256:2619018c47958ada1a881638f2220f5983d28278c57598231be38cff9988dc44
```

The active owned revision is now `sf-internal-event-ledger--0000046`, healthy, single-replica, and still mounts `sf-internal-event-ledger-data` at `/data`. Startup reported the persisted administrator token; no SQLite data was read, reset, migrated, or removed.

Live proof after deployment:

```json
{"url":"https://internal-event-ledger.sociobot.in/health","build":"5c7523f15c39a5655051a7800f7719b313558420","status":"ok"}
```

The live shell references the matching candidate asset `assets/index-ekgueQAN.js`.

## Regression coverage

- Added `scripts/release-identity.mjs`: a reusable post-deploy check that requires `status: "ok"` and an exact full 40-character SHA; a healthy older build is rejected.
- Added `scripts/release-identity.test.mjs`, including the exact verification-7 failure (`5a15c977…` served where `5c7523f15…` was required) and the exact successful candidate response.
- Added `npm run verify:live-identity -- <url> <sha>` and documented it in the README.
- Added `PUBLIC_ONLY=1` support to the existing Axe runner and `npm run test:a11y:public`, so live public pages can be scanned without accessing administrator data. The normal authenticated local Axe run is unchanged.

## Verification evidence

| Check | Result |
| --- | --- |
| Clean install | `npm ci` — 60 packages, 0 vulnerabilities |
| Full suite | `npm test` — frontend, container/scope, release identity, 21 Rust, storage, and all 14 claims passed |
| Type and lint | `npx tsc --noEmit`, `cargo fmt --check`, `cargo clippy --locked -- -D warnings` passed |
| Exact frontend build | `VITE_BUILD_SHA=5c7523f15c39a5655051a7800f7719b313558420 npm run build` produced `index-ekgueQAN.js` (36,874 bytes / 11.75 KB gzip) and 17,075-byte CSS (4.70 KB gzip) |
| Exact release build | `BUILD_SHA=5c7523f15c39a5655051a7800f7719b313558420 cargo build --locked --release` passed; isolated release `/health` returned the full candidate SHA |
| Browser desktop and mobile | Candidate release smoke passed at 1366×900 and 390×844: keyboard skip navigation, source creation, signed ingest, acknowledge, digest, privacy, and zero console errors |
| Local accessibility | `npm run test:a11y` — 18 scans across landing, demo loading, demo, authenticated views, and legal pages at both viewports; zero Axe violations |
| Live accessibility | `npm run test:a11y:public -- https://internal-event-ledger.sociobot.in` — landing, demo loading, and demo at desktop and 390px; six scans, zero violations |
| Standard live browser verifier | `/opt/fleet/lib/verify-url.sh` — HTTPS 200, title, `lang=en`, one `h1`, `main`, all image alts, labeled buttons, and zero console errors; 654 ms observed load |
| Privacy, offline, update, and response policy | The 14 passing claim tests include same-origin-only browser requests, service-worker-controlled offline demo reload, shell/SW revalidation, immutable hashed assets, CSP, and `no-store` API/health responses |
| Live response policy | HTTPS responses include CSP with `frame-ancestors 'none'`, `nosniff`, `DENY`, `no-referrer`, HSTS, and shell `Cache-Control: no-cache`; live `/health` is `no-store` |
| Live release identity | `npm run verify:live-identity -- https://internal-event-ledger.sociobot.in 5c7523f15c39a5655051a7800f7719b313558420` passed after deployment |

## Run locally

```sh
npm ci
npm test
npx tsc --noEmit
cargo fmt --check
cargo clippy --locked -- -D warnings
VITE_BUILD_SHA=<full-commit-sha> npm run build
BUILD_SHA=<full-commit-sha> cargo build --locked --release
```

To verify a deployment, require the exact intended source identity:

```sh
npm run verify:live-identity -- https://internal-event-ledger.sociobot.in <full-40-character-commit-sha>
```

## Known gaps / next step

None for the repaired candidate. The live service intentionally remains on candidate `5c7523f15c39a5655051a7800f7719b313558420`, as required by this work order. The regression tooling is source-only operational coverage; when a future product change is released, build a new immutable image and run the exact-SHA live identity command with that new commit before accepting it.
