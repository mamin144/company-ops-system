-- ============================================================
-- 20_authz_backfill: default project memberships (Phase 1)
-- Fully idempotent (ON CONFLICT DO NOTHING) — safe to re-run any time.
-- Role-derived defaults are provably behavior-preserving: the project
-- layer only narrows, and no role holds global rights above its cap
-- (admin=has deletes, editor roles=no global deletes, viewer=read-only).
-- ============================================================
INSERT INTO project_members (project_id, user_id, access, created_by)
SELECT
  p.id,
  u.id,
  CASE u.role_name
    WHEN 'admin' THEN 'DELETE'
    WHEN 'viewer' THEN 'READ'
    ELSE 'WRITE'
  END,
  'migration-20'
FROM projects p
CROSS JOIN users u
ON CONFLICT (project_id, user_id) DO NOTHING;
