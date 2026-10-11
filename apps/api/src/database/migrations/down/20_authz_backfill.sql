-- DOWN for 20_authz_backfill.sql (test/rollback use only).
-- Membership rows are all new-era data: nothing pre-existing is destroyed.
DELETE FROM project_members;
