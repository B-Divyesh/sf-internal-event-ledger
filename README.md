# Internal Event Ledger

Internal Event Ledger is a self-hosted record for reviewing low-priority webhook events.
It is for solo developers and small product teams. It keeps product, backend, and integration events searchable outside Slack.

It accepts JSON through private endpoints and can verify request signatures. It removes configured fields before storage. Matching events share a group with a clear review state.
It provides an on-demand digest, retention deletion, and JSON or CSV export.

Keep urgent alerts in an incident tool. This product is not a pager, retrying webhook proxy, automation engine, or guaranteed-delivery system.

## Try the isolated demo

Open `/demo` or choose **Try it with sample data** on the first screen. The server creates a random workspace with three sources and five event groups in a dedicated demo table.
It expires after 24 hours and never reads or writes the operator's source or event tables. **Reset demo** starts a clean sample. **Start for real** discards it before showing administrator access.

The browser keeps the sample in `demo:internal-event-ledger:workspace`. The demo remains readable offline after its first visit. No account or administrator token is needed.

## Run with Docker

Use the included Compose file for a local deployment. Local builds use `dev` as their build identity. On first boot, the service generates an administrator token if none is supplied.

```sh
docker compose up --build -d
docker compose exec ledger cat /data/internal-event-ledger/admin-token
```

Open `http://localhost:8080`. Run one app replica for each SQLite database. Enter the token in **Open your ledger**. It is retained only for that browser tab.

Set `ADMIN_TOKEN` to override generation. Set `BUILD_SHA` to stamp a release image.

To build and run the image directly:

```sh
docker build -t internal-event-ledger .
docker run --name internal-event-ledger -e PORT=8080 -p 8080:8080 -v ledger-data:/data internal-event-ledger
docker exec internal-event-ledger cat /data/internal-event-ledger/admin-token
```

Release builds should pass the source identity without relying on `.git`:

```sh
docker build --build-arg BUILD_SHA=<full-commit-sha> -t internal-event-ledger .
```

After deployment, verify the running release identity:

```sh
npm run verify:live-identity -- https://internal-event-ledger.sociobot.in <full-40-character-commit-sha>
```

## Develop and verify

Requirements: Node 22+, npm 10+, and Rust 1.88+.

```sh
npm ci
npm run dev          # frontend at http://localhost:5173, proxies the API
npm run dev:server   # backend at http://localhost:8080 (second terminal)
npm test             # frontend, Rust, container, and browser claim tests
npm run test:a11y    # builds and starts an isolated local accessibility server
npm run test:e2e     # builds and starts an isolated production-like browser smoke server
npm run build        # frontend build; output is dist/
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
| `DATABASE_URL` | `/data/internal-event-ledger/ledger-v2.sqlite3` in the image | Ledger SQLite location |
| `STATIC_DIR` | `dist` | Built frontend location |
| `RUST_LOG` | JSON info logs | Tracing filter |
| `ADMIN_TOKEN` | generated and persisted | Optional administrator access override |
| `ADMIN_TOKEN_FILE` | `.internal-event-ledger-data/admin-token` natively; `/data/internal-event-ledger/admin-token` in the image | Generated-token location |
| `BUILD_SHA` | `dev` | Compile-time `/health` identity |

## Receive events

Create a source in the Sources screen. Its receiver token is shown once. Each source has a separate receiver token.
Send it as `X-Ledger-Token`, an `Authorization: Bearer` token, or the `token` query parameter:

```sh
curl -X POST 'http://localhost:8080/ingest/deploys' \
  -H 'Content-Type: application/json' \
  -H 'X-Ledger-Token: YOUR_RECEIVER_TOKEN' \
  -d '{"type":"deploy.completed","summary":"Production deploy completed","version":"1.0.0"}'
```

If the source has a signing secret, also send `X-Ledger-Signature: sha256=HEX_HMAC`. Compute it over the exact raw request body.
An optional `X-Event-Fingerprint` controls grouping. Otherwise the ledger hashes source, event type, and summary.
A new event reopens an archived group. It preserves an acknowledged group.

Credential headers are always discarded. Configured headers and dot-separated JSON object paths are replaced with `[REDACTED]` before storage.

## Digest, retention, and export

- `GET /api/digest?hours=24` returns the active digest. The UI can copy it as plain text.
- `POST /api/maintenance/retention` deletes groups older than each source policy.
- `GET /api/export?format=json` and `?format=csv` export the complete current ledger.
- `GET /health` returns service status and build SHA.

The administrator token protects management APIs, exports, review, settings, and retention. Each source uses a separate token for incoming events.
A deployment can create more than five sources and retain each for up to 10 years. Digest windows range from 6 hours to 7 days.
These controls are enforced directly by the server and do not need a remote account.

## Privacy and security

There are no analytics, trackers, third-party fonts, runtime CDN assets, billing calls, or identity calls. Operational data stays in SQLite files under `/data/internal-event-ledger/`.
Read the in-product `/privacy` and `/terms` pages for the full notices. Back up the `/data` volume and place the service behind HTTPS.

Every API client is rate limited before authentication and receives `429` with `Retry-After` when limited. Valid receiver deliveries have a separate quota from invalid delivery attempts.
Hashed frontend assets are immutable-cached, while HTML and `sw.js` revalidate.

The product is free to self-host under the MIT License. The executable claim registry is [.factory/claims.json](.factory/claims.json). Run all claim sandboxes with `npm run test:claims`.

## License

MIT. See [LICENSE](LICENSE).
