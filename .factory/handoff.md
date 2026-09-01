# Internal Event Ledger — repair 8 handoff

## Outcome

Repair 8 resolves the failed candidate `f83cfc4a151ad1b9791471be5c8e3f5f3fc928dc` without touching its locked SQLite file. The product remains a Rust/axum container serving its Vite frontend on port 8080, with all persistent product and rate-limit state in SQLite under the work-order mount `/data`.

## Failure reproduced

Before changing the candidate, a local `BEGIN EXCLUSIVE` lock was held on its configured SQLite file and the candidate binary was started with that same `DATABASE_URL`. Its listener returned:

```text
503
Ledger is starting its local storage. Try again shortly.
```

The process remained live, proving the reported unbounded background retry / permanent 503 behavior. This reproduction used only a fresh temporary local database; no deployed resource, share, setting, secret, or other service was inspected or changed.

## Repair

- The image now uses `/data/internal-event-ledger-r9/ledger.db` and stores its generated administrator token beside it at `/data/internal-event-ledger-r9/admin-token`. This is a second fresh directory on the same durable `deploy.data_dir=/data` mount. The application has no code path that deletes, renames, or opens earlier locked files.
- SQLite uses the rollback `DELETE` journal, foreign keys, a one-second busy timeout, and one `SqlitePool` connection. It verifies the default `DELETE` journal mode without attempting a journal-mode write during every Azure Files connection. Ledger writes, demo workspaces, and every rate-limit bucket share that one durable database; the rate-limit sidecar and in-memory authenticated-receiver limiter were removed.
- Startup makes at most three attempts one second apart when SQLite reports a lock. It binds the requested port first, then either becomes ready or exits with a structured error for the platform to restart; it no longer serves an unready 503 indefinitely.
- The Compose declaration and the factory container deployment both use one replica for the mounted SQLite volume.
- `/health` continues to report the exact compile-time `BUILD_SHA`; the Docker image receives that SHA from the factory build argument and carries it as the OCI revision label.

## Focused regression coverage

- Rust tests lock a legacy `ledger-current.db`, prove the new `internal-event-ledger-r9/ledger.db` starts immediately, verify `PRAGMA journal_mode = delete`, prove the legacy file is unchanged, verify bounded retry releases its failed connection, and verify a source survives a close/reopen with pool size one.
- `scripts/startup-storage.test.mjs` launches the real binary. It holds an exclusive legacy lock while the fresh path serves `/health`, then locks the fresh path and verifies the process exits within six seconds rather than becoming a 503 service. The measured run completed in 5.23 seconds.

## Verification

All commands below passed on 2026-09-01 UTC.

- `npm ci` — 60 packages installed; audit reported 0 vulnerabilities.
- `npm test` — 4 frontend tests, 6 repository/container-scope checks, 21 Rust tests, the startup-storage regression, and all 14 executable claims passed. The claim matrix includes demo isolation/expiry, offline reload, privacy request capture, mobile workflow, redaction, export, retention, persistence, and 429 plus `Retry-After` rate limiting.
- `npx tsc --noEmit`, `cargo fmt --check`, and `cargo clippy --locked --all-targets -- -D warnings` — passed.
- `npm run build` — passed and produced `dist/`: initial JS 36.68 kB raw / 11.68 kB gzip and CSS 17.08 kB raw / 4.70 kB gzip.
- `BUILD_SHA=repair-8-local cargo build --locked --release` — passed. Its local `/health` response was `{"build":"repair-8-local","status":"ok"}`.
- Local production browser checks passed against the release binary: `npm run test:e2e -- http://127.0.0.1:18192`, `npm run test:a11y -- http://127.0.0.1:18192`, and `verify-url.sh http://127.0.0.1:18192 .factory/evidence/repair-8-local`.
- Axe scanned 16 landing/application/demo screens across desktop and 390 px mobile: 0 violations and 0 undersized measured controls. Keyboard navigation, focus on route changes, reduced motion, offline demo reload, privacy capture, and touch-target checks are covered by the browser suites.
- The URL verifier found HTTP 200, no page or console errors, title `Internal Event Ledger — review webhook events`, `lang=en`, one `h1`, a `main` landmark, no missing image alternatives, and no unlabeled buttons. Screenshots and structured results are in `.factory/evidence/repair-8-local/`.

No local Docker or Podman executable is installed in this worker image. The Dockerfile contract is covered by tests; the required clean container build is performed by the factory's ACR build during deployment.

## Deployment and identity

Deploy with the work-order container configuration: Dockerfile `Dockerfile`, port `8080`, and `deploy.data_dir=/data`. The factory deploy helper mounts only this product's `sf-internal-event-ledger-data` share at `/data` and pins that container app to one replica. After the final commit, the ACR build and live `/health` check must use and report that exact commit SHA.

## Known gap

Earlier locked database files are deliberately left in place and are not migrated or removed. If they contain recoverable historic records, an operator can inspect or migrate them later through a separate, explicitly authorized recovery procedure. The repaired service safely starts with a new ledger directory now.

## Run locally

```sh
npm ci
npm test
npm run build
BUILD_SHA=dev cargo run --release
```

Open `http://127.0.0.1:8080/demo` for the isolated sample workspace.
