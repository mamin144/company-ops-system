-- Data-integrity rules for the core contracting modules.
-- Preflight verified: no duplicate (project_id, item_code) in boq_items
-- and no duplicate (project_id, ipc_number) in ipcs, so constraints apply
-- cleanly. Same code in different projects remains allowed.
ALTER TABLE boq_items
  ADD CONSTRAINT boq_items_project_code_unique UNIQUE (project_id, item_code);

ALTER TABLE ipcs
  ADD CONSTRAINT ipcs_project_number_unique UNIQUE (project_id, ipc_number);
