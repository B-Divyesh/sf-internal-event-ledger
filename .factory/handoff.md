# Internal Event Ledger — repair 10 handoff

## Outcome

**Release-ready.** This repair resolves the sole release blocker in independent verification 6 for candidate `2d241143dac3a5a0ba53c996f488042d72ce7c41`: Axe reported `aria-prohibited-attr` with serious impact while the live demo skeleton was on screen.

## Repair and regression coverage

- The demo loading skeleton is now a named `role="status"` live region. Its `aria-label="Loading events"` is therefore used on a valid role, while the three purely visual skeleton blocks are hidden from assistive technology.
- The exact unfixed behavior was reproduced against a clean candidate-stamped release build by intercepting `POST /api/demo`, delaying its response, and scanning the visible skeleton. Axe returned the reported serious `aria-prohibited-attr` error on `.event-list`.
- `scripts/axe.mjs` now deliberately delays `POST /api/demo` in a fresh service-worker-blocked context, waits for `getByRole('status', { name: 'Loading events' })`, and scans that loading state before releasing the sample response. This runs at both 1366×900 and 390×844 in `npm run test:a11y`.
- The repaired delayed scan returned zero violations. The full Axe run recorded 18 zero-violation scans: loading state, landing, six authenticated views, and settled demo at each viewport.

## Local verification

All checks passed on 2026-09-01 UTC from a clean `npm ci` install.

- `npm test` — 4 frontend, 6 container/scope, 21 Rust, 2 real-process storage, and all 14 claim tests passed.
- `npx tsc --noEmit`, `cargo fmt --check`, `cargo clippy --locked --all-targets -- -D warnings`, and `npm audit --omit=dev` passed; audit reported zero vulnerabilities.
- `VITE_BUILD_SHA=repair-10-local npm run build` and `BUILD_SHA=repair-10-local cargo build --locked --release` passed. The built JavaScript is 36.85 KB raw / 11.71 KB gzip; CSS is 17.08 KB raw / 4.70 KB gzip.
- `npm run test:a11y -- http://127.0.0.1:18192` passed with the delayed demo-loading regression at desktop and 390px. `/opt/fleet/lib/verify-url.sh http://127.0.0.1:18192 .factory/evidence/repair-10-local` passed: HTTP 200, title, `lang=en`, one `h1`, `main`, complete alt text/button labels, and no browser errors.
- Browser smoke passed at 1366×900 and 390×844: skip-link keyboard behavior, administrator access, source creation, signed ingest, redaction, acknowledge, digest, Privacy route, and zero console errors.
- The claim registry passed all 14 exact commands, including offline demo reload/service-worker control, same-origin-only privacy capture, cache/response policy, demo expiry/isolation, exports, retention, ingest safety, and shared API rate limiting.
- Mobile Lighthouse passed with Performance 99, Accessibility 100, Best Practices 100, SEO 100; FCP 1.3 s, LCP 2.1 s, TBT 0 ms, CLS 0. Raw report: `.factory/evidence/repair-10-local/lighthouse-mobile.json`.

## Deployment

Deploy the committed repair with the work-order configuration only:

```sh
WO_DATA_DIR=/data /opt/fleet/lib/deploy-container.sh internal-event-ledger /work/repo Dockerfile 8080
```

The container remains the same Rust/axum and Vite artifact class. It starts with only `PORT`, stores durable state under `/data/internal-event-ledger/`, runs non-root, and exposes `/health` with its build SHA. Live deployment identity is checked by comparing that SHA with the pushed commit.

## Evidence and known gaps

- Local browser verification artifacts: `.factory/evidence/repair-10-local/`.
- No local Docker/Podman/Buildah/Nerdctl executable was available. The factory ACR build and post-deploy health check provide the container proof.
- No product gaps remain from verification 6. No other service, database, vault, storage share, or secret was read or changed.

## Run locally

```sh
npm ci
npm test
npm run build
BUILD_SHA=dev cargo run --release
```

Open `http://127.0.0.1:8080/demo` for the isolated sample ledger.
