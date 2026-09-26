-- ============================================================
-- 19_authz_rebuild: dynamic authorization foundation (Phase 1)
-- Additive + approved FK/session reset. Safe to re-run (IF NOT EXISTS /
-- ON CONFLICT guards); tracked once via _migrations by the app runner.
-- ============================================================

-- 1. User-specific permission overrides (GRANT/DENY over role inheritance).
CREATE TABLE IF NOT EXISTS user_permission_overrides (
  user_id        UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission_key TEXT         NOT NULL,
  effect         TEXT         NOT NULL CHECK (effect IN ('grant', 'deny')),
  created_by     VARCHAR(100),
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, permission_key)
);
CREATE INDEX IF NOT EXISTS idx_overrides_user ON user_permission_overrides (user_id);

-- 2. Project-level access (NONE/READ/WRITE/DELETE). Constraint-only layer:
--    it can narrow global permissions, never broaden them (enforced in code).
CREATE TABLE IF NOT EXISTS project_members (
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access     TEXT NOT NULL DEFAULT 'NONE'
             CHECK (access IN ('NONE', 'READ', 'WRITE', 'DELETE')),
  created_by VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (project_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_members_user ON project_members (user_id);
CREATE INDEX IF NOT EXISTS idx_members_project ON project_members (project_id);

-- 3. Orphan guard: fail loudly naming bad values instead of a cryptic FK error.
DO $$ DECLARE bad TEXT;
BEGIN
  SELECT string_agg(DISTINCT quote_literal(role_name), ', ') INTO bad
  FROM users
  WHERE role_name NOT IN ('admin', 'management', 'warehouse', 'technical', 'viewer');
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'authz migration blocked: unknown users.role_name values: %', bad;
  END IF;
END $$;

-- 4. Seed/refresh the 5 system roles from the canonical matrix.
--    Admin additionally holds the 3 new administration keys.
--    Existing custom rows (if any) are never touched.
INSERT INTO roles (id, name, name_ar, permissions, is_system, created_at, updated_at) VALUES
  (uuid_generate_v4(), 'admin', 'مدير النظام', ARRAY[
    'archive.view','archive.upload','archive.edit','archive.delete','archive.download',
    'warehouse.view','warehouse.create','warehouse.edit','warehouse.delete',
    'warehouse.stock_in','warehouse.stock_out','warehouse.transfer','warehouse.adjust','warehouse.return',
    'projects.view','projects.create','projects.edit','projects.delete',
    'materialRequests.view','materialRequests.create','materialRequests.approve','materialRequests.issue',
    'reports.view','audit.view','settings.manage','users.manage','backup.manage',
    'roles.manage','projects.access','users.resetPassword'
  ], TRUE, NOW(), NOW()),
  (uuid_generate_v4(), 'management', 'الإدارة', ARRAY[
    'archive.view','archive.download','warehouse.view',
    'projects.view','projects.create','projects.edit',
    'materialRequests.view','materialRequests.approve',
    'reports.view','audit.view'
  ], TRUE, NOW(), NOW()),
  (uuid_generate_v4(), 'warehouse', 'المخازن', ARRAY[
    'archive.view','archive.download',
    'warehouse.view','warehouse.create','warehouse.edit',
    'warehouse.stock_in','warehouse.stock_out','warehouse.transfer','warehouse.adjust','warehouse.return',
    'projects.view',
    'materialRequests.view','materialRequests.issue'
  ], TRUE, NOW(), NOW()),
  (uuid_generate_v4(), 'technical', 'الفني', ARRAY[
    'archive.view','archive.upload','archive.edit','archive.download',
    'projects.view','warehouse.view',
    'materialRequests.view','materialRequests.create'
  ], TRUE, NOW(), NOW()),
  (uuid_generate_v4(), 'viewer', 'مشاهدة فقط', ARRAY[
    'archive.view','archive.download','warehouse.view','projects.view','materialRequests.view'
  ], TRUE, NOW(), NOW())
ON CONFLICT (name) DO UPDATE SET
  name_ar = EXCLUDED.name_ar,
  permissions = EXCLUDED.permissions,
  is_system = TRUE,
  updated_at = NOW()
WHERE roles.is_system;

-- 5. Make users.role_name reference the managed roles table.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_users_role') THEN
    ALTER TABLE users ADD CONSTRAINT fk_users_role FOREIGN KEY (role_name) REFERENCES roles(name);
  END IF;
END $$;

-- 6. One-time global session reset (approved cutover): every user re-logs in
--    once, which kills all pre-migration stale permission claims.
UPDATE sessions SET revoked_at = NOW() WHERE revoked_at IS NULL;
