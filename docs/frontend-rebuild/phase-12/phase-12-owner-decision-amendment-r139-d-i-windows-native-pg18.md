# Phase 12 — R-139: Owner Decision Amendment — D-I / Windows Native PostgreSQL 18.4 (I-WIN)

**Status:** `DOCUMENTATION ONLY — OWNER DECISION AMENDMENT — PHASE 12 REMAINS OPEN`

**Repository:** `D:\Default Project\company-ops-system`
**Branch:** `main`
**HEAD:** `f91ed2f9e81db3937e3bcbb1b44e5e2c44e175cf`
**Remote:** `https://github.com/mamin144/company-ops-system.git`
**Decision amendment date:** `2026-11-09`

This document is the owner decision amendment for consolidated Phase 12 decision `D-I`. It is append-only documentation in the R-series continuation (R-132 → … → R-138 → **R-139**). It supersedes only the environment-direction field of `D-I`; it does not authorize provisioning, database creation, configuration changes, migration execution, backup, restore, or application deployment.

**Identifier note:** the amendment identifier is deliberately **`I-WIN`** — a new, descriptive, non-numbered identifier. It does not reuse, extend, or reinterpret any previously discussed numbered option (`I1`, `I2`, `I3`, `I4`). The recorded meanings of `I1`–`I4` in R-136 §E.9 are preserved unchanged.

---

## 1. Owner decision amendment record

| Field | Value |
|---|---|
| Decision ID | `D-I` (isolated PostgreSQL 18 environment) |
| Amendment ID | **`R-139`** (next available documentation identifier; verified — no `R-139` existed in the repository before this document) |
| Amendment status | `DECIDED — I-WIN SELECTED` (environment direction) |
| Amendment date | `2026-11-09` |
| Decision source | Explicit owner instruction received 2026-11-09, assignment titled "COS Phase 12 — D-I Owner Decision Amendment — Windows Native PostgreSQL 18.4 on Existing Host" |
| Owner name | (not supplied — left blank) |
| Formal signature | Not supplied — owner instruction text recorded by reference |
| Accepted risk / waiver | None stated |
| Separate execution authorization | `NOT AUTHORIZED` |
| Supersedes | Only the environment-direction selection recorded for `D-I` (previously `I3 — Approved isolated PostgreSQL 18 Container`) |
| Historical decisions | `D1`–`D8` (Owner Decision Record) and `D-A`…`D-H` (R-132 §17.2 series) — unchanged and untouched |

### 1.1 I-WIN decision wording

> The owner explicitly approves replacing the previously selected `D-I` direction (**I3 — Docker-based PostgreSQL 18 environment**) with:
>
> **`I-WIN` — Windows Native PostgreSQL 18.4 running on the existing Windows host.**
>
> The previously discussed Linux VM alternative was **not approved**.
>
> This is an **environment-direction approval only**. It does **NOT** authorize provisioning, database creation, configuration changes, migration execution, backup, restore, or application deployment.

### 1.2 Direction changes recorded by this amendment

| Item | Status |
|---|---|
| `I3 — Approved isolated PostgreSQL 18 Container` | **Superseded — historical, not erased.** Docker is **no longer the approved environment direction** |
| `I1 — Dedicated VM` | **Not selected.** Linux VM alternative explicitly not approved; **new VM provisioning is not selected** |
| `I2 — Separate physical/virtual host` | **Not selected** (no separate host is chosen; work remains on the existing Windows host) |
| `I-WIN — Windows Native PostgreSQL 18.4 on the existing Windows host` | **Current, owner-approved `D-I` direction** |
| I4 — existing managed instance in an isolated database (R-136 §E.9, unselected) | Unchanged in meaning; `I-WIN` is a distinct, newly recorded direction and is **not** treated as a retro-selection of `I4` |

### 1.3 Supersession mechanics

- The prior `D-I` decision record `phase-12-owner-decision-addendum-d-i-i3.md` (decision date 2026-11-05) is **preserved exactly**; its decision history and decision dates are kept. A dated supersession notice has been **appended** (append-only; no body text altered) so `I3` remains discoverable as historical and superseded.
- The prior WP-03 container proposal `phase-12-wp-03-isolated-postgresql18-container-execution-proposal.md` (2026-11-05) is **preserved exactly as historical evidence**; a dated supersession notice has been appended. Its genuine contributions — condition-1 evidence discipline, `0xC0000142` non-repetition rules, authorization-gate structure — remain valid reference material.
- Nothing is silently rewritten in this corpus.

---

## 2. Existing environment — owner-verified evidence (recorded facts)

The following facts were collected through **owner-provided PowerShell and PostgreSQL command outputs** and are recorded here at classification `Owner-Confirmed`. This document did **not** independently re-inspect the environment; no operational command was executed in producing R-139.

### 2.1 PostgreSQL 18 (existing instance — the I-WIN direction)

| Fact | Value |
|---|---|
| Version | PostgreSQL **18.4** |
| Installation directory | `C:\Program Files\PostgreSQL\18` |
| Data directory | `C:\Program Files\PostgreSQL\18\data` |
| Windows service | `postgresql-x64-18` |
| Observed service state | **Running** |
| Startup type | Automatic |
| Port | `5432` |
| Local readiness | `pg_isready` reported accepting connections |
| Identity confirmation | A successful authenticated SQL query confirmed the server identity, data directory, port, and configuration |
| Client tools | `pg_dump` 18.4; `pg_restore` 18.4 |

`pg_dump`/`pg_restore` at 18.4 additionally supply the **version-consistent reader and target server** required by the R-136 Section C / C.4 compatibility finding (the repository's `postgres:16-alpine` PG 16 reader rejects the `PGDMP 1.16.0 / header 18.4` archives).

### 2.2 PostgreSQL 17 (untouched companion instance)

| Fact | Value |
|---|---|
| Installation directory | `C:\Program Files\PostgreSQL\17` |
| Windows service | `postgresql-x64-17` |
| Observed service state | **Running** |
| Local readiness | Previously observed on port `5433` (owner-provided) |
| Policy | **Must remain untouched.** No restart, no configuration change, no stop, no modification of any kind |

### 2.3 Existing PostgreSQL 18 databases (both preserved — neither is disposable)

**`cos_db`**

| Fact | Value |
|---|---|
| Tables | 27 |
| Approximate size | ~12 MB |
| Actual rows across inspected tables | 3,243 |
| `_migrations` ledger | 19 records |
| Ledger filenames | Match filenames in the repository |

**`cos_authz_unit`**

| Fact | Value |
|---|---|
| Tables | 26 |
| Approximate size | ~9.4 MB |
| Actual rows across inspected tables | 36 |
| `_migrations` ledger | **Not present** in the inspected table listing |

Both databases contain existing project data and **must be preserved**. Neither is an empty disposable test database.

### 2.4 PostgreSQL network configuration (observed, unverified reachability)

| Fact | Value |
|---|---|
| `listen_addresses` | `'*'` |
| `port` | `5432` |
| `pg_hba_file_rules` observed | Local connections and TCP rules for `127.0.0.1` and `::1` |
| Authentication method | `scram-sha-256` |
| HBA parsing errors | None reported |
| Windows Firewall rules / effective external reachability | **Not independently verified** |

**Constraint:** these settings are recorded as observed facts. They **do not prove Condition 1 isolation**. Isolation remains an assessment target requiring separate authorized evidence (see the WP-03 proposal, Deliverable B).

### 2.5 Migration runner — verified repository findings (§3 of the owner assignment)

The following files were inspected as repository findings (owner-assigned, read-only): `apps/api/src/database/migrate.ts`, `apps/api/src/app.ts`, `apps/api/copy-migrations.cjs`, `apps/api/src/database/migrations/`.

| # | Verified finding |
|---|---|
| 1 | Application initialization calls `runMigrations()` |
| 2 | The runner reads SQL files directly from the migrations directory using `fs.readdir` |
| 3 | It filters `.sql` files and sorts them using `localeCompare` |
| 4 | It does **not** recursively execute files in the `down` directory |
| 5 | Each migration SQL execution and its `_migrations` ledger insertion are enclosed in a transaction |
| 6 | Failures trigger rollback |
| 7 | The ledger records name and applied timestamp, but does **not** verify content checksums |
| 8 | `copy-migrations.cjs` recursively copies migration assets into `dist`, including the `down` directory |
| 9 | `11_modernize_dms.sql` and `18_modernize_dms.sql` have identical SHA-256: `852AB84B901DE5AC9808213647EF5DF4F9158AAB7D59556D9A0C5B58FBCBF65B` |

### 2.6 Mandatory safety conclusions (binding on all future work)

1. **Do not connect the existing application to `cos_authz_unit`.** Because it lacks the migration ledger, the current migration runner would treat existing migration files as unapplied and attempt to execute them against it.
2. **Do not use `cos_db` for migration or restore experiments.** Although its migration names match the current repository, historical migration content equivalence has **not** been proven, and the database contains existing project data.
3. No application startup or migration execution is authorized by this amendment.

---

## 3. Authorization boundary — I-WIN decision vs execution permission

Per R-138 §9.1, an owner decision is not an execution authorization. I-WIN changes only the environment direction.

| Activity | Status after I-WIN selection |
|---|---|
| Select Windows-native PG 18.4 environment direction | `DECIDED — I-WIN` |
| Prepare a bounded WP-03 proposal for the existing instance | `PROPOSED — NOT AUTHORIZED` (`phase-12-wp-03-windows-native-pg18-existing-instance-proposal.md`) |
| Create a database (e.g. a validation database) | `NOT AUTHORIZED` |
| Create roles or change passwords | `NOT AUTHORIZED` |
| Change `postgresql.conf`, `pg_hba.conf`, or Windows Firewall rules | `NOT AUTHORIZED` |
| Restart or stop `postgresql-x64-18` or `postgresql-x64-17` | `NOT AUTHORIZED` |
| Run migrations | `NOT AUTHORIZED` |
| Run `pg_dump` or `pg_restore` | `NOT AUTHORIZED` |
| Perform backups or restores | `NOT AUTHORIZED` |
| Connect the COS application to `cos_db` or `cos_authz_unit` | `NOT AUTHORIZED` — and prohibited as a safety rule (§2.6) |
| Change application code | `NOT AUTHORIZED` |
| Execute any DDL, DML, backup, restore, or operational database command | `NOT AUTHORIZED` |

**No database, service, network, firewall, or application configuration was changed by this amendment or in producing it.**

---

## 4. Condition and dependency status (preserved — R-138 §9 model)

The dependency structure is preserved unchanged:

- `D-I` (now via I-WIN) **→ separate WP-03 execution authorization → WP-03 → isolation evidence → Condition 1**.
- Condition 1 **→ separate WP-04 authorization → PostgreSQL 18 migration dry run → Condition 2**.
- Condition 2 is a **soft/recommended** dependency for WP-05, not a hard dependency.
- `D-A` **and a separate restore execution authorization** remain required for WP-05. `D-A` remains `PENDING OWNER DECISION` unless a separately documented owner decision already exists.

| Item | Status |
|---|---|
| `D-I` | `DECIDED — I-WIN SELECTED` (direction); execution `NOT AUTHORIZED` |
| I3 | `SUPERSEDED — HISTORICAL` (replaced as direction; record preserved) |
| WP-03 | `PROPOSED — NOT AUTHORIZED` (new Windows-native proposal; container proposal historical) |
| Condition 1 | **`NOT MET`** |
| WP-04 | `PROPOSED — NOT AUTHORIZED` |
| Condition 2 | **`NOT MET`** |
| Condition 10 | **`NOT MET`** |
| Condition 11 | **`NOT MET`** |
| `D-A` | `PENDING OWNER DECISION` |
| WP-05 | `PROPOSED — NOT AUTHORIZED` |
| Stage 3 | `NOT AUTHORIZED` |
| Phase 13 | `NOT AUTHORIZED` |

**The new direction does not automatically satisfy Condition 1.** Condition 1's requirement — a proven, isolated environment with reviewed isolation evidence and no `0xC0000142` recurrence — is assessed only from actual evidence produced under separately authorized WP-03 work. The facts in §2.4 (HBA rules for loopback, `scram-sha-256`) are not isolation evidence: Windows Firewall effectiveness and effective external reachability are unverified, and `listen_addresses = '*'` has an unreassessed acceptability question (WP-03 NOT-VERIFIED item 2).

---

## 5. Decision register update (canonical current rows)

This section is the new canonical register state for the `D-I` / `WP-03` cluster. All rows below are effective as of 2026-11-09; historical rows in R-136 §E.9, R-136 §I.9, the D-I/I3 addendum, and R-138 §11 remain as dated historical records.

| Register item | New canonical value | Source row affected (historical — preserved) |
|---|---|---|
| `D-I` environment direction | `DECIDED — I-WIN SELECTED` (Windows Native PostgreSQL 18.4, existing Windows host) | R-136 §E.9 options row; R-136 §I.9 fillable template; D-I addendum §1/§4; R-138 §11 line (all understood as historical, per §1.3) |
| Selected option identifier | `I-WIN` (new, non-numbered identifier by design) | — |
| Docker as environment direction | **Not approved** (no longer the selected direction) | Supersedes "I3 SELECTED" as current direction |
| Linux VM / new VM provisioning | **Not selected; not approved** | — |
| I3 record | `Historical — SUPERSEDED` (discoverable; preserved) | D-I addendum + appended notice |
| Container WP-03 proposal | `Historical — SUPERSEDED` (preserved as evidence; genuine guidance still citable) | Container proposal + appended notice |
| WP-03 active proposal | `PROPOSED — NOT AUTHORIZED` → `phase-12-wp-03-windows-native-pg18-existing-instance-proposal.md` | — |
| WP-03 execution authorization | `NOT AUTHORIZED` (separate, explicit, still required) | R-138 §9.6 WP-03 prerequisites |
| Condition 1 | `NOT MET` (does not follow from I-WIN or §2 facts) | R-136 §D row 1 |
| Condition 2 | `NOT MET` (soft/recommended for WP-05 — unchanged) | R-136 §D row 2; R-138 §9.3 |
| Condition 10 | `NOT MET` | R-136 §D row 10 |
| Condition 11 | `NOT MET` | R-136 §D row 11 |
| `D-A` | `PENDING OWNER DECISION` (unchanged) | R-136 §E.1 |
| `D-A`…`D-H`, `D1`–`D8` | Unchanged — no unrelated decision is affected | — |
| Stage 3 / Phase 13 | `NOT AUTHORIZED` (unchanged) | — |

**Register arithmetic note:** this amendment adds one decision identifier (`I-WIN`) and one work-package proposal identifier (the Windows-native WP-03 proposal). It creates no new findings, corrections, or condition rows; R-138's §7 arithmetic (157 identifiers / 137 rows) is unchanged by this document.

---

## 6. Document index update (Phase 12 decision documentation set)

| Document | Status as of 2026-11-09 |
|---|---|
| `phase-12-owner-decision-record.md` (D1–D8 ledger) | Historical — unchanged, preserved |
| `phase-12-owner-acceptance-record.md` | Historical — unchanged, preserved |
| `phase-12-final-evidence-and-owner-decision-pack-r136.md` (R-136) | Historical — unchanged, preserved (§D conditions, §E decisions, §G WP register, §H authorization matrix remain as records) |
| `phase-12-r136-index-and-sequencing-correction-r137.md` (R-137) | Historical — unchanged, preserved |
| `phase-12-r137-identifier-and-dependency-integrity-correction-r138.md` (R-138) | Historical — unchanged, preserved; its §9 dependency model remains controlling (§4 above) |
| `phase-12-owner-decision-addendum-d-i-i3.md` (D-I/I3 record, 2026-11-05) | **Historical — superseded by this amendment.** Body preserved; dated supersession notice appended |
| `phase-12-wp-03-isolated-postgresql18-container-execution-proposal.md` (2026-11-05) | **Historical — superseded as the WP-03 direction.** Preserved as evidence; dated supersession notice appended; its condition-1 evidence discipline and `0xC0000142` non-repetition rules remain citable guidance |
| **`phase-12-owner-decision-amendment-r139-d-i-windows-native-pg18.md` (this document, R-139)** | **Current — owner decision amendment, I-WIN** |
| **`phase-12-wp-03-windows-native-pg18-existing-instance-proposal.md` (Deliverable B)** | **Current — active WP-03 proposal, `PROPOSED — NOT AUTHORIZED`** |

No other Phase 12 document is in scope. Nothing silent is rewritten; supersession is recorded in append-only notices and here.

---

## 7. Historical preservation statement

The following documents are **not modified by R-139** (in body):

- R-132 through R-138 (all correction/consolidation reports)
- The historical Phase 12 Owner Decision Record (D1–D8)
- The owner acceptance record
- All other existing Phase 12 documents

Two existing documents receive **append-only supersession notices** (§1.3): the D-I/I3 addendum and the container WP-03 proposal. In both cases the pre-existing content is byte-preserved; the notice is appended after the existing terminal marker with a dated heading, so the original record retains its provenance and decision dates.

---

## 8. Explicit non-actions

None of the following were performed in producing this document:

- Creating or altering any database, table, or database object.
- Creating roles or users; changing passwords.
- Changing `postgresql.conf`, `pg_hba.conf`, or any PostgreSQL configuration file.
- Changing Windows Firewall rules or any network configuration.
- Starting, stopping, or restarting any Windows service (including `postgresql-x64-18` or `postgresql-x64-17`).
- Executing migrations, `pg_dump`, `pg_restore`, backups, or restores.
- Executing any SQL or operational database command against any database (`cos_db`, `cos_authz_unit`, PG 17, or any other).
- Connecting the COS application to any database; starting the application.
- Changing application code; running creative audit passes over it.
- Running Docker/container operations; provisioning any environment.
- Installing any software (Linux, Docker, a new PostgreSQL instance, or otherwise).
- Moving or replacing any PostgreSQL data directory; reinitializing any database.
- Reading `.env` or any secret value.
- Runnning tests, builds, typechecks, or lint against the application.
- Git writes (no stage, commit, push, branch, tag, reset, stash, clean).

Environment facts in §2 are recorded **as received** from owner-provided command outputs; R-139 executed none of them.

---

## 9. Final verification

| Item | Result |
|---|---|
| Output path (R-139) | `docs/frontend-rebuild/phase-12/phase-12-owner-decision-amendment-r139-d-i-windows-native-pg18.md` |
| Identifier check | `R-139` confirmed unused before this document (repository-wide search); next available |
| Repository root | `D:/Default Project/company-ops-system` |
| Branch / HEAD | `main` / `f91ed2f9e81db3937e3bcbb1b44e5e2c44e175cf` |
| Remote | `https://github.com/mamin144/company-ops-system.git` |
| Working tree | Pre-existing dirty state preserved (24 modified tracked + 3 untracked porcelain entries); no Git write performed |
| New documents | Exactly 2 (`R-139` amendment + Windows-native WP-03 proposal) |
| D-I recorded as | `DECIDED — I-WIN SELECTED` (direction); execution `NOT AUTHORIZED` |
| I3 recorded as | `SUPERSEDED — HISTORICAL`, retained and discoverable |
| Docker | No longer the approved environment direction |
| Linux VM / new VM provisioning | Not selected / not approved |
| Conditions 1, 2, 10, 11 | `NOT MET` — none marked met |
| `D-A` | `PENDING OWNER DECISION` |
| Execution authorizations | All `NOT AUTHORIZED` |
| Historical rewrites | None (append-only notices only) |
| Operational action | None (§8) |

**Final required state:**
`I-WIN OWNER-APPROVED — WINDOWS NATIVE POSTGRESQL 18.4 — DOCUMENTATION UPDATED — WP-03 NOT EXECUTED — EXECUTION NOT AUTHORIZED — PHASE 12 REMAINS OPEN.`

**Final Phase 12 verdict remains:** `BLOCKED — ADDITIONAL EVIDENCE REQUIRED — PHASE 12 REMAINS OPEN`

---

**End of R-139.**
