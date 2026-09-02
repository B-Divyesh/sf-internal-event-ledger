# Internal Event Ledger — verification 7 handoff

## Outcome: FAIL — candidate is not deployed

Candidate `5c7523f15c39a5655051a7800f7719b313558420` was independently verified on 2026-09-02 UTC. Its local product checks pass, but it must **not** be accepted or described as release-ready: the live production URL still serves build `5a15c977709b65e99171de3eb506c662cae30f43`.

The required live/candidate identity check is therefore a release blocker. No product code, infrastructure, DNS, deployment, storage, or secrets were changed by this verifier.

## What passed locally

- Clean `npm ci` installed 60 packages with zero audit vulnerabilities.
- All 14 literal commands in `.factory/claims.json` passed separately through the demo entry point; `npm test` also passed (4 frontend, 6 container/scope, 21 Rust, 2 storage, and all 14 claims).
- Candidate-stamped production builds passed: `VITE_BUILD_SHA=5c7523f15c39a5655051a7800f7719b313558420 npm run build` and `BUILD_SHA=5c7523f15c39a5655051a7800f7719b313558420 cargo build --locked --release`. The release binary's `/health` returned the candidate SHA.
- Axe had zero serious/critical findings across loading, landing, authenticated views, legal pages, and demo at 1366px and 390px. Browser smoke passed at both sizes, including keyboard skip link, source creation, ingest, acknowledgement, digest, Privacy, and zero console errors.
- The candidate demo made only same-origin requests. Shell and service worker revalidate; hashed assets are immutable. The initial JS is 36,874 bytes raw / 11.75 KB gzip and CSS is 17,075 bytes raw / 4.70 KB gzip.
- A 120-request one-client management burst observed 60 responses at 401 followed by 60 at 429, all rate-limited responses carrying `Retry-After: 1`.

## Live result and next step

- Cold 390px live first read passes: it says it reviews operational events without Slack noise, names solo developers/small teams, and exposes one-click **Try it with sample data** with an explanation of what opens.
- Live `/health` returned `{"build":"5a15c977709b65e99171de3eb506c662cae30f43","status":"ok"}`. Its JavaScript asset was `index-DyrVZexg.js`; the candidate-stamped build produces `index-ekgueQAN.js`.
- Redeploy the exact candidate image through the factory workflow, then verify live `/health` reports `5c7523f15c39a5655051a7800f7719b313558420` and repeat the live loading-state Axe scan.

See `.factory/verification-7.md` for the complete evidence and severity-ranked finding.

## Run locally

```sh
npm ci
npm test
VITE_BUILD_SHA=5c7523f15c39a5655051a7800f7719b313558420 npm run build
BUILD_SHA=5c7523f15c39a5655051a7800f7719b313558420 cargo build --locked --release
```

For browser a11y/smoke scripts, start the backend with `PORT=8080 npm run dev:server` first, then run `npm run test:a11y` and `npm run test:e2e`.
