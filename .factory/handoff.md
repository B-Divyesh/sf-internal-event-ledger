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

- Deployed container image: `sociobotregistry.azurecr.io/sf-internal-event-ledger:56388fc92c48`.
- The live health endpoint returned build `56388fc92c48679ab4ad5f49de1bf590255440fc` with status `ok`.
- `/opt/fleet/lib/verify-url.sh https://internal-event-ledger.sociobot.in /tmp/iel-live-evidence` passed: 709 ms cold load, correct title/lang/main/h1/alts, and no console errors.
- `PUBLIC_ONLY=1 npm run test:a11y -- https://internal-event-ledger.sociobot.in` passed eight live scans: desktop and 390×844 landing, demo loading, demo, and 404, all with zero violations.
- Direct cold Playwright checks passed for the new landing copy and facts, `?demo=1` redirect/banner/reset, real Sources link semantics, and the 404 status/title/Open Graph metadata.
- Live screenshots are at `/tmp/iel-live-evidence/landing-390.png`, `/tmp/iel-live-evidence/demo-390.png`, and `/tmp/iel-live-evidence/404-390.png`.

## Known gaps

None.
