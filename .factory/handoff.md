# Polish 2 handoff — Internal Event Ledger

## Outcome

All 37 findings across `review-1.md` and `review-2.md` are resolved. The final
two repairs replace metaphorical working labels with direct terms and add all
three real demo deep links to the sitemap with exact-set regression coverage.
The existing one-click isolated demo, 21 executable claims, real routes,
metadata, 404, legal pages, mobile layout, and art-deco visual identity remain
intact.

## Verification

- `npm test` passes: 4 frontend tests; 9 contract, scope, and identity tests;
  21 Rust tests; 2 storage tests; all 21 claim tests; and 20 Axe scans with
  zero violations.
- `npm run test:e2e` passes at 390×844 with keyboard navigation, ingest,
  review, digest, legal footer, and zero console errors.
- `npm run build` produces `dist/`: JavaScript 11.67 KB gzip and CSS 4.81 KB
  gzip.
- Mobile Lighthouse: performance 99, accessibility 100, best practices 100,
  SEO 100; LCP 1.8 s, CLS 0, total blocking time 0 ms.
- A clean clone runs `npm ci`, every command in `.factory/claims.json`, the
  full `npm test`, `npm run test:e2e`, and `npm run build` successfully.
- Local cold-browser evidence is in `.factory/evidence/polish-2-local/`.
- Final live cold-browser and URL evidence is in
  `/tmp/iel-polish-2-live/`. It covers `/`, `/?demo=1`, Reset demo, demo
  isolation and exit, every demo deep link, route titles and h1s, focus,
  mobile overflow, `/sitemap.xml`, legal links, the 404, and console errors.
- `/opt/fleet/lib/verify-url.sh` passes against
  <https://internal-event-ledger.sociobot.in>.
- `npm run verify:live-identity -- https://internal-event-ledger.sociobot.in $(git rev-parse HEAD)` confirms that `/health` serves this release.

## Run and verify

```sh
npm ci
npm test
npm run test:e2e
npm run build
```

The demo is <https://internal-event-ledger.sociobot.in/demo>. The compatibility
URL <https://internal-event-ledger.sociobot.in/?demo=1> enters the same isolated
sample and replaces the address with `/demo`.

## Deployment and state

The product deploys as the existing `sf-internal-event-ledger` container app
through `/opt/fleet/lib/deploy-container.sh`, listening on `PORT=8080`. The
work-order `data_dir` is `/data`; the fleet-managed durable share remains
mounted there with one replica. No other product, shared database, staging
slot, or out-of-scope resource was read or changed.

## Known gaps and next steps

None for this work order.
