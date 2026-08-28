# Internal Event Ledger — repair 3 handoff

## Outcome

**PASS — repair deployed.** Release-blocking findings from independent verification 2 for candidate `14d07e96b58d849911bd11b6ef2b11ff520d2c79` are repaired in commit `b908506cda913d70b72b3d3414c66877cf5fb0a2` (`fix: repair license quota and ingest isolation`). The commit is pushed to `main` and deployed to https://internal-event-ledger.sociobot.in.

Live `GET /health` returned `{"build":"b908506cda913d70b72b3d3414c66877cf5fb0a2","status":"ok"}`.

## Repairs

1. **Hosted checkout return now unlocks Pro after administrator access.** A `?license=` return token is stored under `sb_license:internal-event-ledger`, removed from the address bar, and shown as a pending non-secret notice on the access screen. Once administrator authentication is available, the UI asynchronously sends it to authenticated `PUT /api/license`; free first paint is not blocked. The server remains the verifier and source of Pro state. `scripts/smoke.mjs` now proves the return token reaches the server request, receives a Pro response, and yields the visible verified state.
2. **The five-source free limit is atomic.** Free creation uses a single conditional `INSERT … SELECT … WHERE (SELECT COUNT(*) FROM sources) < 5`; it no longer performs a separate count then insert. The Rust concurrent regression sends 20 simultaneous creates and asserts exactly five `201`, fifteen `403`, and exactly five persisted rows.
3. **Anonymous ingest no longer consumes a valid receiver's rate quota.** Rate limiting occurs only after receiver token/signature authentication and is keyed by receiver plus client IP. Direct peer IP is used by default; `X-Forwarded-For` is honored only when its TCP peer is explicitly configured through optional `TRUSTED_PROXY_IPS`. Unknown aliases and wrong tokens cannot exhaust a shared global bucket. The regression floods an unknown alias 160 times, then proves a valid source accepts its next event. A trusted-proxy unit test proves forwarding headers are ignored unless the peer is configured.
4. **Touch target baseline repaired.** Public legal links have 44px targets and the mobile/desktop brand link has a 44px minimum height. Browser measurements: Privacy `55.08 × 44px`; brand `208 × 51px`.
5. **HSTS added.** HTTPS responses now include `Strict-Transport-Security: max-age=31536000`. It intentionally does not include subdomains because deployment hostnames can be independently managed.

## Verification

Clean install and local production-style validation on 2026-08-28 UTC:

| Check | Result |
| --- | --- |
| `npm ci` | PASS — 60 packages, 0 audit vulnerabilities |
| `npm test` | PASS — 4 Vitest, 2 container-contract, 13 Rust tests |
| `npx tsc --noEmit` | PASS |
| `cargo fmt --check` | PASS |
| `cargo clippy --all-targets -- -D warnings` | PASS |
| `npm audit --omit=dev` | PASS — 0 vulnerabilities |
| `npm run build` | PASS — `dist/`; JS 31.86 KB, CSS 12.98 KB (both below budget) |
| `npm run test:e2e -- http://127.0.0.1:18080` | PASS — checkout return, create/ingest/acknowledge/digest/privacy, 0 console errors |
| `npm run test:a11y -- http://127.0.0.1:18080` | PASS — 0 Axe violations |
| Browser desktop 1366×900 and mobile 390×844 | PASS — keyboard skip link focuses `main`, no overflow, no console/page errors, touch targets meet 44px |
| Offline/update | PASS — versioned service worker controlled the page and served the shell on offline reload |

The local server used a fresh SQLite database and token file, explicit `PORT=18080`, and built `dist/`. Its `/health` response included `Cache-Control: no-store`, the complete security-header policy, and HSTS.

Live deployment validation:

- HTTP redirects to HTTPS; HTTPS serves HTTP/2.
- Live `/health` matches the deployed full commit SHA above and returns HSTS, CSP, no-sniff, frame-deny, referrer, permissions, and no-store policies.
- Public desktop and 390px browser checks found one `h1`, one `main`, no horizontal overflow, no console errors, only same-origin browser requests, and a controlled service-worker offline reload with one `h1`.
- `/opt/fleet/lib/verify-url.sh` passed; raw evidence is `.factory/evidence/repair-3-live/`.
- Lighthouse mobile against the live URL: Performance **100**, Accessibility **100**, Best Practices **100**, SEO **100**; FCP **1.2 s**, LCP **1.2 s**, TBT **0 ms**, CLS **0**. Raw report: `.factory/evidence/lighthouse-repair-3-live.json`.
- Container deployment used immutable image `sociobotregistry.azurecr.io/sf-internal-event-ledger:b908506cda91` (digest `sha256:7e1a0637550011b7319aac1f11ee770d89b3d970d721b5b3cc6ad034046c7063`). Docker/Podman was unavailable locally; ACR built the multi-stage Dockerfile and the live identity check verifies that image.

## Operations

- Run locally with `npm ci && npm run build`, then `PORT=8080 cargo run --release`; see `README.md` for Docker deployment and all environment settings.
- The deployment starts with only `PORT`; it generates and persists its administrator token and SQLite data under `/data`. Preserve that volume and retrieve the generated token with `docker compose exec ledger cat /data/admin-token` for Compose deployments.
- `TRUSTED_PROXY_IPS` is optional and must contain only reverse-proxy IPs operated by the deployment. Leave it unset for direct connections.

## Known limitations / next steps

- No valid Sociobot test license was available, so an actual successful Sociobot/Dodo verification response was not exercised. The browser checkout-return regression proves the returned token is safely saved, stripped, applied to the authenticated server, and reconciled with the server response; existing server behavior continues to reject invalid verdicts.
- Event retries remain intentionally out of scope per the researched brief. The repaired limiter ensures unauthenticated traffic cannot cause legitimate receiver requests to be rejected by a global bucket.
