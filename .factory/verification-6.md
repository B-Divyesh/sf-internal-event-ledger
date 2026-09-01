# Independent product verification 6 — FAIL

**Work order:** `internal-event-ledger-verify-6`

**Candidate:** `2d241143dac3a5a0ba53c996f488042d72ce7c41`

**URL:** https://internal-event-ledger.sociobot.in

**Verified:** 2026-09-01 UTC

## Verdict

**FAIL — do not release this candidate.** The deployment is healthy, matches the candidate, clears the earlier billing, expiry, shared-rate-limit, focus, and rolling-SQLite findings, and completes the core job end to end. One fresh release blocker remains: the live demo's loading state has an Axe `serious` ARIA violation. The attached accessibility contract requires zero serious or critical findings, including loading states.

No product code was changed during this verification.

## Release blocker

### High — the live demo loading state uses a prohibited ARIA attribute

Two fresh live `/demo` contexts reproduced this Axe finding before the demo API response settled:

```text
Rule: aria-prohibited-attr
Impact: serious
Target: .event-list
HTML: <div class="event-list" aria-label="Loading events">...</div>
Failure: aria-label cannot be used on a div with no valid role attribute
```

The exact source is `frontend/src/main.ts:98`. Once the five sample groups replace the skeleton, the same Axe rules return zero violations. This is still a real loading-state defect: assistive technology cannot rely on the intended "Loading events" name. Give the loading container an appropriate live/status role and accessible loading text, then add a test that deliberately delays `POST /api/demo` so Axe scans the loading state rather than racing past it.

## Mandatory first checks

### Claims

`.factory/claims.json` exists with 14 entries. The literal pre-install run from the untouched clone could not find Vite because dependencies were not yet installed. After the required `npm ci`, every exact command listed in the registry passed, and the complete `npm test` run passed all 14 together.

| Claim | Result | Fresh evidence |
| --- | --- | --- |
| `demo-sandbox` | PASS | First-screen action opened `/demo` without a token; reset and realistic sample data worked |
| `demo-isolation` | PASS | Dedicated demo API/browser namespace; production sentinel remained unchanged |
| `demo-expiry` | PASS | 86,400-second expiry and expired-workspace rejection |
| `self-hosted-runtime` | PASS | Release server started with only `PATH` and `PORT`; generated mode-0600 token and SQLite |
| `review-workflow` | PASS | Search, acknowledge, archive, 24-hour digest, route and Back focus |
| `administrator-boundary` | PASS | Anonymous/wrong-token management requests returned 401; token stayed in session storage |
| `retention-delete` | PASS | Aged fixture was deleted by its source policy |
| `response-policy` | PASS | Shell/SW revalidate; hashed assets immutable; CSP present |
| `ledger-export` | PASS | CSV had a header plus five rows; JSON had five records |
| `privacy-no-tracking` | PASS | Whole browser flow contacted only the product origin |
| `offline-demo` | PASS | Service-worker-controlled offline reload retained five groups |
| `ingest-safety` | PASS | HMAC, redaction, credential stripping, and repeat grouping |
| `self-hosted-controls` | PASS | Six 3,650-day sources and custom digest window worked locally |
| `api-rate-limit` | PASS | Shared 60-token management burst returned 429 plus `Retry-After` |

### Cold first-read test

**PASS on desktop and 390 px.** The first screen answers all three questions in plain words:

- What: **“Review operational events without Slack noise.”**
- For whom: **“For solo developers and small teams that need searchable webhook history without another urgent inbox.”**
- First action: **“Try it with sample data,”** with **“Opens an isolated sample ledger with no token.”** beside it.

The action is visible in the first 390×844 viewport. One click opens `/demo`, five realistic groups, and the persistent **“Demo — sample data, nothing is saved to your real ledger”** banner with **Reset demo** and **Start for real**.

## Clean local gates

| Check | Result |
| --- | --- |
| Initial checkout | PASS — exact candidate, no worktree changes |
| `npm ci` | PASS — 60 packages, 0 audit vulnerabilities |
| Every individual claim command | PASS — 14/14 after install |
| `npm test` | PASS — 4 frontend, 6 container/scope, 21 Rust, 2 process/storage, 14 claim tests |
| `npx tsc --noEmit` | PASS |
| `cargo fmt --check` | PASS |
| `cargo clippy --locked --all-targets -- -D warnings` | PASS |
| `npm audit --omit=dev` | PASS — 0 vulnerabilities |
| Candidate-stamped `npm run build` | PASS — `dist/` produced |
| Candidate-stamped `cargo build --locked --release` | PASS |
| Desktop and 390 px `npm run test:e2e` | PASS — zero console errors |
| Local `npm run test:a11y` | PASS — zero violations in 16 route/viewport scans |
| Docker image build | Not run — no Docker, Podman, Buildah, or Nerdctl executable in this worker |

The Dockerfile was inspected: multi-stage Node/Rust build, `rust:1-alpine`, no `.git`, defaulted `BUILD_SHA`, locked builds, non-root runtime, `/data`, `PORT=8080`, and the candidate-stamped health contract. The deployed image and local build identity provide runtime evidence despite the missing local container engine.

## End-to-end and backend evidence

- The release binary started in a fresh directory with only `PATH` and `PORT=18192`. It logged generated configuration without printing the token and returned the full candidate SHA from `/health`.
- Desktop and mobile browser smoke created a source, ingested and redacted an event, acknowledged it, opened Digest and Privacy, exercised the skip link, and reported zero console errors.
- Empty source name, malformed alias, and retention above 3,650 days returned clear 400 responses. Anonymous/wrong administrator and receiver credentials returned 401. An oversized 300 KB body returned 413.
- A source at the 3,650-day boundary accepted two valid HMAC-SHA256 deliveries, grouped them to occurrence count 2, replaced configured body/header values with `[REDACTED]`, and did not store ledger tokens or signatures.
- A full stop and restart retained the generated administrator token, both verifier sources, and their events.
- Two release processes started concurrently on ports 18192 and 18193 against the same SQLite files. Both stayed healthy and read the same persisted sources. A 100-request burst split across both processes returned exactly 60×200 and 40×429, all with `Retry-After: 1`.
- Invalid administrator input left the form available with **“Administrator authentication is required.”** The user could recover immediately by entering the five-group demo.

## Live deployment evidence

### Candidate identity and routes

- `/health` returned `{"build":"2d241143dac3a5a0ba53c996f488042d72ce7c41","status":"ok"}`.
- Candidate-stamped local and live JavaScript SHA-256: `3bb228cc86916d9638b66eba9a0aa735d5c80de9aaa7e9cdaa06ade07077676f`.
- Candidate-stamped local and live CSS SHA-256: `75aed50bbde9e77b0dcaaa40cc6bd15e847b54b9ff0d2d0e77b11df3885ff453`.
- Local and live hero SHA-256: `6d989203b1bcafb73fbe490a4d27649f913927ceb6130eb18c10afc410f74ced`.
- `/`, `/demo`, `/privacy`, `/terms`, `/robots.txt`, `/sitemap.xml`, `/manifest.webmanifest`, `/sw.js`, and `/404.html` returned 200. An unknown route returned the designed document with 404. Every rendered internal link returned 200.

### Core workflow and responsive behavior

- Search for “catalogue” returned two groups. Acknowledge and confirmed archive worked. The digest total was 11. Reset restored five groups.
- CSV export had six lines including its header; JSON export had five records.
- Route changes and browser Back focused the final `<h1>`.
- Desktop and 390 px layouts had no horizontal overflow. At 200% root text size, the demo still had no horizontal overflow and retained the heading and demo banner.
- Keyboard traversal starts at the skip link; its focus outline is 3 px `rgb(6, 118, 154)`, and Enter moves focus to `<main>`.
- `prefers-reduced-motion: reduce` matched, reduced transition/animation duration to `0.00001s`, and left no active animation.
- Settled landing, demo, Privacy, and Terms pages had zero Axe violations. The transient demo loading-state violation above is the sole blocker.

### Privacy, PWA, headers, caching, and limits

- The complete landing → demo → state changes → export → reset → legal-page flow requested only `https://internal-event-ledger.sociobot.in`. There were no trackers, remote fonts, CDN scripts, console errors, or page errors.
- CSP, HSTS, no-sniff, frame denial, no-referrer, and camera/microphone/geolocation denial headers were present.
- HTML and `sw.js` returned `Cache-Control: no-cache`; hashed JS/CSS returned `public, max-age=31536000, immutable`; APIs and health returned `no-store`.
- Service worker `sw.js?build=2d241143…` controlled the demo, `registration.update()` completed, the cache was candidate-versioned, and an offline reload retained all five groups with no errors.
- Live rate-limit evidence from one fixed forwarded client per bucket:
  - Demo: 10×200, then 5×429, all `Retry-After: 1`.
  - Management: 62×401 and 58×429 during a 10.128-second 120-request burst. This is the 60-token burst plus refill at 20/s while responses drained.
  - Ingest: 253×404 and 47×429 during a 36.872-second 300-request burst. This is the 240-token burst plus refill at 40/s while responses drained.
  - `/health` is intentionally exempt.

### Performance

- Candidate frontend: JS 36.71 KB raw / 11.72 KB gzip; CSS 17.08 KB raw / 4.70 KB gzip; hero 61.86 KB; no web fonts.
- Fresh live mobile Lighthouse: Performance 100, Accessibility 100, Best Practices 100, SEO 100; FCP 1.2 s, LCP 1.6 s, TBT 0 ms, CLS 0, transfer 115 KiB.
- Lighthouse scans the settled landing page and therefore does not supersede the separately reproduced loading-state Axe failure.

## Other acceptance checks

- No sign-in provider is used; the self-hosted administrator-token model makes the Entra requirement inapplicable.
- No paid tier, checkout, billing, or product-unlock endpoint remains, so the earlier unavailable checkout is resolved without crossing the product boundary.
- The brief does not imply a missing AI step. Deterministic grouping, search, digest, export, and redaction cover the review job without sending operational data to a model.
- The visual design matches `.factory/design.md`: a product-specific art-deco dispatch ledger, explicit single light mode, system fonts, original generated poster art with provenance, and reduced-motion handling.

## Required repair

1. Make the demo loading state semantically valid and announced, such as a status/live region with accessible loading text.
2. Add an Axe regression that delays the demo response and scans while the skeleton is present.
3. Rerun the exact claim registry, full suite, live loading-state Axe scan, and deployment identity comparison.

## Evidence

- `.factory/evidence/verification-6/axe-loading-state.json`
- `.factory/evidence/verification-6/live-browser.json`
- `.factory/evidence/verification-6/lighthouse-live.json`
- `.factory/evidence/verification-6/live-health.json`
- `.factory/evidence/verification-6/live-cold-desktop.png`
- `.factory/evidence/verification-6/live-cold-mobile.png`
- `.factory/evidence/verification-6/live-demo-desktop.png`
- `.factory/evidence/verification-6/live-demo-mobile.png`
- `.factory/evidence/verification-6/verify-live/verify.json`
