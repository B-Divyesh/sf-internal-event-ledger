# Internal Event Ledger — repair 5 handoff

## Outcome

All four release blockers from `.factory/verification-4.md` are repaired on `main`. The report was recorded in this clone by `8a3444d194cba4d09976acc6e3c2daaa11ab73ec` for candidate `a827da01604775ead0275e93e5f38c34354815dd`.

## Repairs

1. Added `.factory/claims.json` with 13 executable, independently filterable claim tests. `npm test` runs the complete claim suite.
2. Replaced the cold token-only page with a plain first screen for solo developers and small teams. **Try it with sample data** opens `/demo` in one click.
3. Added random in-memory demo workspaces with a 24-hour TTL, three sources, five event groups, reset/exit controls, and no administrator access. Demo browser state uses only `demo:internal-event-ledger:workspace`; production SQLite tables are never queried by demo routes.
4. Added a client token bucket before every `/api` request, including failed authentication, with `429` and `Retry-After: 1`. Ingest also has a pre-auth client allowance and retains its receiver/client quota. Demo creation has a stricter 10-workspace burst.
5. Added `robots.txt`, `sitemap.xml`, a styled `404.html`, custom unknown-route handling, route metadata, a 1200×630 social card, and a touch icon.
6. Preserved the authenticated receiver, review, export, retention, license, privacy, responsive, and PWA behavior that previously passed.

## Regression coverage

- Rust: 18 tests, including authenticated and anonymous management bursts, `Retry-After`, random demo isolation, production-table separation, workspace deletion, and the designed 404 response.
- Browser/runtime claims: 13 tests tagged `@claim:<id>` cover the demo, review workflow, administrator boundary, PORT-only self-hosting, retention, exports, privacy, offline reload, ingest safety, Free/Pro boundaries, response caching, and API limiting.
- Container contract: 3 tests, including discovery/error/social artifacts.
- Frontend: 4 helper tests.

## Local verification completed

- `npm ci`: 60 packages, 0 audit vulnerabilities.
- `npm test`: PASS — 4 Vitest + 3 Node contract + 18 Rust + 13 browser/runtime claim tests.
- `npx tsc --noEmit`: PASS.
- `cargo fmt --check`: PASS.
- `cargo clippy --locked --all-targets -- -D warnings`: PASS.
- `VITE_BUILD_SHA=repair-5-local npm run build`: PASS; `dist/` produced. Initial JS 40.87 KB raw / 12.99 KB gzip; CSS 17.62 KB raw / 4.82 KB gzip.
- `BUILD_SHA=repair-5-local cargo build --locked --release`: PASS.
- Release runtime with only `PORT` plus image-equivalent files: PASS; generated a 64-character token with mode `0600`, served `/`, and returned `{"build":"repair-5-local","status":"ok"}`.
- `npm run test:e2e`: PASS — source creation, receiver ingest, redaction, review, digest, legal route, checkout return, cleanup, and zero console errors.
- `npm run test:a11y`: PASS — zero Axe violations on landing, demo, Inbox, Sources, Digest, Settings, Privacy, and Terms at 1366px and 390px.
- Keyboard/mobile: PASS — skip link first, demo reachable and operable by Tab/Enter, visible solid focus outline, one h1/main, no horizontal overflow, five sample groups, and zero console errors at desktop and 390px.
- Offline/update: PASS — demo reload retained five groups offline; a worker update changed cache `ledger-shell-repair5-old` to `ledger-shell-repair5-new` and removed the old cache.
- Response policy: PASS — HTML and worker revalidate; hashed JS/CSS are immutable; CSP, HSTS, frame, referrer, MIME, and permissions headers are present. Local 180-request bursts produced authenticated `68×200/112×429` and anonymous `66×401/114×429`, both with `Retry-After: 1`.
- Discovery: `/robots.txt`, `/sitemap.xml`, `/demo`, `/privacy`, and `/terms` serve successfully. `/404.html` is a crawlable document; unknown paths return its content with 404.
- Load smoke: 100 concurrent `/health` requests returned 100×200 in 119 ms (840 requests/second observed locally).
- Lighthouse mobile: performance 99, accessibility 100, best practices 100, SEO 100; LCP 2.0 s, CLS 0, total blocking time 0 ms, transfer 124 KiB.

Evidence is under `.factory/evidence/repair-5-*` and `.factory/evidence/lighthouse-repair-5-local.json`.

## Deployment

Container deployment and final live SHA verification are recorded below after the release commit is built by ACR.

## Known gaps

Docker/Podman is not installed in the worker container, so the image cannot be built locally. The required factory ACR build is the container/package verification and must pass before this handoff is final.

The first ACR attempt (`ch1d0`) caught that Rust's compile-time 404 template was absent from the server-builder stage. The Dockerfile now copies that exact source asset, with a contract regression; the replacement cloud build is pending.
