# Review low-priority webhook events — independent verification 13

Verified: 5 September 2026 UTC

Live URL: <https://internal-event-ledger.sociobot.in>

Implementation reviewed: `588b2325f2f028f39969f66c116925ba75db3863`

Documentation and deployed identity: `2f6c0e5549ef2e2e7d14477921aa0af36a4cbb70`

## Verdict

**PASS — zero findings and zero untested claims.**

The live product completes the researched job. A solo developer or small team
can receive signed low-priority webhook events, review grouped occurrences,
search, acknowledge or archive them, produce a digest, apply retention, and
export the ledger. The product remains a review ledger rather than a pager,
retry service, or automation tool.

No product code, product data, deployment, or infrastructure was changed.
Only this verification report and the handoff were changed.

Commit `2f6c0e5` changes only the prior handoff and verification evidence over
implementation commit `588b232`. The live health identity is the full
documentation SHA, and the live HTML, JavaScript, and CSS are byte-identical
to a clean build stamped with that SHA.

## First screen and sample ledger

Fresh Chromium contexts were used at 1440×900 and 390×844 before scrolling.
Both showed:

- Job: **Review low-priority webhook events**.
- Audience: solo developers and small teams that need searchable event history outside Slack.
- First action: **Try it with sample data**.
- Result beside the action: an isolated sample ledger opens without a token.
- Three facts: no analytics or third-party scripts, offline sample access after one visit, and free MIT self-hosting.

The phone's last fact ended at 674.64 CSS px inside the 844 px viewport. The
primary action measured 358×44.8 CSS px. The first keyboard Tab focused the
skip link, and Enter moved focus to `main`.

One click opened `/demo` with three sources and five realistic groups:

1. Refund review requested for annual plan.
2. Checkout latency crossed 900 ms.
3. Production deploy 2026.08.30 completed.
4. Catalogue import is waiting for two files.
5. Three product rows need category mapping.

Search for `catalogue` returned two groups. Acknowledgment and confirmed
archive worked. CSV contained its header plus five rows; JSON contained five
records. The on-demand digest reported 11 occurrences and copied as plain
text. The demo label remained present across the ledger and digest. Reset
created a new workspace and restored five groups. **Start for real** removed
the demo state and returned to administrator access.

The browser contacted only the product origin. Its API traffic was limited to
`POST /api/demo` and deletion of the disposable demo workspaces. No operator
API was called, no administrator token was used, and no real ledger data was
read or changed. Console and page errors were zero.

## Declared claims

The clean clone had no dependency or build directories. `npm ci` installed 60
packages and reported zero vulnerabilities. `.factory/claims.json` contains
21 unique IDs, each maps to exactly one claim test, and every declared command
was run separately after installation. All passed on the first product run:

| Claim | Result | Fresh observable evidence |
| --- | --- | --- |
| `demo-sandbox` | PASS | One-click entry, five groups, reset, no token. |
| `demo-isolation` | PASS | Production sentinel unchanged; demo-only API traffic. |
| `demo-expiry` | PASS | 86,400-second lifetime and expiry rejection. |
| `self-hosted-runtime` | PASS | PORT-only start, generated token, SQLite, health. |
| `review-workflow` | PASS | Search, acknowledge, archive, digest, copy, focus. |
| `administrator-boundary` | PASS | Anonymous 401; token remains in session storage. |
| `retention-delete` | PASS | Exactly one expired group deleted. |
| `response-policy` | PASS | HTML/SW revalidate; emitted hashed assets immutable. |
| `ledger-export` | PASS | CSV header plus five rows; JSON five records. |
| `privacy-no-tracking` | PASS | Landing, demo, and digest requests stayed same-origin. |
| `offline-demo` | PASS | Five groups remained after a controlled offline reload. |
| `ingest-safety` | PASS | HMAC, redaction, credential stripping, grouping. |
| `receiver-token-once` | PASS | Token appeared during a held refresh, disappeared on reload, and differed by source. |
| `receiver-authentication` | PASS | Ledger header, Bearer header, and query token accepted; invalid token rejected. |
| `group-state-transition` | PASS | Archived reopened; acknowledged remained acknowledged. |
| `health-identity` | PASS | Status and nonempty build identity returned. |
| `receiver-quota` | PASS | Invalid attempts did not spend the valid-delivery quota. |
| `scope-boundary` | PASS | No retry or delivery activity followed ingest. |
| `free-mit-license` | PASS | Public free-self-host copy and MIT license agree. |
| `self-hosted-controls` | PASS | Six sources, 3,650-day retention, and six-hour digest succeeded locally. |
| `api-rate-limit` | PASS | Management and receiver limits returned 429 with `Retry-After`. |

The live landing page, legal pages, working UI, README, and copy audit were
cross-checked against the registry. No missing, false, incomplete, or
untested public claim was found.

## Clean build and test matrix

| Check | Result |
| --- | --- |
| `npm ci` | PASS; 60 packages, 0 reported vulnerabilities. |
| Every exact claim command | PASS; 21/21, 0 untested. |
| `npm test` | PASS; 4 Vitest, 9 Node contract/scope/identity, 21 Rust, 2 restart-storage, 21 claims, and 21 Axe scans. |
| `npx tsc --noEmit` | PASS. |
| `cargo fmt --all -- --check` | PASS. |
| `cargo clippy --all-targets --all-features --locked -- -D warnings` | PASS. |
| SHA-stamped `npm run build` | PASS; `dist/` produced. |
| SHA-stamped `cargo build --locked --release` | PASS. |
| `npm run test:e2e` at 390×844 | PASS; keyboard, source, ingest 202, acknowledge, digest, privacy, zero console errors. |
| `npm run test:e2e` at 1366×900 | PASS with the same workflow and zero console errors. |

The stamped frontend contains 37,581 bytes of JavaScript (11.73 KB gzip) and
17,873 bytes of CSS (4.83 KB gzip). No local Docker, Podman, or Buildah
executable is installed. The repository's Docker/source-tar/non-root/default
configuration contract tests passed, both exact production build stages
passed natively, and the deployed container returned the exact release SHA.

## Backend, boundaries, and recovery

A fresh temporary SQLite service used the exact stamped release binary.
Anonymous management access returned 401. Empty names, short aliases, zero or
3,651-day retention, malformed source JSON, malformed event JSON, and invalid
receiver credentials returned 400 or 401 as appropriate. Duplicate aliases
returned 409. The 3,650-day retention boundary succeeded. Two valid events
returned 202 and grouped to occurrence count two.

The digest API accepted its documented server boundary of 1 and 168 hours and
rejected 0 and 169. The product UI exposes the promised six-hour through
seven-day choices. A complete stop and restart against the same SQLite file
retained the grouped event. The automated storage test separately proved a
rolling process and a full restart.

Demo isolation used its own expiring workspace table and never touched the
operator tables. HMAC verification, nested body/header redaction, removal of
credential headers, retention deletion, source-token uniqueness, and all
three receiver authentication forms passed their independent sandboxes.

Live `/health` returned:

```json
{"build":"2f6c0e5549ef2e2e7d14477921aa0af36a4cbb70","status":"ok"}
```

A 120-request live anonymous management burst from one forwarded client
returned 62×401 and 58×429 while refill occurred. All 58 limited responses
carried `Retry-After`; a later request recovered to the expected 401.

## Accessibility, mobile, offline, and privacy

- `/opt/fleet/lib/verify-url.sh` passed: HTTP 200, 661 ms load, descriptive title, `lang=en`, one h1, main landmark, complete image alts, labeled buttons, and zero console errors.
- Live Playwright Axe found zero violations on desktop and phone landing, demo loading, settled demo, and 404, plus the 200% reflow state.
- The complete local Axe matrix found zero violations on landing, loading, Inbox, Sources, Digest, Settings, Privacy, Terms, demo, 404, and 200% reflow.
- At 390 px, the page measured `scrollWidth=clientWidth=390`; the select-all target and all row targets measured 44×44 CSS px.
- At the 200% probe, `scrollWidth=clientWidth=640`; the rightmost event action ended at 588.81 px.
- Reduced-motion durations collapsed to 0.00001 seconds, with no looping or flashing content.
- The service worker URL ended in `sw.js?build=2f6c0e5…`; a fresh offline reload retained all five sample groups and the demo label.
- Privacy and Terms are titled legal routes. The privacy page explains export, retention deletion, source deletion, and contacting the deployment operator. The corresponding export, retention, and deletion behavior is tested locally.
- Requests across landing, demo, review, digest, export, and offline setup were same-origin. No analytics, tracker, external font, CDN script, billing, identity, or model request occurred.

## Routes, headers, identity, and performance

`/`, `/demo`, `/demo/sources`, `/demo/digest`, `/demo/settings`, `/privacy`,
and `/terms` returned 200 with route-specific titles, one h1, and a main
landmark. Fifteen rendered internal links returned 200. The sitemap includes
all public and demo routes. A deliberate missing route returned HTTP 404 with
the designed title, plain error h1, footer, and two recovery links; this is
the expected 404, not a defect.

The live root and service worker use `Cache-Control: no-cache`. The emitted JS
and CSS use `public, max-age=31536000, immutable`. Live security headers include
HSTS, `nosniff`, frame denial, no-referrer, a restrictive permissions policy,
and a same-origin CSP with `frame-ancestors 'none'`.

Clean stamped and live bytes matched:

| File | SHA-256 |
| --- | --- |
| `index.html` | `17bd27b3e01e30f05b3384270b9a4780aa93de8fcb8892db7e510fef91e9dbe5` |
| `/assets/index-B3rjBTyT.js` | `b3c050d2d36a0e68cb682d3fc36a520d523f8eb4226864c5b741d6acfe6cee07` |
| `/assets/index-B5Id4iGW.css` | `61593af98ec0de78222b84bd3e9912905e416452b243fdbae96c8ce07c90e820` |

Fresh live Lighthouse scored 100 performance, 100 accessibility, 100 best
practices, and 100 SEO. LCP was 1,650 ms, CLS 0, total blocking time 0 ms, and
total transfer 120,425 bytes.

## Earlier verification findings

All earlier verification defects, including minor ones, were reproduced or
checked through their regression coverage:

| Earlier report | Finding disposition and current proof |
| --- | --- |
| Verification 1 | Public administration is now 401-protected; paid client-only limits were removed in favor of a free self-hosted product; health is exact; cache headers are correct; the worker is build-versioned and updates cleanly. |
| Verification 2 | The retired purchase path is absent; source controls are local and support six sources; invalid receiver traffic has a separate quota; legal/brand targets meet 44 px; HSTS is present. |
| Verification 3 | Settings contrast has zero Axe violations; invalid `HH:MM` values are rejected by Rust tests; Privacy and Terms targets meet 44 px. |
| Verification 4 | The 21-claim registry, one-click isolated demo, management rate limiting, robots, sitemap, and designed 404 are all present and pass. |
| Verification 5 | The unavailable paid tier and its claims are removed; demo expiry is tested; the deployment is one-replica SQLite with enforced live allowance; route and Back focus pass. |
| Verification 6 | The held demo loading state has a named status role and zero live/local Axe violations. |
| Verifications 7 and 8 | Live health and asset bytes match the release; bare `test:a11y` and `test:e2e` now self-start and pass. |
| Verification 9 | The actual hyphenated Vite asset is immutable-cached; leaving demo discards sample state; routes are real paths; all app/legal/demo routes have footers; bare E2E is documented and passes. |
| Verification 12 | Receiver credential rendering passes while source refresh is held; select-all is 44×44; 200% reflow has no overflow. |

## Earlier review findings

Every `review-1.md` and `review-2.md` item has this current disposition:

| ID | Disposition and current proof |
| --- | --- |
| F-1-1 | Fixed: the first screen shows privacy, offline, and free/MIT facts. |
| F-1-2 | Fixed: the live 404 has complete metadata, legal footer, and recovery links. |
| F-1-3 | Fixed: route navigation uses links and real paths. |
| F-1-4 | Fixed: the digest is explicitly on demand; the inert schedule is absent. |
| F-1-5 | Fixed: `scope-boundary` is registered and passes. |
| F-1-6 | Fixed: README makes no untested Compose-persistence promise. |
| F-1-7 | Fixed: unregistered container-storage wording remains absent. |
| F-1-8 | Fixed: README gives the tested one-replica SQLite instruction. |
| F-1-9 | Fixed: `receiver-token-once` passes, including a held refresh. |
| F-1-10 | Fixed: all three receiver-token locations pass. |
| F-1-11 | Fixed: archived and acknowledged re-ingest transitions pass. |
| F-1-12 | Fixed: stored headers exclude authorization, cookies, tokens, and signatures. |
| F-1-13 | Fixed: the digest clipboard result is asserted. |
| F-1-14 | Fixed: unused scheduled-email language and control remain absent. |
| F-1-15 | Fixed: health status and build identity are claimed and tested. |
| F-1-16 | Fixed: unmeasured token-entropy wording is absent; uniqueness is tested. |
| F-1-17 | Fixed: both management and receiver rate limits are tested. |
| F-1-18 | Fixed: the separate valid-receiver quota is claimed and tested. |
| F-1-19 | Fixed: unregistered trusted-proxy wording remains absent from public copy. |
| F-1-20 | Fixed: the headline names the review job directly. |
| F-1-21 | Fixed: the preview heading names grouped webhook review. |
| F-1-22 | Fixed: the process heading is `How webhook review works`. |
| F-1-23 | Fixed: the masthead says `Webhook review`. |
| F-1-24 | Fixed: the boundary heading says `Not for urgent alerts`. |
| F-1-25 | Fixed: `calm` is absent from product and README copy. |
| F-1-26 | Fixed: event, event group, source, ledger, and demo terms are consistent. |
| F-1-27 | Fixed: the README audience sentence is within 22 words. |
| F-1-28 | Fixed: the README capability copy is split within the limit. |
| F-1-29 | Fixed: boot/token copy is split within the limit. |
| F-1-30 | Fixed: the long container sentence is absent. |
| F-1-31 | Fixed: authorization copy is split within the limit. |
| F-1-32 | Fixed: source, retention, and digest limits are split within the limit. |
| F-1-33 | Fixed: repair-history residue is absent from README. |
| F-1-34 | Fixed: the 404 h1 says `This page does not exist`. |
| F-1-35 | Fixed: brief summary and verb-first catalog description exist. |
| F-2-1 | Fixed: working navigation uses `Ledger sections`, `Sources`, and `Source setup`. |
| F-2-2 | Fixed: sitemap lists all three demo deep links. |

## Findings

None at critical, high, medium, low, or minor severity.

Untested claims: **0**.

Final verdict: **PASS**.
