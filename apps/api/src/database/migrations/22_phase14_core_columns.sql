-- ============================================================
-- 22_phase14_core_columns: Phase 14 additive core columns (O1/O8/O12)
-- Target model: docs/frontend-rebuild/phase-14/phase-14b/02-target-data-model.md
-- Additive only: new nullable columns + indexes. No renames, no drops,
-- no data backfill. Safe to re-run (IF NOT EXISTS guards).
-- ============================================================

-- 1. users.department / users.title (O1) — optional profile fields.
--    email is intentionally NOT touched (owner decision: no invented
--    column/constraint/backfill for it).
ALTER TABLE users ADD COLUMN IF NOT EXISTS department VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS title VARCHAR(100);

-- 2. projects soft delete (O12): deleted_at IS NOT NULL means logically
--    deleted. No physical cascade — children (sites, boq, ipcs, documents)
--    and their history remain untouched.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id);

-- Partial index for live-project listings; plain index for delete audit.
CREATE INDEX IF NOT EXISTS idx_projects_status_active
  ON projects (status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_projects_deleted_at ON projects (deleted_at);

-- 3. audit_logs.project_id (O8): logical FK for project-scoped audit
--    filtering. Historical rows keep project_id NULL and remain valid.
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id);

CREATE INDEX IF NOT EXISTS idx_audit_project
  ON audit_logs (project_id) WHERE project_id IS NOT NULL;
