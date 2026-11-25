# Phase 12 — Revised WP-03 Proposal — Windows Native PostgreSQL 18.4 on the Existing Host (I-WIN)

**Status:** `PROPOSED — NOT AUTHORIZED — DOCUMENTATION ONLY — PHASE 12 REMAINS OPEN`

**Repository:** `D:\Default Project\company-ops-system`
**Branch:** `main`
**HEAD:** `f91ed2f9e81db3937e3bcbb1b44e5e2c44e175cf`
**Remote:** `https://github.com/mamin144/company-ops-system.git`
**Date:** `2026-11-09`

This document is the revised execution proposal for work package `WP-03` under the owner-approved environment direction **`I-WIN` — Windows Native PostgreSQL 18.4 on the existing Windows host** (owner decision amendment `R-139`).

**Every command and proposed artifact in this document is `PROPOSED — NOT EXECUTED`.** Nothing here has been run. All database names, role names, grants, and settings are **proposals only** — none has been created or applied. `WP-03` remains `NOT AUTHORIZED`, and condition 1 remains `NOT MET`.

---

## 1. Purpose, scope, and classification

| Field | Value |
|---|---|
| Document type | Execution proposal (planning artifact) |
| Authorization produced | **None** |
| Authorization required before execution | Separate, explicit **WP-03 execution authorization** naming WP-03 (per R-138 §9.6) |
| Work-package status | `WP-03 — PROPOSED — NOT AUTHORIZED` |
| Condition 1 status | `NOT MET` (no isolation evidence exists yet) |
| Controlling dependency model | R-138 §9 (`D-I` → separate WP-03 execution authorization → WP-03 → isolation evidence → Condition 1) |

`I-WIN` approves the environment **direction** only (R-139). It does **not** authorize provisioning, database creation, configuration changes, migration execution, backup, restore, or application deployment. This proposal defines the assessment-and-establishment plan a future authorized session would follow.

### 1.1 Scope

- **Assessment plan** for the existing Windows Native PostgreSQL 18.4 instance as the future phase-12 validation environment.
- **Proposed future test-environment design** (database, role, access, and artifact separation) — explicitly proposals only.
- **NOT VERIFIED register** for the environment facts still lacking authorised evidence.
- **Condition-1 evidence plan** adapted to the I-WIN approach.
- **Stop rule** returning the issue to the owner if isolation cannot be demonstrated without risky changes to the existing host.

### 1.2 Out of scope — absolute prohibitions

This proposal must **NOT** propose — and no authorized execution under it may perform — any of the following:

1. Creating a virtual machine (VM).
2. Installing Linux.
3. Installing Docker or any container runtime.
4. Installing another PostgreSQL instance.
5. Moving the existing PostgreSQL 18 data directory (`C:\Program Files\PostgreSQL\18\data`).
6. Replacing PostgreSQL 17 (`postgresql-x64-17` must remain untouched).
7. Reinitializing existing databases (including `cos_db` or `cos_authz_unit`).

Additional standing prohibitions (unchanged from the authorization records): do not connect the COS application to either existing COS database; do not change `postgresql.conf` or `pg_hba.conf`; do not change Windows Firewall rules; do not restart or stop either PostgreSQL service; do not run migrations, `pg_dump`, `pg_restore`, backups, or restores; do not touch production credentials or `.env`.

---

## 2. Verified environment baseline (owner-confirmed, recorded by R-139)

The following facts were established through owner-provided PowerShell and PostgreSQL command outputs. They are recorded as `Owner-Confirmed` evidence; this proposal executes no verification of its own.

| Item | PostgreSQL 18 (the I-WIN target) | PostgreSQL 17 (untouched) |
|---|---|---|
| Version | 18.4 | 17.x (previously observed operational) |
| Installation directory | `C:\Program Files\PostgreSQL\18` | `C:\Program Files\PostgreSQL\17` |
| Data directory | `C:\Program Files\PostgreSQL\18\data` | — |
| Windows service | `postgresql-x64-18` — **Running**, Automatic | `postgresql-x64-17` — **Running** |
| Port | `5432` | `5433` (previously observed locally ready) |
| Readiness | `pg_isready`: accepting connections; authenticated SQL query confirmed server identity, data directory, port, configuration | Previously observed ready |
| Client tools | `pg_dump` 18.4; `pg_restore` 18.4 | — |

**Existing databases on PostgreSQL 18 (both preserved — neither is disposable):**

| Database | Tables | Approx. size | Rows (inspected) | `_migrations` |
|---|---|---|---|---|
| `cos_db` | 27 | ~12 MB | 3,243 | 19 records; names match repository filenames |
| `cos_authz_unit` | 26 | ~9.4 MB | 36 | **Not present** |

**Network configuration (observed):** `listen_addresses = '*'`; `port = 5432`; `pg_hba_file_rules` contain local connections and TCP rules for `127.0.0.1` and `::1`; authentication `scram-sha-256`; no HBA parsing errors reported. **Windows Firewall rules and effective external reachability have NOT been independently verified.** These observed settings do **not** establish Condition 1.

**Migration runner (verified repository findings):** application initialization calls `runMigrations()`; the runner reads SQL files from the migrations directory via `fs.readdir`, filters `.sql`, sorts with `localeCompare`, does not recurse into `down/`, wraps each migration and its `_migrations` insert in a transaction with rollback on failure, records name + timestamp (no content checksums); `copy-migrations.cjs` copies migration assets into `dist` including `down/`; `11_modernize_dms.sql` and `18_modernize_dms.sql` are identical by SHA-256 (`852AB84B901DE5AC9808213647EF5DF4F9158AAB7D59556D9A0C5B58FBCBF65B`).

---

## 3. Mandatory safety conclusions (binding)

1. **Do not connect the existing application to `cos_authz_unit`.** Without the `_migrations` ledger, the runner would treat existing migration files as unapplied and attempt to execute them against it.
2. **Do not use `cos_db` for migration or restore experiments.** Ledger-name match does not prove historical migration-content equivalence, and the database holds existing project data.
3. `cos_db` and `cos_authz_unit` must be preserved. No application startup or migration execution is authorized by I-WIN, R-139, or this proposal.
4. The `0xC0000142` lesson (Stage 2B) remains binding as written: **do not repeat prior local-cluster provisioning attempts without a specific diagnostic justification.** Under I-WIN there is no local-cluster provisioning at all — the existing instance is used in place — and no `initdb`-type operations appear anywhere in this proposal.

---

## 4. Relation to prior WP-03 record

| Prior artifact | Disposition |
|---|---|
| `phase-12-owner-decision-addendum-d-i-i3.md` | Historical record (decision 2026-11-05), preserved; supersession notice appended (R-139) |
| `phase-12-wp-03-isolated-postgresql18-container-execution-proposal.md` | **Superseded as the WP-03 direction** (Docker no longer approved); preserved as historical evidence; supersession notice appended (R-139). Its condition-1 evidence discipline, non-repetition rules, and staged `PROPOSED — NOT EXECUTED` pattern are carried forward here where applicable |
| `phase-12-r137-identifier-and-dependency-integrity-correction-r138.md` (R-138) | Dependency/authorization model remains controlling (§8) |
| `phase-12-owner-decision-amendment-r139-d-i-windows-native-pg18.md` (R-139) | The I-WIN decision record this proposal operationalizes |

The historical condition-1 wording sampled ("VM, separate host, or approved container") is a dated enumeration from R-136 §D. Under R-139 the assessed environment is the **owner-approved I-WIN arrangement on the existing instance**; condition 1 is assessed against **isolation evidence itself**, not against which dated enumeration item was used.

---

## 5. Proposed future test-environment design (proposals ONLY — nothing created)

The following are design proposals for a separately authorized WP-03 execution. **The database name and role name are proposals only. Do not create them. No artifact below exists.**

### 5.1 Procedural layer — reuse, preserve, isolate

| Proposal element | Proposal | Status |
|---|---|---|
| Server/service | Reuse the **existing PostgreSQL 18.4 service** (`postgresql-x64-18`, port `5432`) as-is | `PROPOSED` |
| Existing databases | Preserve `cos_db` and `cos_authz_unit` untouched; no read-through, no writes, no experiments | `PROPOSED` |
| Validation database | Consider a future dedicated database named **`cos_phase12_validation`** (name proposal only) | `PROPOSED — NOT CREATED` |
| Validation role | Consider a separate **least-privilege login role** for validation (role name proposal only), scoped to the validation database only | `PROPOSED — NOT CREATED` |
| Superuser discipline | Do **not** reuse the existing `postgres` superuser for application or test execution | `PROPOSED` |
| Access path | Prefer **loopback-only access** for validation (align with the `127.0.0.1`/`::1` HBA pattern) — assess via proposals in §7, do not change HBA | `PROPOSED` |
| Network review | Review **Windows Firewall and effective network reachability** read-only, without changing rules | `PROPOSED` |
| Artifact separation | Keep the validation database and all future artifacts (dumps, logs, evidence, scratch data) **separate from operational databases and production credentials**; no reuse of production secrets; no test artifacts in operational schemas | `PROPOSED` |
| Lifecycle | Define ownership and lifecycle (creation → use → evidence capture → drop-only-if-needed) **before** creation; validation objects should be removable without touching operational data | `PROPOSED` |
| Rollback/safety | Pre-establish a validated backup/recovery story for any destructive-capable step **before** it is authorized (currently NOT VERIFIED — §6) | `PROPOSED` |

### 5.2 Cross-cutting rules for the design

- The validation arrangement must enable Phase 12's actual purpose: eventually providing a PG18-compatible reader/target for assessments (e.g., archive compatibility checks under separately authorized future work packages) without touching `cos_db`/`cos_authz_unit`.
- All isolation claims must be **evidence-based**, not setting-based. Observed HBA loopback rules are settings, not proof (§6 items 1–3 and 8).
- No component of the design may require risky changes (security posture reductions, service restarts, firewall or HBA edits) → that outcome triggers the §9 stop rule.

---

## 6. NOT VERIFIED register

The following remain **NOT VERIFIED**; each requires an authorized evidence step before it can be relied upon:

| # | Item | Why it cannot be assumed |
|---|---|---|
| 1 | Windows Firewall and effective external network access | Rules and effective reachability not independently verified; reachability from outside the host is unknown |
| 2 | Whether `listen_addresses = '*'` is acceptable | This widens the potential listening surface; acceptability for the isolation purpose is an owner/policy question, unassessed |
| 3 | Whether existing PostgreSQL 18 service-level settings satisfy the intended isolation requirements | No isolation charter/evidence has been produced for this instance's settings |
| 4 | Dedicated validation database creation | `cos_phase12_validation` does not exist (proposal only); creation is `NOT AUTHORIZED` |
| 5 | Dedicated validation role and permissions | Role does not exist (proposal only); creation is `NOT AUTHORIZED` |
| 6 | Backup and recovery evidence for the existing instance | No validated backup/recovery story for the instance has been produced or accepted |
| 7 | Validation database ownership and lifecycle controls | No recorded ownership/lifecycle design has been accepted |
| 8 | Evidence that all validation operations cannot affect operational or production databases | Isolation evidence does not yet exist — this is precisely what Condition 1 assessment would require |

**Note:** the owner-provided evidence base (§2) supports the *direction* (a working PG 18.4 with matching client tools exists) but establishes **none** of the isolation properties above.

---

## 7. Proposed staged assessment procedure `A`–`D`

> **STATUS: `PROPOSED — NOT EXECUTED`.** Every command is illustrative of what an authorized session would run. No command has been run; none may be run without the separate WP-03 authorization. Nothing below changes any configuration; Stage A–B are read-only inspections; Stage C would create proposed artifacts **only if** previously gated by the authorization and an accepted safety record.

### Stage A — Re-verification and network/firewall assessment (read-only)

Purpose: convert §6 items 1 and 2 from `NOT VERIFIED` into evidence (if derivable read-only) and confirm the §2 baseline still holds.

```powershell
# PROPOSED — NOT EXECUTED
Get-Service postgresql-x64-18, postgresql-x64-17
& "C:\Program Files\PostgreSQL\18\bin\pg_isready.exe" -h 127.0.0.1 -p 5432
Get-NetFirewallRule -Direction Inbound | Where-Object { $_.Enabled -eq 'True' }
# plus a focused review of any rule referencing PostgreSQL (read-only listing only)
Test-NetConnection -ComputerName 127.0.0.1 -Port 5432              # loopback reachability
# effective external reachability would be tested from an EXTERNAL vantage point only
# if and when separately authorized; no firewall rule is created or changed either way.
```

Stop conditions: any required fact not obtainable read-only → record and stop; external-reachability testing cannot be safely constructed → treat as unknown and rely on §9.

### Stage B — Isolation analysis against the proposals (paper + read-only evidence)

Purpose: evaluate whether the §5.1 proposals can satisfy the isolation intent **without** any risky change. Produce a written isolation assessment covering: database-boundary isolation, privilege-boundary isolation (no superuser reuse), network-boundary (loopback preference), artifact separation, and blast-radius-from-operational-dbs analysis.

```powershell
# PROPOSED — NOT EXECUTED
# No commands belong to Stage B other than repeat read-only checks from Stage A,
# plus owner-facing analysis. No CREATE statements, no config reads of secrets,
# no changes of any kind.
```

### Stage C — Establishment of proposed validation artifacts (only after double gate)

Purpose: create the proposed database/role per §5.1 — **only if** (a) the separate WP-03 execution authorization has been recorded, and (b) the Stage B isolation assessment has been accepted by the owner.

```sql
-- PROPOSED — NOT EXECUTED — names are proposals only
-- (illustrative only; final wording, ownership, grants, and lifecycle
-- would be fixed in the authorized execution and reviewed then.)
CREATE DATABASE cos_phase12_validation;
CREATE ROLE cos_phase12_validator LOGIN;  -- least privilege; restrictions applied at grant time
```

And only then, bounded prose-evidence requirements:

- Retain full transcripts of every statement run and its outputs (the condition-1 evidence record).
- Verify the validation database is reachable **only** via the intended access path.
- Verify zero writes and zero configuration drift to `cos_db`, `cos_authz_unit`, `postgresql-x64-17`, and any config file.

### Stage D — Evidence capture, condition-1 assembly, or stop

Purpose: either assemble the condition-1 evidence pack (§8) for assessment, or execute the §9 stop rule.

```powershell
# PROPOSED — NOT EXECUTED
# Evidence bundle: Stage A outputs, Stage B assessment, Stage C transcripts,
# and an explicit statement of what remains unknown. No operational commands.
```

**No operational-database command appears anywhere in this procedure.** Neither `cos_db` nor `cos_authz_unit` is ever targeted, read, or written.

---

## 8. Condition-1 evidence plan (checklist)

Condition 1 stays `NOT MET` until an authorized execution produces each item below and an assessment accepts it:

| # | Evidence item | Feeds from |
|---|---|---|
| 1.1 | Service state, version, port re-confirmed at execution time (not from memory) | Stage A |
| 1.2 | Windows Firewall and effective reachability assessed; findings recorded, including external-reachability status (verified/unverifiable) | Stage A |
| 1.3 | Acceptability question for `listen_addresses = '*'` assessed and answered (accept / escalate / require change) | Stage A–B |
| 1.4 | Service-level settings assessed against the isolation intent (§6 item 3) | Stage B |
| 1.5 | Validation database and role exist per accepted proposals, or the isolation case is made without them | Stage C |
| 1.6 | Least-privilege role demonstrated; **no superuser reuse** for any application/test execution | Stage C |
| 1.7 | Loopback-only access demonstrated, or any wider path explicitly assessed and accepted | Stage A–C |
| 1.8 | Separate-ness demonstrated: validation artifacts disjoint from `cos_db`, `cos_authz_unit`, and all operational/production surfaces | Stage B–C |
| 1.9 | Lifecycle controls recorded: creation evidence, intended retention, and a defined removal path that cannot touch operational data | Stage C |
| 1.10 | No risky host changes made (no firewall/HBA edits, no service restarts, no data-dir moves) — documented as such | Stage A–C |
| 1.11 | Full transcript with timestamps retained | A–D |
| 1.12 | Backup/recovery story for any future destructive-capable step established or explicitly deferred with accepted risk | Stage B |

Failure of any row → Condition 1 remains `NOT MET`; do not proceed to WP-04.

---

## 9. Stop rule (return to owner)

**If sufficient isolation cannot be demonstrated without risky changes to the existing host (e.g., needing firewall rule changes, HBA edits, service restarts, `listen_addresses` changes, or privilege-model weakening), the authorized session must stop and return the issue to the owner.**

No risky change is self-authorized. The stop rule is not a failure of the direction: it is the designed behavior of this proposal when evidence shows the host cannot host an isolatable validation arrangement as-is.

---

## 10. Authorization and dependency table (preserved — R-138 §9)

- `D-I` via I-WIN `→` separate **WP-03 execution authorization** `→` WP-03 `→` isolation evidence `→` **Condition 1**.
- Condition 1 `→` separate **WP-04 authorization** `→` PG 18 migration dry run `→` **Condition 2** (assessed after).
- Condition 2 is **soft/recommended** for WP-05, not a hard prerequisite.
- `D-A` **and** a separate **restore execution authorization** remain required for WP-05. `D-A` remains `PENDING OWNER DECISION`.

| Item | Status |
|---|---|
| `D-I` / I-WIN | `DECIDED` (direction only); execution `NOT AUTHORIZED` |
| WP-03 | `PROPOSED — NOT AUTHORIZED` |
| Condition 1 | `NOT MET` |
| Condition 2 | `NOT MET` (soft/recommended for WP-05) |
| Condition 10 | `NOT MET` |
| Condition 11 | `NOT MET` |
| `D-A` | `PENDING OWNER DECISION` |
| Stage 3 / Phase 13 | `NOT AUTHORIZED` |

**Container-row disposition:** the previous container-proposal Stage C (docker network/container run) is entirely withdrawn; no Docker operation is proposed anywhere in this document.

---

## 11. Risk register

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| R1 | `listen_addresses = '*'` interpreted as proof of isolation or as safe | False Condition 1 closure; external exposure unnoticed | §2.4/§6/§8: settings ≠ evidence; firewall/reachability assessment required |
| R2 | Effective external reachability is wider than HBA suggests | Validation or operational surfaces exposed | Stage A assessment; external vantage test only under authorization; stop rule |
| R3 | Accidental application connection to `cos_authz_unit` | Runner would execute all migrations on a ledger-less DB | §3 binding prohibition; WCAG of the design: app never pointed at either existing DB |
| R4 | `cos_db` drift during experiments | Damage to real project data | §3 binding prohibition; validation database proposal exists precisely to absorb experiments |
| R5 | Superuser reuse for app/test execution | Excessive privilege noise; weakened evidence value | §5.1 superuser discipline proposal |
| R6 | Risky host changes slipped in during Phase 12 work | Service/firewall drift, confidentiality/integrity erosion | §9 stop rule; §8 item 1.10 |
| R7 | Premature inference that I-WIN satisfies Condition 1 or 2 | Unauthorized downstream work | §10 table; both remain `NOT MET` |
| R8 | Loss of evidence provenance | Condition-1 assessment impossible | §8 1.11 transcript requirement |
| R9 | Backup/recovery absence discovered late | No safe path for destructive-capable steps | §6 item 6; §8 item 1.12 |

---

## 12. Explicit non-actions

None of the following were performed in producing this document:

- Creating databases, roles, users; changing passwords.
- Changing `postgresql.conf`, `pg_hba.conf`, Windows Firewall rules, or any network configuration.
- Starting, stopping, or restarting any PostgreSQL service.
- Installing anything (Linux, Docker, another PostgreSQL instance).
- Creating or provisioning any VM, container, runtime, or database.
- Moving or replacing any data directory; replacing PostgreSQL 17; reinitializing any database.
- Connecting to any database; executing any SQL, migration, `pg_dump`, `pg_restore`, backup, or restore.
- Connecting the COS application to any database; changing application code.
- Reading `.env` or any secret.
- Running tests, builds, typechecks, lint, or scripts.
- Git writes (no stage, commit, push, branch, tag, reset, stash, clean).
- Modifying any existing file in body.

---

## 13. Final stop report

| Item | Result |
|---|---|
| Output path | `docs/frontend-rebuild/phase-12/phase-12-wp-03-windows-native-pg18-existing-instance-proposal.md` |
| Companion decision amendment | `docs/frontend-rebuild/phase-12/phase-12-owner-decision-amendment-r139-d-i-windows-native-pg18.md` (R-139) |
| Repository root | `D:/Default Project/company-ops-system` |
| Branch / HEAD | `main` / `f91ed2f9e81db3937e3bcbb1b44e5e2c44e175cf` |
| New documents | 2 (R-139 amendment + this proposal) |
| Modified documents | 2, **append-only** (D-I/I3 addendum and container WP-03 proposal each receive a dated supersession notice; body content preserved) |
| Working tree | Pre-existing dirty state preserved; no Git write performed |
| Proposed artifacts | None created: `cos_phase12_validation` and the validation role are **proposals only, NOT CREATED** |
| Commands | All `PROPOSED — NOT EXECUTED` |
| NOT VERIFIED register | 8 items recorded (§6) |
| Condition 1 | `NOT MET` — settings do not equal evidence |
| Execution | `NOT AUTHORIZED` |
| Stage 3 / Phase 13 | `NOT AUTHORIZED` |

**Final required state:**
`I-WIN OWNER-APPROVED — WINDOWS NATIVE POSTGRESQL 18.4 — DOCUMENTATION UPDATED — WP-03 NOT EXECUTED — EXECUTION NOT AUTHORIZED — PHASE 12 REMAINS OPEN.`

---

**End of WP-03 Windows-native proposal.**
