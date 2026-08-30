CREATE TABLE IF NOT EXISTS request_rate_limits (
  bucket_key TEXT PRIMARY KEY,
  tokens REAL NOT NULL,
  updated_at_ms INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_request_rate_limits_updated
  ON request_rate_limits(updated_at_ms);

CREATE TABLE IF NOT EXISTS demo_workspaces (
  workspace_id TEXT PRIMARY KEY,
  payload_json TEXT NOT NULL,
  created_at_unix INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_demo_workspaces_created
  ON demo_workspaces(created_at_unix);
