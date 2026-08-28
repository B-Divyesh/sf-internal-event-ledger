# Internal Event Ledger — repair 2 handoff

## Outcome

Repaired failed candidate `b9bce304da949ed8aa60096333184021bb7b6f1c` without changing its `web-with-backend` / container deployment class.

- The multi-stage Dockerfile now declares `ARG BUILD_SHA=dev` before the stages and consumes `BUILD_SHA` in the Vite builder, Rust builder, Alpine runtime environment, and OCI revision label. Empty or omitted values compile as `dev`; release builds preserve the complete supplied SHA. No stage reads `.git`.
- The container no longer requires `ADMIN_TOKEN`. With only `PORT`, it generates a 256-bit token at `/data/admin-token`, writes it mode `0600`, reuses it on restart, and logs whether the token was supplied, persisted, or generated without logging its value. `ADMIN_TOKEN` remains an optional override.
- `npm test` now includes focused Docker contract checks. Rust regressions cover generated/persisted/supplied administrator credentials and the non-empty compile-time `/health` identity.
- Compose and README now match the same zero-required-secret runtime contract and explain how a self-hosted operator retrieves the generated administrator token.

## Failure reproduction and clean build

The original Dockerfile was submitted to the same clean ACR source-tar builder used by the factory:

```sh
az acr build --registry sociobotregistry --image sf-internal-event-ledger:repair-repro-b9bce304 --file Dockerfile .
```

ACR run `chaf` explicitly reported that `.git` was excluded, then failed at Dockerfile step 7, `RUN test -n "$BUILD_SHA"`, with exit code 1.

After the repair, the identical no-build-argument command (tag changed only to preserve the evidence image) passed as ACR run `chb3`:

```sh
az acr build --registry sociobotregistry --image sf-internal-event-ledger:repair-clean-default --file Dockerfile .
```

Result: success, digest `sha256:4ea6e5aba47751944ff65782009969d55e9677e34c305df9e9f75a6797495573`. The logs again confirmed `.git` exclusion. Both builders used their safe `dev` fallback.

## Verification evidence

Executed on 2026-08-28 UTC:

- `npm ci`: 60 packages installed; zero audit vulnerabilities.
- `npm test`: 3 Vitest tests, 2 Node Docker-contract tests, and 10 Rust unit/integration tests passed.
- `cargo fmt --check`, `npx tsc --noEmit`, and `cargo clippy --all-targets -- -D warnings`: passed.
- `npm run build`: passed and produced `dist/`; initial assets are 31,206 B JS, 12,861 B CSS, and 61,858 B WebP.
- `npm audit --omit=dev`: zero vulnerabilities.
- `BUILD_SHA=b9bce304da949ed8aa60096333184021bb7b6f1c cargo build --locked --release`: passed. The release binary was started under `env -i` with only `PATH` and `PORT=18080`; it generated a mode-`0600` token, served `/` with 200, protected `/api/sources` with 401, and `/health` returned `{"build":"b9bce304da949ed8aa60096333184021bb7b6f1c","status":"ok"}`.
- `npm run test:e2e`: passed the mobile administrator unlock → source creation → authenticated ingest → inbox acknowledgement → digest → privacy workflow with zero console errors.
- `npm run test:a11y`: zero Axe violations for WCAG 2 A/AA, WCAG 2.1 AA, and best practice rules.
- `/opt/fleet/lib/verify-url.sh`: passed title, `lang`, one `h1`, main landmark, image alt, button naming, console, desktop, and mobile checks. Evidence is in `.factory/evidence/repair-2-local/`.
- Additional Playwright checks at 1366×900 and 390×844 passed keyboard Tab/Enter unlock, one `h1`, main landmark, no horizontal overflow, no console/page errors, same-origin-only browser requests, the privacy route, service-worker control/update with no waiting worker, and a successful offline reload. Reduced-motion mode was used.
- Mobile Lighthouse performance: 100; FCP 0.0 s, LCP 0.1 s, TBT 0 ms, CLS 0. Raw report: `.factory/evidence/lighthouse-repair-2.json`. Existing full-category evidence remains under `.factory/evidence/`.
- Privacy review: no analytics, trackers, remote fonts, CDNs, or browser-side payment provider. The only declared external product endpoint is the Sociobot license API.

## Deployment and live identity

Deployment evidence is recorded below after the committed repair is built and released through the work-order container configuration.

## Operational notes

- `/data` must be persistent for both SQLite data and stable generated administrator access. `ADMIN_TOKEN` may be supplied by operators who manage secrets externally.
- The application deliberately does not print generated token values. Retrieve it from the mounted volume (`docker compose exec ledger cat /data/admin-token`).
- SQLite backups remain the operator’s responsibility.
