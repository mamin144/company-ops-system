# Phase 12 — Next-Step Discovery & Planning (Read-Only)

Status: **DOCUMENTATION ONLY — discovery and planning. No implementation authorized.**
Baseline: branch `main`, HEAD `f91ed2f9e81db3937e3bcbb1b44e5e2c44e175cf`, November 2026.
Companion docs: A (`phase-12-separation-migration-architecture-report.md`), B (`phase-12-data-migration-matrix.md`), C (`phase-12-api-auth-permissions-map.md`), D (`phase-12-migration-validation-rollback-plan.md`), E (`phase-12-owner-decision-record.md`), Stage 0 inventory (chat-only, 2026-10-29), Stage 1 target design (`phase-12-stage-1-target-design.md`), Stage 2 dry-run report (`phase-12-stage-2-dry-run-report.md`), Stage 2 environment plan (`phase-12-stage-2-environment-plan.md`), Stage 2B report (`phase-12-stage-2b-report.md`), Stage 2C gap assessment (`phase-12-stage-2c-production-readiness-gap-assessment.md`), Owner review & master plan reconciliation (`phase-12-owner-review-and-master-plan-reconciliation.md`), Owner acceptance record (`phase-12-owner-acceptance-record.md`).

**Language note:** technical body in English (see doc A header).

**Evidence labels (per project convention):** `Verified` = file/code/SQL proof · `Inferred` = engineering deduction with named sources · `Proposed` = unimplemented design · `Unknown` = could not be verified now · `Recorded Owner Decision` = decision recorded in doc E · `Fact` = repository/owner-provided fact · `Inference` = deduction · `Recommendation` = proposed next step · `Unknown` = not verifiable.

**Scope:** read-only discovery and planning. No application source, tests, database, migration, schema, secret, configuration, deployment, or Git state was changed to produce this document.

---

## 1. Executive Summary

- **Phase 12 is still OPEN.** It is a documentation/architecture study phase that has produced substantial evidence and completed several sub-stages (Stage 0 accepted, Stage 1 approved, D4 repaired, Stage 2 empty + populated dry runs passed), but it has not authorized production migration, Stage 3, Phase 13, D6 execution, or D7 implementation.
- **Phase 13 is NOT the next authorized step.** The master plan (`COS_Full_Frontend_Rebuild_Plan_AR.md`) defines phases 0–11 for the frontend rebuild; Phase 12 was added as a separation/migration architecture study. Phase 13 chartering is explicitly blocked by D8/stage gates and requires Phase 12 completion + owner authorization.
- **The next logical project activity is closing Phase 12's remaining gaps** — not advancing to Phase 13. The critical path is: (a) provision/verify an isolated PostgreSQL 18 environment (or accept PG 17-only evidence), (b) close Unknown production facts via an authorized read-only production assessment, (c) finalize the contract map, (d) design/test D6 and D7, (e) satisfy Stage 3 entry criteria, (f) obtain owner approval for Stage 3.
- **PostgreSQL 18 compatibility is unverified** due to the `0xC0000142` worker-process DLL initialization failure on this host. The failure affects worker processes (connection backend, autovacuum) but not the main postmaster; root cause is likely but unconfirmed. No production PG 18 instance was touched.
- **No implementation is authorized.** This document is planning only.

---

## 2. Verified Current Project Status

### 2.1 Phase 12 status (Fact)
- Phase 12 is **OPEN and in progress** (owner acceptance record, 2026-11-01).
- Stage 0: accepted (repository-only; chat-only evidence limitation recorded).
- Stage 1: owner-approved (DESIGN ONLY, 2026-10-29).
- D4: completed (18 files, 21 blocks, `npm run typecheck` exit 0).
- Stage 2 empty-DB dry run: completed (PASS).
- Stage 2 populated-data dry run: completed (PASS WITH LIMITATIONS).
- Stage 2 PG 18 compatibility: **blocked** (0xC0000142).
- Stage 3: not authorized.
- Phase 13: not authorized.

### 2.2 Repository state (Fact)
- Branch `main`, HEAD `f91ed2f9e81db3937e3bcbb1b44e5e2c44e175cf`.
- Pre-existing tracked modifications: logs, package-lock.json, package.json, scripts/install-service.ps1, test-results/.last-run.json.
- Untracked: `COS_Full_Frontend_Rebuild_Phase_Prompts_AR.md`, `COS_Full_Frontend_Rebuild_Plan_AR.md`, `docs/` (contains all Phase 12 documents).
- No staging, commit, reset, or clean performed.

### 2.3 Master plan phases (Fact, from `COS_Full_Frontend_Rebuild_Plan_AR.md`)
- Phases 0–11 defined for the frontend rebuild (Safety & Baseline → Release Readiness & Handover).
- Phase 12 ("New System Separation & Migration Architecture") was added as an architecture study phase; it is not in the original 0–11 roadmap but is the current active phase.
- Phase 13 is not defined in the master plan; it would be the next phase after Phase 12 if/when Phase 12 completes and is owner-authorized.

### 2.4 Owner decisions (Fact, from Doc E)
- D1: Option B — logical separation with selective reuse (recorded).
- D2: Reuse existing PostgreSQL database topology (recorded; design decision only).
- D3: API namespace deferred until contract map complete; keep `/api/` (recorded).
- D4: Conflict-marker repair completed (18 files, 21 blocks, typecheck green).
- D5: Secret-management plan approved; movement/rotation deferred.
- D6: JSON audit_logs/notifications → PG migration approved as task; execution gated.
- D7: HTTP adapter approved in principle; implementation gated.
- D8: Migration/validation/rollback plan final approval recorded (2026-10-29).

---

## 3. Phase 12 Remaining Limitations

1. **Stage 2 PG 18 compatibility unverified** — isolated PG 18 cluster crashed with `0xC0000142`; root cause likely but unconfirmed. No PG 18 migration execution.
2. **All 14 production facts Unknown** — no authorized production access in any phase.
3. **Contract map incomplete** — prototype-to-live-API contract deltas not finalized; per-endpoint HTTP method/request shapes not exhaustively documented (unblocked by D4 but not yet done).
4. **D5 secret handling plan not prepared** — movement/rotation deferred pending production-source verification and impact assessment.
5. **D6 field mapping not finalized** — source-to-target mapping (userId→user_id, timestamp→created_at, actor, read_by, payload body) remains Proposed/Unknown.
6. **D6 idempotency not proven with populated data** — only 1 project/site/document tested; broader coverage needed.
7. **D7 adapter not implemented** — gated by contract map and stage approvals.
8. **No tested recovery/reconciliation procedure** for post-cutover writes (replay/reconciliation/discard policy not designed or tested).
9. **No tested rollback** beyond snapshot existence (audit logs cannot be relied on for reversal until before/after information verified — currently Unproven).
10. **No communication plan** for session revocation (Migration 19 impact).
11. **Stage 0 evidence is chat-only** — not preserved as a repository document (documentation limitation recorded).
12. **Stage 3 entry criteria not satisfied** — isolated DB test readiness incomplete; production discovery not authorized; recovery/reconciliation not tested.

---

## 4. Recommended Next Project Activity and Justification

### Recommended next activity: Close Phase 12's remaining gaps (NOT Phase 13)

**Justification:**

1. **Phase 12 is explicitly open** — the owner acceptance record (2026-11-01) states "Phase 12: remains OPEN" and "Do not start Stage 3, Phase 13, D6 production data migration, or D7 adapter implementation."
2. **Phase 12's exit criteria are not met** — Stage 3 entry criteria require: isolated DB test readiness (incomplete), production discovery authorization (not granted), rollback/recovery readiness (not tested), owner approval (not granted).
3. **Phase 13 is undefined in the master plan** — the master plan (`COS_Full_Frontend_Rebuild_Plan_AR.md`) defines phases 0–11. Phase 12 was added as a study phase. Phase 13 would be a new phase requiring explicit chartering after Phase 12 completion.
4. **The critical path is through Phase 12's remaining gaps** — production migration readiness cannot be assessed without: (a) an isolated PG 18 environment (or acceptance of PG 17-only evidence), (b) a read-only production assessment, (c) finalized contract map, (d) D5/D6/D7 design completion, (e) Stage 3 entry criteria satisfaction, (f) owner approval.

### Activities that can proceed independently (without violating Phase 12 boundaries)

These activities are **documentation and read-only analysis only** — they do not execute gated tasks:

| Activity | Boundary check | Authorized? |
|---|---|---|
| Finalize the prototype-to-live-API contract map (static analysis, no code changes) | Read-only; no execution | Yes (documentation) |
| Prepare D5 safe secret-handling/rotation plan (documentation) | No secret movement/rotation | Yes (documentation) |
| Design D6 field mapping, idempotency, recovery procedures (documentation) | No D6 execution | Yes (documentation) |
| Design D7 adapter contract (documentation) | No implementation | Yes (documentation) |
| Create `phase-12-stage-0-inventory.md` (preserve chat-only evidence) | Documentation only | Yes (if owner-approved) |
| Authorize and perform read-only production assessment | Requires explicit owner authorization | No (not yet authorized) |
| Provision isolated PG 18 environment | Requires specific diagnostic justification + owner approval | No (not yet authorized) |
| Execute Stage 3 validation | Requires Stage 3 entry criteria + owner approval | No |
| Implement D6/D7 | Requires owner approval + stage gates | No |

### Activities that must NOT proceed (authorization boundaries)

- Stage 3 execution, Phase 13, D5 secret movement/rotation, D6 JSON data migration (production or isolated implementation), D7 HTTP adapter implementation, production database access (read or write), production migrations or schema changes, changes to PostgreSQL services/config/credentials/data, changes to auth/permissions/RBAC/API namespace, Git staging/commit/reset/clean/deployment.

---

## 5. Candidate Next-Phase Sequence

The following sequence is recommended from the current state toward the next authorized implementation stage. Each step requires owner approval before execution.

| Step | Activity | Prerequisite | Gate |
|---|---|---|---|
| 1 | Owner review of this discovery document and all Phase 12 reports | None (documentation review) | Owner review |
| 2 | Owner decision on PG 18 isolated environment (VM/separate host) or acceptance of PG 17-only evidence | Owner decision | Owner approval |
| 3 | If PG 18 env available: repeat dry run on PG 18; compare PG 17 vs PG 18 | Step 2 + isolated env | Owner review of isolation evidence |
| 4 | Authorize read-only production assessment (14-item checklist) | Owner authorization | Owner approval |
| 5 | Execute read-only production assessment; close Unknown production facts | Step 4 | Owner review of findings |
| 6 | Finalize contract map (prototype ↔ live API) + per-endpoint HTTP shapes | D4 complete (done) | Documentation review |
| 7 | Prepare D5 safe secret-handling/rotation plan (verify production source, assess impact) | Step 5 (for production source) | Owner approval of plan |
| 8 | Design D6 field mapping, idempotency, recovery/reconciliation; test in isolated env | Steps 3/5 | Owner approval |
| 9 | Design D7 adapter contract (against current API, per contract map) | Step 6 | Owner approval |
| 10 | Satisfy Stage 3 entry criteria (doc D / Stage 2C §9) | Steps 3–9 | Owner review |
| 11 | Owner authorization of Stage 3 | Step 10 | Owner approval |
| 12 | Execute Stage 3 (automated validation suite) | Step 11 | Stage 3 gate |
| 13 | Owner authorization of Phase 13 chartering | Step 12 + Phase 12 completion | Owner approval |

**Note:** Steps 1–7 can include documentation/preparation work that does not execute gated tasks. Steps 8–13 require explicit authorization.

---

## 6. PostgreSQL 18 Blocker Analysis and Diagnostic Plan

### 6.1 Known facts (Verified)
- PostgreSQL 17.11 and 18.4 binaries are installed at `C:\Program Files\PostgreSQL\17\bin\` and `C:\Program Files\PostgreSQL\18\bin\`.
- Two temporary clusters were initialized (PG 17 on port 5439, PG 18 on port 5440) in `C:\Users\PC-01\AppData\Local\Temp\opencode\pg-stage2-cluster*`.
- Both clusters initialized and started (postmaster bound 127.0.0.1, "database system is ready to accept connections").
- Both crashed with `0xC0000142` (STATUS_DLL_INIT_FAILED) on worker process initialization:
  - PG 17: server process (PID 3052 / 5708) terminated on connection attempt.
  - PG 18: autovacuum worker (PID 5064) terminated ~2 min after startup.
- All key DLLs present in PG 17 bin (libpq, libcrypto-3-x64, libssl-3-x64, libintl-9, libiconv-2, libxml2, libxslt, zlib1, libwinpthread-1).
- PATH has no PostgreSQL entries (binaries invoked by absolute path; no cross-version PATH pollution).
- Windows Application/System event logs in the crash window: no matching events found.
- Safe probes: `cmd /c "echo probe_ok"` (exit 0), `postgres --version` for PG 17 and 18 (exit 0), `pg_ctl --version` (exit 0).
- Operational PostgreSQL 18 service (host) is running on port 5432 (PID 8100) and 5433 (PID 7892); it was NOT touched.
- Docker is not available.

### 6.2 Distinction: A (actual incompatibility) vs B (environment failure) vs C (missing evidence)

| Hypothesis | Evidence for | Evidence against | Assessment |
|---|---|---|---|
| **A. Actual PG 18 migration/application incompatibility** | None — no PG 18 migration was ever executed | Migrations use standard SQL + contrib extensions available in both 17 and 18; no PG 18-specific features observed in SQL | Not supported by evidence; cannot be ruled out without testing |
| **B. Failure of isolated cluster startup environment** | Worker processes crash with `0xC0000142` (STATUS_DLL_INIT_FAILED) on both PG 17 and 18; main postmaster starts fine; cmd.exe probe succeeds; no event log entries | The crash is specific to worker-process initialization, not total sandbox block | **Likely but unconfirmed** — evidence points to a worker-process DLL initialization failure in this execution context |
| **C. Missing evidence preventing a compatibility conclusion** | No successful PG 18 connection or migration execution; no event log entries; no DLL diagnostic tool available | — | **Confirmed** — missing evidence prevents any compatibility conclusion |

**Conclusion:** The evidence supports hypothesis B (environment failure) as likely but unconfirmed, and hypothesis C (missing evidence) as confirmed. Hypothesis A (actual incompatibility) is not supported by any evidence but cannot be ruled out without testing. The root cause is **likely but unconfirmed**.

### 6.3 Diagnostic plan (non-executing, for owner review)

**Phase 1 — Evidence gathering (read-only, no system changes):**
1. Review the server.log files from both failed clusters (already done — crash at 0xC0000142 on worker init).
2. Check Windows Event Viewer (Application/System) for PostgreSQL provider entries or DLL load failures in the crash window (attempted — no matching events found; may require elevated access or different log).
3. Inspect the PostgreSQL binary directory for required DLLs and their dependencies (done for PG 17 — all key DLLs present).
4. Check the VC++ runtime installation status (msvcp/vcruntime DLLs in System32) — read-only inspection.
5. Check if a DLL diagnostic tool (e.g., Dependency Walker, dumpbin, procmon) is available without installation.

**Phase 2 — Safe probes (read-only, no DB access):**
6. Run `postgres --single` (single-user mode) against the existing cluster data dir with a read-only query to see if the backend process itself can initialize (this avoids worker process spawn). **Caution:** this executes SQL (SELECT 1) — requires owner approval as it is SQL execution, even read-only.
7. Check if the crash reproduces with a minimal `pg_ctl start` + immediate `pg_ctl stop` (no connections) — to determine if the crash requires a connection or happens on idle autovacuum.

**Phase 3 — Alternative environments (if Phase 1/2 don't resolve):**
8. Provision PostgreSQL 18 on a separate Windows VM (if VM infrastructure available) — separate data dir, port, no production creds.
9. Provision PostgreSQL 18 on a separate physical/virtual host (if available).
10. Use an approved isolated container environment (if a container runtime other than Docker is available and verified).

**Prohibited (per task boundaries):** no system DLL changes, no ACL changes, no desktop/session setting changes, no antivirus changes, no reinstall of PostgreSQL or VC++ runtimes without evidence and separate approval, no bypass of sandbox, no privilege escalation, no security policy modification.

**If no diagnostic path resolves the issue:** report the blocker and recommend owner decision on infrastructure (VM/separate host) for PG 18 isolated testing.

---

## 7. Dependencies and Unresolved Owner Decisions

### Dependencies (what blocks what)

```
Phase 12 completion
  ├── D4 repair (DONE) ──→ typecheck green (DONE) ──→ Stage 2 execution (BLOCKED: no isolated PG 18 env)
  ├── Contract map (incomplete) ──→ D3 namespace decision ──→ D7 adapter implementation
  ├── Production facts (Unknown) ──→ Stage 1 target schema finalization ──→ Stage 3 entry
  ├── D5 plan preparation (not started) ──→ secret movement/rotation
  ├── D6 field mapping (Proposed/Unknown) ──→ D6 execution
  ├── D7 contract (incomplete) ──→ D7 implementation
  ├── Stage 3 entry criteria (not satisfied) ──→ Stage 3 execution
  └── Owner approvals (pending) ──→ all gated activities
```

### Unresolved owner decisions (11)
1. PG 18 isolated environment provisioning (VM/separate host) — who owns infrastructure.
2. Accept PG 17-only evidence vs. require PG 18 repeat dry run.
3. D5 secret movement/rotation timing.
4. D6 audit/notifications migration execution timing.
5. D7 HTTP adapter implementation timing.
6. Broader populated-data dry run (more entities).
7. Read-only production assessment authorization.
8. Recovery/reconciliation procedure test authorization.
9. New permission key / namespace / schema change.
10. Stage 3 entry authorization.
11. Phase 13 chartering authorization.

---

## 8. Authorization Matrix: Allowed for Planning / Not Authorized for Execution

| Activity | Planning allowed? | Execution authorized? |
|---|---|---|
| Read-only repository inspection | Yes | N/A (read-only) |
| Documentation creation/editing | Yes | N/A (documentation) |
| Contract map drafting (static analysis) | Yes | No code changes |
| D5 plan preparation (documentation) | Yes | No secret movement |
| D6 field mapping design (documentation) | Yes | No D6 execution |
| D7 adapter contract design (documentation) | Yes | No implementation |
| Stage 0 inventory (repository-only) | Yes | No production access |
| D4 repair (completed) | — | Yes (completed, narrow scope) |
| `npm run typecheck` | Yes (executed) | Done |
| Stage 2 dry run (isolated PG 17) | — | Yes (executed, PASS WITH LIMITATIONS) |
| Stage 2 environment provisioning | Yes (attempted) | Blocked (0xC0000142) |
| Stage 3 automated validation | Yes (planning) | No |
| Phase 13 chartering | Yes (planning) | No |
| D5 secret movement/rotation | Yes (planning) | No |
| D6 JSON → PG migration (isolated test) | Yes (planning) | No |
| D6 JSON → PG migration (production) | Yes (planning) | No |
| D7 HTTP adapter implementation | Yes (planning) | No |
| Production database access (read) | Yes (planning) | No (not authorized) |
| Production database access (write) | No | No |
| Production migration execution | Yes (planning) | No |
| Schema changes (DDL) on any DB | Yes (planning) | No (except test DBs) |
| Secret rotation | Yes (planning) | No |
| Permission changes | Yes (planning) | No |
| API namespace changes | Yes (planning) | No |
| Git staging / commit / reset / clean | No | No |
| Production deployment | No | No |

---

## 9. Proposed Entry Criteria for the Next Implementation Stage

The next implementation stage (whichever is authorized first) must satisfy:

1. **Owner approval** of the specific activity and its scope.
2. **D4 repair complete + typecheck green** (satisfied 2026-10-29).
3. **Isolated environment available and proven** (blocked — 0xC0000142; needs VM/separate host/approved container).
4. **Authorized data source** (synthetic or owner-authorized isolated copy).
5. **Migration runner and ordering inspected** (satisfied).
6. **Specific test scope documented** (satisfied — Doc D Stage 3 scope rule).
7. **No production connection or production mutation** (satisfied by construction).
8. **Production facts verified** (Unknown — requires authorized read-only production assessment).
9. **Recovery/reconciliation policy designed and tested** (not yet).
10. **Owner approval at each applicable gate** (pending).

**A successful repository-level or isolated dry run is not proof of production migration readiness.**

---

## 10. Explicit Owner Approval Gates

The following gates require explicit owner approval before proceeding:

1. **Gate 1:** Owner review and acceptance of this discovery document.
2. **Gate 2:** Owner decision on PG 18 isolated environment (provision or accept PG 17-only evidence).
3. **Gate 3:** Owner authorization of read-only production assessment.
4. **Gate 4:** Owner approval of D5 safe secret-handling/rotation plan.
5. **Gate 5:** Owner approval of D6 field mapping, idempotency, and recovery design.
6. **Gate 6:** Owner approval of D7 adapter contract design.
7. **Gate 7:** Owner authorization of Stage 3 entry (after all entry criteria satisfied).
8. **Gate 8:** Owner authorization of Phase 13 chartering (after Phase 12 completion).

**No implementation is authorized by this document. Phase 12 remains OPEN.**

---

## 11. Final Response

### Exact file path
`docs/frontend-rebuild/phase-12/phase-12-next-step-discovery.md`

### Recommended next step
Close Phase 12's remaining gaps — do NOT advance to Phase 13. The critical path is: (1) owner decision on PG 18 isolated environment (VM/separate host) or acceptance of PG 17-only evidence; (2) owner authorization of read-only production assessment to close Unknown production facts; (3) finalize contract map; (4) design D5/D6/D7; (5) satisfy Stage 3 entry criteria; (6) obtain owner approval for Stage 3. All can include documentation/preparation work that does not execute gated tasks.

### New owner decisions required
1. PG 18 isolated environment provisioning (VM/separate host) — who owns infrastructure.
2. Accept PG 17-only evidence vs. require PG 18 repeat dry run.
3. Read-only production assessment authorization.
4. D5 secret movement/rotation timing.
5. D6 audit/notifications migration execution timing.
6. D7 HTTP adapter implementation timing.
7. Broader populated-data dry run (more entities).
8. Recovery/reconciliation procedure test authorization.
9. New permission key / namespace / schema change.
10. Stage 3 entry authorization.
11. Phase 13 chartering authorization.

### Confirmation
- No code, database, service, configuration, credentials, or Git state was changed.
- No SQL executed, no migrations run, no production connection made.
- Phase 12 remains OPEN (existing evidence does not support a different status).
- No Stage 3, Phase 13, D6 execution, or D7 implementation was started.

**STOP. No implementation. Owner review required.**