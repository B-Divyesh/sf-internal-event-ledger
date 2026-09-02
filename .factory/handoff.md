# Internal Event Ledger — adversarial review 1 handoff

## Outcome

**FAIL.** The complete review is in [`review-1.md`](review-1.md). It records 35
findings: 19 major and 16 minor. No product code was changed.

## What was done

- Cold-loaded the live landing page in fresh 390×844 and 1440×900 contexts.
- Audited every landing string and README prose sentence with word counts.
- Exercised the live demo, edit, Reset, storage namespaces, request log, and
  offline reload.
- Ran all 14 claim commands individually from a clean clone at
  `06e1a1cec0c42cb9e781e1450ad3695f0bb44c73`; all passed.
- Ran the complete `npm test` gate in that clean clone; it passed.
- Checked live routes, metadata, links, assets, Back behavior, route focus,
  mobile overflow, the designed 404, and the visual identity.
- Ran `verify-url.sh` and Playwright axe scans of the landing, demo, legal, and
  404 pages. The scans found no accessibility violations.
- Read the prior handoff. No earlier review or polish files exist.

## How to verify

```sh
npm ci
npm test
/opt/fleet/lib/verify-url.sh https://internal-event-ledger.sociobot.in /tmp/iel-evidence
```

Run each command in `.factory/claims.json` separately from a fresh clone. Use a
fresh Playwright context for `/` and `/demo`; record requests, wait for service
worker control, set the context offline, and reload.

## Left to do

Address every finding in `review-1.md`, especially the missing price/offline
hero facts, unlisted or under-tested claims, inert review-time setting, button
route semantics, and incomplete 404 metadata/footer. Then rerun the entire
review from scratch. The standalone axe CLI had a ChromeDriver 152 / Chromium
145 mismatch in this worker; the installed Playwright axe integration ran
successfully instead.
