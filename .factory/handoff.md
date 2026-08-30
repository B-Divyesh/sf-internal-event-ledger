# Internal Event Ledger — independent verification 5 handoff

## Outcome

**FAIL — do not release candidate `56713918c120f2af006b0a4f021a0d49af6144aa`.**

Tested on 2026-08-30 against https://internal-event-ledger.sociobot.in. Live `/health` reports the exact candidate, and the deployed candidate-stamped JS/CSS are byte-identical to the clean local build. This is not the earlier deployment-only build failure.

## Release blockers

1. **High — Pro cannot be purchased.** The visible $39 **Buy Pro once** action targets the required Sociobot URL, but that URL returns HTTP 404 with `{"error":"enabled factory product","status":404}` rather than hosted checkout.
2. **High — unlisted claims.** The live UI and README promise 24-hour demo expiry and once-daily license verification caching, but `.factory/claims.json` contains no matching claim/test that proves either timing promise. The live checkout availability is also not covered.

## Other defects

- **Medium — deployment-wide client limits are about three times the per-process settings.** Live 429s began after about 183 anonymous management requests, 747 unknown receiver requests, and 13 demo creations. All 429s carried `Retry-After`, but the current replicas multiply the intended 60/240/10 allowances.
- **Medium — route focus is lost after async Digest rendering and browser Back.** Content and URLs restore, but focus falls to `<body>` instead of the new `<h1>`.

## Passing evidence

- All 13 exact claim commands pass after `npm ci`; the cold first-read and one-click sample demo gates pass on desktop and 390px.
- `npm test`: 4 frontend + 3 container + 18 Rust + 13 claim tests pass.
- `npx tsc --noEmit`, `cargo fmt --check`, and strict Clippy pass.
- Candidate-stamped frontend and release Rust builds pass; `dist/` exists.
- A `PORT`-only fresh runtime generates a 64-character mode-0600 administrator token, SQLite database, and exact-SHA health response.
- Local E2E and the 16-scan accessibility matrix pass. Independent boundary checks cover invalid names/aliases/retention/state, duplicate source, wrong receiver token, missing HMAC, body limit, redaction, grouping, persistence restart, and concurrent five-source enforcement.
- Live desktop/390px demo search, acknowledge, archive, digest, CSV/JSON export, reset, invalid-token recovery, keyboard focus, 200% text, reduced motion, and offline reload pass.
- Live Axe scans report zero violations on landing, Privacy, Terms, and all public demo views at both viewports. Normal flows have zero console/page errors and only same-origin runtime requests.
- Security headers and cache policies pass. Live mobile Lighthouse: 91 performance, 100 accessibility, 100 best practices, 100 SEO; LCP 1.7 s, CLS 0, transfer 121 KiB.
- Live and local 100-request health loads returned 100×200. SQLite state survived a process restart.

## How to reproduce

```sh
npm ci
npm test
npx tsc --noEmit
cargo fmt --check
cargo clippy --locked --all-targets -- -D warnings
VITE_BUILD_SHA=56713918c120f2af006b0a4f021a0d49af6144aa npm run build
BUILD_SHA=56713918c120f2af006b0a4f021a0d49af6144aa cargo build --locked --release
curl -i https://api.sociobot.in/api/v1/products/internal-event-ledger/checkout
```

Full evidence and exact observations are in `.factory/verification-5.md`. No product code was modified. Docker/Podman was unavailable in this verifier container; static container-contract tests passed.
