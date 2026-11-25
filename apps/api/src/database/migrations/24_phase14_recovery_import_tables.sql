-- ============================================================
-- 24_phase14_recovery_import_tables: O10/O11 support tables
-- (14B-02 §9.1-9.4). Additive only; metadata tables — no business
-- data migration, no backfill. Safe to re-run (IF NOT EXISTS).
-- None of these tables is exposed via any public endpoint (INT-4).
-- ============================================================

-- 1. password_reset_tokens (O10): hash-only tokens, single-use,
--    short-lived. The raw token is never stored — only its SHA-256 hex.
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   VARCHAR(64) NOT NULL UNIQUE,
  expires_at   TIMESTAMPTZ NOT NULL,
  used_at      TIMESTAMPTZ,
  requested_ip VARCHAR(45),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user
  ON password_reset_tokens (user_id);

-- 2. backups (O10): metadata index only — backup files live on disk,
--    never inside the database.
CREATE TABLE IF NOT EXISTS backups (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_name       VARCHAR(255) NOT NULL UNIQUE,
  file_path       VARCHAR(1000) NOT NULL,
  size_bytes      BIGINT,
  checksum_sha256 VARCHAR(64),
  status          VARCHAR(20) NOT NULL DEFAULT 'created'
                  CHECK (status IN ('created', 'verified', 'failed')),
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_at     TIMESTAMPTZ
);

-- 3. restore_jobs (O10): two-step restore — mandatory dry_run, then an
--    explicit commit. Each job references exactly one backup.
CREATE TABLE IF NOT EXISTS restore_jobs (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  backup_id         UUID NOT NULL REFERENCES backups(id),
  mode              VARCHAR(10) NOT NULL CHECK (mode IN ('dry_run', 'commit')),
  status            VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'validating', 'validated',
                                      'running', 'completed', 'failed', 'cancelled')),
  requested_by      UUID NOT NULL REFERENCES users(id),
  requested_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  validation_report JSONB,
  completed_at      TIMESTAMPTZ,
  notes             TEXT
);

CREATE INDEX IF NOT EXISTS idx_restore_jobs_backup ON restore_jobs (backup_id);

-- 4. import_batches (O11): one row per import run (documents
--    ImportHistoryEntry). No hard links to imported rows — it is a
--    historical log. duplicate_rule snapshots the rule in force at
--    import time; errors is a display-capped JSONB array.
CREATE TABLE IF NOT EXISTS import_batches (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity          VARCHAR(100) NOT NULL,
  file_name       VARCHAR(255) NOT NULL,
  user_id         UUID,
  username        VARCHAR(100),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_rows      INTEGER NOT NULL DEFAULT 0,
  successful_rows INTEGER NOT NULL DEFAULT 0,
  failed_rows     INTEGER NOT NULL DEFAULT 0,
  errors          JSONB NOT NULL DEFAULT '[]'::jsonb,
  duplicate_rule  VARCHAR(50) NOT NULL DEFAULT 'document_number',
  status          VARCHAR(20) NOT NULL DEFAULT 'completed'
                  CHECK (status IN ('completed', 'failed', 'cancelled'))
);
