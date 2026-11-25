# Phase 12 — Stage 2C: Production Readiness Gap Assessment (Documentation Only)

Status: **PASS WITH LIMITATIONS — assessment complete; no production readiness claimed.**
Baseline: branch `main`, HEAD `f91ed2f9e81db3937e3bcbb1b44e5e2c44e175cf`, November 2026.
Companion docs: A (`phase-12-separation-migration-architecture-report.md`), B (`phase-12-data-migration-matrix.md`), C (`phase-12-api-auth-permissions-map.md`), D (`phase-12-migration-validation-rollback-plan.md`), E (`phase-12-owner-decision-record.md`), Stage 0 inventory (chat-only, 2026-10-29), Stage 1 target design (`phase-12-stage-1-target-design.md`), Stage 2 dry-run report (`phase-12-stage-2-dry-run-report.md`), Stage 2 environment plan (`phase-12-stage-2-environment-plan.md`), Stage 2B report (`phase-12-stage-2b-report.md`).

**Language note:** technical body in English (see doc A header).

**Evidence labels:** `Verified` = file/code/SQL proof · `Inferred` = engineering deduction with named sources · `Proposed` = unimplemented design · `Unknown` = could not be verified now · `Recorded Owner Decision` = decision recorded in doc E.

**Scope:** documentation and static analysis only. No application source, migration SQL, database, secret, configuration, deployment, or Git state was changed. No SQL was executed. No production connection was made.

---

## 1. Executive Summary

A successful isolated PostgreSQL 17 migration dry run (all 19 migrations applied, exit 0; schema validated; runner idempotency confirmed; duplicate pair idempotent with populated data) does **not** establish production migration readiness. The remaining gaps are concentrated in three areas:

1. **Production facts are entirely unverified** — PostgreSQL version/patch, applied migration set (19–21), schema state, data counts, active sessions, role/permission state, JSON store contents, document storage integrity, backup/restore capability, and application runtime version are all `Unknown`.
2. **Two migrations carry stateful, non-trivially-reversible operations** — Migration 09 (document category remapping + deletion) and Migration 19 (authorization rebuild + session revocation). Both require pre-migration validation queries, backups, and tested rollback procedures before production use.
3. **PostgreSQL 18 compatibility is unverified** — the isolated PG 18 cluster could not be provisioned (0xC0000142 worker crash). A dry run on PG 18 in an isolated environment is still required before production migration readiness can be assessed.

**Final gate: `PASS WITH LIMITATIONS`** — the assessment document is ready for owner review. No production readiness is claimed. No production migration is authorized.

---

## 2. Evidence Reviewed

- Stage 0 inventory (chat-only, 2026-10-29): repository baseline, migration inventory (19 top-level + 3 in `down/`), JSON/runtime dependency matrix, attachment/backup counts, configuration setting names, unresolved production facts.
- Stage 1 target design (`phase-12-stage-1-target-design.md`): Option B architecture, entity matrix, D6/D7 designs, acceptance criteria, entry requirements.
- Stage 2 dry-run report (`phase-12-stage-2-dry-run-report.md`): environment verification, migration execution (19/19, exit 0), duplicate behavior, schema validation, idempotency findings, diagnostic findings (0xC0000142).
- Stage 2 environment plan (`phase-12-stage-2-environment-plan.md`): migration analysis, extension/privilege matrix, environment options, test DB spec, execution gates.
- Stage 2B report (`phase-12-stage-2b-report.md`): populated-data test (1 project/site/document), duplicate idempotency with populated data, FK integrity, PG 17/18 comparison (blocked), migration inventory, failures/risks.
- Docs A–E: architecture options, data migration matrix, API/auth/permissions map, migration/validation/rollback plan, owner decision record (D1–D8).
- Source files (read-only): all 19 migration files, `migrate.ts`, `connection.ts`, `auth.service.ts`, `session.service.ts`, `base.repository.ts`, `bootstrap.ts`, `seed-users.ts`, `app.ts`, `authorization.service.ts`, `projectScope.ts`.
- Owner-provided facts: PostgreSQL 18 operational, `cos_db` and `cos_authz_unit` exist, PG 18 data dir `C:\Program Files\PostgreSQL\18\data`.

---

## 3. Migration-by-Migration Risk Classification

Classification categories: **Additive** (new objects/columns, low risk) · **Transformative** (data changes, medium risk) · **Destructive** (data loss, high risk) · **Stateful** (non-reversible without backup) · **Conditional** (depends on prior state).

| # | Migration | Classification | Risk | Reversibility | Notes |
|---|---|---|---|---|---|
| 1 | 001_initial_schema.sql | Additive (baseline) | Low | N/A (baseline) | Creates all core tables, extensions, constraints. No data. Idempotent via `IF NOT EXISTS` (mostly). |
| 2 | 05_create_boq_and_ipcs.sql | Additive | Low | Reversible (DROP TABLE) | Creates boq_items, ipcs, ipc_items. No data. |
| 3 | 06_add_ipc_deductions.sql | Additive | Low | Reversible (DROP COLUMN) | Adds `deductions NUMERIC(14,2)` to ipcs. |
| 4 | 07_add_region_and_doc_ipc_link.sql | Additive | Low | Reversible (DROP COLUMN) | Adds `region` (projects), `ipc_id` (documents). |
| 5 | 08_seed_doc_categories.sql | Transformative (seed) | Low | Reversible (DELETE seeded rows) | Seeds Arabic document categories. |
| 6 | 09_fix_document_categories.sql | **Destructive + Transformative** | **High** | **Not reversible without backup** | DELETEs English document-category rows; UPDATEs document categories to Arabic canonical. See §4. |
| 7 | 10_add_revisions_column.sql | Additive | Low | Reversible (DROP COLUMN) | Adds `revisions JSONB` to documents. |
| 8 | 11_add_stock_items_column.sql | Additive | Low | Reversible (DROP COLUMN) | Adds stock-related column to items. |
| 9 | 11_modernize_dms.sql | Additive + Backfill | Medium | Partially reversible | Creates folders, document_links; backfills from project_id/site_id/ipc_id. Idempotent DDL + ON CONFLICT. |
| 10 | 12_backfill_document_revisions.sql | Transformative (backfill) | Medium | Partially reversible | Backfills document_revisions from documents. |
| 11 | 13_add_project_owner.sql | Additive | Low | Reversible (DROP COLUMN) | Adds `owner` to projects. |
| 12 | 14_seed_runtime_stores.sql | Transformative (seed) | Low | Reversible (DELETE seeded rows) | Seeds counters, units, categories (document-type). ON CONFLICT DO NOTHING. |
| 13 | 15_import_json_history.sql | Additive | Low | Reversible (DROP TABLE) | Creates import_history table. |
| 14 | 16_ipc_rejected_status.sql | Additive + Constraint replacement | Medium | Partially reversible | Adds 'rejected' to ipc status CHECK (DROP CONSTRAINT + ADD). |
| 15 | 17_core_uniqueness.sql | Additive (constraints) | Low | Reversible (DROP CONSTRAINT) | Adds PK/UNIQUE constraints. |
| 16 | 18_modernize_dms.sql | Additive + Backfill (duplicate of #9) | Medium | Partially reversible | Byte-identical to #9. Runner applies both. Idempotency verified (empty + limited populated data). |
| 17 | 19_authz_rebuild.sql | **Stateful + Destructive** | **High** | **Not reversible without backup** | Creates user_permission_overrides, project_members; rebuilds roles/permissions; FK users→roles; **revokes all sessions**. See §5. |
| 18 | 20_authz_backfill.sql | Transformative (backfill) | Medium | Partially reversible | Backfills authorization data. Depends on 19. |
| 19 | 21_direct_amounts.sql | Additive | Low | Reversible (DROP COLUMN) | Adds `net_amount`, `gross_amount` to ipcs. |

**Summary:** 12 additive, 4 transformative, 2 high-risk stateful/destructive (09, 19), 1 duplicate (16/18). No migration is unconditionally safe for production without pre-migration validation and backup.

---

## 4. Detailed Migration 09 Assessment (Document Categories)

### Exact operations (from `09_fix_document_categories.sql`)
1. `UPDATE documents SET category = 'عقد' WHERE category IN ('Contracts', 'doc-contract', 'contract');`
2. `UPDATE documents SET category = 'مقايسة' WHERE category IN ('BOQ', 'boq');`
3. `UPDATE documents SET category = 'رسومات' WHERE category IN ('Drawings', 'doc-drawing', 'drawings');`
4. `UPDATE documents SET category = 'تقارير' WHERE category = 'Reports';`
5. `UPDATE documents SET category = 'خطاب' WHERE category = 'Correspondence';`
6. `UPDATE documents SET category = 'مستخلص' WHERE category = 'Invoices';`
7. `UPDATE documents SET category = 'أخرى' WHERE category IN ('Other', 'Technical Documents');`
8. `DELETE FROM categories WHERE "group" = 'document-category';`
9. `INSERT INTO categories (id, code, name, "group") VALUES (...)` × 12 (Arabic canonical set), `ON CONFLICT (code) DO NOTHING`.

### Exact rows deleted
- All rows in `categories` where `"group" = 'document-category'`. This includes any English document-category rows that existed before migration 09. The count is **Unknown** (production data not inspected).

### Exact document category remapping
- Documents with categories in the listed English sets are remapped to Arabic canonical categories.
- Documents with categories **not** in any listed set (e.g., 'Invoices' is mapped, but a category like 'Misc' is not) remain unchanged — they are not remapped and not deleted.

### Reversibility
- **Not reversible without backup.** The DELETE removes category rows (including any custom English categories). The UPDATE overwrites the original category values. There is no inverse mapping stored.
- The INSERT uses `ON CONFLICT (code) DO NOTHING`, so re-running does not restore deleted rows or original values.

### Backup / snapshot required
- A pre-migration snapshot of the `categories` table (all rows, all groups) and the `documents` table (at least `id`, `category`) is required.
- `pg_dump` of the affected tables or a full database backup before migration 09.

### Pre-migration validation query required
- Count of document-category rows before deletion.
- Count of documents per category value before remapping.
- Identify any document categories not in the known mapping sets (these will be left unchanged — potential data integrity issue).
- Verify the `categories` table has the expected schema (code UNIQUE, group CHECK).

### Rollback
- Rollback requires **restoring data** (from backup), not merely reversing DDL. The deleted category rows and original document category values cannot be reconstructed from schema alone.
- If rollback is needed after migration 09, restore `categories` and `documents.category` from the pre-migration snapshot.

---

## 5. Detailed Migration 19 Assessment (Authorization Rebuild)

### Role and permission changes
- Seeds/refreshes 5 system roles (admin, management, warehouse, technical, viewer) with canonical permission arrays from `ROLE_PERMISSIONS`.
- Admin holds all 28 legacy keys + 3 admin keys (`roles.manage`, `projects.access`, `users.resetPassword`).
- `ON CONFLICT (name) DO UPDATE SET ... WHERE roles.is_system` — updates system roles only; custom roles (if any) are never touched.
- Creates `user_permission_overrides` table (GRANT/DENY over role inheritance).
- Creates `project_members` table (NONE/READ/WRITE/DELETE per project).

### User-role relationship changes
- Adds FK `users.role_name → roles(name)` (if not already present).
- Orphan guard: fails loudly if any `users.role_name` value is not one of the 5 known roles.

### Project membership and permission override effects
- `project_members` provides per-project access narrowing (scoped CRUD).
- `user_permission_overrides` provides per-user GRANT/DENY over role base.
- Precedence: role base → DENY override beats GRANT → GRANT override → project-access narrowing → active-user/known-key guard.

### Session revocation behavior
- `UPDATE sessions SET revoked_at = NOW() WHERE revoked_at IS NULL` — invalidates **all** active sessions. Every user must re-login once.
- This is a stateful, one-time operation. Re-running would be a no-op (already revoked rows skipped by `WHERE revoked_at IS NULL`).

### User-visible login impact
- All users lose their current session and must log in again.
- Pre-migration tokens (without `sid`) are rejected by `middleware/auth.ts:74-75`.
- Permission changes take effect after re-login (role/permission re-resolved server-side per request, but session must be valid first).

### Required communication and operational recovery procedure
- **Communication:** notify all users of a mandatory re-login window before migration 19 runs. Provide a re-login impact statement.
- **Recovery:** if migration 19 fails mid-execution, the transaction rolls back (runner wraps in BEGIN/COMMIT). However, if sessions were already revoked in a prior partial run (not possible within a single transaction, but possible if the migration was run manually), recovery requires restoring the `sessions` table from backup.
- **Pre-migration validation:** verify no unknown `role_name` values (orphan guard); verify `roles` table state; verify `users` table state.
- **Post-migration validation:** verify role×permission matrix cell-by-cell; verify admin-capable user count ≥ 1 (last-admin guard); verify session revocation count.

---

## 6. Production Facts Checklist

| # | Fact | Classification | Source needed |
|---|---|---|---|
| 1 | Exact PostgreSQL 18 version and patch | Unknown | Authorized read-only production assessment |
| 2 | Actual applied migration set | Unknown | `SELECT * FROM _migrations;` via authorized read-only session |
| 3 | Existing schema inventory (tables, columns, types) | Unknown | `information_schema` / `pg_catalog` query |
| 4 | Column types, nullability, defaults | Unknown | Same as above |
| 5 | Constraints and indexes | Unknown | `pg_constraint`, `pg_indexes` |
| 6 | Installed extensions and versions | Unknown | `SELECT * FROM pg_extension;` |
| 7 | Data counts for affected tables (users, roles, projects, documents, categories, sessions, etc.) | Unknown | `SELECT count(*)` per table (read-only) |
| 8 | Existing document/category relationships | Unknown | `SELECT category, count(*) FROM documents GROUP BY category` |
| 9 | Active session counts | Unknown | `SELECT count(*) FROM sessions WHERE revoked_at IS NULL AND expires_at > NOW()` |
| 10 | Role and permission state (roles, overrides, project_members) | Unknown | Read-only queries |
| 11 | JSON runtime stores: audit_logs, notifications, sessions.json | Unknown (file-based; runtime dependency partially unresolved) | File inventory + source reference audit |
| 12 | Document storage inventory and integrity | Unknown | File count + size + sha256 (read-only, no content modification) |
| 13 | Backup and restore capability | Unknown | Verify pg_dump/pg_restore availability and tested restore procedure |
| 14 | Application version and active runtime dependencies | Unknown | `package.json` in deployed artifact; `node --version` |

**Classification key:** Known from isolated testing (green) · Owner-confirmed but not independently verified (yellow) · Unknown (red) · Requires explicit future authorization (blue).

- Items 1–14: all **Unknown** (no authorized production access in this phase).
- Owner-confirmed but not independently verified: PostgreSQL 18 is the operational version (owner statement); `cos_db` and `cos_authz_unit` exist (owner statement); PG 18 data dir (owner statement via pgAdmin).
- Known from isolated testing: all 19 migrations apply successfully on PG 17.11; schema has 27 tables, 3 extensions, 14 CHECK, 29 FK, 89 PK, 63 UNIQUE, 69 indexes; duplicate migration idempotent (empty + limited populated data); runner re-execution passes.

---

## 7. PostgreSQL 18 Test Strategy

### Previous failure
Two independent PostgreSQL clusters (PG 17 on port 5439, PG 18 on port 5440) were initialized and started but crashed with `0xC0000142` (STATUS_DLL_INIT_FAILED) on worker-process initialization. No connection succeeded. Root cause: likely but unconfirmed (worker-process DLL initialization failure in this execution context). No event log entries found. No DLL diagnostic tool available without installation.

### Non-executing decision tree

```
1. Can the DLL initialization failure be diagnosed with existing tools?
   ├── YES (e.g., Dependency Walker / dumpbin / event log accessible) → identify failing module → fix or work around → retry provisioning
   └── NO → proceed to 2

2. Is an isolated VM already available?
   ├── YES → provision PG 18 on the VM (separate data dir, port, no production creds) → verify isolation → run dry run
   └── NO → proceed to 3

3. Is a separate physical/virtual host available?
   ├── YES → provision PG 18 on the separate host → verify isolation → run dry run
   └── NO → proceed to 4

4. Is an approved isolated container environment available and technically supported?
   ├── YES (e.g., container runtime verified, not Docker if unavailable) → provision PG 18 container → verify isolation → run dry run
   └── NO → BLOCKED: no verified path to PG 18 isolated testing
```

**Rules:**
- Do not install software, change system policies, alter services, or provision another cluster without a specific diagnostic justification.
- Do not repeat the same provisioning attempts (PG 17/18 initdb on this host) without new evidence.
- Any new provisioning attempt requires owner review of the isolation evidence before migration execution.
- Distinguish proposed approaches from verified available capabilities at all times.

---

## 8. D6 and D7 Dependencies

### D6 — JSON audit_logs/notifications → PostgreSQL migration

**Prerequisites:**
- D4 repair complete and typecheck green (satisfied 2026-10-29).
- D8 final approval (satisfied 2026-10-29).
- Stage 0 production baseline: verify production audit_logs/notifications table schemas, row counts, and field populations (Unknown — requires authorized production access).
- Source-to-target field mapping finalized (doc B §3 / Stage 1 §3): `userId`→`user_id`, `timestamp`→`created_at`, actor/username, `read_by` membership, payload body.
- Deterministic ID strategy verified (source identifiers and target uniqueness constraints).
- Idempotency proven (rerun + controlled-failure tests).
- Writer-switch procedure designed and approved (freeze file writes → final transform → reconcile delta → switch repository → verify no further JSON writes).
- Recovery/rollback procedure designed and tested (snapshot + post-cutover write policy + file-attachment recovery).
- Owner approval at applicable gates.

**Required source-to-target mappings (from Stage 1 §3.2):**
- `userId` → `user_id` (Proposed — not treated as required unless schemas prove it)
- `timestamp` → `created_at` (Proposed — not treated as required unless schemas prove it)
- camelCase payload fields → snake_case columns (Proposed)
- actor/username → actor identity columns (Unknown — before/after state sufficiency)
- `read_by` (notifications) → `read_by` membership (Unknown/Proposed)
- notification payload body → notification columns (Proposed — not finalized)

**Validation and quarantine:** derived from verified source fields, verified target constraints, and an approved handling policy. Records violating verified required fields or approved validation rules → quarantine (documented reject file/list; count and report; do not silently drop).

**Rollback:** restore from pre-migration snapshot (data rollback, not app rollback). Audit logs cannot be relied on for reversal until before/after information is verified (currently Unproven).

### D7 — Standalone HTTP adapter

**Prerequisites:**
- D4 repair complete and typecheck green (satisfied).
- Finalized prototype-to-live-API contract map with proven deltas (Unknown — not finalized).
- D3 namespace decision (deferred until contract map complete).
- Adapter built against current API as-is first (cookie/session contract per doc C).
- Server-side permission enforcement preserved (no client-side permission logic).
- Contract test cases: auth (login/refresh/logout/expired/invalid), permission grants/denials, project scope, CRUD per domain, audit/notification writes (post-D6), error handling (401/403/5xx).
- Owner approval at applicable gates.

**Dependencies on contract map:**
- Endpoint/method/request/response shapes (Unknown — to be generated post-conflict-resolution, now unblocked by D4).
- Permission keys (31 current; new keys require proven new business rules, added upstream).
- Project scoping (IDOR-safe, DB-row-backed).
- Namespace decision (`/api/v2/**` vs. none vs. different) — deferred until contract map complete.

---

## 9. Stage 3 Entry Criteria

### Documentation readiness
- [ ] Stage 0 inventory accepted (done — repository-only).
- [ ] Stage 1 target design accepted (done — owner-approved 2026-10-29).
- [ ] Stage 2 dry-run report complete (done — PASS WITH LIMITATIONS).
- [ ] Stage 2 environment plan complete (done).
- [ ] Stage 2B report complete (done — PASS WITH LIMITATIONS).
- [ ] Stage 2C gap assessment complete (this document).

### Isolated database test readiness
- [ ] D4 repair complete and typecheck green (done).
- [ ] Isolated disposable database environment available and proven (BLOCKED — 0xC0000142 on local PG 17/18; needs VM/separate host/approved container).
- [ ] Authorized isolated data source (synthetic or owner-authorized copy) confirmed.
- [ ] Migration runner and ordering inspected (done).
- [ ] Specific test scope documented (done — doc D Stage 3 scope rule).
- [ ] Duplicate migration behavior verified with broader populated data (partially — 1 project/site/document tested).
- [ ] Repeatability/idempotency proven (runner-level PASS; SQL-level PASS empty + limited populated data).
- [ ] Recovery/reconciliation policy tested (not yet — requires isolated environment).

### Production discovery authorization
- [ ] Authorized read-only production assessment approved by owner.
- [ ] Production PostgreSQL version, applied migrations, schema inventory, data counts, session counts, role/permission state, JSON store contents, document storage integrity, backup/restore capability, application version — all verified.
- [ ] Production facts checklist (§6) completed with evidence.

### Production migration authorization
- [ ] Owner approval of production migration plan.
- [ ] Pre-migration validation queries for Migration 09 and 19 executed and reviewed.
- [ ] Backup/snapshot procedure tested and verified.
- [ ] Rollback/recovery procedure tested and verified (including post-cutover write policy).
- [ ] Communication plan for session revocation (Migration 19) approved.
- [ ] Owner sign-off at each applicable gate.

### Rollback and recovery readiness
- [ ] Named recovery point (pre-cutover snapshot, isolated copy).
- [ ] Explicit written decision for post-cutover writes (replay / reconciliation / deliberate discard / other proven recovery).
- [ ] Recovery/reconciliation plan for file attachments and external side effects.
- [ ] Evidence that audit trail captures operations rollback depends on (currently Unproven).

### Owner approval
- [ ] Stage 3 entry approved by owner after all above gates satisfied.

**A successful isolated dry run alone does not satisfy production readiness.**

---

## 10. Open Decisions Requiring Owner Approval

1. Whether to provision an isolated PostgreSQL 18 environment on a VM/separate host (given the 0xC0000142 failure on this host) — and who owns that infrastructure.
2. Whether to repeat the dry run on PG 18 before production migration readiness can be assessed.
3. Timing of D4 repair execution (completed 2026-10-29 — done).
4. D5 secret movement/rotation (deferred pending production-source verification and impact assessment).
5. D6 audit/notifications migration execution timing (gated by stage approvals).
6. D7 HTTP adapter implementation timing (gated by contract map and stage approvals).
7. Whether to proceed with a broader populated-data dry run (more entities) before production readiness.
8. Whether to authorize a read-only production assessment (to close Unknown production facts).
9. Whether to authorize a test of the recovery/reconciliation procedure (post-cutover write policy).
10. Any new permission key, namespace, or schema change.

---

## 11. Git Status and Confirmation of Zero Code/Database Changes

**This task made no code, database, migration, schema, secret, configuration, deployment, or Git-state changes.**

Documentation changes:
- **Created:** `docs/frontend-rebuild/phase-12/phase-12-stage-2c-production-readiness-gap-assessment.md` (this document).
- **Not modified:** Docs A–E, source code, tests, database, migrations, configuration, secrets, dependencies.

**Git status:**
```
 M apps/api/logs/service-err.log
 M apps/api/logs/service-out.log
 M apps/api/src/... (18 conflict-repair files)
 M package-lock.json
 M package.json
 M scripts/install-service.ps1
 M test-results/.last-run.json
?? COS_Full_Frontend_Rebuild_Phase_Prompts_AR.md
?? COS_Full_Frontend_Rebuild_Plan_AR.md
?? docs/
```
No staging, no commit, no reset. Pre-existing tracked modifications preserved. The `docs/` directory (untracked) contains all Phase 12 documents.

---

## Final Gate

**PASS WITH LIMITATIONS** — the production readiness gap assessment is complete and ready for owner review. No production readiness is claimed. No production migration is authorized. All production facts remain Unknown until independently verified through an explicitly authorized, read-only assessment.

**Do not start Stage 3, Phase 13, D6 production data migration, or D7 adapter implementation.**