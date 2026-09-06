CREATE TABLE boq_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  item_code       VARCHAR(50) NOT NULL,
  description     TEXT NOT NULL,
  unit            VARCHAR(50) NOT NULL,
  quantity        NUMERIC(14, 4) NOT NULL DEFAULT 0,
  unit_price      NUMERIC(14, 2) NOT NULL DEFAULT 0,
  total_price     NUMERIC(14, 2) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ipcs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  ipc_number      INTEGER NOT NULL,
  date            DATE NOT NULL,
  status          VARCHAR(30) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved')),
  notes           TEXT,
  net_amount      NUMERIC(14, 2) DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ipc_items (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ipc_id              UUID NOT NULL REFERENCES ipcs(id) ON DELETE CASCADE,
  boq_item_id         UUID NOT NULL REFERENCES boq_items(id) ON DELETE RESTRICT,
  previous_quantity   NUMERIC(14, 4) NOT NULL DEFAULT 0,
  current_quantity    NUMERIC(14, 4) NOT NULL DEFAULT 0,
  total_quantity      NUMERIC(14, 4) NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(ipc_id, boq_item_id)
);
