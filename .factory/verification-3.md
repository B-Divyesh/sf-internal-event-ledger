# Independent product verification 3 — FAIL

**Work order:** `internal-event-ledger-verify-3`

**Candidate:** `37e1e5192412cf820a54e8e6ed9eb4ad6672fd2c`

**Live URL:** https://internal-event-ledger.sociobot.in

**Verified:** 2026-08-28 UTC

## Verdict

**FAIL — do not release this candidate unchanged.** The deployment-only uncertainty in the preceding builder handoff is resolved: the live backend now advertises the full candidate SHA, and every shipped frontend asset is byte-identical to a clean SHA-stamped build. The core signed-event workflow, administrator boundary, free-tier enforcement, persistence, privacy, offline shell, performance, and public access screens pass.

The candidate nevertheless fails the non-negotiable accessibility contract. The authenticated Settings screen has one Axe `serious` color-contrast violation affecting four controls/links in the Pro panel. The label and restore-license button render at **1.09:1**, and the Privacy/Terms links render at **1.89:1**, all below the required 4.5:1. This failure occurs at desktop and 390 px and makes the license restoration action nearly invisible.

## Clean-checkout build and automated gates

A separate detached worktree was created at the exact candidate with no `node_modules`, `target`, or `dist` before testing.

| Check | Result |
| --- | --- |
| `npm ci` | PASS — 60 packages installed; 0 audit vulnerabilities |
| `npm test` | PASS — 4 Vitest tests, 2 Node container-contract tests, 13 Rust tests |
| `npx tsc --noEmit` | PASS |
| `cargo fmt --check` | PASS |
| `cargo clippy --all-targets -- -D warnings` | PASS |
| `npm audit --omit=dev` | PASS — 0 vulnerabilities |
| `VITE_BUILD_SHA=37e1e519… npm run build` | PASS — exact SHA-stamped frontend build produced `dist/` |
| `BUILD_SHA=37e1e519… cargo build --locked --release` | PASS — exact SHA-stamped release binary |
| `npm run test:e2e -- http://127.0.0.1:18183` | PASS — create, ingest, acknowledge, digest, privacy, checkout-return handoff; 0 console errors |
| Repository `npm run test:a11y` | PASS on its single Inbox scan — 0 violations |
| Expanded Axe sweep | **FAIL** — Settings has 1 serious rule affecting 4 nodes; all other tested screens had 0 violations |

Production assets are within budget: JavaScript **31,892 B**, CSS **12,975 B**, generated WebP **61,858 B**, no web fonts, and 47,237 B transferred on the live first load. The JavaScript and CSS are well below the 200 KB and 50 KB limits.

No Docker/Podman/Buildah engine was installed in the verifier container, so the multi-stage image itself could not be rebuilt. Both exact build stages were run with the candidate SHA; both Docker contract tests passed; the Dockerfile is multi-stage, `.git`-independent, declares `ARG BUILD_SHA=dev`, runs as `ledger`, and the live image reports the exact candidate identity.

## Backend and end-to-end evidence

The release binary and built `dist/` were copied into a new temporary runtime directory and started under `env -i` with only `PORT=18183`.

- First boot generated a 64-character administrator token, persisted it with mode `0600`, and logged `admin_token_source=generated` without logging the token. Restart logged `persisted`.
- `/health` returned `37e1e5192412cf820a54e8e6ed9eb4ad6672fd2c`. One hundred concurrent local health requests and 100 concurrent live health requests all returned 200 with that SHA.
- Sources, events, both exports, settings, digest, and license routes returned 401 without the administrator token; a wrong token also returned 401.
- Normal and boundary checks covered names of 1/80/81 characters, aliases of 1/2/48/49 characters and invalid characters, retention 0/1/30/31/3651, 33 redaction rules, duplicate aliases, malformed JSON, unknown aliases, missing/wrong receiver tokens, missing/wrong HMAC, and a body over 256 KiB.
- HMAC-SHA256 ingest returned 202. Three equal fingerprints grouped into one record; acknowledgement, archive, arrival-driven reopening, search, status filtering, bulk update, 24-hour digest, source cascade deletion, JSON export, and CSV quote escaping worked.
- Configured nested body data and headers were stored as `[REDACTED]`. `Authorization`, `Cookie`, receiver-token, and signature headers were absent from stored event headers.
- Twenty simultaneous free source creations produced exactly **5 × 201** and **15 × 403**, leaving five sources. A 160-request anonymous unknown-alias flood returned 160 × 404; the valid receiver then accepted its next event. A following 100-request concurrent valid ingest burst returned 100 × 202 and persisted 100 distinct groups without corruption.
- One source, 101 event groups, and the `23:59` review time survived restart. After one disposable event was aged, retention reported one deletion and left 100 groups.
- An invalid real Sociobot license was rejected with 403 and was not treated as Pro. The browser smoke proves a checkout-return token is retained, removed from the URL, and applied to the authenticated server using a mocked successful verifier response.

## Browser, accessibility, recovery, and PWA evidence

- Desktop 1366×900 and mobile 390×844 had one `h1`, one `main`, `lang=en`, a 16 px body baseline, and no horizontal overflow. Normal flows produced no page or console errors.
- Keyboard-only smoke confirmed the skip link is first, visibly focuses with a 3 px cyan outline, and Enter moves focus to `main`. Wrong administrator authentication displayed an alert and recovered with the correct token. The token was present only in session storage, not local storage.
- Empty Inbox, generated illustration/alt text, invalid source alias blocked before submission, successful correction, no-results search, Clear filters recovery, and the authenticated offline error state were all exercised at 390 px.
- Under `prefers-reduced-motion: reduce`, the maximum computed animation/transition duration was 0.01 ms and none exceeded 1 ms.
- Expanded Axe scans covered authenticated Inbox, Sources, Digest, Settings, Privacy, and Terms plus live access at desktop and 390 px. Every screen except Settings had zero violations. Settings reproduced the same serious four-node contrast failure at both sizes. Screenshot: `.factory/evidence/verification-3-live/settings-contrast.png`.
- The live service worker controlled the page from `sw.js?build=37e1e519…`, used `ledger-shell-37e1e519…`, had no waiting/installing worker after `registration.update()`, excluded `/api` and `/ingest` from its cache, and served a one-`h1`/one-`main` shell on offline reload with no errors.
- `/opt/fleet/lib/verify-url.sh` passed with title, language, main landmark, image-alt, and console checks. Raw output and screenshots are in `.factory/evidence/verification-3-live/`.

## Live deployment, privacy, policies, and performance

- Fresh `GET /health` returned `{"build":"37e1e5192412cf820a54e8e6ed9eb4ad6672fd2c","status":"ok"}`.
- Clean-build and live bytes match for `index.html`, JS, CSS, WebP, service worker, manifest, and favicon. Key SHA-256 values: HTML `bd9ccee7…`, JS `fa772ef8…`, CSS `34bc335d…`, WebP `6d989203…`.
- Anonymous live sources, events, exports, settings, and license reads returned 401. A hostile-origin preflight returned 401 without an allow-origin header.
- HTTP redirects to HTTPS; HTTPS serves HTTP/2. Live responses include HSTS, CSP, no-sniff, frame deny, no-referrer, and restrictive permissions policy. HTML and `sw.js` use `no-cache`; hashed JS/CSS use one-year immutable caching; API and health use `no-store`.
- Browser observation found only same-origin requests on normal local and live loads. Source review found no analytics, trackers, remote fonts, runtime CDN scripts, or direct payment-provider code. The sole product service reference is the allowed Sociobot billing API.
- Live mobile Lighthouse: Performance **99**, Accessibility **100** on the public access screen, Best Practices **100**, SEO **100**; FCP **1.4 s**, LCP **1.4 s**, TBT **90 ms**, CLS **0**. The public Lighthouse score does not cover the authenticated Settings defect. Raw report: `.factory/evidence/lighthouse-verification-3-live.json`.

## Defects

### High — authenticated Settings has a serious contrast failure

Open Settings after administrator authentication. In the dark Pro panel:

- “Have a license? Paste it here” and “Verify and apply to this server” render `#162b35` on `#10242d`: **1.09:1**.
- Privacy and Terms render `#8e291e` on `#10242d`: **1.89:1**.

Axe classifies the rule as `serious` at both 1366×900 and 390×844. The restore action is visually difficult to discover/use, and the result violates the explicit ≥4.5:1 and zero serious/critical acceptance gates. Give Pro-panel labels/buttons/links explicit high-contrast colors and add Settings to the repository axe script.

### Low — digest time API accepts a value outside its stated format

`PUT /api/settings` with `{"digest_hour":"7:00"}` returned 200 and persisted `7:00`, although the handler error and API contract require `HH:MM`. The browser time control normally emits `07:00`, so impact is limited to direct API clients. Require exactly two hour digits and two minute digits before persistence.

### Low — authenticated sidebar Terms target is fractionally undersized

The desktop authenticated sidebar Terms link measured **43.3 × 44 px**, below the product’s 44×44 px target contract by 0.7 px in width. The public legal links pass. Add `min-width: 44px` (or equivalent padding) to the sidebar legal links.

## Scope limitations

- No valid paid test license was available, so a genuinely successful Sociobot/Dodo verdict was not sent to the real billing service. Invalid-verdict behavior and the complete browser return/application path with a mocked valid server response were exercised.
- The live administrator token was not available. Full authenticated UI/API work was exercised against the byte-identical candidate release locally; public authorization and build identity were verified live.
- No container engine was available, as noted above. Product source code was not modified.
