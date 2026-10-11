-- DOWN for 21_direct_amounts.sql (test/rollback use only).
ALTER TABLE ipcs DROP COLUMN IF EXISTS gross_amount;
ALTER TABLE projects DROP COLUMN IF EXISTS contract_value;
