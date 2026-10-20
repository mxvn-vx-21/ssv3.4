-- 0004_links.sql — link shortener. Safe to re-run.
CREATE TABLE IF NOT EXISTS links(name TEXT PRIMARY KEY, url TEXT NOT NULL, clicks INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL, updated INTEGER NOT NULL);
