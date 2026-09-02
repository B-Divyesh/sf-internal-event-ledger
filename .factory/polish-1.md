# Polish 1 — review finding closure

This repair closes every finding in `review-1.md`. Local evidence is from the
final source tree; live evidence is recorded after deployment in the handoff.

| Finding | Change made | Evidence |
| --- | --- | --- |
| F-1-1 | Added privacy, offline, and free-MIT facts to the first screen; changed the brief to free because no paid tier exists. | `@claim:offline-demo`, `@claim:privacy-no-tracking`, `@claim:free-mit-license` |
| F-1-2 | Added complete metadata, touch icon, product footer, legal links, and provenance to the designed 404. | `container-contract.test.mjs`; `axe.mjs` 404 scan |
| F-1-3 | Replaced URL-changing sidebar buttons with real anchors. | `test:e2e`; axe desktop/mobile navigation scans |
| F-1-4 | Removed the inert scheduled-review setting and named the feature an on-demand digest. | `@claim:review-workflow`; `test:e2e` |
| F-1-5 | Registered and tested the product boundary. | `@claim:scope-boundary` |
| F-1-6 | Removed the unproved Compose persistence promise; Compose remains a run command. | README copy audit |
| F-1-7 | Removed the unregistered container-storage claim from public copy. | README copy audit |
| F-1-8 | Replaced SQLite lock jargon with the operator instruction to run one replica. | README copy audit |
| F-1-9 | Added a receiver-token-once claim and browser test. | `@claim:receiver-token-once` |
| F-1-10 | Added all three supported receiver-token modes and rejection coverage. | `@claim:receiver-authentication` |
| F-1-11 | Added archive-reopen and acknowledge-preserve coverage. | `@claim:group-state-transition` |
| F-1-12 | Extended redaction coverage to Authorization and Cookie. | `@claim:ingest-safety` |
| F-1-13 | Added digest clipboard verification to the review workflow. | `@claim:review-workflow` |
| F-1-14 | Removed the unobservable no-email scheduling statement with the inert setting. | README and Settings copy audit |
| F-1-15 | Registered and tested health/build identity. | `@claim:health-identity` |
| F-1-16 | Replaced entropy wording with the tested separate-token behavior. | `@claim:receiver-token-once` |
| F-1-17 | Rate-limit coverage now includes anonymous API, authenticated API, and receiver bursts. | `@claim:api-rate-limit` |
| F-1-18 | Separated invalid receiver buckets from authenticated receiver buckets in the server. | `@claim:receiver-quota`; Rust quota test |
| F-1-19 | Removed the unregistered proxy configuration claim; the existing Rust trusted-ingress test remains. | `cargo test --locked` |
| F-1-20 | Rewrote the first-screen headline as “Review low-priority webhook events.” | first-screen copy audit |
| F-1-21 | Replaced the preview slogan with a descriptive event-group heading. | first-screen copy audit |
| F-1-22 | Replaced the alliterative how-it-works label with a descriptive heading. | first-screen copy audit |
| F-1-23 | Replaced “Central ledger” with “Webhook review.” | first-screen copy audit |
| F-1-24 | Replaced “Clear boundaries” with “Not for urgent alerts.” | first-screen copy audit |
| F-1-25 | Removed “calm” from product copy. | README copy audit |
| F-1-26 | Standardized event, event group, source, ledger, and demo terminology. | `.factory/copy-audit.md` |
| F-1-27 | Split the README audience sentence. | README copy audit |
| F-1-28 | Split the README capabilities sentence. | README copy audit |
| F-1-29 | Split the token-generation sentence. | README copy audit |
| F-1-30 | Removed the long container sentence from public copy. | README copy audit |
| F-1-31 | Split the authorization sentence. | README copy audit |
| F-1-32 | Split the limits sentence. | README copy audit |
| F-1-33 | Removed repair-history residue from the README. | README copy audit |
| F-1-34 | Rewrote the 404 heading as “This page does not exist.” | 404 axe scan; `container-contract.test.mjs` |
| F-1-35 | Added `brief.summary` and the verb-first catalog description file. | `.factory/catalog-description.txt` |

## Final local evidence

- `npm test` — all unit, container, storage, 21 claim, and 20 axe scans pass.
- `npm run test:e2e` — mobile 390×844 end-to-end flow passes with no console errors.
- `npm run build` — produces `dist/`; initial JS gzip is 11.69 KB and CSS gzip is 4.81 KB.
- `npm run test:a11y` — 20 desktop/mobile scans, including the 404, report zero violations.
