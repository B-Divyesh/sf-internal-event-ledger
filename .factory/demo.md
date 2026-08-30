# Demo sandbox

- URL: `https://internal-event-ledger.sociobot.in/demo` (the compatibility URL `/?demo=1` redirects in place).
- Entry: choose **Try it with sample data** on the public first screen. No administrator token is required.
- Sample: three sources and five grouped events covering checkout review, deploy history, and delayed customer imports. Payloads include visible redaction examples and repeated fingerprints.
- Isolation: `POST /api/demo` creates a random workspace in a dedicated server-side demo table. It expires after 24 hours and never queries the production source or event tables. Browser state uses only `demo:internal-event-ledger:workspace` so the sample remains readable offline.
- Reset: **Reset demo** discards the current server workspace and browser namespace, then creates a newly seeded workspace.
- Exit: **Start for real** discards the demo workspace and returns to administrator access. No demo record is copied into the production ledger.
