# Polish 2 — zero-finding closure

This repair closes every finding in `review-2.md` and re-verifies every repair
from `review-1.md`. The unchanged art-deco transit-control-room identity stays
in the geometry, palette, and original artwork; working labels now use direct
product language.

## Review 1 findings

| Finding | Change retained or made | Evidence |
| --- | --- | --- |
| F-1-1 | First screen states privacy, offline sample behaviour, and free MIT use. | `@claim:privacy-no-tracking`, `@claim:offline-demo`, `@claim:free-mit-license`; local and live landing screenshots. |
| F-1-2 | Designed 404 includes route metadata, legal links, provenance, and build footer. | `site discovery and designed error documents ship in the frontend`; `test:a11y` 404 scans; live `/not-a-route` check. |
| F-1-3 | App destinations are real links with History API navigation. | `npm run test:e2e`; live demo route-focus check. |
| F-1-4 | The digest is on demand; the inert daily schedule is absent. | `@claim:review-workflow`; local `/demo/digest` check. |
| F-1-5 | The product boundary has an executable claim. | `@claim:scope-boundary`. |
| F-1-6 | README describes Compose as a run path without an untested persistence promise. | `.factory/copy-audit.md`; full `npm test`. |
| F-1-7 | Public copy does not make the removed container-identity promise. | `.factory/copy-audit.md`; container contract tests. |
| F-1-8 | README gives the plain one-replica SQLite instruction. | `.factory/copy-audit.md`; storage tests. |
| F-1-9 | Receiver tokens are shown once and differ by source. | `@claim:receiver-token-once`. |
| F-1-10 | All three documented receiver-token locations work. | `@claim:receiver-authentication`. |
| F-1-11 | New events reopen archived groups and preserve acknowledged groups. | `@claim:group-state-transition`. |
| F-1-12 | Stored event headers discard credentials. | `@claim:ingest-safety`. |
| F-1-13 | Digest copy writes the expected plain text. | `@claim:review-workflow`. |
| F-1-14 | The unused scheduling control and no-email statement remain removed. | `@claim:review-workflow`; demo Settings browser check. |
| F-1-15 | Health returns status and the compiled build identity. | `@claim:health-identity`; live `/health` identity check. |
| F-1-16 | Copy promises separate per-source tokens, not unmeasured entropy. | `@claim:receiver-token-once`; `.factory/copy-audit.md`. |
| F-1-17 | Management and receiver limits return 429 with `Retry-After`. | `@claim:api-rate-limit`; Rust rate-limit tests. |
| F-1-18 | Valid receiver traffic has a separate quota from invalid attempts. | `@claim:receiver-quota`; Rust quota test. |
| F-1-19 | Unregistered proxy wording remains absent from public copy. | Rust `forwarded_addresses_are_used_only_for_trusted_ingress`; README audit. |
| F-1-20 | Headline says “Review low-priority webhook events.” | `.factory/copy-audit.md`; local and live landing screenshots. |
| F-1-21 | Preview heading says “Group and review repeated webhook events.” | `.factory/copy-audit.md`; landing screenshots. |
| F-1-22 | Process heading says “How webhook review works.” | `.factory/copy-audit.md`; landing screenshots. |
| F-1-23 | Masthead says “Webhook review.” | `.factory/copy-audit.md`; landing screenshots. |
| F-1-24 | Boundary heading says “Not for urgent alerts.” | `.factory/copy-audit.md`; landing screenshots. |
| F-1-25 | “Calm” remains absent from product copy. | `.factory/copy-audit.md`; README audit. |
| F-1-26 | Event, event group, source, ledger, and demo remain the canonical terms. | `.factory/copy-audit.md` terminology table. |
| F-1-27 | README audience copy remains split below 22 words. | `.factory/copy-audit.md`. |
| F-1-28 | README capability copy remains split below 22 words. | `.factory/copy-audit.md`. |
| F-1-29 | README build and token copy remains split below 22 words. | `.factory/copy-audit.md`. |
| F-1-30 | The long container sentence remains absent. | `.factory/copy-audit.md`. |
| F-1-31 | README authorization copy remains split below 22 words. | `.factory/copy-audit.md`. |
| F-1-32 | README source, retention, and digest limits remain split. | `.factory/copy-audit.md`. |
| F-1-33 | Repair-history residue remains absent from README. | README audit. |
| F-1-34 | 404 h1 says “This page does not exist.” | 404 Axe scans; live `/not-a-route` returns 404. |
| F-1-35 | Brief summary exists; catalog copy is now verb-first and 70 characters. | `.factory/brief.json`; `.factory/catalog-description.txt`. |

## Review 2 findings

| Finding | Change made | Evidence |
| --- | --- | --- |
| F-2-1 | Replaced “Control board,” “Incoming lines,” “Routing office / 02,” and the related “Registered lines” with “Ledger sections,” “Sources,” “Source setup / 02,” and “Registered sources.” | `working navigation uses direct functional labels`; `npm run test:e2e`; `.factory/evidence/polish-2-local/demo-desktop.png`; `.factory/evidence/polish-2-local/demo-mobile.png`; `/tmp/iel-polish-2-live/demo-desktop.png`; live `/demo/sources`. |
| F-2-2 | Added `/demo/sources`, `/demo/digest`, and `/demo/settings`; the test now compares the exact sitemap route set. | `site discovery and designed error documents ship in the frontend`; `.factory/evidence/polish-2-local/browser.json`; `/tmp/iel-polish-2-live/browser.json`; live `/sitemap.xml`. |

## Evidence summary

- `npm test`: full frontend, container, forbidden-resource, Rust, storage,
  21-claim, privacy, offline, and 20-scan Axe suite passes.
- `npm run test:e2e`: 390×844 keyboard, source, ingest, acknowledge, digest,
  footer, and console smoke passes.
- `npm run build`: `dist/` produced; initial JavaScript is 11.67 KB gzip and
  CSS is 4.81 KB gzip.
- Local Lighthouse mobile: performance 99, accessibility 100, best practices
  100, SEO 100; LCP 1.8 s, CLS 0, total blocking time 0 ms. Evidence:
  `.factory/evidence/polish-2-local/lighthouse-mobile.json`.
- Local screenshots and browser report:
  `.factory/evidence/polish-2-local/`.
- Final cold live screenshots and browser report:
  `/tmp/iel-polish-2-live/`.
