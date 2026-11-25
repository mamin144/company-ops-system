# Phase 12 — Data Migration Matrix (Design Only)

Status: **DESIGN ONLY.** No data was read from, imported to, exported from, or deleted from any database during Phase 12. Below is a classification derived purely from repository files.
Baseline: HEAD `f91ed2f9` on branch `main`.

Evidence labels: **Verified** / **Inferred** / **Proposed** / **Unknown**.

---

## 1. Which Store Runs at Runtime (Pivotal Question — Answer)

The runtime is **PostgreSQL for the operational core**. The JSON data layer under `apps/api/data/**/*.json` exists at startup but is no longer the dominant source of truth. Distribution:

| Store | Repos | Repos |
|---|---|---|
| **PostgreSQL (`PgBaseRepository`)** | 14 of 16 | project, site, document, folder, document-link, import-history, item, warehouse, material-request, stock-transaction, user, boq, ipc (×ipc_item), config (categories/units) |
| **File (`BaseRepository`, JSON files)** | 2 of 16 | audit-log, notification |

Secondary verified facts:
- Sessions: written to Postgres `sessions` table (`session.service.ts:58-70`) — the JSON `sessions.json` file appears to be a leftover/reference layer.
- One-shot JSON→PG loader exists: `apps/api/src/database/data-migration.ts` (single-transaction).
- Startup recreates empty JSON files via `storage/bootstrap.ts` — they **do not currently reseed acts from JSON**, but seed constants (`seedCategories`, `seedUnits`, `seedUsersAndRoles`) are applied.

---

## 2. Database Inventory (schema source: `001_initial_schema.sql` + later migrations — Verified)

Header columns: **Entity/Table · Purpose · Relations · Key Constraints · Current Usage · Migration Notes**.

| Entity/Table | Purpose | Relations | Key Constraints | Current Usage (repo evidence) | Migration Notes |
|---|---|---|---|---|---|
| `roles` | Role/permission base | referenced by `users.role_name` (FK, migration 19) | `name` UNIQUE; permissions TEXT[] | Read at runtime (`authorization.service.ts:95-99`) | Direct Copy; include `is_system`, permissions arrays verbatim |
| `users` | Identity | `sessions.user_id` cascade; `user_permission_overrides.user_id` cascade; `project_members.user_id` cascade | `username` UNIQUE; `is_active` | Runtime CRUD (`user.repository.ts:7` extends Pg) | Direct Copy (password_hash + bcryptjs confirmed portable) |
| `sessions` | Refresh-token records | `user_id` → users CASCADE | sha256 token hash; expires/revoked | Runtime create/verify (`session.service.ts:58-70`) | **Migration policy (explicit, Proposed):** four distinct actions must not be conflated: (1) creating the target `sessions` table/schema in Postgres — already exists in the current schema (`001_initial_schema.sql`); (2) copying historical or active session rows — **not** done by default; (3) deliberate invalidation of existing sessions at cutover — **default-safe option** (one re-login per user, precedent `19_authz_rebuild.sql:91-93`); (4) preserving session rows — only if explicitly approved by the Owner **and** verified that hashed records verify against the new secret — neither hash-portability nor row-preservation is automatically safe. Under the default invalidation policy, no active legacy session is copied or made valid in the new system; expired/revoked/invalid sessions are never resurrected. |
| `projects` | Project header | sites/documents/warehouses/material_requests/approved links; `project_members.project_id` cascade | `project_code` UNIQUE; `status` CHECK; `role` CHECK | Runtime CRUD (`project.repository.ts:7`) | Direct Copy; preserve `contract_value` (migration 21) |
| `sites` | Project sites | documents, material_requests | `UNIQUE(project_id, code)` | Runtime (`site.repository.ts:7`) | Direct Copy |
| `documents` | Main document archive | revisions (CASCADE), document_links (CASCADE), folders | `file_path` NOT NULL; `status` CHECK; `revision` default '00' | Runtime (`document.repository.ts:7`) | Direct Copy + review legacy migration paths (migrations 08/09/11 Modernize DMS) |
| `document_revisions` | Version history | → documents CASCADE | `UNIQUE(document_id, revision)` | Runtime | Direct Copy |
| `document_links` | Polymorphic links (project/site/ipc/folder) | `document_id` → documents CASCADE | `UNIQUE(document_id, entity_type, entity_id)` | Runtime (`document-link.repository.ts:5`) | Direct Copy; **entity_id is polymorphic — no native FK**, must verify polluter rows in Stage 3 |
| `folders` | Folder tree | `parent_id` self-join CASCADE | — | Runtime (`folder.repository.ts:6`) | Direct Copy |
| `warehouses` | Warehouses | documents, items, stock_transactions, material_requests | `code` UNIQUE; `type` CHECK | Runtime (`warehouse.repository.ts:7`) | Direct Copy |
| `items` | Items catalog | stock_transactions, stock_transaction_lines, material_request_lines | `code` UNIQUE; `tracking_type` CHECK | Runtime (`item.repository.ts:7`) | Direct Copy |
| `stock_transactions` | Stock movements | warehouse/destination_warehouse/project/item | `type` CHECK — IN/OUT/TRANSFER/ADJUSTMENT/RETURN | Runtime (`stock-transaction.repository.ts:7`) | Direct Copy |
| `stock_transaction_lines` | Transaction lines | → stock_transactions CASCADE, → items | NOT NULL quantities | Runtime | Direct Copy |
| `material_requests` | Requests header | sites/warehouses/projects | `UNIQUE`/items JSONB; `status` CHECK (7 states) | Runtime (`material-request.repository.ts:7`) | **Transform-candidate** — items stored as JSONB plus separate lines table; reconcile the two shapes in Stage 1 (Verified of shape, Proposed for consolidation) |
| `material_request_lines` | Request lines | → material_requests CASCADE, → items | `issued_qty` default 0 | Runtime | Direct Copy |
| `boq_items` | BOQ per project (migration 05) | → projects CASCADE | NOT NULL quantities/prices | Runtime (`boq.repository.ts:7`) | Direct Copy |
| `ipcs` | Interim Payment Certificates (migration 05) | ipc_items → ipc; contract links via `document_links` | `ipc_number` INTEGER, `status` CHECK (draft/submitted/approved — +`rejected` via migration 16) | Runtime (`ipc.repository.ts:7`) | Direct Copy; include `net_amount`, `gross_amount` (migration 21) |
| `ipc_items` | IPC.LINE items | → ipcs CASCADE; `boq_item_id` RESTRICT | `UNIQUE(ipc_id, boq_item_id)` | Runtime (`ipc.repository.ts:69`) | Direct Copy |
| `categories` | Lookup dictionaries | document metadata reference | `code` UNIQUE; `group` CHECK — document-category / item-category / warehouse-type / document-type | Runtime (`config.repository.ts:4`) | Direct Copy; preserve Arabic canonical set post-migration 09 |
| `units` | Lookup dictionaries | items | `code` UNIQUE | Runtime (`config.repository.ts:23`) | Direct Copy |
| `counters` | Auto-numbering | — | `UNIQUE(prefix, year)` | Runtime | **Direct Copy — preserve values verbatim**; must not re-seed differently or numbering collides (verified pattern at `19_authz_rebuild.sql` "one-time snapshot" plus `data-migration.ts:179-199`) |
| `user_permission_overrides` | Per-user grant/deny | user FK | `PRIMARY KEY(user_id, permission_key)`, effect in grant/deny | Runtime | Direct Copy |
| `project_members` | Project access | projects/users | `PRIMARY KEY(project_id, user_id)`, access in {NONE, READ, WRITE, DELETE} | Runtime | Direct Copy |
| `audit_logs` (JSON) | Audit trail | — | — | **File-based** (Verified) | **Transform** if migrating to Postgres; current repo treats as separate store |
| `notifications` (JSON) | Notifications | — | — | **File-based** (Verified) | **Transform** if migrating to Postgres; current repo treats as separate store |
| `import_history` (JSON) | Import record | — | — | **PostgreSQL (Verified — `import-history.repository.ts:7,9` extends `PgBaseRepository`, table `import_history`)**; the `data/*.json` import-history variant is a bootstrap/legacy artifact, **not** the runtime write path. Whether the JSON file holds stale data not present in Postgres is Unknown. | Direct Copy of the PostgreSQL table (typed format from `15_import_json_history.sql`); the legacy JSON file is Historical/Read-only input, not an automatic production-migration source |
| `data/.jwt-secret` | Seed runtime secret | — | filesystem | startup | **Do Not Migrate** as a data row — treat as a secret via separate handling (Proposed) |
| `storage/documents/**` & `backup/2026-10-11_08-52-safety/` | Binary attachments | referenced by `documents.file_path`, `document_revisions.file_path` | filesystem | runtime | Direct Copy at co-located level; copy is **independent of PostgreSQL data** (Verified — different directories). Never assume json-transfer carries it. |

Duplicate migration files (Verified): `11_modernize_dms.sql` and `18_modernize_dms.sql` are byte-identical, 1644 bytes each.

---

## 3. Data Migration Classification Matrix

Classification column uses the 7 categories defined in the Phase 12 prompt: `Direct Copy` / `Transform` / `Restructure` / `Rebuild/Regenerate` / `Historical/Read-only` / `Do Not Migrate` / `Undetermined`.

**Conditional applicability:** these classifications are a preliminary plan for a target system/database under the target-schema assumptions stated in this document. They are not a universal instruction to migrate data under every architecture option. Distinguish: (1) reuse the existing database without moving the corresponding data; (2) move data to a separate database with an equivalent schema; (3) migrate into a redesigned schema whose semantics and relationships may differ. Where the target schema is not finalized, the classification is conditional or `Undetermined` — no claim is made that all known entities must be copied or that no restructuring will be needed.

| Source | Target Concept | Classification | Transformation | Dependency / Order | Integrity Risks | Validation |
|---|---|---|---|---|---|---|
| `users` + `roles` + `user_permission_overrides` + `project_members` | Same schema | **Direct Copy** | None (identity) | First (identity precedes other FKs) | Role key expansion risk if new keys are added by mistake → re-run no-op matrix against `19_authz_rebuild.sql` | Stage 3 role×permission matrix diff |
| `sessions` | Same schema | **Table structure carries over (schema exists); row policy explicit (Proposed):** deliberate invalidation default-safe at cutover (one re-login, precedent `19_authz_rebuild.sql:91-93`); active legacy session rows are **not** copied or made valid under the default policy; conditional preservation requires Owner approval plus verification that hashed records verify against the new secret — neither hash-portability nor row-preservation is automatically safe | None; no row copy under default | After users | Expired/revoked/invalid rows must not resurrect as active | Validation counts compare source/target only (do not imply migration of active rows); verify one hashed record against new secret only if preservation is approved |
| `projects`, `sites` | Same schema | **Direct Copy** | None | Before dependent tables | — | counts + FK check |
| `documents`, `document_revisions`, `document_links`, `folders` | Same DMS schema (post-migrations 11/12/18) | **Direct Copy** | No schema change (migrations 11/18 already consolidated to document_links) | After projects/sites | `file_path` must match actual file on disk; legacy `documents.ipc_id` column references must map—currently kept alongside `document_links` (verified at `11_modernize_dms.sql` and its duplicate) | File-existence check; count of each relation |
| `warehouses`, `items`, `stock_transactions`, `stock_transaction_lines` | Same schema | **Direct Copy** | None | After projects/warehouses/items | Decimal precision (NUMERIC(15,3)) must not drift | count + numeric spot-check |
| `material_requests` + `material_request_lines` | Same schema | **Transform (candidate)** | Decide whether to keep JSONB `items` alongside `material_request_lines` or consolidate — Proposed option, not verified | After items/projects/warehouses | Two representations could drift | consistency iterated in Stage 1 |
| `boq_items`, `ipcs`, `ipc_items` | Same schema | **Direct Copy** | None | After projects | `ipc_number` INTEGER is human-facing — preserve as-is | counts |
| `categories`, `units`, `counters` | Same schema | **Direct Copy** | For counters especially — copy values verbatim; Arabic document-type canonical set may need remapping if legacy JSON had old keys (Verified precedent in migration 09) | First (before dependent lookups) | In the Arabic canonical set swap — a mis-merge in doc categories breaks archive filtering | Sample spot-check + counts |
| JSON `audit_logs` | PostgreSQL `audit_logs` | **Transform** | Field mapping from JSON shape (`userId`, `timestamp`, camelCase) to SQL shape (`user_id`, `created_at`) — same convention as `data-migration.ts:122-131` | Late; unavoidable read-only window | Legacy JSON records not in Postgres will disappear from runtime API unless transformed | Spot-check + counts |
| JSON `notifications` | PostgreSQL `notifications` | **Transform** | Same JSON→SQL field mapping | Late | Same risk as audit | counts |
| PostgreSQL `import_history` | Same schema | **Direct Copy** (runtime store is already PostgreSQL — `import-history.repository.ts:7,9`) | None | Late | — | counts |
| Legacy JSON `import_history` file | — | **Historical/Read-only** (bootstrap/legacy artifact; not read at runtime as the dominant source). No automatic production migration claim — content delta vs Postgres is Unknown | None | N/A | — | — |
| `data/.jwt-secret` | Secrets manager | **Do Not Migrate (as data row)** | Physical relocation only; value never recorded in Phase 12 | Before any cutover (operations, not data) | Loss of secret = all user sessions invalid → one coordinated re-login Active | Secret-presence check (existence only) |
| `storage/documents/**` | Target object / file store | **Direct Copy** | None (path-preserving first; renaming/UI-only restructure later) | Independent of SQL migration runs; can run in parallel | Path hash naming already present; no current restructure proposal inside Path 12 counts | File count + size + sha256 sample |
| `apps/api/backup/**`, `apps/api/temp/*` | Historical / retained | **Historical/Read-only** | None | N/A | Do not include in operational migration scope without owner decision | — |
| Old frontend `apps/web/**` | Replacement | **Rebuild/Regenerate** (frontend, not data) | Full new UI rebuild path (Phase 3 prototype → HTTP adapter) | Not part of data migration | Contract mismatch with prototype mock API — needs HTTP adapter task first (already flagged in Phase 11 limitations; Inferred) | Build + vitest suite |

**Undetermined rows:** the target **semantics** of two rows remain Undetermined rather than fully mapped: (a) `material_requests` — whether to keep JSONB `items` alongside `material_request_lines` is a Proposed consolidation, not verified; (b) any post-rebuild capability deltas (e.g. new financial fields in the prototype's مستخلص/عقد modules) — not yet known until the prototype contract map is finalized; these would become new transform rules in a second pass. All currently-identified entities are mapped to a source store, but "no restructuring required" is **not** claimed — the current schema being known does not prove a redesigned target would not need changes.

---

## 4. Migration Execution Order (Proposed)

```
   Stage A (identity) : roles → users → user_permission_overrides → project_members
   Stage B (master)  : categories → units → counters → projects → sites
   Stage C (operational) : warehouses → items → boq_items
   Stage D (transactional) : stock_transactions → stock_transaction_lines
                            material_requests → material_request_lines
                            documents → document_revisions → document_links
                            ipcs → ipc_items
   Stage E (support) : sessions (schema only; row invalidation default-safe per policy above) → audit_logs (JSON→PG Transform) → notifications (JSON→PG Transform) → import_history
   Stage F (files)   : storage/documents/** → storage mirror (parallel-safe)
```
Source: ordering derived from FK dependencies in `001/05/11/18/19/20/21` migrations (Inferred → Proposed).

---

## 5. Missing Information (Unknown)

1. **Live row counts / production dataset volume**; inferred from repo tree only.
2. **Actual content of `data/*.json`** (was listed but not read fully — numbers of records inside each JSON file remain Unknown; safe to not parse in a read-only scope).
3. **Runtime status of `_migrations`** on the deployed database — the repo cannot verify whether migrations 19–21 were ever applied in the owner's production DB.
4. **Whether Arabic canonical categories (migration 09) are fully applied** in production; differs per database state.
