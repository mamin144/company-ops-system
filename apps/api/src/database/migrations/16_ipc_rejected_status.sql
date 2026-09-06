-- IPC workflow includes rejection (UI approve/reject action), but the original
-- CHECK constraint only allowed draft/submitted/approved — rejecting an IPC
-- crashed with a 500 constraint violation. Add 'rejected' as a terminal state.
ALTER TABLE ipcs DROP CONSTRAINT IF EXISTS ipcs_status_check;
ALTER TABLE ipcs
  ADD CONSTRAINT ipcs_status_check
  CHECK (status IN ('draft', 'submitted', 'approved', 'rejected'));
