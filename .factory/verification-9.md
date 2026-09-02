# Independent verification 9: FAIL

Candidate SHA: `df710f7e6c5272e4d18a43403e52e25a15375068`

Live URL: <https://internal-event-ledger.sociobot.in>

Verified: 2026-09-02 02:20 UTC from a clean checkout of `main`.

## Verdict

**FAIL. Do not release this candidate.** The live deployment is the exact
candidate and its core workflow works, but two product-contract failures are
reproducible:

1. The registered immutable-cache claim is false for the candidate's main
   JavaScript asset. Both the local release server and live deployment return
   `Cache-Control: public, max-age=86400` for
   `/assets/index-BVE-f5_C.js`, not the claimed
   `public, max-age=31536000, immutable`.
2. Demo state can escape its mandatory labeled sandbox. From `/demo`, choosing
   Privacy removes the demo banner without deleting the demo state. Choosing
   Inbox then shows all five sample groups at `/#inbox` under
   `Receiver connected`, with no demo banner.

No product code or infrastructure was changed during verification.

## Mandatory first gates

### Claims

`.factory/claims.json` exists and contains 14 entries. After `npm ci` (60
packages, zero vulnerabilities), every exact registered command was run
individually before broader inspection. Every runner invocation selected one
test and passed it:

| Claim | Declared test result |
| --- | --- |
| `demo-sandbox` | PASS |
| `demo-isolation` | PASS |
| `demo-expiry` | PASS |
| `self-hosted-runtime` | PASS |
| `review-workflow` | PASS |
| `administrator-boundary` | PASS |
| `retention-delete` | PASS |
| `response-policy` | PASS in its fixture, but the observable candidate behavior FAILS |
| `ledger-export` | PASS |
| `privacy-no-tracking` | PASS |
| `offline-demo` | PASS |
| `ingest-safety` | PASS |
| `self-hosted-controls` | PASS |
| `api-rate-limit` | PASS |

The `response-policy` sandbox is not representative. It tests the fabricated
name `index-Abc12345.js`. The candidate emits `index-BVE-f5_C.js`; the server
splits at the last hyphen and sees only `f5_C`, so its minimum-eight-character
hash check fails. This is why the registered test passes while the shipped
claim does not.

### Cold first read

PASS. A fresh 1440 x 900 browser view says:

- What: `Review operational events without Slack noise`.
- Who: solo developers and small teams needing searchable webhook history.
- First action: `Try it with sample data`, next to `Opens an isolated sample
  ledger with no token.`

The action opens `/demo` in one click and, once seeded, displays three sources,
five event groups, and 12 arrivals. The live page loaded with no console or page
errors. First-read screenshot and machine report are under
`.factory/evidence/verification-9-live/verify-url/`.

## Clean build and test evidence

| Check | Result |
| --- | --- |
| `npm test` | PASS: 4 Vitest, 8 Node contract/scope/identity, 21 Rust, 2 storage/restart, 14 claims, and 18 local Axe view scans |
| `npx tsc --noEmit` | PASS |
| `cargo fmt --all -- --check` | PASS |
| `cargo clippy --all-targets --all-features --locked -- -D warnings` | PASS |
| `VITE_BUILD_SHA=df710... npm run build` | PASS; `dist/` produced |
| `BUILD_SHA=df710... cargo build --locked --release` | PASS |
| Stamped local `/health` | PASS; full candidate SHA returned |
| Local production-like E2E at 1366 x 900 and 390 x 844 | PASS; source creation, ingest, acknowledge, digest, Privacy, keyboard skip link, cleanup, zero console errors |
| Bare `npm run test:e2e` | FAILS with `ERR_CONNECTION_REFUSED` unless a server is started separately; the script's prerequisite is not documented |
| Docker image build | Not run: Docker, Podman, and Buildah are absent from the verifier image; all repository container-contract tests passed |

The stamped frontend emitted 36,874 bytes of JavaScript (11.75 KB gzip) and
17,075 bytes of CSS (4.70 KB gzip). The main image is 61,858 bytes. These are
inside the 200 KB JS, 50 KB CSS, and 300 KB image budgets.

## End-to-end and boundary evidence

The live demo was exercised at 390 px from a fresh browser context. It loaded
five groups; searching `catalogue` returned two; acknowledging one and
archiving the other left one visible active match. CSV exported six lines
(header plus five groups), and JSON exported five records. Reset created a new
workspace, and Start for real cleared the normal demo-exit path. There was no
horizontal overflow and no browser error.

The stamped local release was exercised against representative invalid and
boundary input:

- Anonymous management request: 401 with a clear administrator message.
- Empty source name, invalid alias, and 3,651-day retention: 400 with specific
  correction text.
- 3,650-day source: 201.
- Malformed receiver JSON: 400; corrected JSON: 202.
- 169-hour digest: 400; 168-hour digest: 200.
- Invalid `24:99` review time: 400; corrected `07:30`: 200.
- The accepted event's nested customer email was stored as `[REDACTED]`.
- Source cleanup returned 204.

The real-process storage tests proved state across rolling overlap and full
restart. The Rust suite also covered simultaneous source creation, HMAC,
fingerprinting, redaction, retention, and administrator boundaries.

Concurrency and request allowances:

- 100 concurrent local health requests: 100 x 200 in 129 ms (775 requests/s).
- Local management burst: 60 x 200, then 60 x 429.
- Local authenticated receiver burst: 122 x 202, then 18 x 429; the nominal
  allowance is a 120-token burst with one token/second refill.
- Live management burst: 62 x 401, then 58 x 429 over 11.54 seconds; nominal
  allowance is 60 tokens with 20/second refill.
- Live demo creation burst: 10 x 200, then 15 x 429; nominal allowance is 10
  workspaces with one/minute refill.
- Every observed 429 included `Retry-After: 1`. Health is intentionally exempt.

## Live identity, privacy, security, and PWA

`npm run verify:live-identity` returned the exact full candidate SHA. SHA-256
digests of the live and clean-build JS matched
`3a670745e67dbc53db78760100ffaf775dafd590b477df6d57ecc3b95dd49eb9`;
the CSS digests also matched.

Browser logging across landing, demo, digest, and export found only
`https://internal-event-ledger.sociobot.in` requests. There were no analytics,
third-party scripts, fonts, CDN calls, page errors, or console errors.

HTML and `sw.js` revalidate with `no-cache`; APIs and health use `no-store`;
CSS is immutable for one year. The main JS cache failure is listed above.
Responses include HSTS, `nosniff`, `DENY`, `no-referrer`, a restrictive
permissions policy, and a CSP with `frame-ancestors 'none'`.

The service worker was active and controlled the page from
`/sw.js?build=df710f7e6c5272e4d18a43403e52e25a15375068`. `update()` completed,
the build-named cache was present, and an offline reload retained the event
ledger, all five groups, and the explicit `Offline — showing last view` state.

## Accessibility, responsive layout, and performance

- `/opt/fleet/lib/verify-url.sh` passed live: HTTP 200, title, `lang`, one
  `h1`, main landmark, image alternatives, button labels, and no browser errors.
- Live Axe scans of loading, landing, and demo at desktop and 390 px found zero
  WCAG A/AA, WCAG 2.1 AA, or best-practice violations. The local full suite
  scanned all authenticated, legal, loading, landing, and demo states with zero
  violations.
- Keyboard order begins with the skip link. Enter moves focus to `main`; every
  traversed control had a visible 3 px focus outline, and Enter opened Digest.
- Visible controls meet 44 px targets; the 19 px checkboxes sit inside 44 x 44
  labels. The 390 px page has no horizontal overflow.
- Reduced motion changes animations and transitions to 0.01 ms.
- Live mobile Lighthouse: performance 97, accessibility 100, best practices
  100, SEO 100; LCP 1.8 s, CLS 0, TBT 160 ms, total transfer 116 KiB.
- `/`, `/demo`, `/privacy`, `/terms`, discovery files, and every crawled link
  returned 200. An unknown route returned the designed 404.

Sign-in is not required, so the Entra check does not apply. The brief does not
benefit from an AI feature, and there is no library/CLI consumer surface.

## Defects by severity

### High — release-blocking

1. **The immutable-cache claim is false for the main JavaScript bundle.** The
   emitted Vite hash contains `-`, which the server's detector does not accept
   after splitting on the last hyphen. The claim test uses a nonrepresentative
   filename and therefore does not protect the shipped artifact.
2. **Demo labeling and isolation state are lost through legal navigation.**
   `/demo` → Privacy removes the persistent demo banner but retains the demo
   workspace. Privacy → Inbox displays five sample records as
   `Receiver connected`. Leaving demo must discard its state, and sample data
   must never appear without the demo label.

### Medium

1. Product sections use hash routes (`/#inbox`, `/#sources`, `/#digest`, and
   `/#settings`) for application state rather than real paths, contrary to the
   routing contract.
2. `/demo`, `/privacy`, and `/terms` have no semantic `<footer>`, contrary to
   the required shared site skeleton. They do retain legal links in the
   desktop sidebar, but those links are hidden at mobile width.

### Low

1. `npm run test:e2e` assumes a server at port 8080 and is not documented as
   requiring one. It passes against a started release server but fails as a
   standalone clean-checkout command.

## Required next steps

Fix the asset hash detector and make its claim test inspect the actual filename
emitted by `npm run build`. Preserve demo mode and its banner on legal routes,
or discard the workspace before leaving; add regression coverage for the full
navigation sequence. Then implement real paths and the missing route footers,
document or self-start the E2E command, deploy a new exact-SHA image, and repeat
independent verification.
