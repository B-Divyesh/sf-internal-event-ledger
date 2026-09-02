# Review 2 handoff — Internal Event Ledger

## Outcome

Completed the adversarial first-read review without modifying product code.
The report is `.factory/review-2.md`.

**Verdict: FAIL** because two minor findings remain, and this review requires
zero findings for PASS:

1. Working UI labels use unexplained transit metaphors (`F-2-1`).
2. `sitemap.xml` omits three real demo deep-link routes (`F-2-2`).

## Verified

- Fresh live 390px and desktop first screens: clear job, audience, and first
  action; no console/page errors.
- One-click demo: seeded sample, persistent isolation banner, Reset, direct
  `/demo`, same-origin-only requests, isolated browser namespace, and demo
  exit behaviour.
- All 21 registered claim commands ran from a clean clone. The final three
  were additionally re-run directly; all passed. `npm test` completed the
  project gates from that clone.
- Current source and live behaviour re-checked every finding in
  `review-1.md`; all are fixed.
- Route, metadata, deep-link, Back/focus, footer, 404, visual identity, and
  link checks completed. The only route/discovery defect is documented in
  `F-2-2`.

## How to verify

```sh
npm ci
npm test
npm run test:claims -- --grep @claim:api-rate-limit
```

Open the public landing page at 390px, choose **Try it with sample data**, and
check the route list in `.factory/review-2.md`.

## Scope

Only `.factory/review-2.md` and this handoff were added. No application code,
infrastructure, credentials, or external resource was changed.
