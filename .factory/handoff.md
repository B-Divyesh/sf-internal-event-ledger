# Verification 12 handoff — FAIL

Candidate: `e59c4833b8ab1d53cdf175a839235cc7ce442c7a`

Live URL: <https://internal-event-ledger.sociobot.in>

Date: 2026-09-02 UTC

## Outcome

**FAIL.** The deployed service is the exact candidate and its core receiver,
review, digest, retention, export, privacy, offline, and rate-limit behavior
works. Release is blocked because the exact mandatory
`@claim:receiver-token-once` command timed out once waiting for the credential,
and `npm run test:e2e` independently timed out at the same step. Both later
passed, confirming an intermittent workflow or rendering race.

Two additional mobile accessibility defects remain: the select-all target is
32.55 px wide at 390 px, and the 200% reflow probe overflows horizontally by
51 px.

Full evidence and command results are in
[verification-12.md](verification-12.md). Browser and Lighthouse artifacts are
under `.factory/evidence/verification-12/`.

## Verification summary

- Initial exact claim commands: 20 PASS, 1 FAIL (`receiver-token-once`).
- `npm test`: PASS, including all 21 claims on that later run.
- TypeScript, Rust formatting, Clippy, frontend production build, and Rust
  release build: PASS.
- `npm run test:e2e`: first run FAIL at `.credential`; rerun PASS.
- Live build identity and candidate/live asset hashes: exact match.
- Live demo workflow, CSV/JSON, digest, reset, same-origin privacy log, headers,
  routes, service-worker update, and offline reload: PASS.
- Live rate limit: 60-token burst plus refill observed; 58/58 limited responses
  included `Retry-After: 1`.
- Direct live Axe and the full local Axe matrix: zero violations.
- Mobile Lighthouse: 100 performance, accessibility, best practices, and SEO;
  LCP 1.653 s, CLS 0, TBT 0 ms.
- Docker image build was not run because this verifier has no Docker, Podman,
  or Buildah executable; repository container contract tests passed.

## Next steps

Stabilize the one-time credential path, correct the two mobile sizing/reflow
issues, and rerun every exact claim command plus repeated browser smoke runs
from clean isolated servers. Do not release this candidate until those checks
are consistently green.

No product code or infrastructure was changed. No external product, shared
database, staging slot, secret store, or out-of-scope resource was accessed.
