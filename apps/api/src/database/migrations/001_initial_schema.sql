-- ============================================================
-- PHASE 1: CORE SCHEMA
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";   -- for text search

-- ============================================================
-- AUTH & RBAC
-- ============================================================

CREATE TABLE roles (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(50)  NOT NULL UNIQUE,
    name_ar     VARCHAR(100) NOT NULL,
    permissions TEXT[]       NOT NULL DEFAULT '{}',
    is_system   BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username      VARCHAR(100)  NOT NULL UNIQUE,
    full_name     VARCHAR(200)  NOT NULL,
    password_hash VARCHAR(255)  NOT NULL,
    role_name     VARCHAR(50)   NOT NULL,
    is_active     BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_username ON users (lower(username));
CREATE INDEX idx_users_role ON users (role_name);

CREATE TABLE sessions (
    id           VARCHAR(24)   PRIMARY KEY,
    user_id      UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    username     VARCHAR(100)  NOT NULL,
    token_hash   VARCHAR(64)   NOT NULL,
    remember_me  BOOLEAN       NOT NULL DEFAULT FALSE,
    ip_address   INET,
    user_agent   VARCHAR(200),
    expires_at   TIMESTAMPTZ   NOT NULL,
    revoked_at   TIMESTAMPTZ,
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_user ON sessions (user_id);
CREATE INDEX idx_sessions_token ON sessions (token_hash);

-- ============================================================
-- PROJECTS & SITES
-- ============================================================

CREATE TABLE projects (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_code    VARCHAR(50)  NOT NULL UNIQUE,
    project_name    VARCHAR(300) NOT NULL,
    client          VARCHAR(300) NOT NULL DEFAULT '',
    main_contractor VARCHAR(300) NOT NULL DEFAULT '',
    site_location   VARCHAR(500) NOT NULL DEFAULT '',
    contract_number VARCHAR(100) NOT NULL DEFAULT '',
    start_date      DATE,
    end_date        DATE,
    status          VARCHAR(20)  NOT NULL DEFAULT 'planned'
                    CHECK (status IN ('planned','active','on-hold','completed','cancelled')),
    role            VARCHAR(30)  CHECK (role IN ('main-contractor','subcontractor','direct-contractor')),
    notes           TEXT,
    created_by      VARCHAR(100),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_projects_code ON projects (project_code);
CREATE INDEX idx_projects_status ON projects (status);

CREATE TABLE sites (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID         NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    code       VARCHAR(50)  NOT NULL,
    name       VARCHAR(300) NOT NULL,
    location   VARCHAR(500),
    notes      TEXT,
    created_by VARCHAR(100),
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (project_id, code)
);

CREATE INDEX idx_sites_project ON sites (project_id);

-- ============================================================
-- DOCUMENT ARCHIVE (CORE DOMAIN)
-- ============================================================

CREATE TABLE documents (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID         REFERENCES projects(id) ON DELETE SET NULL,
    site_id         UUID         REFERENCES sites(id) ON DELETE SET NULL,
    title           VARCHAR(500) NOT NULL,
    document_number VARCHAR(100),
    category        VARCHAR(100) NOT NULL,
    document_type   VARCHAR(100) NOT NULL DEFAULT '',
    file_name       VARCHAR(500) NOT NULL,
    file_extension  VARCHAR(20)  NOT NULL DEFAULT '',
    file_size       BIGINT       NOT NULL DEFAULT 0,
    file_path       VARCHAR(1000) NOT NULL,
    revision        VARCHAR(20)  NOT NULL DEFAULT '00',
    document_date   DATE,
    uploaded_by     VARCHAR(200),
    status          VARCHAR(20)  NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','submitted','under-review',
                           'approved','rejected','superseded','archived')),
    tags            TEXT[]       NOT NULL DEFAULT '{}',
    notes           TEXT,
    created_by      VARCHAR(100),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_documents_project ON documents (project_id);
CREATE INDEX idx_documents_site ON documents (site_id);
CREATE INDEX idx_documents_category ON documents (category);
CREATE INDEX idx_documents_status ON documents (status);
CREATE INDEX idx_documents_number ON documents (document_number);
CREATE INDEX idx_documents_search ON documents USING gin (
    (coalesce(title,'') || ' ' || coalesce(document_number,'') || ' ' ||
     coalesce(category,'') || ' ' || coalesce(notes,''))
    gin_trgm_ops
);

CREATE TABLE document_revisions (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id    UUID         NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    revision       VARCHAR(20)  NOT NULL,
    file_name      VARCHAR(500) NOT NULL,
    file_extension VARCHAR(20)  NOT NULL DEFAULT '',
    file_size      BIGINT       NOT NULL DEFAULT 0,
    file_path      VARCHAR(1000) NOT NULL,
    uploaded_by    VARCHAR(200),
    notes          TEXT,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (document_id, revision)
);

CREATE INDEX idx_revisions_document ON document_revisions (document_id);

-- ============================================================
-- CONFIGURATION / LOOKUP TABLES
-- ============================================================

CREATE TABLE categories (
    id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code      VARCHAR(50)  NOT NULL UNIQUE,
    name      VARCHAR(200) NOT NULL,
    "group"   VARCHAR(50)  NOT NULL
              CHECK ("group" IN ('document-category','item-category',
                     'warehouse-type','document-type')),
    is_active BOOLEAN      NOT NULL DEFAULT TRUE,
    created_by VARCHAR(100),
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE units (
    id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code      VARCHAR(50)  NOT NULL UNIQUE,
    name      VARCHAR(200) NOT NULL,
    is_active BOOLEAN      NOT NULL DEFAULT TRUE,
    created_by VARCHAR(100),
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INVENTORY (migrated when needed, schema ready)
-- ============================================================

CREATE TABLE warehouses (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code       VARCHAR(50)  NOT NULL UNIQUE,
    name       VARCHAR(300) NOT NULL,
    type       VARCHAR(20)  NOT NULL DEFAULT 'central'
               CHECK (type IN ('central','site')),
    project_id UUID         REFERENCES projects(id) ON DELETE SET NULL,
    location   VARCHAR(500),
    status     VARCHAR(20)  NOT NULL DEFAULT 'active'
               CHECK (status IN ('active','inactive')),
    notes      TEXT,
    created_by VARCHAR(100),
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE items (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code          VARCHAR(50)  NOT NULL UNIQUE,
    name          VARCHAR(300) NOT NULL,
    category      VARCHAR(100) NOT NULL DEFAULT '',
    unit          VARCHAR(50)  NOT NULL DEFAULT '',
    brand         VARCHAR(200),
    minimum_stock NUMERIC(15,3),
    tracking_type VARCHAR(20)  DEFAULT 'none'
                  CHECK (tracking_type IN ('none','batch','serial')),
    notes         TEXT,
    created_by    VARCHAR(100),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE stock_transactions (
    id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    number                   VARCHAR(50),
    type                     VARCHAR(20)  NOT NULL
                             CHECK (type IN ('IN','OUT','TRANSFER','ADJUSTMENT','RETURN')),
    warehouse_id             UUID         NOT NULL REFERENCES warehouses(id),
    destination_warehouse_id UUID         REFERENCES warehouses(id),
    project_id               UUID         REFERENCES projects(id),
    item_id                  UUID         REFERENCES items(id),
    quantity                 NUMERIC(15,3),
    unit_cost                NUMERIC(15,3),
    reference_number         VARCHAR(100),
    date                     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    notes                    TEXT,
    created_by               VARCHAR(100),
    created_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stock_tx_warehouse ON stock_transactions (warehouse_id);
CREATE INDEX idx_stock_tx_type ON stock_transactions (type);
CREATE INDEX idx_stock_tx_date ON stock_transactions (date);

CREATE TABLE stock_transaction_lines (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID         NOT NULL REFERENCES stock_transactions(id) ON DELETE CASCADE,
    item_id        UUID         NOT NULL REFERENCES items(id),
    quantity       NUMERIC(15,3) NOT NULL,
    unit_cost      NUMERIC(15,3),
    sort_order     INT          NOT NULL DEFAULT 0
);

CREATE INDEX idx_stock_lines_tx ON stock_transaction_lines (transaction_id);
CREATE INDEX idx_stock_lines_item ON stock_transaction_lines (item_id);

-- ============================================================
-- MATERIAL REQUESTS
-- ============================================================

CREATE TABLE material_requests (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    number         VARCHAR(50)  NOT NULL,
    project_id     UUID         REFERENCES projects(id),
    site_id        UUID         REFERENCES sites(id),
    warehouse_id   UUID         NOT NULL REFERENCES warehouses(id),
    status         VARCHAR(30)  NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft','submitted','approved','rejected',
                          'partially-issued','issued','closed')),
    items          JSONB        NOT NULL DEFAULT '[]',
    requested_by   VARCHAR(200),
    reviewed_by    VARCHAR(200),
    review_notes   TEXT,
    notes          TEXT,
    created_by     VARCHAR(100),
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE material_request_lines (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id     UUID         NOT NULL REFERENCES material_requests(id) ON DELETE CASCADE,
    item_id        UUID         NOT NULL REFERENCES items(id),
    requested_qty  NUMERIC(15,3) NOT NULL,
    issued_qty     NUMERIC(15,3) DEFAULT 0,
    notes          TEXT,
    sort_order     INT          NOT NULL DEFAULT 0
);

CREATE INDEX idx_mr_lines_request ON material_request_lines (request_id);

-- ============================================================
-- SYSTEM: AUDIT, NOTIFICATIONS, IMPORT HISTORY
-- ============================================================

CREATE TABLE audit_logs (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    VARCHAR(100),
    username   VARCHAR(100),
    action     VARCHAR(100)  NOT NULL,
    entity     VARCHAR(100)  NOT NULL,
    entity_id  VARCHAR(100),
    old_value  JSONB,
    new_value  JSONB,
    ip_address INET,
    created_at TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_action ON audit_logs (action);
CREATE INDEX idx_audit_entity ON audit_logs (entity, entity_id);
CREATE INDEX idx_audit_date ON audit_logs (created_at DESC);

CREATE TABLE notifications (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type       VARCHAR(50)  NOT NULL,
    title      VARCHAR(500) NOT NULL,
    message    TEXT         NOT NULL,
    link       VARCHAR(500),
    entity_id  VARCHAR(100),
    user_id    VARCHAR(100),
    read_by    TEXT[]       NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_date ON notifications (created_at DESC);

CREATE TABLE import_history (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity          VARCHAR(100) NOT NULL,
    file_name       VARCHAR(500) NOT NULL,
    user_id         VARCHAR(100),
    username        VARCHAR(100),
    total_rows      INT          NOT NULL DEFAULT 0,
    successful_rows INT          NOT NULL DEFAULT 0,
    failed_rows     INT          NOT NULL DEFAULT 0,
    errors          TEXT[]       NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- NUMBERING COUNTERS
-- ============================================================

CREATE TABLE counters (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prefix     VARCHAR(20)  NOT NULL,
    year       INT          NOT NULL,
    last_value INT          NOT NULL DEFAULT 0,
    UNIQUE (prefix, year)
);
