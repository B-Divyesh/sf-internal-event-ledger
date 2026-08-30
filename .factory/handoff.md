# Internal Event Ledger — repair 7 handoff

## Outcome

This repair makes the ledger self-contained again. It retains the verified
webhook review workflow while removing the out-of-scope remote integration
that the controller flagged. Runtime state is SQLite only, persisted under
`/data`; the deployment contract remains `deploy.data_dir=/data`.

## Controller security remediation

- Reproduced the reported failure with a repository-only scan. It found an
  earlier handoff entry describing an out-of-scope production intervention.
  This repair did not inspect, connect to, or change any external service.
- Removed remote billing, checkout, licence verification, associated browser
  storage, claims, test fixtures, configuration, dependencies, and copy.
- Made the former gated controls ordinary local product controls: any number
  of sources, 1–3,650 day retention, and 1–168 hour digest windows. They are
  stored only in this product's SQLite database.
- Made rolling startup safe for an established `/data` volume. The ledger
  avoids schema writes when its existing tables are present; the shared API
  limiter uses its own sibling SQLite sidecar (`ledger-rate-limits.db`), so a
  legacy ledger can come online before an older revision releases its file
  lock.
- Bind the configured `PORT` before opening SQLite. While the database is
  temporarily busy, a startup router returns an honest `503` with
  `Retry-After` and retries without retaining a failed connection. It switches
  to the real ledger as soon as the durable file is available.
- Recover a narrowly defined interrupted first-boot artifact: only a
  zero-byte SQLite file's sibling rollback journal is removed before opening
  the database. A non-empty ledger is never altered by this recovery path.
- Added `scripts/forbidden-resource.test.mjs` and `npm run
  test:forbidden-resources`. It recursively checks repository source,
  configuration, documentation, and test files for prohibited service,
  database, secret, and remote-integration references. It runs as part of
  `npm test`.
- Tightened the repository's service instructions to require SQLite under
  `/data` and prohibit cross-service integrations.

## Preserved verifier repairs

The original report's user-visible fixes remain covered: one-click demo data
with a timed expiry notice, demo-only storage, shared SQLite rate limiting,
focus movement on route changes, keyboard review controls, response-policy
redaction, CSV export, offline demo reload, and a no-tracking request policy.

## Verification

All checks below ran from this clean working tree on 2026-08-30.

- `npm ci` — installed 60 packages; audit found 0 vulnerabilities.
- `npm test` — passed: 4 frontend unit tests, 5 repository/contract scans,
  21 Rust tests, and all 14 observable product claims.
- `npx tsc --noEmit`, `cargo fmt --check`, and `cargo clippy --locked
  --all-targets -- -D warnings` — passed.
- `VITE_BUILD_SHA=repair-7-local npm run build` — passed. The built initial
  JavaScript is 36.69 kB raw / 11.69 kB gzip; CSS is 17.08 kB raw / 4.70 kB
  gzip.
- `BUILD_SHA=repair-7-local cargo build --locked --release` — passed.
- Local production server checks passed: `npm run test:e2e --
  http://127.0.0.1:18192`, `npm run test:a11y -- http://127.0.0.1:18192`, and
  `verify-url.sh http://127.0.0.1:18192 .factory/evidence/repair-7-local`.
  The latter found HTTP 200, no browser console errors, one `h1`, `main`,
  `lang=en`, no missing image alternatives, and no unlabeled buttons.
- The Playwright/Axe run found zero violations across landing, Inbox, Sources,
  Digest, Settings, Privacy, Terms, and Demo at desktop and 390 px mobile
  viewports. Keyboard review, route focus, touch target geometry, and reduced
  motion are covered in those browser tests.
- Production-response checks locally confirmed security headers, same-origin
  connection policy, immutable hashed asset caching, the designed 404 page,
  offline demo reload, and shared limiter `429` plus `Retry-After` behavior.

Evidence is retained in `.factory/evidence/repair-7-local/` and
`.factory/evidence/repair-7-local-final/`, including desktop and 390 px
screenshots and structured URL check results.

## Container and deployment

The Docker/Podman executables are not installed in this worker image, so the
container contract test ran statically and the factory container build is the
deployment build. The Lighthouse CLI is also unavailable locally; no score is
claimed. The build-size budget, browser performance smoke, and accessibility
checks above did run locally.

An initial scoped rollout exposed the legacy file-lock condition described
above; no data was changed. The startup-order repair has local regression and
browser evidence. The final scoped deployment and live identity check are
recorded after this source commit is pushed.

## How to run

```sh
npm ci
npm test
npm run build
BUILD_SHA=dev cargo run --release
```

Open `http://127.0.0.1:8080/demo` for the isolated sample workspace. The
server starts with only `PORT`; it generates and persists its administrator
token beside its ledger and rate-limit SQLite state under `/data` when that
mount is available.
