-- 1. Create folders table
CREATE TABLE IF NOT EXISTS folders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_id UUID REFERENCES folders(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    color VARCHAR(50),
    created_by VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create document_links table (Polymorphic)
CREATE TABLE IF NOT EXISTS document_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (document_id, entity_type, entity_id)
);

-- 3. Add folder_id to documents
ALTER TABLE documents ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES folders(id) ON DELETE SET NULL;

-- 4. Migrate existing relations to document_links
-- Projects
INSERT INTO document_links (document_id, entity_type, entity_id)
SELECT id, 'project', project_id
FROM documents
WHERE project_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Sites
INSERT INTO document_links (document_id, entity_type, entity_id)
SELECT id, 'site', site_id
FROM documents
WHERE site_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- IPCs
INSERT INTO document_links (document_id, entity_type, entity_id)
SELECT id, 'ipc', ipc_id
FROM documents
WHERE ipc_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Note: We will NOT drop project_id, site_id, ipc_id from documents yet 
-- to avoid breaking existing frontend code while we transition the API.
-- We can drop them in a future migration.
