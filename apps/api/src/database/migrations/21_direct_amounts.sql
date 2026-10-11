-- Direct monetary values, independent of BOQ line items.
-- contract_value: قيمة العقد (entered directly on the project).
-- gross_amount:   قيمة المستخلص الإجمالية (entered directly on the IPC).
-- When an IPC has BOQ lines, net_amount is still computed from the lines
-- (existing behavior); otherwise net_amount falls back to gross_amount.

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS contract_value NUMERIC(14, 2) NOT NULL DEFAULT 0;

ALTER TABLE ipcs
  ADD COLUMN IF NOT EXISTS gross_amount NUMERIC(14, 2) NOT NULL DEFAULT 0;
