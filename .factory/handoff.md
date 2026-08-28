# Internal Event Ledger — independent verification 2 handoff

## Outcome

**FAIL — do not release candidate `14d07e96b58d849911bd11b6ef2b11ff520d2c79` unchanged.**

The live deployment at https://internal-event-ledger.sociobot.in reports the exact candidate SHA and its frontend is byte-identical to the SHA-injected production build. Normal event ingestion/review, admin authorization, redaction, persistence, retention, export, accessibility, offline behavior, and performance all pass. Three high-severity defects remain:

1. Checkout-return licenses are saved and stripped from the URL but never sent to the server, so the paid return path does not unlock Pro.
2. Concurrent source creation bypasses the five-source server limit (20 requests yielded nine sources).
3. A global pre-authentication rate-limit bucket lets anonymous traffic to any ingest alias return 429 for a valid source.

The complete independent report is `.factory/verification-2.md`.

## Verification summary

Executed from a clean candidate checkout on 2026-08-28 UTC:

- `npm ci`: pass; 60 packages; 0 audit vulnerabilities.
- `npm test`: pass; 4 Vitest, 2 Node container-contract, and 10 Rust tests.
- `npx tsc --noEmit`, `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`: pass.
- `npm audit --omit=dev`: pass.
- `VITE_BUILD_SHA=14d07e96b58d849911bd11b6ef2b11ff520d2c79 npm run build`: pass; output matches live bytes.
- `BUILD_SHA=14d07e96b58d849911bd11b6ef2b11ff520d2c79 cargo build --locked --release`: pass.
- Repository E2E and Axe commands: pass.
- Live Lighthouse: Performance 99, Accessibility 100, Best Practices 100, SEO 100; FCP 1.1 s, LCP 1.2 s, TBT 130 ms, CLS 0.
- Live `/health`: exact candidate SHA; 100 concurrent checks returned 100 × 200.
- Browser checks: desktop and 390 px, keyboard, visible focus, reduced motion, same-origin requests, no normal console/page errors, zero serious/critical Axe findings.
- PWA: candidate-versioned active worker, no waiting update, successful offline reload.

Evidence is under `.factory/evidence/verification-2-local/`, `.factory/evidence/verification-2-live/`, and `.factory/evidence/lighthouse-verification-2-live-full.json`.

## Required next steps

1. Apply and verify checkout-return/cached licenses after administrator access becomes available; add a paid-return E2E test.
2. Make source-cap enforcement atomic; add a simultaneous-create regression.
3. Replace the global ingest limiter with isolated abuse-resistant keys and prove invalid traffic cannot starve a valid source.
4. Enlarge legal/brand link targets to the documented 44 px minimum.
5. Add HSTS at the app or edge after policy review.
6. Re-run this verification, including a valid test purchase/license if one is available.

## Operational notes and limitations

- Preserve `/data` for both SQLite data and the generated administrator token. Operators can retrieve the token with `docker compose exec ledger cat /data/admin-token`.
- SQLite backups remain the operator's responsibility.
- Docker/Podman was unavailable in this verifier container; the native exact production builds, Docker contract tests, live identity, and live asset match passed. No infrastructure or product code was changed.
