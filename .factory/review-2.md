# Adversarial first-read review 2 — Internal Event Ledger

Reviewed 2 September 2026 against repository commit
`71322d22f1f5f98677b53a68b982dd50d8b9fa24` and the public site at
<https://internal-event-ledger.sociobot.in>.

## Verdict

**FAIL.** Two minor findings remain. The product is clear, usable, tryable,
and the registered claims passed, but this review's acceptance rule is zero
findings of every severity.

## Cold first read

Fresh Chromium contexts were used at 390×844 and 1440×900. No scrolling took
place before recording the first view.

| Question | Answer visible on the first screen | Result |
| --- | --- | --- |
| What does it do? | “Review low-priority webhook events.” | Clear |
| For whom? | “For solo developers and small teams who need searchable event history outside Slack.” | Clear |
| What should I click first? | “Try it with sample data”; its adjacent result says “Opens an isolated sample ledger with no token.” | Clear |

The title was `Internal Event Ledger — review webhook events`; there was one
`h1`; and neither viewport produced a console or page error. The 390px first
screen showed the primary action, its result, and all three plain facts:
privacy, offline demo behaviour, and free/MIT price.

## Copy audit

Counts treat hyphenated words, paths, and abbreviations as one word. Commands,
table cells, product names, and sample event names are not sentences. All
buttons use result-naming verbs. No landing or README sentence exceeds 22
words; no banned marketing word, jargon-only heading, or inconsistent event
terminology was found in those two documents.

### Landing page

| Text | Words | Result |
| --- | ---: | --- |
| Self-hosted webhook review | 3 | Pass |
| Review low-priority webhook events | 4 | Pass |
| For solo developers and small teams who need searchable event history outside Slack. | 13 | Pass |
| Try it with sample data | 5 | Pass — result-naming action |
| Opens an isolated sample ledger with no token. | 8 | Pass |
| No analytics or third-party scripts. | 5 | Pass |
| Sample events stay readable offline after one visit. | 8 | Pass |
| Free to self-host under the MIT License. | 8 | Pass |
| Open your ledger | 3 | Pass — result-naming action |
| Enter the administrator token from your server. | 7 | Pass |
| It stays in this browser tab. | 6 | Pass |
| Find it in the server file shown during setup. | 9 | Pass |
| Group and review repeated webhook events | 6 | Pass |
| Each source groups matching events by fingerprint. | 7 | Pass |
| Reviewers can search, acknowledge, archive, and export event groups. | 9 | Pass |
| How webhook review works | 4 | Pass |
| Connect a source. | 3 | Pass |
| Create a private JSON receiver and optional signature rule. | 9 | Pass |
| Review grouped events. | 3 | Pass |
| Search summaries and payloads outside Slack. | 6 | Pass |
| Keep the useful record. | 4 | Pass — explained by the following action list |
| Acknowledge, archive, delete by retention, or export. | 7 | Pass |
| Use an incident tool for urgent alerts | 7 | Pass |
| Keep urgent alerts in an incident tool. | 7 | Pass |
| Keep event groups on your server | 6 | Pass |
| Sources, event groups, settings, and exports stay in this deployment's SQLite database. | 12 | Pass |
| Review low-urgency operational events in a self-hosted ledger. | 8 | Pass |

### README

| Sentence | Words | Result |
| --- | ---: | --- |
| Internal Event Ledger is a self-hosted record for reviewing low-priority webhook events. | 12 | Pass |
| It is for solo developers and small product teams. | 9 | Pass |
| It keeps product, backend, and integration events searchable outside Slack. | 10 | Pass |
| It accepts JSON through private endpoints and can verify request signatures. | 10 | Pass |
| It removes configured fields before storage. | 6 | Pass |
| Matching events share a group with a clear review state. | 10 | Pass |
| It provides an on-demand digest, retention deletion, and JSON or CSV export. | 11 | Pass |
| Keep urgent alerts in an incident tool. | 7 | Pass |
| This product is not a pager, retrying webhook proxy, automation engine, or guaranteed-delivery system. | 13 | Pass |
| Open `/demo` or choose **Try it with sample data** on the first screen. | 13 | Pass |
| The server creates a random workspace with three sources and five event groups in a dedicated demo table. | 18 | Pass |
| It expires after 24 hours and never reads or writes the operator's source or event tables. | 16 | Pass |
| **Reset demo** starts a clean sample. | 5 | Pass |
| **Start for real** discards it before showing administrator access. | 9 | Pass |
| The browser keeps the sample in `demo:internal-event-ledger:workspace`. | 6 | Pass |
| The demo remains readable offline after its first visit. | 9 | Pass |
| No account or administrator token is needed. | 7 | Pass |
| Use the included Compose file for a local deployment. | 10 | Pass |
| Local builds use `dev` as their build identity. | 9 | Pass |
| On first boot, the service generates an administrator token if none is supplied. | 14 | Pass |
| Open `http://localhost:8080`. | 4 | Pass |
| Run one app replica for each SQLite database. | 9 | Pass |
| Enter the token in **Open your ledger**. | 8 | Pass |
| It is retained only for that browser tab. | 8 | Pass |
| Set `ADMIN_TOKEN` to override generation. | 5 | Pass |
| Set `BUILD_SHA` to stamp a release image. | 7 | Pass |
| Release builds should pass the source identity without relying on `.git`. | 11 | Pass |
| After deployment, verify the running release identity. | 7 | Pass |
| Create a source in the Sources screen. | 7 | Pass |
| Its receiver token is shown once. | 6 | Pass |
| Each source has a separate receiver token. | 7 | Pass |
| Send it as `X-Ledger-Token`, an `Authorization: Bearer` token, or the `token` query parameter. | 16 | Pass |
| If the source has a signing secret, also send `X-Ledger-Signature: sha256=HEX_HMAC`. | 13 | Pass |
| Compute it over the exact raw request body. | 8 | Pass |
| An optional `X-Event-Fingerprint` controls grouping. | 5 | Pass |
| Otherwise the ledger hashes source, event type, and summary. | 9 | Pass |
| A new event reopens an archived group. | 7 | Pass |
| It preserves an acknowledged group. | 5 | Pass |
| Credential headers are always discarded. | 5 | Pass |
| Configured headers and dot-separated JSON object paths are replaced with `[REDACTED]` before storage. | 12 | Pass |
| The administrator token protects management APIs, exports, review, settings, and retention. | 11 | Pass |
| Each source uses a separate token for incoming events. | 9 | Pass |
| A deployment can create more than five sources and retain each for up to 10 years. | 17 | Pass |
| Digest windows range from 6 hours to 7 days. | 10 | Pass |
| These controls are enforced directly by the server and do not need a remote account. | 15 | Pass |
| There are no analytics, trackers, third-party fonts, runtime CDN assets, billing calls, or identity calls. | 15 | Pass |
| Operational data stays in SQLite files under `/data/internal-event-ledger/`. | 8 | Pass |
| Read the in-product `/privacy` and `/terms` pages for the full notices. | 11 | Pass |
| Back up the `/data` volume and place the service behind HTTPS. | 11 | Pass |
| Every API client is rate limited before authentication and receives `429` with `Retry-After` when limited. | 17 | Pass |
| Valid receiver deliveries have a separate quota from invalid delivery attempts. | 10 | Pass |
| Hashed frontend assets are immutable-cached, while HTML and `sw.js` revalidate. | 11 | Pass |
| The product is free to self-host under the MIT License. | 10 | Pass |
| `GET /api/digest?hours=24` returns the active digest. | 5 | Pass |
| The UI can copy it as plain text. | 8 | Pass |
| `POST /api/maintenance/retention` deletes groups older than each source policy. | 8 | Pass |
| `GET /api/export?format=json` and `?format=csv` export the complete current ledger. | 8 | Pass |
| `GET /health` returns service status and build SHA. | 7 | Pass |
| MIT. | 1 | Pass |
| See [LICENSE](LICENSE). | 2 | Pass |

Terminology is consistent: **event**, **event group**, **source**, **ledger**,
and **demo** have one meaning each. The one copy defect in F-2-1 is in the
working application's navigation, not in the landing page or README.

All landing headings, navigation labels, footer labels, form labels, and action
labels were separately read in context. They are “Webhook review,” “Demo,”
“Privacy,” “Terms,” “Your deployment,” “Open your ledger,” “Administrator
token,” “Event groups,” “How webhook review works,” “Not for urgent alerts,”
“Use an incident tool for urgent alerts,” “Local storage,” and “Keep event
groups on your server.” Each names its section or destination; the app-only
exceptions are recorded in F-2-1.

## Demo, privacy, and claims

One click from a fresh 390px public landing page entered `/demo`. After its
seed request, the first working screen showed five realistic event groups from
Checkout API, Deploy pipeline, and Customer imports. It displayed the
persistent banner “Demo — sample data, nothing is saved to your real ledger,”
**Reset demo**, and **Start for real**. Reset replaced the sample workspace.

The request log for landing, demo entry, reset, review, export, and digest was
same-origin only. Demo browser storage used only
`demo:internal-event-ledger:workspace`; normal administrator access remained
in `sessionStorage`. Direct code inspection confirms `discardDemo()` clears the
sample namespace and sends the demo-workspace delete before legal or normal
routes render. The live `/demo` → Privacy → browser Back sequence restored a
newly labelled demo workspace, not an unlabelled sample ledger.

From a fresh clone at `/tmp/iel-review2-clean.14RCHf`, `npm ci` completed with
zero reported vulnerabilities. Every exact command named in
`.factory/claims.json` was run separately. The sequential run reached its final
claim without an earlier failure; the final three were then run again directly.
All 21 passed. `npm test` also completed its unit, container, Rust, storage,
claim, and Axe gates.

| Registered claim IDs | Result |
| --- | --- |
| demo-sandbox; demo-isolation; demo-expiry; self-hosted-runtime | Pass |
| review-workflow; administrator-boundary; retention-delete; response-policy | Pass |
| ledger-export; privacy-no-tracking; offline-demo; ingest-safety | Pass |
| receiver-token-once; receiver-authentication; group-state-transition; health-identity | Pass |
| receiver-quota; scope-boundary; free-mit-license; self-hosted-controls; api-rate-limit | Pass |

The live landing and README claims map to these registered claims. No unlisted
claim-like landing or README statement was found. The brief implies event
ingestion, search/review, retention, digest, and export; all are present. An
AI feature would not improve this non-urgent webhook ledger's core job and none
is presented decoratively or with a provider key.

## Earlier findings

Every finding in `review-1.md` and its declared repair in `polish-1.md` was
checked again against current public behaviour and current source.

| Earlier ID | Current check | Result |
| --- | --- | --- |
| F-1-1 | First screen has tested privacy, offline, and MIT facts. | Fixed |
| F-1-2 | Live 404 has title, description, canonical, OG/Twitter, touch icon, legal footer. | Fixed |
| F-1-3 | URL-changing sidebar controls are anchors. | Fixed |
| F-1-4 | Digest is labelled and behaves as on-demand. | Fixed |
| F-1-5 | Scope boundary is registered as `scope-boundary`. | Fixed |
| F-1-6 | README no longer promises untested Compose persistence. | Fixed |
| F-1-7 | README no longer makes the unregistered container-storage promise. | Fixed |
| F-1-8 | README gives the one-replica SQLite instruction without lock jargon. | Fixed |
| F-1-9 | `receiver-token-once` browser claim passes. | Fixed |
| F-1-10 | `receiver-authentication` covers all three token locations. | Fixed |
| F-1-11 | `group-state-transition` covers reopen/preserve behaviour. | Fixed |
| F-1-12 | `ingest-safety` covers credential-header removal. | Fixed |
| F-1-13 | `review-workflow` verifies digest copying. | Fixed |
| F-1-14 | Inert scheduled-review language/control is absent. | Fixed |
| F-1-15 | `health-identity` passes. | Fixed |
| F-1-16 | Untested entropy wording is absent. | Fixed |
| F-1-17 | `api-rate-limit` covers management and receiver cases. | Fixed |
| F-1-18 | `receiver-quota` proves the separate valid-delivery quota. | Fixed |
| F-1-19 | Unregistered trusted-proxy statement is absent from public copy. | Fixed |
| F-1-20 | Headline is “Review low-priority webhook events.” | Fixed |
| F-1-21 | Preview heading names repeated webhook-event review. | Fixed |
| F-1-22 | How-it-works heading names webhook review. | Fixed |
| F-1-23 | Masthead says “Webhook review,” not “Central ledger.” | Fixed |
| F-1-24 | Boundary label says “Not for urgent alerts.” | Fixed |
| F-1-25 | “Calm” is absent from README product copy. | Fixed |
| F-1-26 | Landing and README terminology is consistent. | Fixed |
| F-1-27 | README audience copy is split. | Fixed |
| F-1-28 | README capability copy is split. | Fixed |
| F-1-29 | README boot/token copy is split. | Fixed |
| F-1-30 | Long container sentence is absent. | Fixed |
| F-1-31 | Authorization copy is split. | Fixed |
| F-1-32 | Source/retention/digest limits are split. | Fixed |
| F-1-33 | Repair-history residue is absent. | Fixed |
| F-1-34 | 404 h1 says “This page does not exist.” | Fixed |
| F-1-35 | Brief summary and catalog description exist and are plain. | Fixed |

## Structure and route checks

`/`, `/demo`, each demo deep link, normal app deep links, `/privacy`, `/terms`,
discovery documents, icons, and social artwork returned 200. An unknown route
returned the designed 404 with status 404. Demo deep links, Back, route-focus,
and `aria-live` route announcements work; the destination h1 received focus in
the live Sources, Privacy, and Back checks. Each checked route had the required
title pattern, one h1, common description, canonical link, favicon/touch icon,
and a footer with Privacy and Terms. The site loaded without console errors.

The visual system is distinctly the documented art-deco transit-control-room
identity rather than a generic SaaS template. It maintains the shared site
order, visible focus treatment, contrast, 44px controls, and mobile layout.

## Findings

### Minor

#### F-2-1 — Working navigation uses unexplained transit-metaphor labels

- **Location / quote:** live `/demo` sidebar at both widths: “Control board”
  and “Incoming lines”; Sources route overline: “Routing office / 02.” The
  current source is `frontend/src/main.ts` lines 67, 75, and 137.
- **Why this matters:** these labels do not name their sections for a
  first-time visitor or a screen-reader heading/list user. The art-deco visual
  treatment is effective, but these words make a product-specific metaphor do
  the job of information architecture.
- **Concrete fix:** retain the visual treatment and replace the labels with
  “Ledger sections,” “Sources,” and “Source setup / 02.” Add a copy regression
  assertion for the replacement labels.

#### F-2-2 — Sitemap omits real demo deep-link routes

- **Location / quote:** live `/sitemap.xml` lists `/demo` but omits the live,
  reloadable 200 routes `/demo/sources`, `/demo/digest`, and `/demo/settings`.
  `frontend/src/main.ts` exposes those URLs through `routeUrl()`.
- **Why this matters:** the routing contract requires the sitemap to list every
  route. These shareable demo places are otherwise undiscoverable to a crawler.
- **Concrete fix:** add the three demo deep links to
  `frontend/public/sitemap.xml`, and extend the discovery-document test to
  compare the sitemap with every product route.

## What would make this perfect

Use literal section labels in the working UI and list the three demo deep links
in the sitemap. Re-run the route/discovery and plain-copy checks. With those
two small corrections, this review has no remaining finding.
