# Independent product verification 7 — FAIL

**Work order:** `internal-event-ledger-verify-7`  
**Candidate:** `5c7523f15c39a5655051a7800f7719b313558420`  
**URL:** https://internal-event-ledger.sociobot.in  
**Verified:** 2026-09-02 UTC

## Verdict

**FAIL — do not accept this candidate.** Fresh live evidence proves that the production site is not serving the candidate. The candidate itself passes the specified clean local, claim, browser, accessibility, privacy, rate-limit, and release-build checks, but a deployment mismatch is release-blocking.

No product code or external resource was modified.

## Defects

### Critical — production does not match the candidate

Fresh `GET https://internal-event-ledger.sociobot.in/health` returned:

```json
{"build":"5a15c977709b65e99171de3eb506c662cae30f43","status":"ok"}
```

The required candidate is `5c7523f15c39a5655051a7800f7719b313558420`. The live HTML also refers to `/assets/index-DyrVZexg.js`, whereas the candidate-stamped production build emitted `/assets/index-ekgueQAN.js`. This is not a cache-only discrepancy: the server health build identity is the prior commit.

**Required resolution:** deploy the exact candidate through the factory deployment path; then verify `/health` returns the candidate SHA and rerun the live loading-state Axe scan before accepting it.

### Low — standalone browser QA commands require a separately running server

`npm run test:a11y` and `npm run test:e2e` default to `http://127.0.0.1:8080` and do not start it. Invoking `npm run test:a11y` before a server returned `net::ERR_CONNECTION_REFUSED`. With the documented backend running on port 8080, both checks passed. This is a verifier ergonomics issue, not a deployed-product failure.

## Mandatory first checks

### Claims: PASS (14/14)

`.factory/claims.json` is present with these 14 entries. After clean `npm ci`, I invoked every literal `test` command separately, selecting the named claim through the demo entry point. Every selected test passed; each command reports the other 13 as intentional skips. A full `npm test` run also passed all 14 together.

| Claim | Result | Evidence exercised |
| --- | --- | --- |
| `demo-sandbox` | PASS | One-click public entry, seeded groups, reset, no token prompt |
| `demo-isolation` | PASS | Demo actions leave a production sentinel unchanged |
| `demo-expiry` | PASS | 86,400-second deadline and expired workspace rejection |
| `self-hosted-runtime` | PASS | PORT-only startup, generated token, SQLite, health |
| `review-workflow` | PASS | Search, acknowledge, archive, digest |
| `administrator-boundary` | PASS | 401 boundary and session-only browser token |
| `retention-delete` | PASS | Aged group deleted to source policy |
| `response-policy` | PASS | Shell/SW revalidation, immutable asset, CSP |
| `ledger-export` | PASS | Five sample groups exported as CSV and JSON |
| `privacy-no-tracking` | PASS | All browser requests same-origin |
| `offline-demo` | PASS | Service-worker-controlled offline reload with five groups |
| `ingest-safety` | PASS | HMAC, redaction, credential stripping, repeat grouping |
| `self-hosted-controls` | PASS | Six 3,650-day sources and custom digest window |
| `api-rate-limit` | PASS | 60-token burst followed by 429 and `Retry-After` |

### Cold first-read: PASS

At a fresh 390×844 live context, the first screen plainly stated:

- **What:** “Review operational events without Slack noise.”
- **For whom:** “For solo developers and small teams that need searchable webhook history without another urgent inbox.”
- **First click:** **Try it with sample data**, immediately followed by “Opens an isolated sample ledger with no token.”

The action exists once in the first viewport. Clicking it is also covered in the candidate demo claim. The live page made only first-party requests and emitted no console or page errors in the cold read.

## Clean local gates: PASS

| Check | Result |
| --- | --- |
| Detached candidate checkout and `npm ci` | PASS — 60 packages; 0 known vulnerabilities |
| Every individual claim command | PASS — 14/14 |
| `npm test` | PASS — frontend, scope/container, Rust, persistence, all claims |
| Candidate-stamped `npm run build` | PASS — `dist/` produced |
| Candidate-stamped `cargo build --locked --release` | PASS — release health reported candidate SHA |
| `cargo fmt --check` | PASS |
| `cargo clippy --locked -- -D warnings` | PASS |
| Axe checks at desktop + 390px | PASS — zero violations in 18 scans, including delayed demo loading state |
| Browser smoke at desktop + 390px | PASS — zero console errors |

The candidate artifact sizes are 36,874-byte JavaScript (11.75 KB gzip), 17,075-byte CSS (4.70 KB gzip), 61,858-byte hero WebP, and 44,626-byte social WebP. The initial JavaScript is below the static 200 KB budget.

## Functional, security, and browser evidence

- The local exact release binary returned `{"build":"5c7523f15c39a5655051a7800f7719b313558420","status":"ok"}` with candidate-stamped frontend output.
- Smoke tests used keyboard-only skip navigation, made a source with redaction configuration, ingested a realistic event, acknowledged it, opened digest and privacy, and completed at 390px and 1366px.
- The Axe suite scanned public landing, demo loading state, demo, Inbox, Sources, Digest, Settings, Privacy, and Terms at both viewports. It found no serious or critical issues (indeed no violations). The skip link had a visible 3px solid focus outline and moved focus to `main`.
- Browser request capture during demo at both viewports contacted only the local product origin (`/demo`, same-origin JS/CSS/image, and `/api/demo`); no external analytics, font, CDN, or tracker request occurred. Cold live capture likewise made only `internal-event-ledger.sociobot.in` requests and no console errors.
- Candidate response headers were CSP-restricted to self, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, HSTS, and restrictive permissions policy. HTML and SW were `no-cache`; the hashed JS was `public, max-age=31536000, immutable`.
- A fresh local 120-request management burst from one forwarded client returned 60×401 then 60×429. Every 429 had `Retry-After: 1`; observed allowance is a 60-token initial burst. The declared claim also exercises receiver and management rate limits.
- Local routes `/`, `/demo`, `/privacy`, and `/terms` returned 200; a missing route returned the designed 404.

## Brief fit

The candidate meets the smallest useful job locally: a calm, searchable review queue for signed webhook events, with source aliases, fingerprints/grouping, acknowledge/archive, digest, retention deletion, and CSV/JSON export. It does not attempt paging, retries, workflow automation, or Slack replacement. The first-screen demo uses an isolated sample ledger and explicitly says no real data is saved.

## Handoff

The sole acceptance blocker is deployment identity. Do not change code merely for this report. Deploy candidate `5c7523f15c39a5655051a7800f7719b313558420`, confirm live `/health`, and repeat the live delayed-demo accessibility scan.
