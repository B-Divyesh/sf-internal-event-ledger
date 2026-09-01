# Internal Event Ledger

Internal Event Ledger is a calm, self-hosted review inbox for low-urgency operational webhooks. It is for solo developers and small product teams who need product, backend, and integration signals to remain searchable without turning a Slack channel into an unread queue.

It accepts private JSON endpoints, verifies optional HMAC-SHA256 signatures, applies header and nested body redaction before storage, groups repeats by fingerprint, and gives each group an unread, acknowledged, or archived state. It also provides a 24-hour digest, per-source retention deletion, and full JSON/CSV export.

This is not a pager, retrying webhook proxy, automation engine, or guaranteed-delivery system. Keep urgent alerts in an incident tool.

## Try the isolated demo

Open `/demo` or choose **Try it with sample data** on the first screen. The server creates a random workspace with three sources and five grouped events in a dedicated demo table. It expires after 24 hours and never reads or writes the operator's source or event tables. **Reset demo** starts a clean sample, and **Start for real** discards it before showing administrator access.

The browser keeps the sample in the separate `demo:internal-event-ledger:workspace` namespace, so `/demo` remains readable offline after its first visit. No account or administrator token is needed.

## Run with Docker

The smallest deployment uses the included Compose file and a persistent SQLite volume. The build identity defaults to `dev` locally, and the service generates a 256-bit administrator token on first boot when one is not supplied:

```sh
docker compose up --build -d
docker compose exec ledger cat /data/internal-event-ledger/admin-token
```

Open `http://localhost:8080`. The container runs as a non-root user and stores its ledger database, rate-limit state, and generated administrator token in the stable `/data/internal-event-ledger/` directory. Earlier numbered repair files are never opened, deleted, or renamed. The mounted deployment runs one replica with one SQLite connection, normal statement-scoped locks, and SQLite's rollback `DELETE` journal. Enter the token in **Open your ledger**; it is retained only for that browser tab. Set `ADMIN_TOKEN` to override generation, and set `BUILD_SHA` to stamp a release image.

To build and run the image directly:

```sh
docker build -t internal-event-ledger .
docker run --name internal-event-ledger -e PORT=8080 -p 8080:8080 -v ledger-data:/data internal-event-ledger
docker exec internal-event-ledger cat /data/internal-event-ledger/admin-token
```

Release builds should pass the full source identity without relying on `.git`: `docker build --build-arg BUILD_SHA=<full-commit-sha> ...`.

## Develop and verify

Requirements: Node 22+, npm 10+, and Rust 1.88+.

```sh
npm ci
npm run dev          # frontend at http://localhost:5173, proxies the API
npm run dev:server   # backend at http://localhost:8080 (second terminal)
npm test             # frontend, Rust, container, and browser claim tests
npm run build        # exact frontend build command; output is dist/
cargo build --locked --release
```

For a production-like local run:

```sh
npm run build
PORT=8080 cargo run --release
```

Configuration is environment-only:

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `8080` | HTTP listen port |
| `DATABASE_URL` | `/data/internal-event-ledger/ledger-v2.sqlite3` in the image | Ledger SQLite location; rate-limit state shares this database and uses SQLite's cross-process dot-file locks |
| `STATIC_DIR` | `dist` | Built frontend location |
| `RUST_LOG` | JSON info logs | Tracing filter |
| `ADMIN_TOKEN` | generated and persisted | Optional high-entropy override for administrative browser and API access |
| `ADMIN_TOKEN_FILE` | `.internal-event-ledger-data/admin-token` natively; `/data/internal-event-ledger/admin-token` in the image | Generated-token location |
| `TRUSTED_PROXY_IPS` | private/loopback ingress peers | Extra comma-separated proxy IPs whose first `X-Forwarded-For` address is used for client rate limiting |
| `BUILD_SHA` | `dev` | Compile-time `/health` identity; release builds pass the full commit SHA as a build argument |

## Receive events

Create a source in the Sources screen. Its receiver token is shown once. Send it as `X-Ledger-Token`, an `Authorization: Bearer` token, or the `token` query parameter (headers are preferred):

```sh
curl -X POST 'http://localhost:8080/ingest/deploys' \
  -H 'Content-Type: application/json' \
  -H 'X-Ledger-Token: YOUR_ONE_TIME_TOKEN' \
  -d '{"type":"deploy.completed","summary":"Production deploy completed","version":"1.0.0"}'
```

If the source has a signing secret, also send `X-Ledger-Signature: sha256=HEX_HMAC`, computed over the exact raw request body. An optional `X-Event-Fingerprint` controls grouping; otherwise the ledger hashes source, event type, and summary. A new arrival reopens an archived group but preserves an acknowledged group.

Credential headers (`Authorization`, `Cookie`, ledger token, and signature) are always discarded. Configured headers and dot-separated JSON object paths are replaced with `[REDACTED]` before insertion.

## Digest, retention, and export

- `GET /api/digest?hours=24` returns the active digest; the UI can copy it as plain text. The saved review time is a scheduling hint, not outbound email.
- `POST /api/maintenance/retention` deletes groups older than each source’s policy.
- `GET /api/export?format=json` and `?format=csv` export the complete current record and are never paywalled.
- `GET /health` returns service status and build SHA.

All management APIs, exports, event review, settings, and retention require `Authorization: Bearer $ADMIN_TOKEN`; receiver ingestion continues to use each source’s separate receiver token. A deployment can create more than five sources, retain each source for up to 10 years, and choose digest windows from 6 hours to 7 days. These controls are enforced directly by the server and do not need a remote account or service.

## Privacy and security

There are no analytics, trackers, third-party fonts, runtime CDN assets, billing calls, or identity calls. Operational data stays in the deployment’s SQLite files under `/data/internal-event-ledger/`. Read the in-product `/privacy` and `/terms` pages for the full notices.

Back up the `/data` volume and place the service behind HTTPS. The application itself enforces an administrator boundary; a reverse-proxy identity layer can be added as defense in depth. Ingest endpoints have individual high-entropy tokens; HMAC is recommended when the sender supports it. Every API client is rate limited before authentication and receives `429` with `Retry-After` when the allowance is spent. Authenticated deliveries also have a separate receiver quota, so unauthenticated traffic cannot spend it. Private and loopback ingress peers use the first forwarded address; public peers must be listed in `TRUSTED_PROXY_IPS`. Hashed frontend assets are immutable-cached, while HTML and `sw.js` revalidate.

The executable claim registry is [.factory/claims.json](.factory/claims.json). Run all claim sandboxes with `npm run test:claims`.

## License

MIT. See [LICENSE](LICENSE).
