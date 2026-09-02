# Independent verification 10: PASS

Candidate SHA: `e49d952c1ac1267b3df3fd75d62934dab980d67e`  
Live URL: <https://internal-event-ledger.sociobot.in>  
Verified: 2026-09-02 UTC from a clean checkout.

## Verdict

**PASS.** The deployed service reports the exact candidate build identity and
meets the researched brief's smallest useful product: a self-hosted receiver
and calm review queue with endpoint sources, fingerprint grouping, search,
acknowledge/archive, digest, export, retention, signed ingest/redaction, and
an isolated one-click sample workspace. No release-blocking defect was found.

No product code or infrastructure was changed during verification.

## Mandatory first gates

`.factory/claims.json` exists with 14 entries. After `npm ci` (60 packages;
zero reported vulnerabilities), every exact declared command was run
individually before broader inspection:

| Claim | Result |
| --- | --- |
| `demo-sandbox` | PASS |
| `demo-isolation` | PASS |
| `demo-expiry` | PASS |
| `self-hosted-runtime` | PASS |
| `review-workflow` | PASS |
| `administrator-boundary` | PASS |
| `retention-delete` | PASS |
| `response-policy` | PASS |
| `ledger-export` | PASS |
| `privacy-no-tracking` | PASS |
| `offline-demo` | PASS |
| `ingest-safety` | PASS |
| `self-hosted-controls` | PASS |
| `api-rate-limit` | PASS |

Cold first read also passes. At 1440×900 the landing page says, in plain
words, `Review operational events without Slack noise`; it identifies solo
developers and small teams needing searchable webhook history; and its visible
primary action is `Try it with sample data`, followed by `Opens an isolated
sample ledger with no token.` The one click opens `/demo` with three sources
and five grouped events. Cold page errors and console errors were both zero.

## Clean build and test evidence

| Check | Result |
| --- | --- |
| `npm test` | PASS: frontend/Node contracts, 21 Rust tests, storage/restart, all 14 claims, and desktop/mobile axe scans |
| `npx tsc --noEmit` | PASS |
| `cargo fmt --all -- --check` | PASS |
| `cargo clippy --all-targets --all-features --locked -- -D warnings` | PASS |
| `npm run test:e2e` | PASS |
| `VITE_BUILD_SHA=e49d… npm run build` | PASS; `dist/` produced |
| `cargo test --locked` | PASS: 21 unit/integration tests |

The stamped build emits 38,025 bytes of JavaScript (11.99 KB gzip) and 17,748
bytes of CSS (4.81 KB gzip). The main product image is 61,858 bytes. All are
within the supplied budgets. The local candidate-stamped JS SHA-256 exactly
matched the live `/assets/index-C6bgJDxV.js` SHA-256:
`d22799bdf0e8299a3f813eab003c3e91bd804914326e46b19c366df8e973cf37`.

The container build itself could not be executed because this verifier image
has no `docker`, Podman, or Buildah executable. The Dockerfile's non-root,
`/data`, build-arg, and source-tarball contract checks passed inside `npm
test`; the local frontend and Rust release inputs both built successfully.

## Live application, deployment, and boundaries

- `npm run verify:live-identity -- https://internal-event-ledger.sociobot.in
  e49d952c1ac1267b3df3fd75d62934dab980d67e` passed. `/health` returned
  `{"build":"e49d…","status":"ok"}`.
- In a fresh live demo: five event groups loaded; search for `deploy` narrowed
  the list to one; acknowledge and archive updated state (five to four active
  groups); CSV downloaded as `event-ledger-demo.csv`; and Digest refreshed.
- A fresh service-worker-controlled demo context was taken offline and
  reloaded. All five sample groups remained readable with zero page errors.
- At 390×844 with reduced motion, the demo had no horizontal overflow
  (`scrollWidth=clientWidth=390`). Keyboard focus began on `Skip to ledger`
  and rendered a visible `rgb(6, 118, 154) solid 3px` outline.
- Live Axe on the exercised demo reported zero serious or critical findings;
  the local full suite reported no violations across loading, landing, inbox,
  sources, digest, settings, privacy, terms, and demo at desktop and mobile.
- The rate-limit requirement is enforced. A single forwarded client sent 120
  concurrent anonymous management requests: 63 returned 401 before its burst
  was spent, then 57 returned 429; every observed 429 had `Retry-After: 1`.
  The small extra three requests are the measured refill during the 10.7-second
  burst. Health remains exempt as designed.
- The product has no sign-in, so the Entra tenant check is not applicable.
  The researched job does not require an AI feature, and no library/CLI API
  applies.

## Privacy, headers, caching, and routing

Browser request logging through landing, demo, state changes, export, and
digest recorded only `https://internal-event-ledger.sociobot.in`. There were no
analytics, trackers, third-party fonts, CDN assets, page errors, or console
errors. The landing document has `lang="en"`, one `h1`, a `main` landmark,
and a plain title: `Internal Event Ledger — review webhook events`.

Live headers include HSTS, `X-Content-Type-Options: nosniff`,
`X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, restrictive
Permissions-Policy, and a same-origin CSP with `frame-ancestors 'none'`.
HTML and `sw.js` use `Cache-Control: no-cache`; the emitted JS uses
`public, max-age=31536000, immutable`; the product image is conservatively
cached. `/demo`, `/privacy`, and `/terms` return 200; an unknown route returns
the styled 404. `robots.txt` and `sitemap.xml` are present.

## Defects by severity

None found.

## Known verification limitation

No local container runtime was installed, so a local `docker build` was not
possible. This is an environment limitation, not an observed product failure.
