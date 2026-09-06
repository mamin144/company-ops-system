-- The runtime application stores multi-line stock movements as a JSONB
-- `items` array on each transaction row (repository, validator,
-- factory, service and routes all read/write it). The table was missing
-- the column, so every stock transaction INSERT failed.
ALTER TABLE stock_transactions
  ADD COLUMN IF NOT EXISTS items JSONB NOT NULL DEFAULT '[]'::jsonb;
