# Internal Event Ledger — verification 9 handoff

## Outcome

**FAIL — do not release candidate
`df710f7e6c5272e4d18a43403e52e25a15375068`.**

The live deployment is the exact candidate and the core event-ledger workflow
works. Release is blocked by two product-contract defects:

1. The main built JavaScript asset receives `Cache-Control: public,
   max-age=86400`, contradicting the registered immutable-cache claim. The
   emitted filename contains an internal hyphen that the current detector does
   not handle, and the claim test uses a nonrepresentative fixture name.
2. `/demo` → Privacy removes the demo banner but retains sample state. Choosing
   Inbox then displays five sample groups as `Receiver connected`, without the
   mandatory sandbox label or discarding the demo.

Medium findings are hash-only application routes and missing semantic footers
on demo/legal routes. A low tooling finding is that bare `npm run test:e2e`
needs an undocumented prestarted server.

Full evidence and exact reproduction details are in
[verification-9.md](verification-9.md). Browser evidence is in
`evidence/verification-9-live/verify-url/`.

## Verification summary

- All 14 exact `.factory/claims.json` commands passed individually, but the
  response-policy test does not exercise the actual emitted JS filename.
- `npm test` passed: 4 frontend, 8 Node contract/scope/identity, 21 Rust, 2
  storage/restart, 14 claim, and 18 Axe view checks.
- TypeScript, Rust format, Clippy with warnings denied, stamped frontend build,
  and stamped release backend build passed.
- Local production-like E2E passed at 1366 x 900 and 390 x 844.
- Live identity returned the full candidate SHA, and live JS/CSS bytes matched
  the clean stamped build.
- Live demo search, review states, CSV/JSON export, reset, same-origin privacy,
  offline reload, and mobile layout passed.
- Live rate limits returned 429 with `Retry-After: 1`: management allowed 62 of
  120 during measured refill; demo creation allowed 10 of 25.
- Live Axe found zero violations. Mobile Lighthouse scored 97 performance and
  100 for accessibility, best practices, and SEO; LCP 1.8 s, CLS 0, TBT 160 ms.
- Docker tooling was unavailable in the verifier image; repository
  container-contract tests passed.

## Re-run

```sh
npm ci
npm test
npx tsc --noEmit
cargo fmt --all -- --check
cargo clippy --all-targets --all-features --locked -- -D warnings
VITE_BUILD_SHA=df710f7e6c5272e4d18a43403e52e25a15375068 npm run build
BUILD_SHA=df710f7e6c5272e4d18a43403e52e25a15375068 cargo build --locked --release
npm run verify:live-identity -- https://internal-event-ledger.sociobot.in df710f7e6c5272e4d18a43403e52e25a15375068
PUBLIC_ONLY=1 node scripts/axe.mjs https://internal-event-ledger.sociobot.in
```

No product code, infrastructure, credentials, or out-of-scope resources were
modified.
