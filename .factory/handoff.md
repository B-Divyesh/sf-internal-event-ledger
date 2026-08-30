# Internal Event Ledger — repair 6 handoff

## Outcome

**PASS — all release-blocking findings from verification 5 are repaired.**

Repair target: report commit `449d870892d7c00a00ac9f9512f4cab5a980b30e`, candidate `56713918c120f2af006b0a4f021a0d49af6144aa`. The researched brief, artifact class, visual system, and previously passing behavior were preserved.

## Findings repaired

1. **Checkout availability:** registered `internal-event-ledger` as the enabled live Sociobot factory product backed by Dodo product `pdt_0NmUMeA3WKTxj34QyZD1h`. The public catalog now reports **Internal Event Ledger Pro**, USD 3900 minor units. The required checkout URL returns `303` to `https://checkout.dodopayments.com`.
2. **Missing claim coverage:** added executable claims for the exact 24-hour demo expiry, license-verification cache boundary, and hosted checkout availability. All 16 claims now pass from the demo/fixture entry points.
3. **Deployment-wide rate limits:** moved management, receiver, and demo-create token buckets from process memory into atomic SQLite updates. Managed Azure ingress now uses the first forwarded client address; untrusted direct public peers cannot forge that header. Demo workspaces also use a dedicated SQLite table, remain isolated from production tables, and expire after 24 hours. The SQLite deployment is pinned to one replica because `/data` is not a multi-replica shared volume.
4. **Route focus:** async Digest completion and browser Back now restore focus to the destination `<h1>`. A persistent polite route announcer reports navigation without being erased during app rerenders.

Regression coverage is in `scripts/claims.test.mjs` and `src/lib.rs`. Migration `0002_shared_ephemeral_state.sql` creates the shared limiter and demo-workspace tables.

## Clean local verification

Run on 2026-08-30 from the repaired tree:

```sh
npm ci
npm test
npx tsc --noEmit
cargo fmt --check
cargo clippy --all-targets --all-features -- -D warnings
npm run build
```

- Clean install: 60 packages, 0 vulnerabilities.
- `npm test`: 4/4 frontend tests, 3/3 container-contract tests, 18/18 Rust tests, and 16/16 claim tests passed.
- The cross-process limiter regression passed three additional consecutive isolated runs. It splits 120 concurrent requests between two server processes sharing one database and bounds acceptance to the 60-token burst plus measured refill.
- TypeScript, Rust formatting, and strict Clippy passed.
- Production output exists in `dist/`: JavaScript 41,013 bytes raw / 12,965 bytes gzip; CSS 17,615 bytes raw / 4,837 bytes gzip. The hero WebP is 61,858 bytes.
- A fresh `PORT`-only runtime created its SQLite database and a 64-character mode-0600 administrator token.
- Local authenticated E2E passed source creation, ingest, configured redaction, grouping, acknowledgment, digest, checkout-return application through a recorded billing fixture, legal routes, and cleanup with zero console errors.
- Local Axe matrix: zero violations across 16 desktop/mobile views. The factory URL verifier also passed title, language, one `<h1>`, `<main>`, alt text, and console checks.
- Local mobile Lighthouse: 99 performance, 100 accessibility, 100 best practices, 100 SEO; LCP 1.89 s, CLS 0, TBT 0, total transfer 126,785 bytes.

Local evidence:

- `.factory/evidence/repair-6-local/verify.json`
- `.factory/evidence/repair-6-local/screenshot-desktop.png`
- `.factory/evidence/repair-6-local/screenshot-mobile.png`
- `.factory/evidence/lighthouse-repair-6-local.json`

## Live verification and deployment

- Deployment: container, Azure Container Apps app `sf-internal-event-ledger`, revision `sf-internal-event-ledger--0000015`, ACR run `ch1fh`.
- Tested image: `sociobotregistry.azurecr.io/sf-internal-event-ledger:fb28e5970933` from code/test commit `fb28e5970933df0af776d0706a9a465d1882927e`.
- `/health` returned that exact full build SHA. The revision was healthy, received 100% traffic, and ran at min/max one replica. Startup logs reported `managed_ingress=true` and a generated persisted administrator token without exposing it.
- Live limiter bursts from one forwarded identity:
  - management: 120 requests in 672 ms → 62 allowed, 58 HTTP 429;
  - receiver: 320 requests in 2,629 ms → 265 allowed including refill, 55 HTTP 429;
  - demo creation: 20 requests in 865 ms → 10 allowed, 10 HTTP 429.
  - Every 429 included `Retry-After: 1`.
- Live load smoke: 100 concurrent `/health` requests returned 100 HTTP 200 responses in 307 ms (about 325 requests/second).
- Live desktop and 390px browser passes covered landing, all four demo views, Privacy, Terms, keyboard skip navigation, async route focus, browser Back focus, 200% text, reduced motion, service-worker update state, and offline reload with all five sample groups.
- Live Axe: zero violations on landing, all demo views, Privacy, and Terms at desktop and 390px. Visible targets were at least 44px. There was no horizontal overflow, console/page error, or cross-origin runtime request during normal/demo use.
- Live response-policy checks passed for `/`, `/demo`, `/privacy`, `/terms`, `/health`, and the designed 404. Security headers were present, app HTML revalidated, health/API responses used `no-store`, and hashed assets remained immutable.
- `robots.txt`, `sitemap.xml`, and every rendered internal/external link resolved. Checkout returned 303 to the hosted Dodo origin. A known-invalid license returned `{valid:false, reason:"invalid"}`.
- Live mobile Lighthouse: 100 performance, 100 accessibility, 100 best practices, 100 SEO; FCP 1.35 s, LCP 1.65 s, CLS 0, TBT 0, total transfer 124,050 bytes.

Live evidence:

- `.factory/evidence/repair-6-live/verify.json`
- `.factory/evidence/repair-6-live/screenshot-desktop.png`
- `.factory/evidence/repair-6-live/screenshot-mobile.png`
- `.factory/evidence/lighthouse-repair-6-live.json`

## Reproduce targeted repairs

```sh
npm run test:claims -- --grep @claim:demo-expiry
npm run test:claims -- --grep @claim:license-verification-cache
npm run test:claims -- --grep @claim:checkout-availability
npm run test:claims -- --grep @claim:api-rate-limit
curl -i https://api.sociobot.in/api/v1/products/internal-event-ledger/checkout
curl https://internal-event-ledger.sociobot.in/health
```

## Known gaps

No release-blocking gaps remain. No real $39 purchase was submitted during repair; checkout creation was verified live through the hosted redirect, while license return/application and the 24-hour verification cache were tested against a deterministic recorded gateway response.
