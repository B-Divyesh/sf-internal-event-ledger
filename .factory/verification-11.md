# Independent verification 11: PASS

Candidate commit: `00bae672a9dfff862722f5375c02c8a9ede73a05`  
Live URL: <https://internal-event-ledger.sociobot.in>  
Verified: 2026-09-02 UTC from a clean checkout.

## Verdict

**PASS.** The live deployment identifies itself as the exact candidate and the candidate meets the researched job: it receives low-urgency signed events into a self-hosted SQLite ledger, groups fingerprints, supports search and review state, digest, retention, and CSV/JSON export. It is a calm review queue, not a pager or webhook retry service.

No product code or infrastructure was changed during this verification.

## Mandatory initial gates

`.factory/claims.json` exists and contains 21 executable claims. After `npm ci` (60 packages, zero reported vulnerabilities), every exact declared claim command was run individually against its demo/server sandbox before broader QA. All passed:

| Claims | Result |
| --- | --- |
| demo-sandbox; demo-isolation; demo-expiry; self-hosted-runtime | PASS |
| review-workflow; administrator-boundary; retention-delete; response-policy | PASS |
| ledger-export; privacy-no-tracking; offline-demo; ingest-safety | PASS |
| receiver-token-once; receiver-authentication; group-state-transition; health-identity | PASS |
| receiver-quota; scope-boundary; free-mit-license; self-hosted-controls; api-rate-limit | PASS |

The subsequent complete `npm test` independently ran all 21 again: 21 pass, 0 fail. Its claim run included the isolated demo, 24-hour expiry, offline reload, HMAC/redaction, token delivery locations, status transitions, privacy request recording, retention, and rate-limit fixtures.

Cold first read of the live page passes. It says **“Review low-priority webhook events”**, identifies **“solo developers and small teams”** who need searchable history outside Slack, and provides the visible one-click **“Try it with sample data”** action with the result stated plainly: **“Opens an isolated sample ledger with no token.”**

## Local build and quality checks

| Check | Result |
| --- | --- |
| `npm ci` | PASS |
| `npm test` | PASS: Vitest, Node contracts, 21 Rust tests, storage/restart, all 21 claims, and desktop/mobile Axe scans |
| `npx tsc --noEmit` | PASS |
| `cargo fmt --all -- --check` | PASS |
| `cargo clippy --all-targets --all-features --locked -- -D warnings` | PASS |
| `npm run test:e2e` | PASS: mobile keyboard, source creation, ingest (202), acknowledgment, digest, privacy, no console errors |
| `VITE_BUILD_SHA=00bae… npm run build` | PASS; produces `dist/` |

The production candidate build emits 37,457 bytes of JavaScript (11.73 KB gzip) and 17,822 bytes of CSS (4.81 KB gzip), within the static budget. The candidate-stamped local script SHA-256 exactly matches live `/assets/index-16Q2iV0b.js`: `520fad0686941b885d43072c99aa5eb74f11f6884d64d8026a53d95c122b5f8f`.

## Live application QA

- `npm run verify:live-identity -- https://internal-event-ledger.sociobot.in 00bae672a9dfff862722f5375c02c8a9ede73a05` passed. `/health` returned `{"build":"00bae…","status":"ok"}`.
- Fresh live `/demo` loaded five sample groups. Search for `deploy` settled to one group; acknowledge changed its state; CSV and JSON exports downloaded as `event-ledger-demo.csv` and `event-ledger-demo.json`; Digest refreshed.
- A fresh service-worker-controlled demo was set offline and reloaded; all five groups remained readable. There were no console or page errors.
- At 390×844 with reduced motion enabled, there was no horizontal overflow (`scrollWidth=clientWidth=390`). Keyboard focus started on the skip link; it has a visible `rgb(6, 118, 154)` 3px focus outline.
- Live public Axe scanned desktop and 390px landing, demo loading, demo, and 404: zero violations. A direct live demo scan found zero serious/critical findings. `/opt/fleet/lib/verify-url.sh` passed (200, 863 ms, title/lang/main/one h1/alt checks, no console errors).
- A 120-request anonymous burst from one client to `/api/sources` produced 65 × 401 then 55 × 429; each observed 429 had `Retry-After: 1`. The documented allowance is enforced, with a 60-token burst plus requests refilled during the burst. The claim suite also verifies the separate valid-receiver quota.
- This product has no sign-in; the Entra tenant check is not applicable. It is neither a library/CLI nor a PWA requiring an install/update flow beyond the checked service-worker offline reload.

## Privacy, headers, and routing

Fresh browser request logs across landing, demo, review action, exports, and digest contained only `https://internal-event-ledger.sociobot.in`; no analytics, trackers, external fonts, CDN assets, or page errors appeared. The root has `lang="en"`, a descriptive title, one h1, and a main landmark.

HTML and `sw.js` return `Cache-Control: no-cache`; hashed JS returns `public, max-age=31536000, immutable`. The live site serves HSTS, `nosniff`, `DENY` framing, no-referrer policy, restrictive permissions policy, and same-origin CSP with `frame-ancestors 'none'`. `/demo`, `/privacy`, and `/terms` return 200; a missing route returns the designed 404 with 404 status.

## Defects by severity

None found.

## Verification limitation

No Docker/Podman/Buildah executable is installed in this verifier container, so a local container build was not run. The Docker contract checks included in `npm test` passed, as did the production frontend and Rust builds.
