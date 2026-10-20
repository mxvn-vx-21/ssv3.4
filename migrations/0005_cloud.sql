-- 0005_cloud.sql — expiring share links for /cloud files. Safe to re-run.
CREATE TABLE IF NOT EXISTS cloud_shares(token_hash TEXT PRIMARY KEY, file_id TEXT NOT NULL, expires INTEGER NOT NULL, revoked INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_cloud_shares_file ON cloud_shares(file_id);
