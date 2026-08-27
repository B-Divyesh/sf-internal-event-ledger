# Internal Event Ledger

Internal Event Ledger is a calm, self-hosted review inbox for low-urgency operational webhooks. It is for solo developers and small product teams who need product, backend, and integration signals to remain searchable without turning a Slack channel into an unread queue.

It accepts private JSON endpoints, verifies optional HMAC-SHA256 signatures, applies header and nested body redaction before storage, groups repeats by fingerprint, and gives each group an unread, acknowledged, or archived state. It also provides a 24-hour digest, per-source retention deletion, and full JSON/CSV export.

This is not a pager, retrying webhook proxy, automation engine, or guaranteed-delivery system. Keep urgent alerts in an incident tool.

## Run with Docker

The smallest deployment uses the included Compose file and a persistent SQLite volume:

```sh
docker compose up --build -d
```

Open `http://localhost:8080`. The container runs as a non-root user and stores its database at `/data/ledger.db`.

To build and run the image directly:

```sh
docker build -t internal-event-ledger .
docker run --rm -p 8080:8080 -v ledger-data:/data internal-event-ledger
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
DATABASE_URL='sqlite://ledger.db?mode=rwc' cargo run --release
```

Configuration is environment-only:

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `8080` | HTTP listen port |
| `DATABASE_URL` | `sqlite://ledger.db?mode=rwc` | SQLite location |
| `STATIC_DIR` | `dist` | Built frontend location |
| `RUST_LOG` | JSON info logs | Tracing filter |
| `BUILD_SHA` | `dev` | Value reported by `/health` when set at compile time |

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

The free tier supports five sources and 30-day source retention in the UI. A $39 one-time Pro license unlocks unlimited sources, longer retention, and custom digest windows. Checkout and verification use only the Sociobot billing API; no payment provider is embedded.

## Privacy and security

There are no analytics, trackers, third-party fonts, or runtime CDN assets. Operational data stays in the deployment’s SQLite database. The browser only stores a Sociobot license token/verdict when Pro is used. Read the in-product `/privacy` and `/terms` pages for the full notices.

Back up the `/data` volume, place the service behind HTTPS, and restrict administrative UI access at your reverse proxy when exposing it outside a trusted network. Ingest endpoints have individual high-entropy tokens; HMAC is recommended when the sender supports it.

## License

MIT. See [LICENSE](LICENSE).
