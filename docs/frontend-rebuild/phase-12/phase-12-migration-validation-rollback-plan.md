# Phase 12 — Migration, Validation & Rollback Plan (Design Only)

Status: **DESIGN ONLY — no migration has been executed. D8 has final owner approval (2026-10-29); this plan is approved as the governing plan, and no stage execution is authorized without its entry conditions and required approvals.**
Baseline: HEAD `f91ed2f9` on branch `main` at document creation time.

Evidence labels: **Verified** = file/code/SQL proof. **Inferred** = engineering deduction with named sources. **Proposed** = unimplemented design. **Unknown** = could not be verified now.

---

## 0. Ground Facts This Plan Stands On

1. **PostgreSQL is the runtime store today** (Verified):
   - 14 of 16 repositories in `apps/api/src/repositories/` extend `PgBaseRepository` and query `pool` directly. Full list in `phase-12-data-migration-matrix.md`.
   - `session.service.ts` lines 58–70 insert sessions into the `sessions` table.
   - `apps/api/src/database/data-migration.ts` is a one-shot JSON→PostgreSQL loader inside a single transaction (BEGIN/COMMIT).
2. **JSON layer is now a bootstrap/legacy layer** (Verified):
   - `storage/bootstrap.ts` lines 21–36 recreate `data/*.json` at startup.
   - Actual file-store exceptions: `audit-log.repository.ts:7` and `notification.repository.ts:7` extend the file-based `BaseRepository`.
   - `data/.jwt-secret` is a startup secret. Its value is never quoted in Phase 12 docs.
3. **The backend source does not currently compile** (Verified): `npm run typecheck` in `apps/api` fails with TS1185 errors; 18 files under `apps/api/src/**` contain unresolved git merge-conflict markers.
4. **Two byte-identical migration files**: `11_modernize_dms.sql` and `18_modernize_dms.sql` (1644 bytes each). The runner (`migrate.ts:36-38`) sorts with `localeCompare`, so identical content executes multiple times — harmless because idempotent, but documented debt.

---

## 1. Plan Principles

- This plan does not itself authorize source, database, or production changes. Stage 0 is read-only; Stage 2 dry runs use an authorized isolated copy. Any production action requires explicit approval at its applicable gate.
- The separate D4 conflict-marker repair task has been approved for creation, but its execution timing is deferred. It is not part of this plan's dry run and must not be bundled with unrelated changes.
- Default success criterion: **zero unexplained data loss or corruption**. Any accepted exception must be explicitly recorded in `phase-12-owner-decision-record.md`.
- Idempotency must be demonstrated by testing; a transaction wrapper alone does not prove that rerunning a script cannot duplicate or lose data.
- Free-form Dual Writes are prohibited (see §6).

---

## 2. Stages (Stage 0 → Stage 6)

### Stage 0 — Readiness & Source Inventory (Proposed)
- Inputs: this repository, the inventory in `phase-12-data-migration-matrix.md`, and an authorized read-only production-like environment (not reachable in Phase 12).
- Work: pin PostgreSQL version and applied migration set from `_migrations`; record database and file sizes/counts from authorized read-only metadata; inventory `data/*.json`, `storage/documents/**`, and `backup/**`; audit migration ordering and duplicates. Verify production configuration by checking presence/absence of relevant setting names only; never disclose secret values. Classify JSON dependencies per file rather than treating all JSON files as retired.
- Success: complete inventory; no entity or relevant file left unclassified; production facts are clearly distinguished from repository-only evidence.
- Failure: any missing entity, unsupported production claim, or metrics taken from an unauthorized environment.
- Approval: implementer (backend dev) + Owner for the stage output; this read-only stage does not authorize production changes.

### Stage 1 — Target Design (Proposed)
- Materials: target design derived from docs B and C and verified against the actual schema/catalog and applied migration set discovered at Stage 0. `001_initial_schema.sql` is a reference, not proof by itself of the production schema; migrations 19–21 remain Unknown until verified.
- CHECK constraints and ENUM values must reflect the verified target schema and migration state, not be copied from an initial migration without checking later changes.
- **Owner decision D2 is recorded:** use the current PostgreSQL database (topology option 1). This sets the intended topology only; it does not authorize DDL, database changes, data migration, or execution. Options 2 and 3 are not selected unless new evidence prompts a new Owner decision.
- **Owner decision D1 is recorded:** Option B, logical separation with selective reuse. **D3 remains deferred:** no new API namespace is approved now; revisit the namespace only after the prototype-to-API contract map is complete.
- Design the D6 audit/notification migration target as a scoped task against the existing PostgreSQL database; do not assume a wholesale database move or migration of every JSON file.
- Approval: Owner of the design deliverable. Approval of the deliverable is not permission to implement it.

### Stage 2 — Dry Run (Proposed, with mandatory precondition)
- Precondition: the separate D4 repair must actually be completed, the intended source logic reviewed, and `npm run typecheck` must exit 0 before any migration script runs. D4 task creation is approved, but its execution timing is deferred; therefore this stage is currently blocked.
- Execution: use an authorized isolated data copy and isolated target; run only the specifically approved dry-run script; record duration, per-entity counts, transform errors, and a per-run report. No production script execution is permitted in this stage.
- Success: all Stage 3 checks are green on the isolated copy, with every difference explained.
- Approval: backend dev prepares the evidence; Owner reviews the results before the plan advances.

### Stage 3 — Automated Validation Suite (Proposed design)

**Scope rule:** run checks that apply to the specifically approved work item and its affected data. D2 selects the current PostgreSQL database; it does not imply a wholesale database migration. For the currently approved D6 task, source-to-target data reconciliation focuses on `audit_log.json` / `notifications.json` and the PostgreSQL `audit_logs` / `notifications` tables. Checks for identity, passwords, sessions, attachments, other entities, or permissions become mandatory only when the approved scope affects or depends on them; their presence in the table does not approve migrating or modifying them.

| Check | Evidence base | Idea |
|---|---|---|
| Record counts per affected entity/table | Doc B inventory and approved task scope | For D6, compare JSON source counts with the target `audit_logs` / `notifications` tables and explain every delta. Do not treat all existing PostgreSQL tables as migration targets under D2 |
| PK/Unique integrity | Verified target catalog after Stage 0; reference migrations `001_initial_schema.sql:13-51`, `17_core_uniqueness.sql` | Insert duplicate test in isolation — rejection expected; confirm constraints actually exist in the selected target schema |
| Transform correctness | Per-entity transform rules in doc B | Verified on a signed-off sample (e.g. ~10 rows approved by Owner) |
| Orphan detection | `stock_transactions.item_id`, `documents.project_id`, `document_links.entity_id` | `LEFT JOIN` per ref; expects zero rows |
| FK integrity | Verified target catalog and applied migration set after Stage 0; references include `001…`, `05…`, `19…` | `pg_constraint` inspection + FK-relation test against the selected target schema |
| Soft deletes / revoked states (conditional) | `users.is_active`, `sessions.revoked_at` | Compare only if the approved scope changes or migrates these entities; otherwise this check is not a reason to alter them |
| Roles & Permissions mapping (conditional) | `19_authz_rebuild.sql:46-77` | If an approved scope changes role/permission data, diff the role×permission matrix cell-by-cell; otherwise keep the existing server-side permissions unchanged |
| Password hashes (conditional) | bcryptjs — `apps/api/package.json:18` | Only if identity/password data is in an approved transfer: spot-check known-password logins; D2 alone does not authorize moving user records |
| Files/Attachments (conditional) | `documents.file_path`, `document_revisions.file_path` | If the approved scope affects file metadata or physical files, verify every in-scope path resolves; do not move attachments by assumption |
| Sessions / JWT | sha256 token hash — `session.service.ts:22` | The production signing-secret source is Unknown. D5 approves preparing a safe handling/rotation plan only; actual change and rotation window are deferred until source and login impact are verified. Test session rows only if a separately approved change actually moves/preserves them; do not assume a global session reset or re-login solely because D2 reuses the current DB. Any planned invalidation requires an explicit impact statement and Owner approval |
| Idempotency | Re-run and controlled failure tests in the isolated environment | Demonstrate that reruns and interrupted/failed runs do not duplicate or lose data; verify stable keys/unique constraints and recovery behavior. A transaction wrapper alone is insufficient evidence |

- Success: every check actually executed in an isolated environment; any diff becomes a logged issue.
- Failure: any unexplained diff halts migration.

### Stage 4 — Reconciliation & Acceptance (Proposed)
- Review diffs with the Owner in Arabic, cell by cell, or record explicit acceptances in `phase-12-owner-decision-record.md`.
- Approval: Owner only.

### Stage 5 — Scoped Transition / Cutover Design (Proposed; design before execution)
- Scope guard: D1 selects Option B and D2 selects the current PostgreSQL database. This plan does **not** presume a wholesale database move, a new API namespace, a new backend, or that the existing API must become read-only. D3 defers the namespace decision; no new namespace is approved now.
- Mechanics to design for each separately approved work item:
  1. Identify exactly which component/entity is changing and document its current and target writer. During coexistence, keep one authoritative writer for each affected record/domain; do not declare all legacy components read-only by assumption.
  2. For D6, define the controlled handoff for `audit_log.json` and `notifications.json`: capture/freeze the relevant file-backed writes only as required by the approved conversion, reconcile the final delta, switch the repository to the verified PostgreSQL target, then verify no further writes reach those two files. Any such repository/code change remains subject to the D8 gates.
  3. For D7, define the adapter route/auth/transport behavior against the current API and finalized contract map. Do not flip `VITE_API_URL`, alter `DATABASE_URL`, introduce a namespace, or change routing unless that specific change is approved and necessary.
  4. Handle sessions and secret rotation only if the approved scope requires it. Verify the production secret source and assess session/login impact first; do not impose a global re-login solely by precedent.
  5. Before any production transition, document the recovery point, treatment of writes after the transition, file/attachment recovery, external side effects, monitoring, owner-facing acceptance criteria, and a tested rollback/reconciliation method.
- Success: the specifically approved scope is consistent and validated; any go-live/cutover is a separate, explicit authorization and must have no unresolved critical differences or known unsafe rollback gap. “New system live” is not a Stage-5 design-stage success criterion.
- Approval: Owner + responsible engineer for the scoped transition plan; separate Owner approval is required before any production cutover or production data change.

### Stage 6 — Post-Change Verification (Proposed; scoped to the approved work)
- For D7, once implementation is separately authorized, validate the HTTP adapter against the finalized contract map; test authentication, expected permission grants, and explicit denials (`SCOPED_MIN_LEVEL` — `authorization.service.ts:59-75`) without changing server-side permission policy.
- Run the relevant existing vitest tests (`apps/api/tests/`, per doc C) and `npm run typecheck` in the authorized verification environment. Do not claim the full suite is green until it has actually run.
- Test CRUD only for the domains and roles covered by the approved task; verify audit/notification writes for D6 only after the D6 conversion has been implemented and authorized.
- Compare record counts and data semantics only for entities in the approved transformation scope.
- After the separately approved D6 conversion is executed and verified, assert that runtime writes for audit logs and notifications no longer reach `audit_log.json` and `notifications.json` and instead reach the intended PostgreSQL tables.
- Do **not** assert that no JSON file may be written anywhere under `data/`: other files must be assessed per file, with unresolved runtime dependencies kept Unknown and no blanket retirement or deletion.

---

## 3. Stage Summary Table

| Stage | Inputs | Outputs | Accept | Fail | Approver |
|---|---|---|---|---|---|
| 0 | Repo state + DB/data files | Final inventory | Complete, no gaps | Missing entity | Owner |
| 1 | Inventory | Target Schema proposal | Owner approval | Unresolved ambiguity | Owner |
| 2 | Target design + isolated copy | Dry Run results | Stage 3 green | Any red check | Dev + Owner |
| 3 | Dry Run snapshot | Reconciliation matrix | Zero unexplained diff | Unexplained diff | Owner |
| 4 | Stage 3 report | Formal sign-off | Owner signature | Open diffs | Owner |
| 5 | Accepted scoped design + tested recovery proposal | Scoped transition/cutover plan | Owner accepts scope, recovery, and criteria; separate production approval still required | Unclear writer ownership, unsafe rollback, or unresolved critical gap | Owner + responsible engineer |
| 6 | Separately authorized transition completed | Verification report | Relevant suite green + manual scenarios + no unexplained diffs | Suite failures or unexpected JSON writes in converted repositories | Owner |

---

## 4. Coexistence Rules (Proposed)

1. For each affected entity/domain, identify one authoritative writer at a time. D1 Option B and D2 reuse of the current database do not, by themselves, mean that the whole legacy application becomes read-only or that the whole new UI is the sole writer.
2. No Dual Writes in any form. Any shared-write scheme needs a new, explicit owner decision (not covered by Phase 12).
3. Restoring a pre-cutover snapshot does **not** preserve writes accepted by the new system after cutover. Post-cutover writes require a designed and tested policy — replay into the old system, reconciliation, deliberate discard with explicit Owner approval, or another proven recovery mechanism — before cutover can be approved. Audit logs cannot be relied on for reversal until the necessary before/after information and operation coverage have been verified; currently Unproven, so manual reconciliation may be needed. File attachments and external side effects must have their own recovery/reconciliation plan independent of database rollback. If no reliable rollback path exists, rollback is unsafe and must be treated as a blocker for cutover approval.
4. Runtime writes to `audit_log.json` and `notifications.json` are verified in source. Their JSON→PostgreSQL conversion is an approved independent task under D6, but is not executed by this plan revision. The target/schema mapping belongs in Stage 1; implementation and data transformation remain blocked until the final D8 plan is approved and the required later-stage gate explicitly authorizes them. Other JSON files must be reviewed individually; this plan does not authorize deletion, retirement, or a blanket read-only rule for `data/*.json`.

---

## 5. Rollback — App Rollback vs Data Rollback

- **App Rollback** (re-flip the frontend/API pointer): safe on its own if failure is purely frontend/API-level. Reverts to prior app; does not revert data.
- **Data Rollback**:
  - Restoring a pre-cutover snapshot does **not** preserve writes accepted by the new system after cutover.
  - A same-database topology does **not** make data rollback automatically safe. Any proposed restore/replay/reconciliation method must be designed and tested for the actual changed tables and operations. Whether existing audit entries capture enough before/after state to reverse the relevant operations is **Unknown**; audit logs alone must not be treated as proof of reversibility.
  - NOT guaranteed (Inferred): if the migration renames tables, restructures relations, or introduces go-forward-only schemas. Any such branch must be hand-coded as an inverse migration — an explicit Owner acceptance item, not an assumption. **No general-purpose inverse migration exists or is designed here**; if a reliable inverse path has not been designed, it must be stated before cutover approval.
  - Unsafe without manual reconciliation whenever: writes accepted by the new system after cutover cannot be replayed into the old system, or file attachments / external side effects (uploads, backups, notifications) diverge between old and new stores. In those circumstances rollback is **unsafe or requires manual reconciliation**, requiring explicit Owner sign-off on the reconciliation plan.
- **Required before cutover approval:** (1) named recovery point (pre-cutover snapshot, isolated copy), (2) explicit written decision for post-cutover writes — replay / reconciliation / deliberate discard / another proven recovery mechanism, with explicit Owner approval, (3) recovery/reconciliation plan for file attachments and external side effects independent of database rollback, (4) evidence that the audit trail captures the operations rollback depends on (verified old/new values — currently Unproven). If no reliable rollback path exists, rollback is unsafe and blocks cutover approval.
- **General ruling**: changing frontend routing or redirecting traffic is not a data rollback. The plan must specify whether post-transition writes are replayed, reconciled, deliberately discarded with explicit Owner acceptance, or recovered by another proven method. If no safe and tested path exists, production transition is blocked.
- **Scope ruling**: this is a design for scoped transitions (including the separately approved D6 and D7 tasks), not an assumption that all data must move to a new database. Reusing the current PostgreSQL database under D2 does not eliminate the need to test recovery for any changed repository or data flow.

---

## 6. Dual-Write Prohibition Detail

- Phase 12 prohibits any Dual Writes. Only one system writes any given row, at any given time.
- Rationale: unmanaged dual writes silently fork the source of truth and defeat any rollback design.
- If the Owner later wants a coexistence period with both systems live, that period must include a fronted ownership matrix (who owns which entity's writes), not just a URL flip. This is a future decision, not part of this plan.

---

## 7. Missing Information (Unknown — blocking any execution)

1. **Production environment**: PostgreSQL image/version, Docker Compose vs host service, actual hardware/host names. Repo holds config hints only (Docker Compose patterns seen); actual resources are not verifiable from this repo.
2. **Production dataset size**: row counts and real `storage/documents/**` size — not inferable from a checkout.
3. **Actual `DATABASE_URL` value** in the production environment; never quoted in Phase 12.
4. **`.env` in production**: name list only from `apps/api/.env.example`; actual `.env` was never read in Phase 12. In particular, the actual signing-secret source (`JWT_SECRET` environment setting versus `data/.jwt-secret` fallback) is Unknown; the value must never be recorded in the plan.
5. **CORS production configuration**: source behavior can be inspected, but the actual deployed `CORS_ORIGINS` configuration is Unknown.
6. **Prototype/API contract deltas**: the contract map is unfinished; D3 remains deferred until that map is complete.
7. **Audit/notification migration semantics**: field mapping, historical state preservation, notification membership/read state, and the sufficiency of audit before/after data need validated design before execution.

---

## 8. Pre-existing Working-Tree State (Scope Integrity note)

The uncommitted local changes flagged for the Phase 11 baseline (log files, `package.json`/`package-lock.json`, `test-results/.last-run.json`, `scripts/install-service.ps1`, `COS_Full_Frontend_Rebuild_Phase_Prompts_AR.md`, `COS_Full_Frontend_Rebuild_Plan_AR.md`, `docs/` untracked) were preserved untouched in the Phase 12 study. The Owner has since approved creation of a separate, narrowly scoped repair task for the 18 merge-conflict source files; its execution timing remains deferred. No source repair was performed by Phase 12 or by this documentation update. The repair must restore compilable intended logic, run `npm run typecheck` to exit 0, and exclude unrelated changes.
