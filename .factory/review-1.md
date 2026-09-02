# Adversarial first-read review 1 — Internal Event Ledger

Reviewed 2 September 2026 against repository base
`06e1a1cec0c42cb9e781e1450ad3695f0bb44c73` and the live site at
<https://internal-event-ledger.sociobot.in>.

## Verdict

**FAIL** — 35 findings remain: 19 major and 16 minor. No registered claim test
failed, and no first-screen or demo defect met the review's explicit BLOCKING
conditions. PASS still requires zero findings and no untested claim.

## Cold first screen

Fresh Chromium contexts were opened without scrolling at 390×844 and
1440×900.

| Question | Answer from the first screen | Result |
| --- | --- | --- |
| What does this do? | It collects webhook events into a searchable ledger for deliberate review outside Slack. | Clear |
| For whom? | Solo developers and small teams. | Clear |
| What should I click first? | **Try it with sample data**. The adjacent text says it opens an isolated sample without a token. | Clear |

The exact copy that supplied those answers was “Review operational events
without Slack noise,” “For solo developers and small teams that need searchable
webhook history without another urgent inbox,” and “Try it with sample data.”
All three were visible before scrolling at both widths. The first screen still
has the fact-list defect in F-1-1 and the metaphor defect in F-1-20.

## Findings

### Major

#### F-1-1 — The first screen omits required offline and price facts

- Location/quote: landing fact list — “Self-host on your own server.”, “No
  analytics or third-party scripts.”, “All core controls stay local.”
- Why: the required three facts must cover privacy, offline use, and price.
  Two current lines restate local hosting/privacy, while neither price nor
  offline demo behavior is disclosed. The brief also says `freemium`, but the
  page contains no price or pricing section.
- Fix: use tested facts such as “No analytics or third-party scripts.”, “The
  sample stays readable offline after one visit.”, and “Free to self-host under
  the MIT License.” Add a claim entry/test for the price statement and explain
  any paid tier with its exact price, or change the brief if no paid tier exists.

#### F-1-2 — The designed 404 omits route metadata and the standard footer

- Location/quote: live `/does-not-exist`; `<title>` is present, but meta
  description, canonical, Open Graph, Twitter card, and apple-touch icon are
  absent. Its footer only says “Built by Param Factory.”
- Why: the 404 is visually designed, but it does not meet the metadata or
  consistent-footer contract and provides no Privacy or Terms links.
- Fix: add the missing metadata and the standard one-line description,
  Privacy, Terms, build ID, and artwork provenance to `404.html`.

#### F-1-3 — Route navigation is exposed as buttons

- Location/quote: demo sidebar controls “Inbox”, “Sources”, “Digest”, and
  “Settings” are `<button data-route>` elements even though they change the URL.
- Why: destinations must be links so link semantics, context menus, copying,
  and opening in another tab work. The History API and focus behavior otherwise
  work.
- Fix: render `<a href="/demo/sources">`-style links (and non-demo equivalents),
  optionally intercept normal clicks for client-side navigation.

#### F-1-4 — “Daily review time” does not produce a daily action

- Location/quote: README — “The saved review time is a scheduling hint, not
  outbound email.” Settings exposes “Daily review time” and “Save review time.”
- Why: the brief calls for a daily digest, but saving the time has no visible
  consequence. A normal user can reasonably expect a reminder or scheduled
  digest from that control.
- Fix: either make the saved time drive an in-app due state and direct link to
  the current digest, with a claim test, or remove the inert setting and call
  the feature an “On-demand digest.” An AI feature is not warranted here.

#### F-1-5 — The product-boundary claim is unlisted

- Location/quote: landing and README — “This ledger does not page people, retry
  webhooks, or guarantee delivery.”
- Why: visitors rely on this safety boundary, but `.factory/claims.json` has no
  entry for it.
- Fix: add a `scope-boundary` claim and an executable test for the deliberately
  unsupported retry/delivery behavior, or narrow the sentence to usage advice.

#### F-1-6 — The Compose-volume claim is unlisted

- Location/quote: README — “The smallest deployment uses the included Compose
  file and a persistent SQLite volume.”
- Why: this is an operational promise without a claims entry.
- Fix: list it and run a clean Compose persistence test, or describe the
  Compose file as an example without promising persistence.

#### F-1-7 — Container identity and storage claims are unlisted

- Location/quote: README — “The container runs as a non-root user and stores
  its ledger database, rate-limit state, and generated administrator token in
  the stable `/data/internal-event-ledger/` directory.”
- Why: the separate container contract test is not named in `claims.json`, so
  the public claim is absent from the required registry.
- Fix: register a container test that verifies UID, exact files, and persistence
  across restart; split the sentence as in the copy audit.

#### F-1-8 — SQLite concurrency details are unlisted and unexplained

- Location/quote: README — “The mounted deployment runs one replica with one
  SQLite connection, normal statement-scoped locks, and SQLite's rollback
  `DELETE` journal.”
- Why: this is a specific operational guarantee without a claims entry, and
  “statement-scoped locks” is unexplained jargon.
- Fix: write “Run one app replica for each SQLite database.” Put journal/lock
  details in an operator note and register the behavior actually guaranteed.

#### F-1-9 — The one-time receiver-token claim is unlisted

- Location/quote: README — “Its receiver token is shown once.”
- Why: `@claim:ingest-safety` creates a source through the API but does not
  verify one-time display in the UI.
- Fix: add a claim/test that creates a source, observes the token once, reloads,
  and confirms it is not shown again.

#### F-1-10 — Three receiver-authentication modes are unlisted

- Location/quote: README — “Send it as `X-Ledger-Token`, an `Authorization:
  Bearer` token, or the `token` query parameter (headers are preferred).”
- Why: the current claim test exercises only `X-Ledger-Token`.
- Fix: list this claim and test all three modes, including rejection of an
  invalid token, or document only the tested header.

#### F-1-11 — Reopen-state behavior is unlisted

- Location/quote: README — “A new arrival reopens an archived group but
  preserves an acknowledged group.”
- Why: no claim entry or claim test verifies either transition.
- Fix: add a state-transition claim with both cases in a fresh database.

#### F-1-12 — Credential-discard coverage is narrower than the copy

- Location/quote: README — “Credential headers (`Authorization`, `Cookie`,
  ledger token, and signature) are always discarded.”
- Why: `@claim:ingest-safety` verifies only ledger-token and signature names;
  it does not send or assert removal of `Authorization` or `Cookie`.
- Fix: extend that claim test to submit all four named credentials and assert
  none appears in stored headers.

#### F-1-13 — Digest clipboard behavior is unlisted

- Location/quote: README — “`GET /api/digest?hours=24` returns the active
  digest; the UI can copy it as plain text.”
- Why: `@claim:review-workflow` checks the displayed occurrence total, not the
  clipboard result.
- Fix: add a clipboard assertion to the registered workflow claim or remove
  “the UI can copy it as plain text.”

#### F-1-14 — The no-email behavior is unlisted

- Location/quote: README — “The saved review time is a scheduling hint, not
  outbound email.”
- Why: this is a product-behavior statement with no registry entry, in addition
  to the missing-leverage issue in F-1-4.
- Fix: add a claim/test for the chosen behavior after resolving F-1-4.

#### F-1-15 — The health-response claim is unlisted

- Location/quote: README — “`GET /health` returns service status and build
  SHA.”
- Why: release tests exist elsewhere, but this visitor-facing promise has no
  `.factory/claims.json` entry.
- Fix: register the claim and its existing health/build identity test.

#### F-1-16 — Receiver-token entropy is unlisted

- Location/quote: README — “Ingest endpoints have individual high-entropy
  tokens; HMAC is recommended when the sender supports it.”
- Why: `@claim:ingest-safety` uses a token but does not measure uniqueness or
  entropy.
- Fix: claim a concrete token size and test length/uniqueness, or say only
  “Each source has a separate receiver token.”

#### F-1-17 — The rate-limit claim test does not cover the whole claim

- Location/quote: README — “Every API client is rate limited before
  authentication and receives `429` with `Retry-After` when the allowance is
  spent.” Registry claim: “Management and receiver API clients are rate
  limited...”
- Why: `@claim:api-rate-limit` sends an authenticated burst only to
  `/api/events`; it does not test a pre-authentication request or a receiver.
- Fix: add anonymous management and `/ingest/...` bursts, then assert each
  returns 429 plus `Retry-After` at its documented allowance.

#### F-1-18 — The separate receiver-quota claim is unlisted

- Location/quote: README — “Authenticated deliveries also have a separate
  receiver quota, so unauthenticated traffic cannot spend it.”
- Why: neither the registry wording nor its test verifies independent quotas
  or the stated protection from anonymous traffic.
- Fix: add a dedicated claim and interleave anonymous and authenticated ingest
  requests to prove the authenticated allowance remains available.

#### F-1-19 — Trusted-proxy address handling is unlisted

- Location/quote: README — “Private and loopback ingress peers use the first
  forwarded address; public peers must be listed in `TRUSTED_PROXY_IPS`.”
- Why: this security-sensitive behavior has no claim entry or observable test.
- Fix: register and test trusted, untrusted, private, and loopback peer cases;
  rewrite as “Only configured proxies may supply a client IP.” if intended.

### Minor

#### F-1-20 — The landing headline ends in a metaphor

- Quote: “Review operational events without Slack noise.”
- Why: “noise” does not name the concrete job.
- Fix: “Review low-priority webhook events outside Slack.”

#### F-1-21 — The preview heading is a metaphor

- Quote: “See repeats before they become noise.”
- Why: it cannot identify the section out of context.
- Fix: “Group and review repeated webhook events.”

#### F-1-22 — The how-it-works heading is a slogan

- Quote: “Route, review, retain.”
- Why: the alliterative phrase names no specific subject.
- Fix: “How webhook review works.”

#### F-1-23 — “Central ledger” is decorative brand lore

- Location/quote: masthead subtitle “Central ledger.”
- Why: it adds no usable product information.
- Fix: remove it or use “Self-hosted webhook review.”

#### F-1-24 — “Clear boundaries” is a context-free label

- Location/quote: landing eyebrow “Clear boundaries.”
- Why: it does not name the subject when read as a heading list.
- Fix: “Not for urgent alerts.”

#### F-1-25 — “Calm” is an untestable marketing adjective

- Location/quote: README — “Internal Event Ledger is a calm, self-hosted review
  inbox for low-urgency operational webhooks.”
- Why: “calm” does not tell an operator what the software does.
- Fix: “Internal Event Ledger is a self-hosted record for reviewing low-priority
  webhook events.”

#### F-1-26 — The same event concept has too many names

- Location/quote: landing/README use “events”, “signals”, “arrivals”, “record”,
  “ledger”, “inbox”, and “queue” for overlapping concepts.
- Why: a visitor must infer that an “arrival” is an event occurrence and a
  “signal” is an event.
- Fix: use **event** for each delivery, **event group** for matching events,
  **source** for a sender, and **ledger** for the stored collection. Reserve
  “Inbox” only as the route label.

#### F-1-27 — README audience sentence exceeds 22 words

- Quote (28 words): “It is for solo developers and small product teams who need
  product, backend, and integration signals to remain searchable without
  turning a Slack channel into an unread queue.”
- Fix: “It is for solo developers and small product teams. It keeps product,
  backend, and integration events searchable outside Slack.”

#### F-1-28 — README capability sentence exceeds 22 words

- Quote (31 words): “It accepts private JSON endpoints, verifies optional
  HMAC-SHA256 signatures, applies header and nested body redaction before
  storage, groups repeats by fingerprint, and gives each group an unread,
  acknowledged, or archived state.”
- Fix: “It accepts JSON through private endpoints and can verify request
  signatures. It removes configured fields before storage. Matching events
  share a group with a clear review state.”

#### F-1-29 — README token-generation sentence exceeds 22 words

- Quote (23 words): “The build identity defaults to `dev` locally, and the
  service generates a 256-bit administrator token on first boot when one is not
  supplied.”
- Fix: “Local builds use `dev` as their build identity. On first boot, the
  service generates an administrator token if none is supplied.”

#### F-1-30 — README container sentence exceeds 22 words

- Quote (24 words): “The container runs as a non-root user and stores its ledger
  database, rate-limit state, and generated administrator token in the stable
  `/data/internal-event-ledger/` directory.”
- Fix: “The container runs as a non-root user. It stores the database,
  rate-limit state, and generated token in `/data/internal-event-ledger/`.”

#### F-1-31 — README authorization sentence exceeds 22 words

- Quote (24 words): “All management APIs, exports, event review, settings, and
  retention require `Authorization: Bearer $ADMIN_TOKEN`; receiver ingestion
  continues to use each source’s separate receiver token.”
- Fix: “The administrator token protects management APIs, exports, review,
  settings, and retention. Each source uses a separate token for incoming
  events.”

#### F-1-32 — README limits sentence exceeds 22 words

- Quote (26 words): “A deployment can create more than five sources, retain
  each source for up to 10 years, and choose digest windows from 6 hours to 7
  days.”
- Fix: “A deployment can create more than five sources and retain each for up
  to 10 years. Digest windows range from 6 hours to 7 days.”

#### F-1-33 — A repair-history sentence does not help product users

- Quote: README — “Earlier numbered repair files are never opened, deleted, or
  renamed.”
- Why: it reads like internal incident residue and gives no setup or operating
  action to the reader.
- Fix: remove it; put any migration invariant in an operator migration note.

#### F-1-34 — The 404 headline uses product lore instead of the error

- Quote: `/does-not-exist` h1 — “This route is not on the board.”
- Why: “the board” depends on the transit metaphor.
- Fix: “This page does not exist.”

#### F-1-35 — The catalog description field is absent

- Location: `.factory/brief.json` has no `summary` field.
- Why: there is no ≤120-character catalog line to verify.
- Fix: add “Review low-priority webhook events in a self-hosted ledger.”

## Copy audit

Counts treat hyphenated terms, contractions, paths, and hashes as one word.
Commands and configuration-table cells are not sentences. Headings, controls,
preview labels, footer text, and image alt text are included.

### Landing page

| # | Text | Words | Result |
| ---: | --- | ---: | --- |
| 1 | Skip to ledger | 3 | Pass |
| 2 | IEL | 1 | Pass (mark) |
| 3 | Internal event | 2 | Pass (brand) |
| 4 | Central ledger | 2 | F-1-23 |
| 5 | Demo | 1 | Pass |
| 6 | Privacy | 1 | Pass |
| 7 | Terms | 1 | Pass |
| 8 | Self-hosted webhook review | 3 | Pass |
| 9 | Review operational events without Slack noise | 6 | F-1-20 |
| 10 | For solo developers and small teams that need searchable webhook history without another urgent inbox. | 15 | Pass |
| 11 | Try it with sample data | 5 | Pass; result-naming verb |
| 12 | Opens an isolated sample ledger with no token. | 8 | Pass |
| 13 | Self-host on your own server. | 5 | F-1-1 |
| 14 | No analytics or third-party scripts. | 5 | Pass; F-1-1 notes missing facts |
| 15 | All core controls stay local. | 5 | F-1-1 |
| 16 | Your deployment | 2 | Pass |
| 17 | Open your ledger | 3 | Pass |
| 18 | Enter the administrator token from your server. | 7 | Pass |
| 19 | It stays in this browser tab. | 6 | Pass |
| 20 | Administrator token | 2 | Pass |
| 21 | Find it in the server file shown during setup. | 9 | Pass |
| 22 | Open my ledger | 3 | Pass; result-naming verb |
| 23 | A searchable record | 3 | Pass |
| 24 | See repeats before they become noise | 6 | F-1-21 |
| 25 | Each receiver groups matching events by fingerprint. | 7 | Pass |
| 26 | Reviewers can search, acknowledge, archive, and export the record. | 9 | Pass |
| 27 | Refund review requested | 3 | Pass (sample) |
| 28 | Checkout API · 3 arrivals | 4 | F-1-26 |
| 29 | Catalogue import needs two files | 5 | Pass (sample) |
| 30 | Customer imports · 2 arrivals | 4 | F-1-26 |
| 31 | Production deploy completed | 3 | Pass (sample) |
| 32 | Deploy pipeline · acknowledged | 3 | Pass (sample) |
| 33 | Five signal routes converge into an open operations ledger at a midnight dispatch desk | 14 | Pass (image alt) |
| 34 | How it works | 3 | Pass |
| 35 | Route, review, retain | 3 | F-1-22 |
| 36 | Connect a source. | 3 | Pass |
| 37 | Create a private JSON receiver and optional signature rule. | 9 | Pass |
| 38 | Review grouped events. | 3 | Pass |
| 39 | Search summaries and payloads without chat interruptions. | 7 | Pass |
| 40 | Keep the useful record. | 4 | Pass |
| 41 | Acknowledge, archive, delete by retention, or export. | 7 | Pass |
| 42 | Clear boundaries | 2 | F-1-24 |
| 43 | Use an incident tool for urgent alerts | 7 | Pass |
| 44 | This ledger does not page people, retry webhooks, or guarantee delivery. | 11 | F-1-5 |
| 45 | Local storage | 2 | Pass |
| 46 | Keep the record on your server | 6 | Pass |
| 47 | Sources, events, settings, and exports stay in this deployment's SQLite database. | 11 | Pass |
| 48 | Review low-urgency operational events in a self-hosted ledger. | 8 | Pass |
| 49 | Privacy | 1 | Pass |
| 50 | Terms | 1 | Pass |
| 51 | Built by Param Factory | 4 | Pass |
| 52 | Build e49d952c1ac1 · Poster artwork generated for Internal Event Ledger. | 9 | Pass |

No landing button uses a non-result verb.

### README

| # | Text | Words | Result |
| ---: | --- | ---: | --- |
| 1 | Internal Event Ledger | 3 | Pass (title) |
| 2 | Internal Event Ledger is a calm, self-hosted review inbox for low-urgency operational webhooks. | 13 | F-1-25 |
| 3 | It is for solo developers and small product teams who need product, backend, and integration signals to remain searchable without turning a Slack channel into an unread queue. | 28 | F-1-27, F-1-26 |
| 4 | It accepts private JSON endpoints, verifies optional HMAC-SHA256 signatures, applies header and nested body redaction before storage, groups repeats by fingerprint, and gives each group an unread, acknowledged, or archived state. | 31 | F-1-28 |
| 5 | It also provides a 24-hour digest, per-source retention deletion, and full JSON/CSV export. | 14 | Pass |
| 6 | This is not a pager, retrying webhook proxy, automation engine, or guaranteed-delivery system. | 13 | F-1-5 |
| 7 | Keep urgent alerts in an incident tool. | 7 | Pass |
| 8 | Try the isolated demo | 4 | Pass (heading) |
| 9 | Open `/demo` or choose **Try it with sample data** on the first screen. | 13 | Pass |
| 10 | The server creates a random workspace with three sources and five grouped events in a dedicated demo table. | 18 | Pass |
| 11 | It expires after 24 hours and never reads or writes the operator's source or event tables. | 16 | Pass |
| 12 | **Reset demo** starts a clean sample, and **Start for real** discards it before showing administrator access. | 16 | Pass |
| 13 | The browser keeps the sample in the separate `demo:internal-event-ledger:workspace` namespace, so `/demo` remains readable offline after its first visit. | 21 | Pass |
| 14 | No account or administrator token is needed. | 7 | Pass |
| 15 | Run with Docker | 3 | Pass (heading) |
| 16 | The smallest deployment uses the included Compose file and a persistent SQLite volume. | 13 | F-1-6 |
| 17 | The build identity defaults to `dev` locally, and the service generates a 256-bit administrator token on first boot when one is not supplied. | 23 | F-1-29 |
| 18 | Open `http://localhost:8080`. | 4 | Pass |
| 19 | The container runs as a non-root user and stores its ledger database, rate-limit state, and generated administrator token in the stable `/data/internal-event-ledger/` directory. | 24 | F-1-7, F-1-30 |
| 20 | Earlier numbered repair files are never opened, deleted, or renamed. | 10 | F-1-33 |
| 21 | The mounted deployment runs one replica with one SQLite connection, normal statement-scoped locks, and SQLite's rollback `DELETE` journal. | 18 | F-1-8 |
| 22 | Enter the token in **Open your ledger**; it is retained only for that browser tab. | 15 | Pass |
| 23 | Set `ADMIN_TOKEN` to override generation, and set `BUILD_SHA` to stamp a release image. | 13 | Pass |
| 24 | To build and run the image directly: | 7 | Pass |
| 25 | Release builds should pass the full source identity without relying on `.git`: `docker build --build-arg BUILD_SHA=<full-commit-sha> ...`. | 17 | Pass |
| 26 | After deployment, prove that the public service is running the intended immutable release (a healthy earlier revision is not sufficient): | 20 | Pass |
| 27 | Develop and verify | 3 | Pass (heading) |
| 28 | Requirements: Node 22+, npm 10+, and Rust 1.88+. | 9 | Pass |
| 29 | For a production-like local run: | 5 | Pass |
| 30 | Configuration is environment-only: | 3 | Pass |
| 31 | Receive events | 2 | Pass (heading) |
| 32 | Create a source in the Sources screen. | 7 | Pass |
| 33 | Its receiver token is shown once. | 6 | F-1-9 |
| 34 | Send it as `X-Ledger-Token`, an `Authorization: Bearer` token, or the `token` query parameter (headers are preferred): | 16 | F-1-10 |
| 35 | If the source has a signing secret, also send `X-Ledger-Signature: sha256=HEX_HMAC`, computed over the exact raw request body. | 19 | Pass |
| 36 | An optional `X-Event-Fingerprint` controls grouping; otherwise the ledger hashes source, event type, and summary. | 14 | Pass |
| 37 | A new arrival reopens an archived group but preserves an acknowledged group. | 12 | F-1-11, F-1-26 |
| 38 | Credential headers (`Authorization`, `Cookie`, ledger token, and signature) are always discarded. | 11 | F-1-12 |
| 39 | Configured headers and dot-separated JSON object paths are replaced with `[REDACTED]` before insertion. | 13 | Pass |
| 40 | Digest, retention, and export | 4 | Pass (heading) |
| 41 | `GET /api/digest?hours=24` returns the active digest; the UI can copy it as plain text. | 14 | F-1-13 |
| 42 | The saved review time is a scheduling hint, not outbound email. | 11 | F-1-4, F-1-14 |
| 43 | `POST /api/maintenance/retention` deletes groups older than each source’s policy. | 9 | Pass |
| 44 | `GET /api/export?format=json` and `?format=csv` export the complete current record and are never paywalled. | 13 | Pass |
| 45 | `GET /health` returns service status and build SHA. | 8 | F-1-15 |
| 46 | All management APIs, exports, event review, settings, and retention require `Authorization: Bearer $ADMIN_TOKEN`; receiver ingestion continues to use each source’s separate receiver token. | 24 | F-1-31 |
| 47 | A deployment can create more than five sources, retain each source for up to 10 years, and choose digest windows from 6 hours to 7 days. | 26 | F-1-32 |
| 48 | These controls are enforced directly by the server and do not need a remote account or service. | 17 | Pass |
| 49 | Privacy and security | 3 | Pass (heading) |
| 50 | There are no analytics, trackers, third-party fonts, runtime CDN assets, billing calls, or identity calls. | 15 | Pass |
| 51 | Operational data stays in the deployment’s SQLite files under `/data/internal-event-ledger/`. | 12 | Pass |
| 52 | Read the in-product `/privacy` and `/terms` pages for the full notices. | 11 | Pass |
| 53 | Back up the `/data` volume and place the service behind HTTPS. | 11 | Pass |
| 54 | The application itself enforces an administrator boundary; a reverse-proxy identity layer can be added as defense in depth. | 18 | Pass |
| 55 | Ingest endpoints have individual high-entropy tokens; HMAC is recommended when the sender supports it. | 14 | F-1-16 |
| 56 | Every API client is rate limited before authentication and receives `429` with `Retry-After` when the allowance is spent. | 18 | F-1-17 |
| 57 | Authenticated deliveries also have a separate receiver quota, so unauthenticated traffic cannot spend it. | 14 | F-1-18 |
| 58 | Private and loopback ingress peers use the first forwarded address; public peers must be listed in `TRUSTED_PROXY_IPS`. | 17 | F-1-19 |
| 59 | Hashed frontend assets are immutable-cached, while HTML and `sw.js` revalidate. | 11 | Pass |
| 60 | The executable claim registry is `.factory/claims.json`. | 8 | Pass |
| 61 | Run all claim sandboxes with `npm run test:claims`. | 9 | Pass |
| 62 | License | 1 | Pass (heading) |
| 63 | MIT. | 1 | Pass |
| 64 | See `LICENSE`. | 2 | Pass |

The README contains no buttons beyond UI names. Those names are result-oriented.

## Demo and sandbox evidence

- One click from a fresh 390×844 landing context opened `/demo` with the proper
  title/banner, three realistic sources, five event groups, and no token prompt.
- Acknowledging a sample changed its state. Reset replaced workspace
  `3153f35e-8cab-41a2-ac19-d3ba87aaf740` with
  `e6e5a8ce-21dd-4b31-a805-c03363888d55` and restored original statuses.
- A non-demo `ledger:digest-window` sentinel survived. The sample used only
  `demo:internal-event-ledger:workspace` in browser storage.
- Landing → demo → edit → reset made only same-origin requests. After service
  worker control, an offline reload still showed all five groups.

## Claim results

A fresh clone at the required base commit was used. After `npm ci`, every exact
command in `.factory/claims.json` was run individually.

| Claim | Result | Evidence |
| --- | --- | --- |
| `demo-sandbox` | PASS | Entry, five groups, banner, reset, search |
| `demo-isolation` | PASS | Demo-only traffic and production sentinel |
| `demo-expiry` | PASS | 86,400-second deadline and expiry rejection |
| `self-hosted-runtime` | PASS | PORT-only start, token, SQLite, health |
| `review-workflow` | PASS | Search, state changes, digest, Back/focus |
| `administrator-boundary` | PASS | Anonymous 401s and session-only token |
| `retention-delete` | PASS | Exactly one expired group deleted |
| `response-policy` | PASS | Cache headers and CSP |
| `ledger-export` | PASS | CSV six lines; JSON five records |
| `privacy-no-tracking` | PASS | Only same-origin browser requests |
| `offline-demo` | PASS | Offline reload retained five groups |
| `ingest-safety` | PASS | HMAC, grouping, configured redaction |
| `self-hosted-controls` | PASS | Six sources, 10-year retention, 6-hour digest |
| `api-rate-limit` | PASS | Authenticated burst returned 429/Retry-After |

F-1-5 through F-1-19 cover unlisted or under-tested public statements.
The full `npm test` gate also passed in the clean clone: 4 frontend tests, 8
Node contract tests, 21 Rust tests, 2 storage tests, all 14 claims, and all 18
desktop/mobile axe scans.

## History review

No earlier `.factory/review-*.md` or `.factory/polish-*.md` exists in the repo or
reachable history. The prior handoff reported verification 10 PASS and no
finding IDs. The live build remains `e49d952c1ac1`, matching that candidate.

## Structure, links, and accessibility

- All listed routes, discovered internal links, and assets returned 200. An
  unknown path returned the designed 404. F-1-2 records its omissions.
- Every checked 200 route had `lang="en"`, one h1/main, title, canonical,
  favicon, Open Graph image, header, and footer.
- Demo deep links worked. Back restored the prior view and focused its h1.
  F-1-3 records the navigation-button semantics.
- There was no 390px horizontal overflow or 200-route console error.
  `verify-url.sh` passed.
- Playwright axe scans of `/`, `/demo`, `/privacy`, `/terms`, and the 404 found
  zero violations. Standalone axe could not start because its ChromeDriver 152
  did not match Playwright Chromium 145; the installed integration ran instead.
- The original art-deco transit-poster identity is distinct and provenance is
  recorded. The live JS is 38,025 bytes uncompressed, below 150 KB gzipped.

## What would make this perfect

Resolve every finding, then rerun every claim, the full suite, offline/request
checks, route/focus checks, link crawl, and axe scan. Only a zero-finding rerun
should receive PASS.
