# Internal Event Ledger — independent verification 3 handoff

## Outcome

**FAIL — candidate `37e1e5192412cf820a54e8e6ed9eb4ad6672fd2c` must not be released unchanged.**

The prior deployment uncertainty is resolved. On 2026-08-28 UTC, https://internal-event-ledger.sociobot.in returned the full candidate SHA from `/health`, and its HTML, JavaScript, CSS, image, service worker, manifest, and favicon were byte-identical to a clean SHA-stamped build.

The release blocker is an Axe `serious` color-contrast failure in the authenticated Settings/Pro panel at desktop and 390 px. Four nodes fail: the license label and apply button are 1.09:1; the Privacy and Terms links are 1.89:1. The acceptance contract requires at least 4.5:1 and zero serious/critical findings.

Full evidence and reproduction details: `.factory/verification-3.md`.

## Verification summary

- Clean detached checkout at the candidate.
- `npm ci`, `npm test`, TypeScript, Rust format/clippy, production frontend build, SHA-stamped release server build, and production-dependency audit passed.
- Repository browser smoke passed. Expanded Axe found the Settings defect that the repository’s Inbox-only scan misses.
- Signed ingest, fingerprint grouping, acknowledge/archive/reopen, search, digest, JSON/CSV export, HMAC failures, redaction, retention, persistence, and invalid-input recovery were exercised.
- Server authorization held on every management route. Concurrent free source creation stopped atomically at five. Anonymous ingest flooding did not consume a valid receiver’s quota. One hundred concurrent valid ingests and health requests completed without corruption/failure.
- Desktop and 390 px had no overflow or console/page errors; keyboard skip/focus, reduced motion, empty/no-results/offline states, and service-worker update/offline reload passed.
- Live mobile Lighthouse scored 99/100/100/100 (performance/accessibility on public screen/best practices/SEO), with LCP 1.4 s, TBT 90 ms, and CLS 0.
- Live headers, CORS behavior, cache policies, same-origin requests, and privacy claims passed.

## Defects

1. **High:** authenticated Settings Pro panel has one serious Axe contrast violation across four nodes. Fix colors and add Settings to automated axe coverage.
2. **Low:** `PUT /api/settings` accepts and persists `7:00` despite the documented `HH:MM` format.
3. **Low:** authenticated desktop sidebar Terms link is 43.3×44 px, fractionally below the 44×44 target contract.

## Limitations and next steps

- No valid real paid license was available; invalid billing verification and the complete return/application path with a mocked valid response were exercised.
- Docker/Podman/Buildah was unavailable. Both exact SHA-stamped build stages and the repository’s Docker contract tests passed, and live build identity is exact.
- Fix the high-severity contrast defect, extend `scripts/axe.mjs` to visit every primary authenticated view at desktop and 390 px, then rerun the full verification. Product source was not changed during this verification.
