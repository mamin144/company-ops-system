-- Add revisions column as JSONB since the repository expects it to be embedded
ALTER TABLE documents ADD COLUMN IF NOT EXISTS revisions JSONB NOT NULL DEFAULT '[]'::jsonb;
