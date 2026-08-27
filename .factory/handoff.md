# Internal Event Ledger — build handoff

## Shipped

- Rust 2021 `axum` service with SQLite migrations, JSON logging, graceful shutdown, `/health`, secure response headers, a 256 KB body cap, and a global ingest burst limit (120, replenishing at 1 request/second).
- Private per-source receiver tokens (stored as SHA-256 hashes), optional raw-body HMAC-SHA256 verification, automatic credential-header stripping, configured header/body-path redaction, and fingerprint-based repeat grouping.
- Searchable/filterable timeline with unread, acknowledged, reopened, and archived states; bulk acknowledgment/archive; expandable payload and retained-header inspection; per-source counts.
- Source creation/removal, one-time receiver credential display, source aliases, 1–30 day free retention and longer Pro options, explicit irreversible deletion confirmation, and manual retention enforcement.
- Live 24-hour digest with copyable text; verified Pro licenses can select 6-hour through 7-day windows. The saved daily review time is exposed for an operator routine/scheduler; v1 intentionally does not send email.
- Complete JSON and CSV export on the free tier.
- Sociobot one-time-purchase contract: production checkout link, query-string license capture and URL cleanup, local storage under `sb_license:internal-event-ledger`, optimistic cached unlock, daily background verification, invalid/revoked fallback, and paste-to-restore. No product ID or payment provider is embedded.
- Responsive, keyboard-operable art-deco transit control room interface with designed loading, empty, filter-empty, error, and offline states; `/privacy` and `/terms` are real server routes.
- Original Factory-generated dispatch poster, reviewed for artifacts and provenance, delivered as a 1200×800 61 KB WebP. Source and prompt sidecars are in `assets/src/`; design rationale is in `.factory/design.md`.
- Multi-stage non-root Dockerfile and Compose deployment with persistent `/data` volume. README documents operation, ingestion, signature format, redaction, limits, and deployment.

## Run and verify

```sh
npm install
npm test
npm run build
cargo build --locked --release
DATABASE_URL='sqlite://ledger.db?mode=rwc' STATIC_DIR=dist cargo run --release
```

Browser checks against the running service:

```sh
CHROMIUM_PATH=/path/to/chromium npm run test:e2e
CHROMIUM_PATH=/path/to/chromium npm run test:a11y
```

Verified on 2026-08-27:

- `npm test`: 3 frontend tests and 4 Rust unit/integration tests passed.
- `cargo clippy --all-targets -- -D warnings`: passed.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed; `dist/index.html` present.
- Browser E2E at 390×844: source creation → authenticated ingest → timeline → acknowledge → digest → direct privacy route passed; zero console errors.
- Factory `verify-url.sh` at 1366×900 and 390×844: title, `lang`, one `h1`, `main`, alt text, and button names passed; zero console errors. Screenshots and report are in `.factory/evidence/`.
- Axe 4.13 WCAG 2 A/AA, WCAG 2.1 AA, and best-practice scan: zero violations.
- Lighthouse 13.4.1 mobile: Performance 100, Accessibility 100, Best Practices 100, SEO 100. FCP 1.1 s, LCP 1.7 s, TBT 20 ms, CLS 0.
- Delivery budgets: initial JS 28.94 KB (9.77 KB gzip), CSS 12.86 KB (3.86 KB gzip), hero WebP 61 KB; no web fonts or third-party runtime scripts.
- Load smoke: 500 concurrent `/health` requests completed in 1,277 ms (~392 requests/second), all successful.
- Security behavior manually checked: an incorrect HMAC returns 401 and secure headers/CSP are present.

## Known gaps and operator notes

- Docker is not installed in the build worker, so the image definition was reviewed and the native release build was compiled, but `docker build` could not be executed here.
- This is a single-tenant self-hosted tool with no account system. Put the administrative UI behind HTTPS and reverse-proxy authentication when it is reachable outside a trusted network. Ingest itself always requires a high-entropy per-source token.
- The digest is an on-demand API/UI roll-up and copy target, not an email sender. An operator can call `/api/digest` from a scheduler if delivery is wanted.
- SQLite backups and reverse-proxy access logs are deployment-operator responsibilities; the application itself contains no analytics.
