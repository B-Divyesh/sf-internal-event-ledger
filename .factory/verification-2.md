# Independent product verification 2 — FAIL

**Work order:** `internal-event-ledger-verify-2`

**Candidate:** `14d07e96b58d849911bd11b6ef2b11ff520d2c79`

**Live URL:** https://internal-event-ledger.sociobot.in

**Verified:** 2026-08-28 UTC

## Verdict

**FAIL — do not release this candidate unchanged.** The normal self-hosted event-review workflow, deployment identity, privacy boundary, accessibility baseline, offline shell, and performance gates pass. However, three fresh release-blocking defects remain:

1. A license returned by the hosted checkout is saved and removed from the URL but is never applied to the server, so the normal paid-return path does not unlock Pro.
2. Concurrent source creation bypasses the server's five-source free limit.
3. The global unauthenticated ingest rate-limit bucket lets any remote caller deny ingestion to every legitimate source.

## Clean-checkout build and automated gates

The tracked tree began clean and exactly at the candidate. `git clean -fdx` removed only an ignored `graphify-out/` directory before installation.

| Check | Result |
| --- | --- |
| `npm ci` | PASS — 60 packages installed; 0 audit vulnerabilities |
| `npm test` | PASS — 4 Vitest tests, 2 Node container-contract tests, and 10 Rust tests |
| `npx tsc --noEmit` | PASS |
| `cargo fmt --check` | PASS |
| `cargo clippy --all-targets -- -D warnings` | PASS |
| `npm audit --omit=dev` | PASS — 0 vulnerabilities |
| `npm run build` | PASS — generated `dist/` |
| `VITE_BUILD_SHA=14d07e96… npm run build` | PASS — exact container frontend build |
| `BUILD_SHA=14d07e96… cargo build --locked --release` | PASS — exact stamped release binary |
| `npm run test:e2e -- http://127.0.0.1:18080` | PASS |
| `npm run test:a11y -- http://127.0.0.1:18080` | PASS — 0 violations |

Production assets are within budget: 31,310 B JavaScript, 12,861 B CSS, 61,858 B WebP, and no web fonts. The full live Lighthouse run transferred 46,532 B on the access screen and scored Performance 99, Accessibility 100, Best Practices 100, and SEO 100; FCP 1.1 s, LCP 1.2 s, TBT 130 ms, CLS 0. Raw evidence is in `.factory/evidence/lighthouse-verification-2-live-full.json`.

Docker/Podman was unavailable in this verifier container, so the multi-stage image was not rebuilt locally. The repository's Docker contract tests passed, both underlying production builds passed with the candidate SHA, the live `/health` identity is exact, and the live frontend is byte-identical to the SHA-injected build.

## Local end-to-end and backend evidence

The release binary was copied with `dist/` into a fresh temporary directory and started under `env -i` with only `PATH` and `PORT=18080` supplied.

- First boot generated a 64-character administrator token, wrote it mode `0600`, and logged `admin_token_source=generated` without printing the value. Restart logged `persisted` and retained the same token, five sources, one event, and the `23:59` digest setting.
- `/health` returned the full candidate SHA. A 100-request concurrent health smoke returned 100 × 200.
- 100 simultaneous valid, uniquely fingerprinted ingests returned 100 × 202 and stored exactly 100 event groups without corruption.
- Fifty-one explicit API assertions passed: all management reads/writes/exports/licensing returned 401 anonymously; signed normal ingest returned 202; missing/wrong tokens and HMAC returned 401; unknown alias 404; malformed JSON 400; oversized body (>256 KiB) 413; duplicate alias 409; invalid name/alias/retention/redaction/status/digest/time boundaries were rejected.
- Nested body paths and a configured header were stored as `[REDACTED]`. `Authorization`, `Cookie`, receiver-token, and signature headers were absent from stored headers.
- Three arrivals with one fingerprint grouped correctly. Acknowledgment, archive, and arrival-driven reopening worked. Search/status filtering, bulk acknowledgment, daily digest, JSON export, CSV escaping/download headers, and free-tier custom-window rejection worked.
- Retention was verified by aging a disposable row before restart: the row persisted across restart, `POST /api/maintenance/retention` reported one deletion, and the row disappeared.
- Repository browser smoke covered mobile unlock, source creation, ingest, acknowledgment, digest, privacy, and cleanup with zero unexpected console errors.

## Browser, accessibility, privacy, and PWA evidence

- Local authenticated UI and live access/legal screens were checked at 1366×900 and 390×844. Both had one `h1`, a main landmark, no horizontal overflow, and no page or console errors during normal use.
- Keyboard-only checks confirmed the skip link is first, Enter moves focus to `main`, navigation and acknowledgment work with Enter, and focus uses a visible `3px` cyan outline. No keyboard trap was observed.
- Reduced-motion contexts computed UI animation durations as `0.00001s` and preserved hierarchy.
- Axe found zero serious/critical violations (zero total in the repository scan) on the authenticated app, access screen, privacy page, and terms page.
- Normal browser requests stayed same-origin on both local and live runs. Source review found no analytics, trackers, remote fonts, third-party runtime scripts, or direct payment-provider integration. The only declared product service is Sociobot billing.
- The administrator token is stored in `sessionStorage`, not `localStorage`; stored event credentials were stripped as described above. Event APIs and ingest APIs return `Cache-Control: no-store` and are excluded from service-worker caching.
- The live worker was controlled by `sw.js?build=14d07e96…`, had no waiting worker, used cache `ledger-shell-14d07e96…`, updated successfully, and rendered the shell offline with one `h1` and no errors.
- Screenshots and URL-verifier output are in `.factory/evidence/verification-2-local/` and `.factory/evidence/verification-2-live/`.

## Live deployment and candidate match

- `GET /health` returned `{"build":"14d07e96b58d849911bd11b6ef2b11ff520d2c79","status":"ok"}`.
- The candidate's SHA-injected `index.html`, JS, CSS, dispatch image, service worker, manifest, and favicon match live bytes. Key SHA-256 values: HTML `10aba534…`, JS `6d68359a…`, CSS `ddb1af68…`, WebP `6d989203…`.
- Anonymous live sources, events, export, settings, and license reads returned 401. A cross-origin preflight returned 401 without an allow-origin response. A 100-request concurrent live `/health` smoke returned 100 × 200.
- HTTP redirects to HTTPS. HTTPS uses HTTP/2 and a verified certificate.
- Live HTML and `sw.js` use `no-cache`; hashed JS/CSS use `public, max-age=31536000, immutable`; API and health use `no-store`.
- Responses include CSP, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, and a restrictive permissions policy.

## Defects

### High — checkout-return licenses are stranded instead of unlocking Pro

Fresh browser reproduction against the candidate:

1. Open `/?license=returned-license-token` as the checkout return would.
2. The app stores `sb_license:internal-event-ledger=returned-license-token` and strips the query from the address bar.
3. Unlock administrator access and wait for initialization.
4. The only license request is `GET /api/license`; no `PUT /api/license` applies or verifies the returned token.
5. Settings shows an empty “Have a license? Paste it here” field and Pro remains inactive.

This breaks the required purchase return path. A buyer who followed checkout is not unlocked and the now-hidden token is not offered back for application. Apply the returned/cached token to the authenticated server after access is available, show a pending-license state before access, and verify/reconcile it without blocking the free first paint.

### High — concurrent API requests bypass the five-source free limit

After deleting all disposable sources, 20 simultaneous authenticated `POST /api/sources` calls produced **9 × 201** and **11 × 403**; `GET /api/sources` then returned nine sources. Sequential creation correctly stopped the sixth source, so this is a time-of-check/time-of-use race between `COUNT(*)` and `INSERT`.

Enforce source quota atomically in a transaction/serialized write or database constraint, and add a concurrent integration regression test.

### High — unauthenticated traffic can globally deny all receiver ingestion

After a clean process restart, 160 concurrent unauthenticated posts to arbitrary `/ingest/nonexistent` produced 121 × 404 and 39 × 429. An immediately following request with a valid token to a real source also returned 429 (`Too Many Requests`). The router uses one `GlobalKeyExtractor` bucket before alias/token validation, so continued anonymous traffic can keep every source blocked. Because webhook retries are explicitly a non-goal, rejected legitimate events can be permanently lost.

Use an abuse-resistant key (at minimum client/IP plus receiver, with trusted-proxy handling), isolate receiver quotas, and ensure invalid aliases cannot consume every tenant/source's capacity. Add a regression proving an anonymous flood cannot block a valid source.

### Low — several link targets are below the product's 44×44 px contract

On the public administrator screen at both desktop and 390 px, Privacy measured 47×15 px and Terms 38×15 px. In the authenticated shell, the desktop legal links are similarly 14 px high and the mobile brand link is 34 px high. Axe reports no serious/critical violation, but these miss the explicit product touch-target baseline.

### Low — HTTPS responses do not advertise HSTS

HTTP redirects to HTTPS and TLS validation passes, but live HTTPS responses have no `Strict-Transport-Security` header. Add an appropriate HSTS policy at the application or edge after confirming the whole host/subdomain policy.

## Scope limitations

- No valid paid test license was supplied, so a genuinely successful Sociobot/Dodo verdict could not be exercised; invalid-license behavior (403) and the checkout-return handoff were tested.
- No local container engine was installed. No infrastructure, billing, DNS, or deployment state was modified.
- Product code was not modified.
