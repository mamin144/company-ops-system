-- Backfill document_revisions from the documents.revisions JSONB mirror.
--
-- The normalized table is the canonical revision store; this copies every
-- embedded revision row into it. Idempotent: safe to re-run
-- (ON CONFLICT (document_id, revision) DO NOTHING).
--
-- All casts are defensive: a malformed JSONB element falls back to a
-- generated UUID / column default instead of aborting the migration.
INSERT INTO document_revisions
  (id, document_id, revision, file_name, file_extension, file_size,
   file_path, uploaded_by, notes, created_at)
SELECT
  CASE
    WHEN elem->>'id' ~ '^[0-9a-fA-F-]{36}$' THEN (elem->>'id')::uuid
    ELSE uuid_generate_v4()
  END,
  d.id,
  COALESCE(NULLIF(elem->>'revision', ''), '00'),
  COALESCE(elem->>'fileName', ''),
  COALESCE(elem->>'fileExtension', ''),
  CASE
    WHEN elem->>'fileSize' ~ '^\d+$' THEN (elem->>'fileSize')::bigint
    ELSE 0
  END,
  COALESCE(elem->>'filePath', ''),
  elem->>'uploadedBy',
  elem->>'notes',
  CASE
    WHEN elem->>'uploadedAt' ~ '^\d{4}-\d{2}-\d{2}' THEN (elem->>'uploadedAt')::timestamptz
    ELSE NOW()
  END
FROM documents d
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(d.revisions, '[]'::jsonb)) AS elem
ON CONFLICT (document_id, revision) DO NOTHING;
