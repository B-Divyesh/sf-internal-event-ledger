# Review low-priority webhook events — review 3

Reviewed 5 September 2026 UTC against the live product at
<https://internal-event-ledger.sociobot.in>.

Implementation reviewed: `588b2325f2f028f39969f66c116925ba75db3863`.

Documentation base: `24f0a402a5252eae21ec19b0f46e9a4cdaf91c49`.

Live deployment identity: `2f6c0e5549ef2e2e7d14477921aa0af36a4cbb70`.
`2f6c0e5` is a documentation/evidence-only child of `588b232`; no product
source differs between those commits.

## Verdict

**PASS — 0 findings and 0 untested claims.**

No product code, product data, deployment, or infrastructure was changed.
This review adds only the review report and handoff record.

## First screen

Fresh, unscrolled Chromium contexts at 1440×900 and 390×844 gave the same
plain answers.

| Question | Visible answer | Result |
| --- | --- | --- |
| Job | “Review low-priority webhook events.” | Clear |
| Audience | “For solo developers and small teams who need searchable event history outside Slack.” | Clear |
| First action | “Try it with sample data” — “Opens an isolated sample ledger with no token.” | Clear |

The first screen also shows the required privacy, offline, and free/MIT facts.
Both contexts had zero console/page errors and no horizontal overflow.

## Sample workflow and safety

The visible action opened `/demo` in one click on desktop and phone. The
populated ledger had three sources, five realistic event groups, and twelve
events. The persistent “Demo — sample data, nothing is saved” label remained
visible. CSV export contained the documented header and a sample row. Reset
briefly showed its named loading state and restored all five groups within one
second. The demo’s browser requests were all same-origin.

The fresh offline browser context visited `/demo`, waited for service-worker
control, then reloaded offline. It retained the sample label and all five
groups. Reduced-motion media made transition and animation durations
`0.00001s`. The complete local isolation claim independently proves that demo
actions use an expiring demo workspace and do not read or change operator
tables.

## Claims and local quality gates

A new clone at `24f0a40` was used; it had a fresh `npm ci` before testing.
Every exact command in `.factory/claims.json` was run separately and passed:

`demo-sandbox`, `demo-isolation`, `demo-expiry`, `self-hosted-runtime`,
`review-workflow`, `administrator-boundary`, `retention-delete`,
`response-policy`, `ledger-export`, `privacy-no-tracking`, `offline-demo`,
`ingest-safety`, `receiver-token-once`, `receiver-authentication`,
`group-state-transition`, `health-identity`, `receiver-quota`,
`scope-boundary`, `free-mit-license`, `self-hosted-controls`, and
`api-rate-limit`.

The following completed with an explicit PASS status in that clean clone:

| Check | Result |
| --- | --- |
| `npm test` | PASS: 4 frontend, 9 contract/scope/identity, 21 Rust, 2 restart-storage, 21 claims, and local Axe matrix |
| `npx tsc --noEmit` | PASS |
| `cargo fmt --all -- --check` | PASS |
| `cargo clippy --all-targets --all-features --locked -- -D warnings` | PASS |
| SHA-stamped `npm run build` | PASS; generated `dist/` |
| SHA-stamped `cargo build --locked --release` | PASS |
| `npm run test:e2e` at 390×844 and 1366×900 | PASS |

These checks cover normal, invalid, boundary, and recovery paths, including
HMAC verification, body/header redaction, all receiver token forms, event
group state transitions, retention deletion, administrator isolation, source
and digest boundaries, restart persistence, and valid-versus-invalid receiver
quota separation.

## Live accessibility, routes, privacy, and performance

- `/opt/fleet/lib/verify-url.sh` passed: HTTP 200, 669 ms load, descriptive
  title, `lang=en`, exactly one h1, main landmark, complete image alt text,
  labeled buttons, and zero console errors.
- Live Axe scans found zero violations on desktop landing, phone landing,
  phone demo, and the designed 404. The deliberate 404 response is HTTP 404
  with a working recovery page, not a defect.
- Keyboard starts on the visible `Skip to ledger` link with a solid focus
  outline; Enter moves focus to `main`.
- Browser route titles, h1s, and main landmarks passed for `/`, `/demo`, all
  three demo deep links, `/privacy`, `/terms`, and `/does-not-exist`. All
  rendered landing links returned 200.
- Security headers include HSTS, `nosniff`, no-referrer, a restrictive
  same-origin CSP with `frame-ancestors 'none'`, and a restrictive permissions
  policy. The live request recording found no analytics, trackers, fonts,
  CDN, billing, identity, or model origin.
- Fresh live Lighthouse: Performance 100, Accessibility 100, Best Practices
  100, SEO 100; LCP 1,650 ms, CLS 0, TBT 0 ms, transfer 120,782 bytes.

## Backend and live allowance

`GET /health` returned status `ok` and the deployment identity above. The
anonymous management boundary returned 401 before authorization. A 140-request
concurrent live burst to `/api/events` from one forwarded client produced
125×401 and 15×429; a captured limited response included `Retry-After: 1`.
A subsequent request recovered to the expected 401. Local fresh-SQLite tests
covered tenant/demo isolation and rolling plus full-restart persistence.

## Earlier findings

All earlier review and verification reports were read. Their current
disposition is proved by this review’s live checks and clean regression suite:

| Earlier reports | Current disposition and proof |
| --- | --- |
| Verification 1 | Closed: administrator data is token-protected; the obsolete paid/client-limit model is gone; health identity, worker update, and cache policy are covered by `administrator-boundary`, `health-identity`, and `response-policy`. |
| Verification 2 | Closed: the retired checkout path is absent; sources are local and scalable; invalid ingest cannot spend a valid receiver’s quota; touch targets and HSTS pass. |
| Verification 3 | Closed: current live Axe has zero violations; Rust tests reject invalid review-time input; legal controls pass the touch-target scan. |
| Verification 4 | Closed: 21 registered executable claims, one-click isolated demo, management limiting, robots/sitemap, and designed 404 are present and pass. |
| Verification 5 | Closed: no unavailable paid tier remains; expiry, live allowance, one-replica storage behavior, and route focus are covered. |
| Verification 6 | Closed: the demo loading state is accessible; live Axe finds no ARIA violation. |
| Verifications 7–8 | Closed: the standalone a11y/E2E commands self-start and pass; live identity is deliberately the documentation child of the unchanged implementation. |
| Verification 9 | Closed: emitted hashed assets are immutable-cached; demo exit/reset stays within the labeled sandbox; real paths and consistent footers pass. |
| Verifications 10–11 | Previous PASS remains confirmed by the new 21-claim, live, and quality matrices. |
| Verification 12 | Closed: `receiver-token-once` passes in the separate exact run; phone reflow and select-all target pass current Axe/mobile checks. |
| Verification 13 | Reconfirmed independently: its implementation/deployment identity distinction, full claims matrix, and zero-finding conclusion agree with this fresh evidence. |
| Review 1, F-1-1 through F-1-35 | Closed: required first-screen facts, metadata/footer, link semantics, on-demand digest wording, all registered public behavior, credential/privacy coverage, plain-language copy, consistent terms, short README sentences, designed 404, and catalog summary remain present. The exact 21-claim run proves the behavior items; the fresh first-screen, route, copy, and 404 checks prove the presentation items. |
| Review 2, F-2-1 and F-2-2 | Closed: working navigation uses literal labels and all three demo deep links are real browser routes. |

## Findings

None at critical, high, medium, low, or minor severity.

Untested claims: **0**.
