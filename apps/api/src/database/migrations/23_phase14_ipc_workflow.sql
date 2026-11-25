-- ============================================================
-- 23_phase14_ipc_workflow: IPC review stage + status audit (O3/O4)
-- + financial NULL semantics (O2: NULL = not entered, never 0).
-- Additive only. No backfill: existing 0 values are historical data
-- and are intentionally left untouched.
-- ============================================================

-- 1. Add 'under-review' as an IPC status value (O3/O4 review stage).
--    documents already accept 'under-review' (001 CHECK); only ipcs
--    needs the value added. Same rebuild pattern as migration 16.
ALTER TABLE ipcs DROP CONSTRAINT IF EXISTS ipcs_status_check;
ALTER TABLE ipcs
  ADD CONSTRAINT ipcs_status_check
  CHECK (status IN ('draft', 'submitted', 'under-review', 'approved', 'rejected'));

-- 2. ipc_status_events (O4): append-only status-transition audit trail.
--    No UPDATE/DELETE path is provided; separation of duties (approver
--    != submitter) is enforced in the API layer, not here.
CREATE TABLE IF NOT EXISTS ipc_status_events (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ipc_id         UUID NOT NULL REFERENCES ipcs(id) ON DELETE CASCADE,
  from_status    VARCHAR(30),
  to_status      VARCHAR(30) NOT NULL,
  actor_user_id  UUID NOT NULL REFERENCES users(id),
  actor_username VARCHAR(100) NOT NULL,
  decision       VARCHAR(20) CHECK (decision IN ('approve', 'reject')),
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ipc_status_events_ipc
  ON ipc_status_events (ipc_id, created_at);

-- 3. Financial nullability (O2/O5/O6): NULL = not entered ≠ 0.
--    Relaxes the NOT NULL + DEFAULT 0 that migrations 06/21 imposed and
--    that conflict with the approved target model (14B-02 §7.2: all
--    three IPC amounts and contract_value are optional/NULL).
--    NUMERIC(14,2) is kept as-is (no type widening).
ALTER TABLE projects ALTER COLUMN contract_value DROP NOT NULL;
ALTER TABLE projects ALTER COLUMN contract_value DROP DEFAULT;

ALTER TABLE ipcs ALTER COLUMN gross_amount DROP NOT NULL;
ALTER TABLE ipcs ALTER COLUMN gross_amount DROP DEFAULT;
ALTER TABLE ipcs ALTER COLUMN net_amount DROP DEFAULT;
ALTER TABLE ipcs ALTER COLUMN deductions DROP NOT NULL;
ALTER TABLE ipcs ALTER COLUMN deductions DROP DEFAULT;
