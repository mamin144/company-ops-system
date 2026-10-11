-- DOWN for 19_authz_rebuild.sql (test/rollback use only).
-- Removes the authz structures; pre-existing business rows are untouched.
-- NOTE: revoked sessions stay revoked by design (one-time re-login cutover).
DROP TABLE IF EXISTS user_permission_overrides;
DROP TABLE IF EXISTS project_members;
ALTER TABLE users DROP CONSTRAINT IF EXISTS fk_users_role;
