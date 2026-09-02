# Independent verification 8: FAIL

Candidate SHA: 5c7523f15c39a5655051a7800f7719b313558420

Live URL: https://internal-event-ledger.sociobot.in

Verified 2026-09-02 UTC from a clean checkout after npm ci.

## Verdict

FAIL. Critical deployment identity mismatch. Fresh live GET /health returned
build ee9f17d2362cbabdec75e49c080596be4623f0b7. It does not equal the
candidate SHA and is not an ancestor of it. The live HTML refers to
assets/index-Cdv9_PNJ.js while the clean candidate build produced
assets/index-BINzS6iE.js. The candidate has not been deployed.

## First read and demo

PASS. The cold first screen says this is for solo developers and small teams
reviewing operational events without Slack noise. The first action is Try it
with sample data and plainly says it opens an isolated ledger without a token.

The live isolated demo passed at desktop and 390 px: it loaded five groups,
catalogue search returned two groups, acknowledgement worked, and Export CSV
and Export JSON downloaded event-ledger-demo.csv and event-ledger-demo.json.
The mobile visual review found no clipping or horizontal overflow.

## Claims and quality gates

The required claims registry exists. After npm ci, all 14 exact registered
claim commands passed individually and npm run test:claims passed 14 of 14 in
11.93 seconds. These cover demo isolation and expiry, offline reload, exports,
privacy requests, retention, signing/redaction/grouping, local controls, and
rate limits.

- npm test passed: 4 Vitest, 6 Node/container-scope, 21 Rust, 2 real-process
  storage, and 14 claim tests.
- npm run build passed and produced dist.
- TypeScript no-emit, Rust format, and Clippy warnings-as-errors all passed.
- A candidate-stamped release build passed. Its local health endpoint returned
  the complete candidate SHA.
- Bundle budgets passed: JavaScript 36.84 KB raw and 11.70 KB gzip; CSS
  17.08 KB raw and 4.70 KB gzip.
- Docker, Podman, and Buildah are unavailable in this verifier environment;
  the repository container-contract tests passed.

Candidate local desktop and mobile smoke passed: skip-link keyboard use,
administrator access, source creation, receiver ingest, acknowledgement,
digest, Privacy, and cleanup. Boundary and recovery calls passed: invalid
source 400, valid source 201, invalid setting 400, corrected setting 200,
unsigned ingest 401, authenticated ingest 202, cleanup 204. Persistence,
concurrent source creation, and PORT-only startup are covered by the Rust and
real-process storage tests.

## Live privacy, accessibility, headers, and limiting

- verify-url.sh passed live: HTTP 200, title, lang, one h1, main, alt/button
  checks, and no browser errors. Evidence:
  .factory/evidence/verification-8-live/verify-url/verify.json.
- Keyboard skip link was first and Enter moved focus to main. Live Axe scans
  of landing and demo at desktop and 390 px had zero serious or critical
  findings. Candidate-local Axe covered loading, authenticated routes, and
  demo in both viewports with zero violations.
- Cold live request logging found only same-origin document, JS, CSS, image,
  and demo API requests. No tracker, third-party font, CDN, or other
  third-party request occurred.
- HTML and service worker use no-cache; hashed JS/CSS are immutable for a
  year; API and health use no-store. CSP includes frame-ancestors none, with
  HSTS, nosniff, no-referrer, and restrictive permissions policy.
- Legal/discovery routes returned 200 and an unknown route returned the
  designed 404.
- Live limiting is enforced. Eighty concurrent unauthenticated GET
  /api/events requests from one client yielded 62 responses of 401 followed
  by 18 responses of 429, each with Retry-After 1. This is the 60 request API
  burst plus observed refills. A 120-request POST /api/demo burst yielded
  10 responses of 200 and 110 of 429, all with Retry-After 1. Demo creation
  has its own 10-workspace burst and one-per-minute refill. No production
  ledger data was used.

Sign-in is not required, so Entra verification does not apply.

## Defects by severity

### Critical

1. Candidate not deployed. Deploy the exact candidate image, confirm health
   build identity and deployed asset identity, then repeat live verification.

### Low

1. npm run test:a11y requires a separately started server and returns
   ERR_CONNECTION_REFUSED when run with no URL. It passes against a candidate
   server. Make the script self-starting or document the required URL.

## Handoff

Do not release this candidate. No product code, infrastructure, credentials,
or non-product resources were modified during this verification.
