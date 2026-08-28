# Internal Event Ledger

Internal Event Ledger is a calm, self-hosted review inbox for low-urgency operational webhooks. It is for solo developers and small product teams who need product, backend, and integration signals to remain searchable without turning a Slack channel into an unread queue.

It accepts private JSON endpoints, verifies optional HMAC-SHA256 signatures, applies header and nested body redaction before storage, groups repeats by fingerprint, and gives each group an unread, acknowledged, or archived state. It also provides a 24-hour digest, per-source retention deletion, and full JSON/CSV export.

This is not a pager, retrying webhook proxy, automation engine, or guaranteed-delivery system. Keep urgent alerts in an incident tool.

## Run with Docker

The smallest deployment uses the included Compose file and a persistent SQLite volume. Generate a long random administrator token and record the commit being deployed first; both values are mandatory:

```sh
export ADMIN_TOKEN="$(openssl rand -hex 32)"
export BUILD_SHA="$(git rev-parse HEAD)"
docker compose up --build -d
```

Open `http://localhost:8080`. The container runs as a non-root user and stores its database at `/data/ledger.db`. On first visit, enter `ADMIN_TOKEN` in the Administrator access screen. It is retained only for that browser tab.

To build and run the image directly:

```sh
docker build --build-arg BUILD_SHA="$(git rev-parse HEAD)" -t internal-event-ledger .
docker run --rm -e ADMIN_TOKEN="$(openssl rand -hex 32)" -p 8080:8080 -v ledger-data:/data internal-event-ledger
```

## Develop and verify

Requirements: Node 22+, npm 10+, and Rust 1.88+.

```sh
npm install
npm run dev          # frontend at http://localhost:5173, proxies the API
npm run dev:server   # backend at http://localhost:8080 (second terminal)
npm test             # frontend unit tests and Rust unit/integration tests
npm run build        # exact frontend build command; output is dist/
cargo build --locked --release
```

For a production-like local run:

```sh
npm run build
ADMIN_TOKEN='local-development-token' DATABASE_URL='sqlite://ledger.db?mode=rwc' cargo run --release
```

Configuration is environment-only:

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `8080` | HTTP listen port |
| `DATABASE_URL` | `sqlite://ledger.db?mode=rwc` | SQLite location |
| `STATIC_DIR` | `dist` | Built frontend location |
| `RUST_LOG` | JSON info logs | Tracing filter |
| `ADMIN_TOKEN` | required | High-entropy token required for all administrative browser and API access |
| `BILLING_API_BASE` | Sociobot production API | Server-side Pro license verification endpoint (override for staging) |
| `BUILD_SHA` | `dev` for native development | Compile-time `/health` identity; mandatory for container builds |

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

All management APIs, exports, event review, settings, retention, and licensing require `Authorization: Bearer $ADMIN_TOKEN`; receiver ingestion continues to use each source’s separate receiver token. The free tier supports five sources and 30-day source retention. A $39 one-time Pro license unlocks unlimited sources, longer retention, and custom digest windows. These limits are enforced by the server for direct API requests as well as the UI. When an administrator applies a license in Settings, the server verifies it with Sociobot and caches the verdict for up to 24 hours; an unavailable or invalid verification safely falls back to free limits. Checkout and verification use only the Sociobot billing API; no payment provider is embedded.

## Privacy and security

There are no analytics, trackers, third-party fonts, or runtime CDN assets. Operational data stays in the deployment’s SQLite database. A restored license is retained in browser local storage and, when applied, in the server database so the server can perform its daily verification. Read the in-product `/privacy` and `/terms` pages for the full notices.

Back up the `/data` volume and place the service behind HTTPS. The application itself enforces an administrator boundary; a reverse-proxy identity layer can be added as defense in depth. Ingest endpoints have individual high-entropy tokens; HMAC is recommended when the sender supports it. Hashed frontend assets are immutable-cached, HTML and `sw.js` revalidate, and a build-versioned worker immediately activates and reloads controlled clients after an update.

## License

MIT. See [LICENSE](LICENSE).
