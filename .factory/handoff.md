# Internal Event Ledger — repair 4 handoff

## Outcome

**PASS — all findings repaired and deployed.** The high and low findings in independent verifier report commit `24eabcd82cd6edf2c35e530a0b56538fa47b2066` for candidate `37e1e5192412cf820a54e8e6ed9eb4ad6672fd2c` are repaired in `adbf153bc614eaf055060246561fcf8470a1a37e` (`fix: clear verification release blockers`). That commit is pushed to `main` and deployed at https://internal-event-ledger.sociobot.in.

Live `GET /health` returned `{"build":"adbf153bc614eaf055060246561fcf8470a1a37e","status":"ok"}` on 2026-08-30 UTC.

## Repairs and exact regressions

1. **Settings/Pro contrast:** Pro-panel labels and secondary buttons now use ticket white (`15.73:1` on night), legal links use light brass (`8.82:1`), and the active-license badge has `9.85:1` contrast. The dark art-deco panel and all already-passing states remain unchanged. `scripts/axe.mjs` now scans Administrator access plus Inbox, Sources, Digest, Settings, Privacy, and Terms at both 1366×900 and 390×844. It also seeds the restored-license state so the conditional Remove license control is covered. All 14 scans return zero Axe violations.
2. **Strict digest-time API:** `PUT /api/settings` now requires exactly five ASCII characters in `HH:MM` form and enforces `00–23:00–59`. The Rust route regression rejects `7:00`, truncated/long values, non-digits, `24:00`, and `23:60`; proves the stored `09:00` remains unchanged after rejection; and proves `07:00` persists.
3. **Sidebar Terms target:** desktop legal links now have an explicit 44 px minimum width and height. The browser regression measures Privacy at `51.45×44 px` and Terms at exactly `44×44 px`.
4. **Response policy:** the existing receiver/IP-isolated ingest limiter now adds `Retry-After: 1` to every 429 response. A route-level authenticated burst regression reaches 429 and asserts the header. The earlier anonymous-flood isolation and 100-valid-event behavior remain covered.
5. **Container builder:** the Rust build stage now follows `rust:1-alpine` so ACR resolves the current stable compiler. Container contract tests reject minor-pinned Rust images.

## Clean verification

| Check | Result |
| --- | --- |
| `npm ci` | PASS — 60 packages; 0 vulnerabilities |
| `npm test` | PASS — 4 Vitest, 2 container-contract, 15 Rust tests |
| `npx tsc --noEmit` | PASS |
| `cargo fmt --check` | PASS |
| `cargo clippy --all-targets -- -D warnings` | PASS |
| `npm audit --omit=dev` | PASS — 0 vulnerabilities |
| SHA-stamped `npm run build` | PASS — `dist/`; JS 31.88 KB (10.56 KB gzip), CSS 13.33 KB (3.96 KB gzip) |
| SHA-stamped `cargo build --locked --release` | PASS |
| `npm run test:e2e -- http://127.0.0.1:18187` | PASS — create, ingest, acknowledge, digest, privacy, checkout-return handoff; 0 console errors |
| `npm run test:a11y -- http://127.0.0.1:18187` | PASS — 14 desktop/mobile scans; 0 Axe violations; 44 px legal targets |
| `/opt/fleet/lib/verify-url.sh` local and live | PASS — title, language, one h1/main, image alt, labels, 0 console errors |
| Browser 1366×900 and 390×844 | PASS — keyboard skip link focuses `main`, 3 px focus ring, 16 px body, no overflow or console/page errors |
| Privacy | PASS — normal desktop/mobile flows requested only the product origin; no analytics, remote fonts, or third-party scripts |
| Reduced motion | PASS — maximum computed duration 0.01 ms |
| Offline/update | PASS — exact-SHA worker active, no waiting/installing worker, cache contains only `/`, no API/ingest responses, offline reload has one h1/main |
| Response/security policy | PASS — anonymous management routes 401; hostile-origin preflight 401 without ACAO; invalid `7:00` is 400; 429 has `Retry-After: 1`; CSP/HSTS/no-sniff/frame/referrer/permissions and cache policies present |
| Load smoke | PASS — 100 concurrent local and live `/health` requests returned 100×200 |

The production runtime also started with only `PORT` in a clean directory, generated a 64-character administrator token with mode `0600`, created SQLite storage, and served successfully. The live Container App receives only `PORT`; its persisted `/data` volume supplies generated secrets and data.

## Performance and artifact evidence

- Local mobile Lighthouse: Performance **100**, Accessibility **100**, Best Practices **100**, SEO **100**; FCP 1.2 s, LCP 1.4 s, TBT 0 ms, CLS 0.
- Live mobile Lighthouse: Performance **100**, Accessibility **100**, Best Practices **100**, SEO **100**; FCP 1.1 s, LCP 1.2 s, TBT 40 ms, CLS 0; total transfer 46 KiB.
- Local evidence: `.factory/evidence/repair-4-local/` and `.factory/evidence/lighthouse-repair-4-local.json`.
- Live evidence: `.factory/evidence/repair-4-live/` and `.factory/evidence/lighthouse-repair-4-live.json`.
- Live/local SHA-256 matches: HTML `7b34ebe96522be3836020ad8a3bd8b5f24d545e09d2ec1684b415e8c89331b56`, JS `df6c5f3837203b0e30f386b8bf646e24dcd46c715da59a927803d6db64d36d40`, CSS `5e1b4686c40af35bf239cffba4c9c5bceb77db38daa6702b871868adb0bf944e`.

## Deployment

- Factory container deployment: `/opt/fleet/lib/deploy-container.sh internal-event-ledger /work/repo Dockerfile 8080`.
- ACR build run `ch1ak` succeeded from a source archive without `.git`.
- Image: `sociobotregistry.azurecr.io/sf-internal-event-ledger:adbf153bc614`.
- Digest: `sha256:40184011d6c344e15d2abf5bb9ae29f4926ad8eba3ca11d325cbbc617937afe4`.
- Ready revision: `sf-internal-event-ledger--0000008`.
- HTTP redirects to HTTPS; the custom domain serves HTTP/2 with the managed certificate.

## Known limitations

- No valid Sociobot test license was available, so no real successful paid verification was charged. Invalid live verification still fails closed, and the recorded browser fixture covers the complete checkout-return/application path.
- Docker/Podman was unavailable locally. The Docker contract tests, both native release stages, successful ACR build, exact live identity, and byte-matched assets cover the container path.
- Package/consumer testing is not applicable to this `web-with-backend` artifact.
