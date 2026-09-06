-- ============================================================
-- Runtime JSON stores -> PostgreSQL seed data (one-time, idempotent)
-- ============================================================
-- 1. COUNTERS: snapshot of counters.json captured at migration time.
--    Numbering must continue from these values so generated document
--    numbers (GIN/MR/GOUT-YYYY-NNNN) never repeat. ON CONFLICT keeps
--    re-runs safe and never overwrites a live counter.
-- 2. UNITS: static seed from units.json (units table was empty).
-- 3. DOCUMENT-TYPE categories: existed only in categories.json while the
--    categories table held document-category rows only. Seeded here so the
--    Archive document-type filter keeps working after the runtime switch
--    to PostgreSQL. English document-category rows from the JSON backup
--    are intentionally NOT merged (migration 09 made Arabic the canonical
--    set and remapped existing documents to it).
-- ============================================================

INSERT INTO counters (prefix, year, last_value) VALUES
  ('GIN', 2026, 6),
  ('MR', 2026, 2),
  ('GOUT', 2026, 1)
ON CONFLICT (prefix, year) DO NOTHING;

INSERT INTO units (id, code, name, is_active, created_at, updated_at) VALUES
  (uuid_generate_v4(), 'pcs', 'Pieces', TRUE, NOW(), NOW()),
  (uuid_generate_v4(), 'box', 'Box', TRUE, NOW(), NOW()),
  (uuid_generate_v4(), 'kg', 'Kilogram', TRUE, NOW(), NOW()),
  (uuid_generate_v4(), 'm', 'Meter', TRUE, NOW(), NOW()),
  (uuid_generate_v4(), 'sqm', 'Square meter', TRUE, NOW(), NOW())
ON CONFLICT (code) DO NOTHING;

INSERT INTO categories (id, code, name, "group", is_active, created_at, updated_at) VALUES
  (uuid_generate_v4(), 'doc-contract', 'Contract', 'document-type', TRUE, NOW(), NOW()),
  (uuid_generate_v4(), 'doc-drawing', 'Drawing', 'document-type', TRUE, NOW(), NOW())
ON CONFLICT (code) DO NOTHING;
