CREATE TABLE IF NOT EXISTS ads (
    id TEXT PRIMARY KEY,
    headline TEXT NOT NULL,
    employer_name TEXT,
    municipality TEXT,
    region TEXT,
    occupation_label TEXT,
    occupation_concept_id TEXT,
    application_deadline TEXT,
    publication_date TEXT,
    webpage_url TEXT,
    description_text TEXT NOT NULL DEFAULT '',
    description_hash TEXT NOT NULL DEFAULT '',
    first_seen TEXT NOT NULL,
    last_seen TEXT NOT NULL,
    last_filter_signature TEXT NOT NULL DEFAULT '',
    is_active INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_ads_filter_active
    ON ads(last_filter_signature, is_active);

CREATE INDEX IF NOT EXISTS idx_ads_deadline
    ON ads(application_deadline);

CREATE TABLE IF NOT EXISTS ad_chunks (
    ad_id TEXT NOT NULL REFERENCES ads(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    chunk_text TEXT NOT NULL,
    embedding BLOB,
    PRIMARY KEY (ad_id, chunk_index)
);

CREATE VIRTUAL TABLE IF NOT EXISTS ad_chunks_fts USING fts5(
    chunk_text,
    ad_id UNINDEXED,
    chunk_index UNINDEXED,
    tokenize = 'unicode61'
);
