# Independent product verification 4 — FAIL

**Work order:** `internal-event-ledger-verify-4`  
**Candidate and live build:** `a827da01604775ead0275e93e5f38c34354815dd`  
**URL:** https://internal-event-ledger.sociobot.in  
**Verified:** 2026-08-30 UTC

## Verdict

**FAIL — do not release this candidate.** This is fresh evidence against the deployed candidate, not a deployment-only failure: live `GET /health` returned `{"build":"a827da01604775ead0275e93e5f38c34354815dd","status":"ok"}`.

### Release blockers

1. **Critical — required claim contract is absent.** `.factory/claims.json` does not exist in the clean candidate. Therefore there were no claim tests to run from the required demo entry point. The product and README make multiple visitor-reliant claims (for example self-hosted/private storage, no analytics, exports, offline update behaviour, rate limiting, and Pro limits) with no registered observable sandbox tests.
2. **Critical — no one-click, isolated sample-data demo; cold first read fails.** A fresh unauthenticated desktop and 390 px visit, including `/?demo=1`, renders only an **“Administrator access”** token form. Its text says “Enter the administrator token…”, not what the ledger does, who it is for, and what to click first. There is no visible **“Try it with sample data”** action, no seeded sample, no persistent “Demo — sample data, nothing is saved” banner, no reset/start-for-real controls, and no `.factory/demo.md`. This cannot meet the required demo-sandbox or plain-words acceptance gates.
3. **High — management/server API endpoints have no rate limit.** The backend limits authenticated receiver ingest at 120 events per source/client; a local burst observed 121×202 then 9×429, with `Retry-After: 1`. But an independent 180-request authenticated local burst to `GET /api/events` returned **180×200**, and an anonymous live burst to the same endpoint returned **180×401**, never 429 or `Retry-After`. This violates the mandatory allowance for every server-side endpoint. The source confirms that only `/ingest/{alias}` calls `take_ingest_token`.
4. **Medium — required site-discovery/error documents are missing.** Live `/robots.txt`, `/sitemap.xml`, and `/404.html` all return 404. The candidate has no corresponding tracked files.

## Required first checks

| Check | Result | Evidence |
| --- | --- | --- |
| Claims listed in `.factory/claims.json` | **FAIL** | File absent at candidate root; no claim command can be run. |
| Cold live first read | **FAIL** | HTTP 200, title `Internal Event Ledger — calm operational review`; sole h1 `Administrator access`; only action `Unlock ledger`. It answers neither the intended audience nor the first useful step in plain words. |
| One-click sample demo | **FAIL** | No matching action or demo banner on `/` or `/?demo=1`; the latter still displays the admin-token gate. |
| Live build identity | PASS | `/health` exact SHA above. |

## Clean checkout and production build

| Check | Result |
| --- | --- |
| `npm ci` | PASS — 60 packages, 0 audit vulnerabilities reported by npm |
| `npm test` | PASS — 4 Vitest, 2 Node container-contract, 15 Rust tests |
| `npx tsc --noEmit` | PASS |
| `cargo fmt --check` | PASS |
| `cargo clippy --all-targets -- -D warnings` | PASS |
| SHA-stamped `VITE_BUILD_SHA=a827… npm run build` | PASS — `dist/`; JS 31.88 KB (10.56 KB gzip), CSS 13.33 KB (3.96 KB gzip) |
| SHA-stamped `BUILD_SHA=a827… cargo build --locked --release` | PASS — release binary reports the exact SHA |
| Docker build | Not run — Docker/Podman unavailable in this verifier container |

## End-to-end/backend evidence

The SHA-stamped release binary was run from a fresh temporary directory with only `PATH` and `PORT=18187` set. It generated a 64-character administrator token with mode `0600`, created its SQLite data, and returned the exact candidate build from `/health`.

- Repository smoke passed against that server: administrator unlock, source creation, receiver ingestion, acknowledge, digest, privacy route, checkout-return handoff, and cleanup; zero browser console errors.
- Browser Axe scan passed with zero violations over Administrator access, Inbox, Sources, Digest, Settings, Privacy, and Terms at desktop and 390 px.
- Independent boundary checks: empty source name 400; retention `0` 400; duplicate alias 409.
- Receiver rate allowance observed: 120-event burst (121 requests accepted due refill timing) then 429, with `Retry-After: 1`. Management allowance observed: none (180 requests returned 200).
- Local normal authenticated browser request log contained only the product origin (`/`, hashed JS/CSS, and same-origin `/api/sources`, `/api/events`, `/api/settings`, `/api/license`). The cold live request log likewise contained only the product origin. No tracker/CDN request was observed. Full live authenticated-flow request logging is impossible without an administrator token, and the required public demo is absent.
- PWA smoke passed locally: a fresh context gained a controlling service worker; after setting offline, a reload rendered one h1 and one main landmark without errors. It only proves the access shell, not a usable offline demo.

## Live quality/security observations

- Desktop and 390 px cold pages: one h1/main, skip link first in tab order, no horizontal overflow, no console/page errors, reduced-motion maximum duration `0.00001s`, and zero Axe serious/critical (zero total) findings on the access screen.
- Live response headers include CSP, HSTS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, and `Permissions-Policy`. HTML/SW use `no-cache`; the hashed JS/CSS use one-year immutable caching. Initial JS is within the 200 KB budget.
- `robots.txt`, `sitemap.xml`, and a real 404 route are nevertheless absent (see blocker 4).

## Repair direction

Add the required claims registry and one observable demo-entry test per claim. Build `/demo` (or `?demo=1`) as a seeded, isolated, no-token sample workspace with a first-screen “Try it with sample data” action, demo banner/reset/real-data exit, and documentation. Put a per-client limiter before every API/management endpoint and return 429 plus `Retry-After` after its documented allowance. Add robots, sitemap, and a styled 404 document/route. Re-run this verification from a clean checkout.
