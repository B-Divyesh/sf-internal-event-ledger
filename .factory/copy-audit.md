# Landing-page copy audit

Audited 2 September 2026. Counts treat hyphenated words as one word. No landing
sentence exceeds 22 words. The banned-word scan found no matches.

| Text | Words | Result |
| --- | ---: | --- |
| Skip to ledger | 3 | Pass |
| Self-hosted webhook review | 3 | Pass |
| Review low-priority webhook events | 4 | Pass |
| For solo developers and small teams who need searchable event history outside Slack. | 13 | Pass |
| Try it with sample data | 5 | Pass |
| Opens an isolated sample ledger with no token. | 8 | Pass |
| No analytics or third-party scripts. | 5 | Pass |
| Sample events stay readable offline after one visit. | 8 | Pass |
| Free to self-host under the MIT License. | 8 | Pass |
| Open your ledger | 3 | Pass |
| Enter the administrator token from your server. | 7 | Pass |
| It stays in this browser tab. | 6 | Pass |
| Find it in the server file shown during setup. | 9 | Pass |
| Event groups | 2 | Pass |
| Group and review repeated webhook events | 6 | Pass |
| Each source groups matching events by fingerprint. | 7 | Pass |
| Reviewers can search, acknowledge, archive, and export event groups. | 9 | Pass |
| How webhook review works | 4 | Pass |
| Create a private JSON receiver and optional signature rule. | 9 | Pass |
| Search summaries and payloads outside Slack. | 6 | Pass |
| Acknowledge, archive, delete by retention, or export. | 7 | Pass |
| Not for urgent alerts | 4 | Pass |
| Keep urgent alerts in an incident tool. | 7 | Pass |
| Keep event groups on your server | 6 | Pass |
| Sources, event groups, settings, and exports stay in this deployment's SQLite database. | 12 | Pass |
| Review low-priority webhook events in a self-hosted ledger. | 8 | Pass |

## Terminology

| Concept | One term |
| --- | --- |
| Stored delivery | event |
| Matching repeated events | event group |
| Sender configuration | source |
| Stored collection | ledger |
| Non-production try-out | demo |
| Administrative credential | administrator token |
| Persistent product state | SQLite database |

`Inbox` is only the navigation label.

## Working interface labels

The round-2 audit also checks working navigation and section labels. Visual
transit details remain in the product's shapes and artwork, not its
information architecture.

| Text | Words | Result |
| --- | ---: | --- |
| Ledger sections | 2 | Pass |
| Sources | 1 | Pass |
| Source setup / 02 | 3 | Pass |
| Incoming sources | 2 | Pass |
| Registered sources | 2 | Pass |

The regression test rejects the replaced labels “Control board,” “Incoming
lines,” “Routing office / 02,” and “Registered lines.”
