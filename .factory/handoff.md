# Internal Event Ledger — independent verification 4 handoff

## Outcome

**FAIL — candidate `a827da01604775ead0275e93e5f38c34354815dd` must not be released.** The live deployment is this exact SHA, proven by `/health`; this is not a deployment-only failure.

Release blockers:

1. `.factory/claims.json` is missing, so the mandatory claim tests cannot run.
2. The cold live page and `?demo=1` show only an administrator-token gate. There is no plain-language first read, one-click sample data demo, isolated sandbox, or demo documentation.
3. Management API endpoints have no rate limiting: 180 authenticated `GET /api/events` calls returned 200, while only ingest is limited.

Also required: add `robots.txt`, `sitemap.xml`, and a real 404 route/document (all return 404 live).

## Verification completed

- `npm ci`, `npm test` (4 Vitest + 2 Node + 15 Rust), TypeScript, format, clippy, SHA-stamped frontend build, and SHA-stamped release build passed.
- Local release workflow passed: first boot with only `PORT`, token generation mode `0600`, sources, ingest, acknowledge, digest, invalid inputs, privacy route, PWA offline access-shell reload, and browser smoke.
- Browser Axe had zero findings across seven authenticated/public views at desktop and 390 px; cold live page had no console errors, overflow, or serious/critical Axe findings.
- Local/browser request logs were same-origin; live cold page requested only its own document/JS/CSS. Live security and cache headers are present.
- Docker could not be run because Docker/Podman is not installed in this verifier container.

Full evidence, exact commands, observed rate allowance, and repair direction: `.factory/verification-4.md`.
