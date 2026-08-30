# Independent product verification 5 — FAIL

**Work order:** `internal-event-ledger-verify-5`  
**Candidate:** `56713918c120f2af006b0a4f021a0d49af6144aa`  
**URL:** https://internal-event-ledger.sociobot.in  
**Verified:** 2026-08-30 UTC

## Verdict

**FAIL — do not release this candidate.** The deployed application is healthy and matches the candidate exactly, but the advertised $39 Pro purchase is unavailable. The claims registry also omits quantitative promises that appear in the live UI and README.

This is fresh evidence, not the earlier deployment-only failure. Live `/health` returned the exact candidate SHA, and the candidate-stamped local JS and CSS were byte-for-byte identical to the deployed assets.

## Release blockers and defects

### High — advertised Pro checkout returns 404

Every **Buy Pro once** link resolves to:

`https://api.sociobot.in/api/v1/products/internal-event-ledger/checkout`

Fresh direct evidence:

```text
HTTP/2 404
content-type: application/json

{"error":"enabled factory product","status":404}
```

The landing page says “Pro costs $39 once,” the Terms page says checkout is handled by Sociobot/Dodo, and Settings offers the purchase action. A visitor cannot buy the offered tier. The checkout endpoint's own limiter did work during a 300-request burst (11×404, 289×429, `Retry-After: 0`), but the normal request never reaches checkout.

### High — quantitative promises are absent from the executable claim contract

`.factory/claims.json` exists and all 13 registered tests pass, but it does not list or directly test these live/README promises:

- “Sample workspace · expires in 24 hours” and README “It expires after 24 hours.”
- “The server verifies the license and caches its verdict for up to one day” / “no more than once daily.”
- The live availability of the offered Sociobot checkout.

The demo tests assert isolation, reset, seeded data, and offline reload, but do not advance time or prove server expiry. The plan-limit test uses a recorded local license verdict but does not count verification calls across a 24-hour cache window or open the real checkout. Under the claims acceptance contract, unlisted visitor-reliant claims are release-blocking.

### Medium — live per-client limits multiply across replicas

The source configures per-process bursts of 60 management requests, 240 pre-auth receiver requests, and 10 demo creations. The live service returned 429 with `Retry-After`, but only after approximately three times those allowances:

| Live single-client burst | Responses | Observed allowance before 429 |
| --- | --- | ---: |
| Anonymous `GET /api/events` | 183×401, 317×429 | 183 |
| Unknown-alias `POST /ingest/...` | 747×404, 253×429 | 747 |
| `POST /api/demo` | 13×200, 2×429 | 13 |

The in-memory limiter is effective per replica rather than across the deployment. The required 429 and `Retry-After: 1` were present, but the documented code-level allowance is not a stable per-client deployment allowance.

### Medium — route changes can lose keyboard/screen-reader focus

Normal demo navigation to Sources focused its `<h1>`. Navigating to Digest focused the heading briefly, then the asynchronous digest render replaced it and left focus on `<body>`. Browser Back from Digest to Sources also left focus on `<body>`. The URL and content changed correctly, but back/forward and async route completion do not restore focus to the new heading as required by the routing contract.

## Mandatory first checks

### Claims

After `npm ci`, every exact command listed in `.factory/claims.json` passed from the clean candidate. The initial pre-install invocation could not start Vite, as expected before dependencies existed; no claim assertion ran or failed in that attempt.

| Claim | Result | Observable evidence |
| --- | --- | --- |
| `demo-sandbox` | PASS | One-click `/demo`, five groups, seeded sources, reset, no token prompt |
| `demo-isolation` | PASS | Demo-only API traffic; production sentinel unchanged |
| `self-hosted-runtime` | PASS | `PORT`-only runtime generated SQLite and a 64-character mode-0600 token |
| `review-workflow` | PASS | Search returned two groups; acknowledge/archive worked; digest total 11 |
| `administrator-boundary` | PASS | Anonymous APIs 401; valid token worked; token only in `sessionStorage` |
| `retention-delete` | PASS | Exactly one expired event deleted |
| `response-policy` | PASS | HTML/SW revalidate; hashed assets immutable; CSP present |
| `ledger-export` | PASS | CSV header plus five records; JSON contained five records |
| `privacy-no-tracking` | PASS | Landing/demo/digest requests were same-origin only |
| `offline-demo` | PASS | Fresh offline reload retained all five groups |
| `ingest-safety` | PASS | HMAC, nested/header redaction, credential removal, grouping count 2 |
| `plan-limits` | PASS | Recorded verdict enforced Free/Pro source, retention, and digest boundaries |
| `api-rate-limit` | PASS locally | 429 plus `Retry-After` from the local management burst |

The unlisted promises above remain a separate failure under the same contract.

### Cold first-read test

**PASS.** In a fresh 1366×900 browser context, the first screen said:

- What: **“Review operational events without Slack noise.”**
- For whom: **“For solo developers and small teams that need searchable webhook history without another urgent inbox.”**
- First click: **“Try it with sample data,”** immediately followed by **“Opens an isolated sample ledger with no token.”**

The action opened `/demo` in one click, showed five realistic event groups, and displayed the persistent “Demo — sample data, nothing is saved to your real ledger” banner with Reset and Start for real controls. The same contract was visible within the first 390×844 mobile screen.

## Clean local gates

| Check | Result |
| --- | --- |
| `npm ci` | PASS — 60 packages, 0 audit vulnerabilities |
| `npm test` | PASS — 4 Vitest, 3 Node container-contract, 18 Rust, 13 claim tests |
| `npx tsc --noEmit` | PASS |
| `cargo fmt --check` | PASS |
| `cargo clippy --locked --all-targets -- -D warnings` | PASS |
| `VITE_BUILD_SHA=567139… npm run build` | PASS — `dist/` produced |
| `BUILD_SHA=567139… cargo build --locked --release` | PASS |
| `npm run test:e2e -- http://127.0.0.1:18192` | PASS — create, ingest, redact, acknowledge, digest, license-return handoff, cleanup |
| `npm run test:a11y -- http://127.0.0.1:18192` | PASS — zero violations across 16 view/viewport scans |
| Docker build | Not run — Docker and Podman are unavailable in this verifier container; static container-contract tests passed |

The release binary started in a fresh directory with only `PATH` and `PORT=18191`. It generated a 64-character administrator token with mode `0600`, created `ledger.db`, served `/`, logged `admin_token_source:"generated"`, and returned the exact candidate from `/health`.

## End-to-end and backend evidence

Independent API boundary checks against the candidate release binary produced:

- Anonymous management 401; empty name 400; malformed alias 400; retention 0 returned 400; free retention 31 returned 403; duplicate alias 409.
- Wrong receiver token 401; missing required HMAC 401; oversized body 413; invalid review state 400; custom free digest window 403.
- Two valid signed deliveries grouped to occurrence count 2. Configured body/header fields became `[REDACTED]`; authorization and receiver credentials were absent from stored headers.
- A created source survived a process restart against the same SQLite database and was then deleted successfully.
- Six simultaneous free source creations resulted in 5×201 and 1×403; exactly five were stored.
- Local 100-request `/health` load: 100×200 in 132 ms (about 759 requests/second).
- Live 100-request `/health` load: 100×200 in 409 ms (about 245 requests/second).

## Live deployment and browser evidence

### Identity and routes

- `/health`: `{"build":"56713918c120f2af006b0a4f021a0d49af6144aa","status":"ok"}`.
- Deployed JS `index-C8oliHqy.js` and CSS `index-D25oWMKj.css` SHA-256 hashes exactly matched the candidate-stamped local build.
- `/`, `/demo`, `/privacy`, `/terms`, `/robots.txt`, `/sitemap.xml`, and `/404.html` returned 200. An unknown path returned the designed document with 404.
- All internal rendered links returned 200; `mailto:` was exempt. The only dead action was the external Pro checkout described above.

### Demo workflow, mobile, keyboard, and accessibility

- Desktop and 390px: no horizontal overflow; one `<h1>` and one `<main>`; correct route titles; sample banner and five groups.
- Search “catalogue” returned two groups. Acknowledge and confirmed archive worked. Digest showed 11 after those state changes. Reset restored five groups.
- CSV downloaded six lines including its header; JSON downloaded five records.
- Invalid administrator token kept the form visible and announced “Administrator authentication is required.”
- Landing keyboard traversal began with the visible Skip link. All focusable landing controls showed the designed 3px `#06769a` focus outline; primary demo entry worked with Enter. Checkbox inputs sit inside 44×44 labels.
- `prefers-reduced-motion: reduce` matched and reduced all animation/transition durations to `0.00001s`.
- At 200% root text size, the 390px demo had no horizontal overflow and retained visible heading/banner.
- Axe: zero violations, including zero serious/critical, on landing, Privacy, Terms, and Demo Inbox/Sources/Digest/Settings at desktop and 390px. The repository's authenticated local matrix was also zero across Inbox/Sources/Digest/Settings/Privacy/Terms.
- Normal landing/demo flow had zero console or page errors. Deliberate invalid login produced only the expected browser 401 resource messages.

### Privacy, headers, caching, and PWA

- The complete landing → demo → search/state/export/reset/digest flow requested only `https://internal-event-ledger.sociobot.in`; no analytics, trackers, CDN fonts, or third-party runtime assets appeared.
- HTML response headers included CSP, HSTS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, and `Permissions-Policy`.
- HTML and `sw.js`: `Cache-Control: no-cache`. Hashed JS/CSS: `public, max-age=31536000, immutable`. API/health: `no-store`.
- A fresh service worker controlled `/demo` from `sw.js?build=567139…`; cache name was `ledger-shell-567139…`. `registration.update()` completed, and an offline reload retained all five groups with zero errors. The worker's activation code removes old `ledger-shell-*` caches.

### Budgets and Lighthouse

- JS: 40,900 bytes raw / 12,967 bytes gzip.
- CSS: 17,615 bytes raw / 4,837 bytes gzip.
- Hero image: 61,858 bytes. No web-font files.
- Live mobile transfer: 121 KiB.
- Fresh full Lighthouse mobile run: performance 91, accessibility 100, best practices 100, SEO 100; FCP 1.2 s, LCP 1.7 s, CLS 0, TBT 360 ms.
- A performance-only repeat scored 100 with LCP 1.7 s and TBT 60 ms. Both meet the score/LCP/CLS and asset budgets.

## Other contract checks

- No sign-in provider is used; the self-hosted administrator-token boundary is intentional, so the Sociobot Entra tenant requirement is not applicable.
- The brief does not need an AI-assisted step; search, digest, export, and redaction already cover the obvious review workflow without model use.
- Dockerfile inspection passes the stated shape: `rust:1-alpine`, no `.git`, build-arg SHA, multi-stage build, non-root runtime, port 8080, and `/health` identity.

## Required repair

1. Register/enable the production billing product so the exact checkout URL redirects to a working hosted checkout, then exercise purchase return and server verification against the live product.
2. Add independent claim entries/tests for 24-hour demo expiry and the once-daily license-verification cache, or remove those promises. Add a live-safe checkout availability claim.
3. Use a shared limiter or ingress-enforced client limit if the intended 60/240/10 allowances must hold across replicas.
4. Refocus and announce the final `<h1>` after asynchronous route rendering and on `popstate`.

