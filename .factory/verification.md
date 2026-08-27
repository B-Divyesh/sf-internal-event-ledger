# Independent product verification — FAIL

**Work order:** `internal-event-ledger-verify-1`  
**Candidate:** `59301bd0d8339ac113611a23bdfdfc0946236327`  
**Live URL:** https://internal-event-ledger.sociobot.in  
**Verified:** 2026-08-27 UTC

## Verdict

**FAIL — do not release this public deployment.** The core local workflow works, but the deployed product has no protection at all on its administrative and data APIs. Anyone who can reach the public URL can read stored events and exports, alter event state/settings, create receiver sources, or delete sources and their events. The paid limits are also client-side only and directly bypassable through the API.

## Clean-checkout build evidence

A fresh detached clone at the candidate SHA was created in `/tmp/internal-event-ledger-verify.Nlu52j`; it had no `node_modules` or `target` directory before verification.

| Check | Result |
| --- | --- |
| `npm ci` | PASS — 60 packages installed; npm audit reported 0 vulnerabilities |
| `npm test` | PASS — 3 Vitest tests and 4 Rust tests |
| `npx tsc --noEmit` | PASS |
| `cargo clippy --all-targets -- -D warnings` | PASS |
| `npm run build` | PASS — generated `dist/` |
| `cargo build --locked --release` | PASS — release binary produced |
| Local Lighthouse, mobile | PASS — Performance 94, Accessibility 100, Best Practices 100, SEO 100; FCP 1.3 s, LCP 1.9 s, TBT 260 ms, CLS 0 |

Delivered raw assets are within the stated budgets: JS 28,939 B, CSS 12,861 B, image 61,858 B; no web-font files are delivered.

## Local end-to-end evidence

Against a fresh SQLite database and the release binary on `127.0.0.1:18080`:

- Repository smoke test passed: source creation, authenticated ingest, inbox acknowledgement, digest, and `/privacy`; zero console errors.
- Axe WCAG 2 A/AA, WCAG 2.1 AA, and best-practice scan found zero violations.
- Normal and recovery cases passed: valid signed ingest (202), HMAC rejection (401), missing token (401), malformed JSON (400), unknown alias (404), oversized body over 256 KiB (413), invalid source name/alias/retention (400), invalid event status (400), and invalid digest time (400).
- Body-path and configured-header redaction were verified; `Authorization`, `Cookie`, receiver-token, and signature headers were absent from retained event headers.
- Repeated fingerprinted events grouped correctly; acknowledged then archived groups were reopened as unread by a later arrival. JSON and CSV export, including CSV quote escaping and download headers, passed.
- Retention deletion was verified by aging a disposable local test event; the maintenance endpoint deleted it. Events and saved review time survived a service restart.
- 100 concurrent `/health` requests all returned 200. Ingest is intentionally globally rate-limited: a 100-request burst accepted 23 and returned 77 rate-limit responses after the prior burst had consumed the shared bucket; no data corruption was observed.
- Desktop (1366×900) and mobile (390×844) loaded without horizontal overflow or console/page errors. Keyboard Enter activated Sources; the skip link received focus and the designed focus outline is present. Under reduced motion an event-row animation computed to `0.00001s`.
- PWA checks passed for the current version: service worker became controller, `ledger-shell-v1` was populated, `registration.update()` completed with no waiting worker, and an offline reload rendered the shell.

## Live deployment evidence

- The live shell, JS, CSS, and image are an exact frontend match for the candidate. SHA-256 matches were:
  - `assets/index-AHiHZFbf.js`: `5d4e8512b04530083ee8ed7f8eb4dff298ee785e4e5f06d81776d2a3a9f60626`
  - `assets/index-BBNhp4u3.css`: `ddb1af6882e56e9a52d4935a27ca99e85064e973799dbb5667d56b0f2d37ab21`
  - `assets/dispatch-hall.webp`: `6d989203b1bcafb73fbe490a4d27649f913927ceb6130eb18c10afc410f74ced`
- Live desktop and 390px mobile had one h1, no horizontal overflow, zero console/page errors, and live axe had zero serious/critical (indeed zero total) violations.
- Live responses include CSP, `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, and a restrictive permissions policy. Normal browser requests stayed same-origin; source review found no trackers, CDNs, or third-party fonts. The only allowed external browser connection is the documented Sociobot licensing endpoint.
- Deployment identity is incomplete: `GET /health` returned `{"build":"dev","status":"ok"}`, not the candidate SHA. The frontend match is proven, but the backend binary cannot be proven to be this candidate by its advertised identity.

## Release defects

### Critical — public unauthenticated data and destructive administration

`GET https://internal-event-ledger.sociobot.in/api/sources` and `GET /api/events` both returned 200 without credentials. The router exposes those endpoints, export, source creation/deletion, event mutation, retention, and settings without any authentication or authorization middleware. Once operators route real operational events to the public instance, any internet user can read records/exports and modify or delete them.

**Required fix:** require an authenticated administrator boundary in the application, or make an authenticated reverse proxy a non-optional deploy configuration and prove the production URL is behind it. Re-test read, export, mutation, deletion, and ingest permissions unauthenticated and authenticated.

### High — Pro limits are trivially bypassable

Without a license, direct local API calls successfully created a source with `retention_days: 3650` (201) and a sixth source (201; seven sources existed in the disposable test database). The backend accepts 1–3650 days and unlimited sources; the license only changes frontend presentation.

**Required fix:** verify/cache the license server-side and enforce the five-source, 30-day, and digest-window limits in API handlers. Core exports must remain free as required.

### Medium — backend build identity is always `dev`

`health()` uses compile-time `option_env!("BUILD_SHA")`, while the Dockerfile neither declares nor supplies a compile-time `BUILD_SHA` to `cargo build`. The live endpoint reports `dev`, preventing backend candidate/deployment traceability.

**Required fix:** pass the candidate SHA as a Docker build argument/environment variable to the Rust compilation step and assert it in deployment verification.

### Medium — hashed static assets have no cache policy

The live hashed JS/CSS and service worker responses have `Last-Modified` and `Content-Length` but no `Cache-Control`, ETag, or immutable policy. This misses the stated immutable hashed-asset caching requirement and causes avoidable revalidation/download work.

**Required fix:** serve hashed assets with long-lived `Cache-Control: public, max-age=31536000, immutable`; use a short revalidation policy for HTML and `sw.js`.

### Low — service-worker updates are not immediate

The current worker has a fixed cache name (`ledger-shell-v1`) and no `skipWaiting()`. Offline reload works and a manual update check succeeds, but a changed worker remains waiting until existing clients close and the cache version is not tied to a build identifier.

**Required fix:** choose and document an update policy; if prompt updates are intended, version the cache by build and use a controlled `skipWaiting`/client-reload flow.

## Not run

Docker was not available in this verification container, so `docker build`/Compose execution could not be run. Native production build and a release-binary run were completed instead. No product source code was modified.
