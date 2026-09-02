# Internal Event Ledger — polish 1 handoff

## Outcome

All 35 findings in `review-1.md` are repaired. The detailed finding-to-change
mapping is in `polish-1.md`.

## What changed

- Rewrote the cold first screen with a concrete job headline, tested offline,
  privacy, and free-MIT facts, and consistent event terminology.
- Kept the one-click `/demo` sandbox isolated and persistent offline; improved
  its real-route navigation semantics and retained banner/reset/exit behavior.
- Removed the inert daily-review-time setting. The product now correctly names
  the existing feature an on-demand digest.
- Added claim registry coverage for receiver tokens, all auth modes, state
  transitions, health identity, scope, free license, and receiver quota.
- Separated invalid receiver rate-limit buckets from valid receiver quotas.
- Completed the designed 404 metadata/footer and added it to accessibility scans.
- Updated README, catalog description, copy audit, test expectations, and all
  routing/accessibility checks without changing the art-deco transit-ledger identity.

## Verification

Run from a fresh checkout:

```sh
npm ci
npm test
npm run test:e2e
```

Final local results before deployment:

- `npm test` passed: 4 frontend tests, 8 Node contract tests, 21 Rust tests,
  2 storage tests, 21 claim tests, and 20 axe scans (desktop/mobile including 404).
- `npm run test:e2e` passed at 390×844 with keyboard skip-link behavior,
  source creation, ingest, acknowledgment, digest, privacy route, and no console errors.
- `npm run build` produced `dist/`; emitted JS is 11.69 KB gzip and CSS is
  4.81 KB gzip.

## Deployment and live verification

The release commit, deployment output, live cold-load check, and exact live
URL evidence are appended after deployment.

## Known gaps

None.
