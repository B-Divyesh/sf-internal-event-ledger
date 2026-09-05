# Verification 13 handoff — Internal Event Ledger

Date: 5 September 2026 UTC

Live URL: <https://internal-event-ledger.sociobot.in>

Implementation reviewed: `588b2325f2f028f39969f66c116925ba75db3863`

Documentation and deployed identity: `2f6c0e5549ef2e2e7d14477921aa0af36a4cbb70`

## Outcome

**PASS — zero findings and zero untested claims.**

Independent verification opened the live product in fresh desktop and phone
contexts, completed the isolated sample workflow, ran every declared claim,
and checked the full local and live matrix. No product code, product data,
deployment, or infrastructure was changed.

The full evidence and earlier-finding disposition are in
`.factory/verification-13.md`.

## Verified behavior

- The first screen states the job, audience, first action, and three required facts before scrolling.
- One-click demo entry loads five realistic groups with a persistent label, search, review state, digest, CSV/JSON export, reset, and a clean exit to real mode.
- Demo requests use only disposable demo endpoints and do not touch operator data.
- All 21 declared claim commands pass individually from a clean clone.
- `npm test`, TypeScript, Rust format, strict Clippy, frontend/release builds, and mobile/desktop E2E all pass.
- Live desktop, 390 px phone, keyboard, focus, reduced motion, 200% reflow, offline reload, legal routes, links, route titles, and designed 404 pass.
- Local normal, invalid, boundary, grouped-ingest, restart-persistence, authentication, privacy, retention, and recovery paths pass.
- Live health identifies the deployed SHA. A 120-request burst returns 429 with `Retry-After` and recovers after refill.
- Live and stamped local HTML/JS/CSS bytes match.
- Fresh live Lighthouse is 100/100/100/100; LCP 1.65 s, CLS 0, TBT 0 ms, and transfer 120,425 bytes.

## Run and verify

```sh
npm ci
npm test
npx tsc --noEmit
cargo fmt --all -- --check
cargo clippy --all-targets --all-features --locked -- -D warnings
VITE_BUILD_SHA=$(git rev-parse HEAD) npm run build
BUILD_SHA=$(git rev-parse HEAD) cargo build --locked --release
npm run test:e2e
VIEWPORT_WIDTH=1366 VIEWPORT_HEIGHT=900 npm run test:e2e
npm run verify:live-identity -- https://internal-event-ledger.sociobot.in 2f6c0e5549ef2e2e7d14477921aa0af36a4cbb70
```

The demo URL is <https://internal-event-ledger.sociobot.in/demo>.

## Environment note

This verifier container has no Docker, Podman, or Buildah executable. Docker
contract tests passed, both production build stages passed natively, the
PORT-only runtime passed, and the deployed container returned the exact SHA.
This is not a product finding.

## Known gaps and next steps

None for this work order.
