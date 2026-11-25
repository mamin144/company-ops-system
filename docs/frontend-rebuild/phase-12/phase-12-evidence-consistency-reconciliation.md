# Phase 12 — Evidence Consistency & Reconciliation

Status: **DOCUMENTATION ONLY — read-only verification and reconciliation. No implementation authorized.**
Baseline: branch `main`, HEAD `f91ed2f9e81db3937e3bcbb1b44e5e2c44e175cf`, November 2026.
Companion docs (all 13 reviewed): A (`phase-12-separation-migration-architecture-report.md`), B (`phase-12-data-migration-matrix.md`), C (`phase-12-api-auth-permissions-map.md`), D (`phase-12-migration-validation-rollback-plan.md`), E (`phase-12-owner-decision-record.md`), Stage 0 inventory (chat-only, 2026-10-29), Stage 1 target design (`phase-12-stage-1-target-design.md`), Stage 2 dry-run report (`phase-12-stage-2-dry-run-report.md`), Stage 2 environment plan (`phase-12-stage-2-environment-plan.md`), Stage 2B report (`phase-12-stage-2b-report.md`), Stage 2C gap assessment (`phase-12-stage-2c-production-readiness-gap-assessment.md`), Owner review & master plan reconciliation (`phase-12-owner-review-and-master-plan-reconciliation.md`), Owner acceptance record (`phase-12-owner-acceptance-record.md`), Next-step discovery (`phase-12-next-step-discovery.md`).

**Language note:** technical body in English (see doc A header).

**Evidence labels (per project convention):** `Verified` = file/code/SQL proof · `Inferred` = engineering deduction with named sources · `Proposed` = unimplemented design · `Unknown` = could not be verified now · `Recorded Owner Decision` = decision recorded in doc E · `Owner-Confirmed` = stated by owner, not independently verified · `Historical` = superseded state preserved for record.

**Scope:** documentation and read-only OS metadata inspection only. No application source, tests, database, migration, schema, secret, configuration, deployment, or Git state was changed. No SQL was executed. No database connection was made. No PostgreSQL service was modified.

---

## 1. Executive Summary

- **Phase 12 is OPEN and in progress.** It is a documentation/architecture study phase. No production migration, Stage 3, Phase 13, D6 execution, or D7 implementation is authorized.
- **13 documents reviewed** (all Phase 12 documents listed in the task). The original frontend Master Plan (`COS_Full_Frontend_Rebuild_Plan_AR.md`) was also inspected for phase references; it defines phases 0–11 and does not define Phase 12 or 13.
- **Stage 2 history has two distinct phases:** (a) an initial BLOCKED state (no proven isolated DB env; temporary PG 17/18 clusters crashed with `0xC0000142`), followed by (b) a later successful migration run on a PostgreSQL 17.11 instance (port 5433, `cos_stage2_dryrun`) after the owner independently provisioned a test database. These are not contradictory — the environment/authorization situation changed between them.
- **Key reconciliation finding:** the successful PG 17 test ran against the **existing host PostgreSQL 17 service** (data directory `C:\Program Files\PostgreSQL\17\data`, port 5433), using a **separate database name** (`cos_stage2_dryrun` / `cos_stage2_populated_dryrun`) — i.e., database-level isolation, not instance-level isolation. The earlier temporary clusters (ports 5439/5440) were separate `initdb` clusters in temp directories that crashed. This distinction must be preserved.
- **21 contradictions identified and resolved** (see §11). **0 contradictions remain unresolved** (all resolved by documentation; some underlying facts remain Unknown).
- **No owner authorization boundary changed.** Phase 12 remains OPEN. Stage 3, Phase 13, D5 execution, D6 execution, D7 implementation, production access, and production migration remain NOT AUTHORIZED.
- **Stage 0 evidence limitation preserved:** original Stage 0 report was chat-only; not reconstructed; subset preserved in Doc B, Doc D, Stage 2 report §8.

---

## 2. Documents Reviewed (all 13)

| # | Document | File | Role |
|---|---|---|---|
| 1 | Doc A — Architecture report | `phase-12-separation-migration-architecture-report.md` | Architecture options, capability matrix, auth/DB/auth strategy, final recommendation |
| 2 | Doc B — Data migration matrix | `phase-12-data-migration-matrix.md` | Store inventory, migration classification, execution order |
| 3 | Doc C — API/auth/permissions map | `phase-12-api-auth-permissions-map.md` | Route mounts, auth model, permission vocabulary (31 keys), authorization matrix |
| 4 | Doc D — Migration/validation/rollback plan | `phase-12-migration-validation-rollback-plan.md` | Stages 0–6, coexistence rules, rollback, dual-write prohibition |
| 5 | Doc E — Owner decision record | `phase-12-owner-decision-record.md` | D1–D8 decision ledger, sequencing, sign-off gate |
| 6 | Stage 0 inventory | Chat-only (2026-10-29) | Repository-only read-only inventory (not preserved as file) |
| 7 | Stage 1 target design | `phase-12-stage-1-target-design.md` | Option B target design, entity matrix, D6/D7 design, acceptance criteria |
| 8 | Stage 2 dry-run report | `phase-12-stage-2-dry-run-report.md` | Empty-DB dry run, environment provisioning, diagnostic findings, execution results |
| 9 | Stage 2 environment plan | `phase-12-stage-2-environment-plan.md` | Environment options, migration analysis, privilege matrix, execution gates |
| 10 | Stage 2B report | `phase-12-stage-2b-report.md` | Populated-data dry run, PG 18 feasibility, migration inventory, D6/D7 dependencies |
| 11 | Stage 2C gap assessment | `phase-12-stage-2c-production-readiness-gap-assessment.md` | Production readiness gap assessment, Stage 3 entry criteria |
| 12 | Owner review & master plan reconciliation | `phase-12-owner-review-and-master-plan-reconciliation.md` | Consolidated status matrix, D1–D8 matrix, evidence index, execution authorization matrix |
| 13 | Owner acceptance record | `phase-12-owner-acceptance-record.md` | Owner acceptance, deferred decisions, Stage 0 evidence limitation |
| (also) Next-step discovery | `phase-12-next-step-discovery.md` | Read-only discovery and planning, PG 18 blocker analysis, next-step sequence |

**Additional reference:** `COS_Full_Frontend_Rebuild_Plan_AR.md` (master plan, phases 0–11) and `COS_Full_Frontend_Rebuild_Phase_Prompts_AR.md` (phase prompts). Neither defines Phase 12 or 13 explicitly; Phase 12 was added as an architecture study phase.

---

## 3. Evidence Classification Rules

Every significant claim in this reconciliation is classified as one of:

| Label | Definition |
|---|---|
| `Verified` | File/code/SQL/OS proof obtained during this phase |
| `Owner-Confirmed` | Stated by the owner; not independently verified by the agent |
| `Historical` | Superseded state preserved for record; no longer current |
| `Inferred` | Engineering deduction with named sources |
| `Proposed` | Unimplemented design |
| `Unknown` | Could not be verified now |
| `Recorded Owner Decision` | Decision recorded in doc E |
| `BLOCKED` | Activity blocked by a gate or missing prerequisite |
| `NOT AUTHORIZED` | Activity not authorized |

**Rules applied:**
- A later document does not automatically override an earlier one; the strongest evidence (file/code/SQL proof) wins.
- Owner-provided facts are labeled `Owner-Confirmed`, not `Verified`, unless independently verified.
- Historical states (e.g., "Stage 2 BLOCKED") are preserved as `Historical` and not erased.
- Inferences are never upgraded to Verified.
- Unknowns are never filled by assumption.

---

## 4. Reconciled Stage 2 Timeline

| # | Event | Date/Time (evidenced) | Environment | Actual result | Evidence | Confidence |
|---|---|---|---|---|---|---|
| 1 | Temporary PG 17 cluster initialized (port 5439) | 2026-10-29 ~14:05 | `initdb` in `C:\Users\PC-01\AppData\Local\Temp\opencode\pg-stage2-cluster` (outside repo) | Initialized successfully; server started; **crashed** on connection attempt (PID 3052, exception `0xC0000142`) | Stage 2 report §9, server.log | Verified |
| 2 | Temporary PG 18 cluster initialized (port 5440) | 2026-10-29 ~14:10 | `initdb` in `...\pg-stage2-cluster-18` | Initialized successfully; server started; **crashed** on autovacuum worker (PID 5064, exception `0xC0000142`) ~2 min after startup | Stage 2 report §9, server.log | Verified |
| 3 | Stage 2 reported as BLOCKED | 2026-10-29 | N/A (documentation) | "BLOCKED — no proven isolated DB environment" | Stage 2 report §5, §8 | Verified (historical) |
| 4 | Owner independently provisioned PG 17 test DB | 2026-10-29 (owner action, date per owner) | Existing host PostgreSQL 17 service (`postgresql-x64-17`), data dir `C:\Program Files\PostgreSQL\17\data`, port 5433 | `cos_stage2_dryrun` created; connection verified via pgAdmin and psql | Stage 2B §1 (owner-provided facts) | Owner-Confirmed |
| 5 | Empty-DB migration run (PG 17) | 2026-10-29 (execution) | PG 17.11, port 5433, `cos_stage2_dryrun` | All 19 migrations applied, exit 0; 27 tables, 3 extensions, 14 CHECK, 29 FK, 89 PK, 63 UNIQUE, 69 indexes | Stage 2 report §12 (execution log) | Verified (execution result) |
| 6 | Runner re-execution (idempotency) | 2026-10-29 | Same | `Database migrations are up to date.` exit 0 | Stage 2 report §12.7 | Verified |
| 7 | Populated-data dry run (PG 17) | 2026-10-29/11-01 | PG 17.11, port 5433, `cos_stage2_populated_dryrun` | All 19 migrations applied; synthetic data (1 project, 1 site, 1 document); duplicate migration 18 re-run → 0 new rows; FK integrity verified (0 orphans) | Stage 2B report §3 | Verified (execution result) |
| 8 | Diagnostic pass (0xC0000142) | 2026-10-29 | Read-only | Evidence gathered; root cause likely but unconfirmed | Stage 2 report §11 | Verified (evidence) |
| 9 | Stage 2B report produced | 2026-11-01 | Documentation | PASS WITH LIMITATIONS | Stage 2B report | Verified (document) |
| 10 | Stage 2C gap assessment produced | 2026-11-01 | Documentation | PASS WITH LIMITATIONS | Stage 2C report | Verified (document) |

**Resolution of the apparent contradiction (BLOCKED vs. successful):** The initial BLOCKED state (event 3) was accurate at the time — no proven isolated DB environment existed. The situation subsequently changed when the owner independently provisioned a test database on the existing host PostgreSQL 17 service (event 4). The successful migration runs (events 5–7) occurred against that owner-provisioned database. The BLOCKED state was not an error; it was the correct status before the owner's provisioning. Both states are preserved as historical facts. The final known status is: **Stage 2 dry run executed successfully on isolated PostgreSQL 17 test database (PASS WITH LIMITATIONS), with PostgreSQL 18 compatibility still blocked.**

**PostgreSQL 18 compatibility test status:** BLOCKED. No isolated PostgreSQL 18 environment could be provisioned (0xC0000142 worker crash). No PG 18 migration was ever executed. Compatibility assessment is static only (standard SQL + contrib extensions available in both versions; no PG 18-specific features observed in SQL). Not proof of identical runtime behavior.

---

## 5. PostgreSQL Service/Port Identity Analysis

### Current service metadata (read-only OS inspection, 2026-11-01)

| Service | Status | StartType | Data directory | Port(s) (from netstat) |
|---|---|---|---|---|
| `postgresql-x64-17` | Running | Automatic | `C:\Program Files\PostgreSQL\17\data` | 5432 (PID 14220, ESTABLISHED), 5433 (PID 5908, FIN_WAIT_1 + ESTABLISHED) |
| `postgresql-x64-18` | Running | Automatic | `C:\Program Files\PostgreSQL\18\data` | 5432 (PID 14220) |

**Owner-confirmed facts:**
- Legacy application uses PostgreSQL 18 (owner statement).
- PostgreSQL 18 contains `cos_db` and `cos_authz_unit` (owner statement).
- PostgreSQL 18 data directory: `C:\Program Files\PostgreSQL\18\data` (owner statement via pgAdmin).
- PostgreSQL 17 appears disconnected in the supplied screenshot (owner statement).
- PostgreSQL 18 is an operational database service that must remain untouched (Recorded Owner Decision).

**Verified (SQL result from owner-supplied evidence):**
- Test DB `cos_stage2_dryrun`: PG 17.11, data dir `C:/Program Files/PostgreSQL/17/data`, port 5433, listen `127.0.0.1,::1`, user `postgres` (superuser, CreateDB), extensions `pg_trgm` 1.6 + `uuid-ossp` 1.1.

### Reconciliation of apparent inconsistency

| Question | Finding |
|---|---|
| Are the successful test and the temporary clusters the same? | **No.** The successful test used the existing host PostgreSQL 17 service (port 5433, data dir `C:\Program Files\PostgreSQL\17\data`). The temporary clusters (ports 5439/5440) were separate `initdb` clusters in temp directories that crashed. |
| Is the "isolated" test DB on a separate instance? | **No — it is database-level isolation, not instance-level.** `cos_stage2_dryrun` is a separate database name on the existing host PostgreSQL 17 service (port 5433). The owner provided it as "isolated"; the evidence shows it shares the PG 17 service/process with whatever else is on that instance. |
| Does the operational PG 18 service own port 5433? | **No — based on current metadata.** The host PG 17 service owns port 5433 (data dir matches owner-confirmed value). The operational PG 18 service owns port 5432 (data dir `C:\Program Files\PostgreSQL\18\data`). These are distinct services with distinct data directories. |
| Could port ownership have changed between the test and now? | **Unknown.** Current service metadata does not prove which service owned port 5433 during the earlier test. Historical claims require historical evidence. The owner-confirmed data directory (`C:\Program Files\PostgreSQL\17\data`) and port (5433) match the current PG 17 service metadata, which supports (but does not prove) that the test ran against the existing PG 17 service. |
| Is the PG 17 service operational or test-only? | **Unknown.** The service is Running/Automatic. Whether it is production-adjacent or purely development is not established. The backup script `backup-db-local.ps1` references `cos_db` on `127.0.0.1:5432` with user `cos` — suggesting the host PG instance (port 5432) may be operational/development infrastructure. Port 5433 (PG 17) was used for the test. |

**Conclusion:** The successful migration test ran against the **existing host PostgreSQL 17 service** on port 5433 (data dir `C:\Program Files\PostgreSQL\17\data`), using separate database names (`cos_stage2_dryrun`, `cos_stage2_populated_dryrun`). This is database-level isolation, not instance-level isolation. The operational PostgreSQL 18 service (port 5432, data dir `C:\Program Files\PostgreSQL\18\data`) was not touched. The earlier temporary clusters (ports 5439/5440) were separate `initdb` clusters that crashed and were not used for the successful test.

**Limitation:** Current service metadata does not prove which service owned port 5433 during the earlier test. Historical claims require historical evidence. The owner-confirmed data directory and port are consistent with the current PG 17 service metadata, but this is correlation, not proof of past state.

---

## 6. PG17 Test Environment Isolation Assessment

### What is established (Verified/Owner-Confirmed)
- The test databases (`cos_stage2_dryrun`, `cos_stage2_populated_dryrun`) are separate database names on the PG 17 instance.
- The migrations ran successfully (all 19, exit 0) against these databases.
- The test databases contain only schema + synthetic seed data (no production data was loaded).
- No production credentials or application configuration were used (DATABASE_URL set in process env for the command only).
- The operational PG 18 service (port 5432, data dir `PostgreSQL\18\data`) was not connected to or modified.

### What is NOT established
- **Instance-level isolation:** the test DBs share the PG 17 service/process with whatever else is on that instance. The PG 17 service's role (production-adjacent vs. purely development) is Unknown.
- **Database-level isolation proof:** no evidence that the PG 17 instance hosts no other operational databases (other than the owner's statement that PG 18 is operational). Whether `cos_db` or other operational data exists on PG 17 is Unknown.
- **Network isolation:** the test DB is accessible on 127.0.0.1:5433 (loopback). Whether other hosts can reach it is Unknown (listen_addresses = 127.0.0.1,::1 suggests loopback-only, but this is the current config, not historical).
- **Authorization validity:** the test was performed with the `postgres` superuser role. Whether a least-privilege role would have succeeded is Unknown.

### Conclusions (must be kept separate)

| Conclusion | Status |
|---|---|
| Migration execution success | **Verified** — all 19 migrations applied, exit 0, on PG 17.11 (`cos_stage2_dryrun` and `cos_stage2_populated_dryrun`) |
| Test database identity | **Verified** — `current_database() = cos_stage2_dryrun` / `cos_stage2_populated_dryrun`, `current_user = postgres`, version 17.11, data dir `C:/Program Files/PostgreSQL/17/data`, port 5433 |
| Environment isolation | **Partially established** — database-level isolation (separate DB name) is evident; instance-level isolation is NOT established (test DBs share the existing host PG 17 service). Whether the PG 17 instance is operational or development is Unknown. |
| Authorization validity | **Verified for the test as performed** — owner authorized the isolated test DB and provided credentials; the test used the `postgres` superuser role on the test DB only. |
| Production safety | **Not established** — the test does not prove production migration safety. Production facts remain Unknown. No production connection was made. |

**Canonical statement:** "Migration execution reported successful; full environment-isolation evidence remains unresolved." (per Stage 2B report and this reconciliation)

---

## 7. Migration Execution and Populated-Data Idempotency Findings

### Empty-data dry run (Verified)
- All 19 migrations applied successfully (exit 0) on `cos_stage2_dryrun` (PG 17.11).
- Schema: 27 tables, 3 extensions (pg_trgm 1.6, plpgsql 1.0, uuid-ossp 1.1), 14 CHECK, 29 FK, 89 PK, 63 UNIQUE, 69 indexes.
- Runner re-execution: `Database migrations are up to date.` (exit 0) — no re-application. **PASS.**

### Populated-data dry run (Verified — limited scope)
- Synthetic data: 1 project, 1 site, 1 document (with project_id and site_id set).
- Duplicate migration (11/18) manual re-execution: first run inserted 2 rows (project, site); second run inserted 0 rows. Count unchanged (2). Exit 0.
- Re-run of byte-identical 11_modernize_dms.sql: 0 rows inserted. Exit 0.
- FK integrity: 0 orphan document_links, 0 orphan sites, 0 orphan documents. **PASS.**

### What is established vs. not established

| Claim | Status | Basis |
|---|---|---|
| Runner-level idempotency (skip already-applied files) | **Verified** | Re-run produced "up to date", exit 0 |
| SQL-level idempotency of duplicate pair (empty data) | **Verified** | 11 + 18 both applied; manual re-run 0 rows |
| SQL-level idempotency of duplicate pair (populated data) | **Verified (limited)** | 1 project/site/document; 2 rows on first run, 0 on second; no duplicates |
| SQL-level idempotency (broader populated data) | **Not established** | Only 1 project/site/document tested; multiple entities, concurrent writes, partially populated states not tested |
| Full semantic idempotency | **Not established** | Requires broader coverage |
| Production data-level validation | **Not established** | No production data used |

**Do not describe full semantic idempotency as proven.** The test covered one synthetic project, site, and document. Broader coverage (multiple entities, concurrent writes, partially populated or inconsistent prior states) is required before idempotency can be claimed at production scale.

---

## 8. PostgreSQL 18 Compatibility Status

- **Status: BLOCKED.** No isolated PostgreSQL 18 environment could be provisioned.
- PG 18 binaries available (version 18.4). Temporary cluster initialized and started but crashed with `0xC0000142` on worker initialization. No connection succeeded.
- **No PG 18 migration was ever executed.** Compatibility assessment is static only: migrations use standard SQL + contrib extensions (`uuid-ossp`, `pg_trgm`) available in both 17 and 18; no PG 18-specific features observed in SQL. This is a static observation, not proof of identical runtime behavior.
- **Do not claim PG 17/18 compatibility** based on static SQL review alone.
- The operational PG 18 service (port 5432, data dir `PostgreSQL\18\data`) was not touched.

---

## 9. D1–D8 Decision and Authorization Consistency

### Decision consistency check

| Decision | Doc E status | Doc A status | Stage 1 status | Consistent? |
|---|---|---|---|---|
| D1 (Option B) | Recorded (Option B selected) | §11/§12: recorded direction | §0: recorded (preserved verbatim) | Yes |
| D2 (Reuse PG) | Recorded (topology option 1) | §5/§12: recorded | §0: recorded | Yes |
| D3 (Namespace deferred) | Recorded (deferred) | §6/§12: recorded | §0: recorded | Yes |
| D4 (Repair task) | Recorded + execution completed 2026-10-29 | §3/§10/§12: completed, typecheck green | §0: recorded (preserved verbatim) + §9 addendum | Yes |
| D5 (Secret handling) | Recorded (plan prep approved; movement deferred) | §7/§10/§12: recorded | §0: recorded | Yes |
| D6 (Audit/notifications → PG) | Recorded (approved as task; execution gated) | §3/§8/§10/§12: recorded | §0: recorded; §3 design | Yes |
| D7 (HTTP adapter) | Recorded (approved in principle; gated) | §4/§10/§12: recorded | §0: recorded; §4 design | Yes |
| D8 (Migration plan) | Recorded (final approval 2026-10-29) | §9/§11/§12: recorded | §0: recorded; §6 | Yes |

All D1–D8 decisions are consistent across Docs A, D, E, and Stage 1. No contradictions found. No decisions were silently changed.

### Authorization consistency check

The Owner Acceptance Record is the controlling record of current execution boundaries. The authorization matrix in Doc E (§Sign-off), Stage 1 (§7.4/§7.7), Stage 2C (§9), and the Owner Review reconciliation (§7) are all consistent:

| Activity | Current authorization (all docs agree) |
|---|---|
| Read-only repository analysis | Allowed |
| Documentation-only planning | Allowed within scope |
| Phase 12 | OPEN |
| Stage 3 execution | NOT AUTHORIZED |
| Phase 13 chartering/implementation | NOT AUTHORIZED |
| D5 secret movement/rotation | NOT AUTHORIZED |
| D5 documentation plan | May be prepared without inspecting secret values or changing secrets |
| D6 field-mapping design | Documentation only |
| D6 isolated or production migration execution | NOT AUTHORIZED |
| D7 adapter contract design | Documentation only |
| D7 implementation | NOT AUTHORIZED |
| Production database access | NOT AUTHORIZED |
| Production migrations or DDL | NOT AUTHORIZED |
| Permission/RBAC/API namespace changes | NOT AUTHORIZED |
| Deployment | NOT AUTHORIZED |
| Git staging/commit/reset/clean | NOT AUTHORIZED |

**Clarification (per reconciliation requirement):** preparing a proposal for a future phase (e.g., D5 plan, D6 field mapping, D7 adapter contract) is documentation work and is allowed within scope. Formally chartering or starting that phase (execution, implementation, production access) is NOT authorized. No planning document can grant new execution permission. This distinction is preserved across all documents.

---

## 10. Stage 0 Evidence Limitation

- **Original Stage 0 inventory** was delivered in chat on 2026-10-29. A standalone repository artifact was **not** created at that time.
- **Subsequent documents preserve only a subset** of Stage 0 findings (Doc B, Doc D, Stage 2 report §8, Stage 2B, Stage 2C).
- **No reconstruction** of missing Stage 0 facts was performed. Missing facts remain `Unknown`.
- **No Stage 0 inventory document was created** during this task (per task boundaries).
- **Recommendation:** if the original Stage 0 chat evidence is available in conversation files or logs, preserve it accurately in a repository document (e.g., `phase-12-stage-0-inventory.md`) via a separate, owner-approved documentation pass. This reconciliation does not create that file.

**Standardized distinction (preserved):**
- **Repository-only Stage 0 inventory** = read-only inspection of the repository (completed, accepted, repository-only; chat-only evidence).
- **Future authorized read-only production assessment** = authorized inspection of the production database (not yet authorized; all production facts Unknown).
- These are different activities and must not share an ambiguous status label.

---

## 11. Contradiction Register

| ID | Conflicting statements | Sources | Resolution | Evidence strength | Remaining uncertainty |
|---|---|---|---|---|---|
| C-01 | Stage 2 described as BLOCKED (no proven isolated DB env) in early sections; later §12–§13 report all 19 migrations executed successfully on PG 17.11 | Stage 2 report §§5–8 (BLOCKED) vs. §§12–13 (executed) | **Resolved:** not contradictory. The BLOCKED state was accurate at the time (no proven isolated DB). The situation changed when the owner independently provisioned a test DB on the existing host PG 17 service. Both states are preserved as historical facts. Final status: Stage 2 dry run executed successfully (PASS WITH LIMITATIONS) on isolated PG 17 test DB. | Verified (timeline reconstructed from document evidence) | The exact date/time of the owner's provisioning is owner-stated, not independently timestamped |
| C-02 | Earlier temporary clusters (ports 5439/5440) described as "isolated"; successful test ran on port 5433 (existing host PG 17 service) | Stage 2 report §9 (ports 5439/5440) vs. Stage 2B §1 (port 5433, data dir `C:\Program Files\PostgreSQL\17\data`) | **Resolved:** different environments. The temporary clusters (5439/5440) were separate `initdb` clusters in temp dirs that crashed. The successful test (5433) used the existing host PG 17 service with separate DB names (`cos_stage2_dryrun`, `cos_stage2_populated_dryrun`). "Isolated" = database-level (separate DB name), not instance-level. | Verified (service metadata + owner-confirmed data dir/port) | Whether the PG 17 service is production-adjacent or purely development is Unknown |
| C-03 | Stage 2 report §9 described provisioning as read-only | Stage 2 report §9 (originally "read-only inventory" framing) vs. actual actions (initdb, postgresql.conf edits) | **Resolved:** provisioning was NOT read-only. Temporary data directories were initialized and local `postgresql.conf` files were adjusted. Scope note added to Stage 2 report §9 (2026-11-01 correction pass). Temporary artifacts are distinct from application's existing databases, production data, application configuration, and Git state. | Verified (actions documented in Stage 2 report) | None |
| C-04 | Stage 2 initial status "BLOCKED" vs. final "PASS WITH LIMITATIONS" | Stage 2 report §3/§5 (BLOCKED) vs. §12/§13 (PASS WITH LIMITATIONS) | **Resolved:** status progression, not contradiction. BLOCKED was the correct status before the owner provisioned the test DB. PASS WITH LIMITATIONS is the correct final status after successful execution. Both preserved. | Verified (timeline) | None |
| C-05 | "Inferred harmless" language for duplicate migration | Stage 2 report line 91 (original: "Idempotency not tested (Inferred harmless; not verified)") vs. corrected version | **Resolved:** corrected to "Unknown — `IF NOT EXISTS`/`ON CONFLICT DO NOTHING` reduce failure likelihood on repeat but do not by themselves establish full semantic idempotency" (2026-11-01 correction pass). Stage 2 environment plan §3.2 and §7 also corrected. | Verified (edit applied) | None |
| C-06 | D8 status: "preliminary approval" vs. "final approval" | Stage 2 report / Stage 1 doc (originally "preliminary") vs. Doc E (final approval 2026-10-29) | **Resolved:** synchronized across A, D, E, and Stage 1 doc (2026-11-01). All now record D8 as finally approved (2026-10-29). Stage 0 results require review/acceptance before advancing (later corrected to "accepted"). | Verified (edits applied) | None |
| C-07 | Stage 0 status: "pending review/acceptance" vs. "accepted" | Stage 1 doc §0/§7.4/§7.8 (originally "pending") vs. Owner acceptance record (accepted) | **Resolved:** synchronized (2026-11-01). Stage 0 repository-only inventory recorded as accepted. Production facts remain Unknown. | Verified (edits applied) | None |
| C-08 | `sessions.json` classification: "Leftover/reference layer" vs. "Unknown" | Stage 1 doc §2.3 (originally "Leftover/reference layer") vs. corrected "Unknown — runtime dependency not fully established" | **Resolved:** corrected (2026-11-01). The JsonStore is instantiated but inspected methods bypass it; whether `store` is invoked elsewhere is Unknown. | Verified (edit applied) | Whether JsonStore is invoked elsewhere remains Unknown |
| C-09 | Attachment path: `storage/documents/**` vs. `apps/api/storage/documents/**` | Stage 1 doc §1.2/§2.2/§6.2/§7.1 (originally `storage/documents/**`) vs. corrected `apps/api/storage/documents/**` | **Resolved:** corrected (2026-11-01). Verified path is `apps/api/storage/documents/**` (Stage 0 inventory: 193 files / 402,424,237 B). | Verified (edit applied) | None |
| C-10 | Duplicate entity rows in Stage 1 §2.2 (`user_permission_overrides`, `project_members`) | Stage 1 doc §2.2 (originally had duplicate rows at lines 108-109 and 123-124) | **Resolved:** duplicate rows removed (2026-11-01). One row each remains. | Verified (edit applied) | None |
| C-11 | `userId`/`timestamp` implied as required fields in D6 design | Stage 1 doc §3.2/§3.4 (originally "Records missing required fields (e.g., no userId, no timestamp)") | **Resolved:** corrected (2026-11-01). Fields not treated as required unless schemas prove it; validation/quarantine criteria derived from verified source fields + verified target constraints + approved handling policy. | Verified (edit applied) | Actual required fields remain Unknown until schema verification |
| C-12 | Deterministic ID claim `(userId, timestamp, action, entity)` assumed unique | Stage 1 doc §3.3 (originally "hash of (userId, timestamp, action, entity)") | **Resolved:** corrected (2026-11-01). Composite not assumed unique without evidence; approach remains Proposed until source identifiers and target uniqueness constraints verified. | Verified (edit applied) | Source record ID stability Unknown |
| C-13 | Extension privilege claim: "may require superuser" | Stage 2 environment plan §3.3 (originally "may require superuser (or trusted-extension-capable role)") | **Resolved:** corrected (2026-11-01). In PG 18, both `uuid-ossp` and `pg_trgm` are trusted extensions; non-superuser with DB-level `CREATE` can install if extension files available. No server-wide superuser recommended. | Verified (edit applied) | Extension file availability on a given server Unknown |
| C-14 | Schema/search_path claim: "All DDL targets default public schema" | Stage 2 environment plan §3.4 (originally "All DDL targets the default `public` schema") | **Resolved:** corrected (2026-11-01). Unqualified names resolved by effective session `search_path`; absence of `SET search_path` does not prove public targeting. Must verify test session's search_path. | Verified (edit applied) | Effective search_path in test session not yet verified |
| C-15 | D8 status in Stage 2 report §10/§13 (originally "BLOCKED" / "D8 final approval pending") | Stage 2 report §10 (BLOCKED) vs. later §12/§13 (executed, PASS WITH LIMITATIONS) | **Resolved:** §10 updated to reflect D8 finally approved (2026-10-29); §13 updated to PASS WITH LIMITATIONS. Historical BLOCKED state preserved in §5/§8. | Verified (edits applied) | None |
| C-16 | Stage 1 §1.2 conflict-marker damage: "prerequisite for almost everything" | Stage 1 doc §1.2 (originally "prerequisite for almost everything") | **Resolved:** corrected (2026-11-01) to "prerequisite for Stage 2 and other paths specifically gated by D4; does not block independent read-only analysis, documentation, or design preparation." | Verified (edit applied) | None |
| C-17 | Stage 1 §4.2/§4.7: endpoint contracts attributed to active conflict markers | Stage 1 doc §4.2/§4.7 (originally "because of conflict markers") | **Resolved:** corrected (2026-11-01) to state D4 is complete but exhaustive endpoint methods/shapes and contract map remain incomplete/Unknown until separately documented. | Verified (edit applied) | None |
| C-18 | Stage 1 §6.2: "execution timing is deferred" (stale after D4 completed) | Stage 1 doc §6.2 (originally "Task creation is approved; execution timing is deferred") | **Resolved:** corrected (2026-11-01) to "D4 repair executed (2026-10-29); typecheck exited 0; prerequisite satisfied." | Verified (edit applied) | None |
| C-19 | Stage 1 §7.4/§7.7: "deferred" / "Stage 0 results require review and acceptance" (stale) | Stage 1 doc §7.4/§7.7 (originally "deferred" / "Stage 0 results review and acceptance") | **Resolved:** corrected (2026-11-01) to reflect D4 completed and Stage 0 accepted; production facts remain Unknown. | Verified (edit applied) | None |
| C-20 | Stage 1 Status line: "PENDING OWNER REVIEW" (stale after approval) | Stage 1 doc Status (originally "STAGE 1 DESIGN — PENDING OWNER REVIEW") | **Resolved:** updated to "OWNER APPROVED (DESIGN ONLY, 2026-10-29)" with §9 Owner Approval Addendum. Final gate statement updated accordingly. | Verified (edit applied) | None |
| C-21 | Stage 1 §3.4: "Records missing required fields (e.g., no userId, no timestamp)" (unconditional required-field implication) | Stage 1 doc §3.4 | **Resolved:** corrected (2026-11-01) to "Records missing fields that are verified as required (or violating approved validation rules)" with note that fields are not assumed required unless schemas prove it. | Verified (edit applied) | Actual required fields remain Unknown until schema verification |

**Total contradictions identified: 21. Total resolved: 21. Unresolved contradictions: 0.**

All 21 contradictions were resolved by documentation edits. No underlying facts were changed; only wording was corrected to match the verified evidence.

---

## 12. Canonical Phase 12 Status

### Phase 12 is OPEN and in progress.

**Completed (with limitations where noted):**
- Stage 0 — repository-only read-only inventory (accepted; repository-only; chat-only evidence limitation).
- Stage 1 — target design (owner-approved 2026-10-29, DESIGN ONLY).
- D4 — conflict-marker repair (completed: 18 files, 21 blocks, `npm run typecheck` exit 0).
- Stage 2 empty-DB dry run (completed: all 19 migrations applied, exit 0; schema validated; runner idempotency confirmed).
- Stage 2 populated-data dry run (completed with limitations: 1 project/site/document; duplicate idempotency verified; FK integrity verified).
- Stage 2 environment provisioning (attempted, failed: 0xC0000142 worker crash on PG 17 and PG 18).
- Stage 2 diagnostic pass (completed: evidence gathered; root cause likely but unconfirmed).
- Stage 2C production readiness gap assessment (completed: PASS WITH LIMITATIONS).
- Owner review & master plan reconciliation (completed: PASS WITH LIMITATIONS).
- Owner acceptance record (completed).
- Next-step discovery & planning (completed).
- Evidence consistency & reconciliation (this document).

**Blocked or not authorized:**
- Stage 2 PG 18 compatibility (blocked — no usable isolated PG 18 environment).
- Stage 3 automated validation (not authorized — entry criteria not satisfied).
- Phase 13 chartering (not authorized — blocked by D8/stage gates).
- D5 secret movement/rotation (not authorized — deferred).
- D6 audit/notifications → PG migration (not authorized — execution gated).
- D7 HTTP adapter implementation (not authorized — gated by contract map).
- Production database access (not authorized).
- Production migration (not authorized).

**Final gate (from Owner Acceptance Record):**
- Stage 3: NOT AUTHORIZED.
- Phase 13: NOT AUTHORIZED.
- D5: NOT AUTHORIZED.
- D6: NOT AUTHORIZED.
- D7: NOT AUTHORIZED.
- Production database access: NOT AUTHORIZED.
- Production migration: NOT AUTHORIZED.

---

## 13. Remaining Risks and Unknowns

### Migration risks
1. Migration 09 (document categories): DELETE of English document-category rows + UPDATE of document categories to Arabic canonical. Not reversible without backup. Requires pre-migration validation query and tested rollback.
2. Migration 19 (authorization rebuild): creates user_permission_overrides + project_members; rebuilds role/permission matrix; adds FK users→roles; revokes all sessions. Stateful, non-trivially-reversible. Requires communication plan and operational recovery procedure.
3. Duplicate migration (11/18): idempotency verified with limited data only (1 project/site/document). Full idempotency with populated data not proven.
4. Migration 16: `DROP CONSTRAINT IF EXISTS ipcs_status_check` + ADD (constraint replacement). Reversible only if prior constraint definition is known.

### Environment risks
5. PostgreSQL 18 compatibility unverified — isolated PG 18 cluster crashed with 0xC0000142. Root cause likely but unconfirmed.
6. Environment-level DLL failure — affects worker processes on this host; root cause not identified.

### Data risks
7. No production data validation — all dry runs used empty or minimal synthetic data.
8. Users not seeded by SQL migrations (app-startup seeding). Production data seeding path not exercised.
9. import_history.json vs PG table content delta Unknown.

### Process risks
10. No tested recovery/reconciliation procedure for post-cutover writes.
11. No tested rollback beyond snapshot existence.
12. No communication plan for session revocation.

### Documentation risks
13. Production facts all Unknown (14 items in Stage 2C §6).
14. Contract map incomplete (prototype ↔ live API).
15. Stage 0 evidence is chat-only (documentation limitation recorded in Owner Acceptance Record §5).
16. Effective `search_path` in test session not verified (may affect schema resolution).

---

## 14. Recommended Next Safe Activities

These are documentation and read-only activities that do not execute gated tasks:

1. **Owner review of this reconciliation** and all Phase 12 reports.
2. **Owner decision** on whether to provision an isolated PostgreSQL 18 environment (VM/separate host) or to accept PG 17-only evidence.
3. **If PG 18 isolated env is available:** repeat the dry run on PG 18; compare PG 17 vs PG 18 outcomes (schema, constraints, extensions, seeded data, migration tracking).
4. **If production facts are needed:** authorize a read-only production assessment (14-item checklist, Stage 2C §6) — never connect to production without explicit authorization.
5. **If D6 is prioritized:** finalize source-to-target field mapping, design and test idempotency/recovery, obtain owner approval, then execute in isolated env first.
6. **If D7 is prioritized:** finalize the contract map, then design and implement the adapter against the current API.
7. **D5:** prepare the safe secret-handling/rotation plan (verify production source, assess impact).
8. **Stage 3:** only after all Stage 3 entry criteria (Doc D / Stage 2C §9) are satisfied and owner-approved.
9. **Phase 13:** only after Phase 12 is complete and owner-authorized.
10. **Optional (owner-approved):** create `phase-12-stage-0-inventory.md` to preserve the chat-only Stage 0 evidence.

---

## 15. Owner Decisions Still Required

1. Whether to provision an isolated PostgreSQL 18 environment (VM/separate host) — and who owns that infrastructure.
2. Whether to accept PG 17-only evidence or require PG 18 repeat dry run.
3. D5 secret movement/rotation timing (deferred pending production-source verification and impact assessment).
4. D6 audit/notifications migration execution timing (gated by stage approvals, field mapping, validation, rollback, writer switch).
5. D7 HTTP adapter implementation timing (gated by contract map and stage approvals).
6. Whether to proceed with a broader populated-data dry run (more entities, larger dataset).
7. Whether to authorize a read-only production assessment (to close Unknown production facts).
8. Whether to authorize a test of the recovery/reconciliation procedure (post-cutover write policy).
9. Any new permission key, namespace, or schema change.
10. Stage 3 entry authorization (after all entry criteria satisfied).
11. Phase 13 chartering authorization (after Phase 12 completion).

---

## 16. Explicit Final Authorization Boundary

| Action | Authorized? |
|---|---|
| Read-only repository inspection | Yes |
| Documentation creation/editing | Yes |
| D4 conflict-marker repair (completed) | Yes (completed, narrow scope) |
| `npm run typecheck` (executed) | Yes (exit 0) |
| Stage 2 dry run on isolated PG 17 (empty + populated) | Yes (executed) |
| Stage 2 environment provisioning (PG 17/18 temp clusters) | Yes (attempted, failed) |
| Stage 3 automated validation | **No** |
| Phase 13 chartering/implementation | **No** |
| D5 secret movement/rotation | **No** |
| D6 audit/notifications → PG migration (production) | **No** |
| D6 audit/notifications → PG migration (isolated test) | **No** |
| D7 HTTP adapter implementation | **No** |
| Production database access (read or write) | **No** |
| Production migration execution | **No** |
| Schema changes (DDL) on any database | **No** (except test DBs already created) |
| Secret rotation | **No** |
| Permission changes | **No** |
| API namespace changes | **No** |
| Git staging / commit / reset / clean | **No** |
| Production deployment | **No** |

**No production readiness is claimed. No production migration is authorized. Phase 12 remains OPEN.**

---

**Phase 12 remains at the ownership gate. Owner review and acceptance of this reconciliation is required before any further stage advancement.**

**Do not start Stage 3, Phase 13, D6 production data migration, or D7 adapter implementation.**