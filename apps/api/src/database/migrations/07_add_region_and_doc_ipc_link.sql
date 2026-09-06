-- Add region column to projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS region VARCHAR(255);

-- Add ipc_id column to documents for linking scans to IPCs
ALTER TABLE documents ADD COLUMN IF NOT EXISTS ipc_id UUID REFERENCES ipcs(id) ON DELETE SET NULL;
