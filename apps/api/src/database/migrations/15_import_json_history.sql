-- One-time import of the pre-migration import_history.json backup entry.
-- Idempotent: ON CONFLICT (id) DO NOTHING.
INSERT INTO import_history
  (id, entity, file_name, user_id, username, total_rows, successful_rows,
   failed_rows, errors, created_at)
VALUES
  ('37ac9e4a-8001-4fbe-ace8-9ce0070aa9a9', 'documents', 'sweep.xlsx',
   '00000000-0000-0000-0000-000000000001', 'admin', 2, 2, 0, '{}',
   '2026-09-03T07:26:51.050Z')
ON CONFLICT (id) DO NOTHING;
