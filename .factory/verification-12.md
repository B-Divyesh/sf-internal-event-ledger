# Independent verification 12: FAIL

Candidate commit: `e59c4833b8ab1d53cdf175a839235cc7ce442c7a`

Live URL: <https://internal-event-ledger.sociobot.in>

Verified: 2026-09-02 UTC from a clean checkout.

## Verdict

**FAIL.** The live deployment is the exact candidate and the core event-ledger
job works, but a mandatory declared claim failed during its first clean run.
The same source-creation step later failed independently in the production-like
browser smoke test. The acceptance contract says any failing claim command is
release-blocking, even when a retry passes.

No product code, deployment, infrastructure, product state, or out-of-scope
resource was changed. Only this report, the handoff, and verification evidence
were added.

## Release-blocking findings

### High — the source credential workflow is intermittently untestable

The exact declared command
`npm run test:claims -- --grep @claim:receiver-token-once` failed during the
mandatory initial run after 31.3 seconds:

```text
locator.textContent: Timeout 30000ms exceeded.
waiting for locator('.credential code').last()
scripts/claims.test.mjs:362:68
```

The exact command passed when rerun, and the complete `npm test` run also
passed the claim. However, `npm run test:e2e` then failed independently at the
same point after source creation:

```text
locator.waitFor: Timeout 30000ms exceeded.
waiting for locator('.credential') to be visible
scripts/smoke.mjs:104:35
```

The smoke test passed on its next run. This is therefore an intermittent
credential-rendering or browser-workflow race, not a deterministic omission.
It still blocks release because the claim contract explicitly makes any failed
declared claim invocation a failure.

### Medium — mobile select-all target is narrower than 44 px

At 390 px, `label.check` for **Select all visible events** measures
`32.546875 × 44` CSS px. Event-row checkbox labels measure `44 × 44`, and the
same select-all control is `44 × 44` on desktop, but the mobile bulk control
does not meet the required 44 px width.

### Medium — the ledger overflows horizontally at the 200% reflow probe

At a 640 px viewport with the page rendered at 200% (an effective 320 CSS px),
the demo has `scrollWidth=691` and `clientWidth=640`, an overflow of 51 px.
The event action region reaches x=690.72 and archive buttons reach x=670.72.
Evidence: [live-demo-200pct.png](evidence/verification-12/live-demo-200pct.png).

## Mandatory initial gates

`.factory/claims.json` exists with 21 entries. After `npm ci` installed 60
packages with zero reported vulnerabilities, every exact listed command was
run individually before broader QA.

| Claim | Initial result |
| --- | --- |
| demo-sandbox, demo-isolation, demo-expiry, self-hosted-runtime | PASS |
| review-workflow, administrator-boundary, retention-delete, response-policy | PASS |
| ledger-export, privacy-no-tracking, offline-demo, ingest-safety | PASS |
| receiver-token-once | **FAIL — 30 s credential timeout** |
| receiver-authentication, group-state-transition, health-identity | PASS |
| receiver-quota, scope-boundary, free-mit-license, self-hosted-controls, api-rate-limit | PASS |

The cold live first screen passes. It says **“Review low-priority webhook
events”**, identifies **“solo developers and small teams”**, and gives the
visible first action **“Try it with sample data”** with the explanation that it
opens an isolated sample ledger with no token. The action opens `/demo` in one
click. Evidence: [first-read-desktop.png](evidence/verification-12/first-read-desktop.png).

## Local build and quality gates

| Check | Result |
| --- | --- |
| `npm ci` | PASS; 60 packages, 0 reported vulnerabilities |
| Every exact `.factory/claims.json` command | **FAIL; 20 passed, 1 failed initially** |
| `npm test` | PASS; 4 Vitest, 9 Node contract/scope/identity, 21 Rust, 2 storage, 21 claims, and 20 Axe scans |
| Claim retry: `receiver-token-once` | PASS in 2.2 s |
| `npx tsc --noEmit` | PASS |
| `cargo fmt --all -- --check` | PASS |
| `cargo clippy --all-targets --all-features --locked -- -D warnings` | PASS |
| `VITE_BUILD_SHA=e59c… npm run build` | PASS; produced `dist/` |
| `BUILD_SHA=e59c… cargo build --locked --release` | PASS |
| First `npm run test:e2e` | **FAIL; 30 s credential timeout** |
| Second `npm run test:e2e` | PASS; mobile keyboard, ingest 202, acknowledge, digest, privacy, 0 console errors |

No Docker, Podman, or Buildah executable is installed, so the image itself was
not built. The repository's container-contract tests passed, including the
non-root/default-config/build-identity assertions.

## End-to-end product evidence

The live demo loaded three sources and five event groups. Search for `deploy`
returned one group; review state changed; archiving reduced the active list
from five to four; reset restored five. CSV contained one header plus five
rows, JSON contained five groups, and the digest showed the 24-hour roll-up.
The persistent demo banner remained visible. Evidence:
[desktop](evidence/verification-12/live-demo-desktop.png) and
[mobile](evidence/verification-12/live-demo-mobile.png).

An independent local API exercise confirmed:

- anonymous management access returns 401;
- empty name, one-character alias, zero retention, invalid JSON, and invalid
  `24:00` digest time return clear 400 errors;
- 3650-day retention succeeds, a duplicate alias returns 409, and `23:59`
  recovers successfully;
- two valid deliveries return 202 and group into one record with occurrence
  count 2.

The Rust tests independently cover simultaneous source creation and durable
SQLite restart boundaries. The storage test passed across a full process
restart.

## Live deployment, privacy, and backend checks

- `/health` returned status `ok` and exact build
  `e59c4833b8ab1d53cdf175a839235cc7ce442c7a`.
- Candidate-stamped local HTML, JS, and CSS matched the live files byte for
  byte. JS SHA-256 is
  `d04a69eccd9cf5a83ddf0292a422cf4c03ac0030ab0acf13486de5fa91330332`;
  CSS SHA-256 is
  `1f22980f31e6ac99f82cbb376cfc78e5bfab3ef401a6a6c94b3891736444e488`.
- Browser requests through landing, demo, review, digest, and export were all
  same-origin. There were no console or page errors in the completed flows.
- Root, demo, privacy, and terms return 200. The designed missing route returns
  404. All crawled internal links returned 200.
- HTML and `sw.js` use `Cache-Control: no-cache`; hashed JS/CSS use
  `public, max-age=31536000, immutable`.
- Responses include HSTS, `nosniff`, `DENY` framing, no-referrer policy,
  restrictive permissions policy, and a same-origin CSP with
  `frame-ancestors 'none'`.
- A concurrent 120-request management burst from one forwarded client yielded
  62 × 401 and 58 × 429 while refill occurred. All 58 limited responses had
  `Retry-After: 1`. The documented allowance is a 60-token burst with 20/s
  refill. A later request recovered to 401.
- The product has no sign-in, so the Entra authority check is not applicable.
  It has no payment or runtime AI path.

## Accessibility, mobile, offline, and performance

- `/opt/fleet/lib/verify-url.sh` passed: 200, 851 ms load, title, `lang=en`, one
  h1, main landmark, image alt text, labeled buttons, and no console errors.
- Direct live Axe scans of landing, demo, privacy, terms, and 404 found zero
  violations. The full local suite found zero violations across 20
  desktop/mobile states.
- At 390 × 844, normal rendering has no horizontal overflow
  (`scrollWidth=clientWidth=390`). Keyboard-only entry reaches the visible skip
  link, activates main, then starts the demo. Reduced-motion durations collapse
  to 0.01 ms.
- A service-worker update check found active
  `/sw.js?build=e59c4833…`; offline reload retained all five sample groups.
- Candidate JS is 37,436 bytes (11.70 KB gzip) and CSS is 17,817 bytes
  (4.81 KB gzip), within budget.
- Mobile Lighthouse scored 100 performance, 100 accessibility, 100 best
  practices, and 100 SEO. LCP was 1.653 s, CLS 0, total blocking time 0 ms,
  and first-load transfer was 120,578 bytes. Evidence:
  [lighthouse-mobile.json](evidence/verification-12/lighthouse-mobile.json).

## Required next steps

1. Make source creation and one-time credential rendering deterministic, then
   run the exact claim command and `npm run test:e2e` repeatedly from clean
   isolated servers.
2. Give the mobile select-all label a 44 px minimum width.
3. Reflow event actions at an effective 320 CSS px under 200% zoom without
   horizontal scrolling.
4. Repeat all 21 declared claim commands from a clean clone before release.
