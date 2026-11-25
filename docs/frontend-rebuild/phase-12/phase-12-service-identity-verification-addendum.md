# Phase 12 — PostgreSQL Service Identity Verification Addendum

Status: **DOCUMENTATION ONLY — read-only OS inspection. No database access. No service, configuration, or data modification. The only change made by this round is the text of this addendum and its companion contract-map document.**
Baseline: branch `main`, HEAD `f91ed2f9e81db3937e3bcbb1b44e5e2c44e175cf`, November 2026.
Inspection timestamp: 2026-11-01 11:42:54 +02:00.
Companion docs: `phase-12-evidence-consistency-reconciliation.md` (§5, §6, C-02), `phase-12-stage-2-dry-run-report.md`, `phase-12-stage-2b-report.md`, `phase-12-stage-2-environment-plan.md`.

**Language note:** technical body in English (see doc A header).

**Evidence labels:** `Verified` = file/OS proof · `Owner-Confirmed` = stated by owner, not independently verified · `Inferred` = engineering deduction · `Unknown` = could not be verified now.

**Scope:** read-only operating-system metadata inspection only. No PostgreSQL connection, no SQL, no service modification, no secret access, no Git state change.

---

## 1. Executive Summary

- **Current service identity is established; current observed TCP listening state is only partially established (Mixed evidence — see per-row labels):**
  - **PG 17:** service `postgresql-x64-17` (Running, service PID 2084) → postmaster PID 5908 → data dir `C:\Program Files\PostgreSQL\17\data` → configured port 5433 → **observed LISTEN socket `[::1]:5433`** at the latest inspection. *(Verified: service metadata + process hierarchy + LISTEN socket.)* An earlier inspection in the same session observed `127.0.0.1:5433`; that socket is now **CLOSED** and is historical only, not current metadata.
  - **PG 18:** service `postgresql-x64-18` (Running, service PID 8000) → postmaster PID 14220 → data dir `C:\Program Files\PostgreSQL\18\data` → configured port 5432 → **no LISTEN socket observed on 5432** at the latest inspection (only `ESTABLISHED`/`FIN_WAIT_1` connection entries owned by PID 14220). *(Verified: service metadata + process hierarchy + absence of a LISTEN socket. NOT verified: that PG 18 is listening on 5432.)* A `Running` service state, a live postmaster PID, and a configured `port = 5432` do **not** by themselves constitute evidence of an observed TCP listener.
  - **Critical distinction:** service state, service PID, postmaster PID, configured port, configured `listen_addresses`, observed TCP LISTEN, and external reachability are seven independent facts (§6.0). None of them may be inferred from another.
- **Correction to the previous reconciliation report (§5, §6, C-02):** the earlier statement that "PID 14220 was associated with both PostgreSQL services on port 5432" was inaccurate. PID 14220 is the PG 18 postmaster only (parent 8000). PID 5908 is the PG 17 postmaster (parent 2084). The two services are distinct processes with distinct data directories and ports. The earlier conflation was an error in the reconciliation report.
- **Historical October 29/November 1 test identity:** The successful PG 17 test (port 5433, data dir `C:/Program Files/PostgreSQL/17/data`, PG 17.11) is consistent with the current PG 17 service metadata (same data dir, same port). However, current service metadata alone does not prove which service owned port 5433 at the time of the test. The historical identity is **Owner-Confirmed + consistent with current metadata, but not conclusively proven** by current OS metadata.
- **PG17 instance-level isolation:** NOT proven. The test databases (`cos_stage2_dryrun`, `cos_stage2_populated_dryrun`) are separate database names on the existing host PostgreSQL 17 service. They share the PG 17 service/process. Whether the PG 17 instance hosts operational data (other than the owner's statement) is Unknown.
- **PG18 compatibility status unchanged:** BLOCKED. No PG 18 migration was ever executed. No evidence change from this inspection.
- **Configured vs. observed listening addresses (correction):** both services' `postgresql.conf` specify `listen_addresses = '*'`. However, the observed LISTEN socket for PG 17 (PID 5908) is `[::1]:5433` (IPv6 loopback) in this inspection, and no LISTEN socket is currently observed for PG 18 (PID 14220) on port 5432 (only ESTABLISHED/FIN_WAIT_1 entries). A configured value of `'*'` does not automatically prove that the running process currently listens on every interface. Similarly, an observed loopback bind does not prove external inaccessibility (firewall, routing, and `pg_hba.conf` are separate factors, not inspected). The discrepancy between configured and observed is **unresolved (UNKNOWN)** without further evidence. See §6.0 and the notes in §6.

---

## 2. Inspection Timestamp

2026-11-01 11:42:54 +02:00 (EEST). All OS metadata below reflects the system state at this timestamp.

---

## 3. Tools and Read-Only Commands Used

| Tool / Command | Purpose | Read-only? |
|---|---|---|
| `Get-Date` | Inspection timestamp | Yes |
| `Get-Service -Name "*postgres*"` | Service names, states, start types | Yes |
| `Get-CimInstance Win32_Service -Filter "Name LIKE '%postgres%'"` | Service PID, executable path, data directory | Yes |
| `Get-CimInstance Win32_Process` (filtered to postgres processes) | PID, parent PID, name, executable path, start time | Yes |
| `Get-NetTCPConnection -State Listen` (filtered to ports 5430–5441) | Listening sockets and owning PIDs | Yes |
| `netstat -ano` (filtered to LISTENING + ports 543x) | Cross-check listening sockets | Yes |
| `Select-String` on `postgresql.conf` (PG 17 and PG 18 service data dirs) | Port and listen_addresses settings | Yes (metadata only; no secrets) |
| `Get-Content` on `server.log` files (temporary clusters) | Crash timestamps and error details | Yes (existing logs; not modified) |

**Not used (prohibited):** `psql`, `pgAdmin`, database drivers, SQL, `.env` files, credential files, JWT secrets, operational data directories (only `postgresql.conf` metadata read), service start/stop/reconfigure commands, cluster creation/deletion.

---

## 4. Current Windows Service Inventory

| Service | State | StartMode | Service PID | Executable path (from Win32_Service.PathName) | Data directory (from path) |
|---|---|---|---|---|---|
| `postgresql-x64-17` | Running | Configured for automatic startup; current service state observed as Running | 2084 | `"C:\Program Files\PostgreSQL\17\bin\pg_ctl.exe" runservice -N "postgresql-x64-17" -D "C:\Program Files\PostgreSQL\17\data" -w` | `C:\Program Files\PostgreSQL\17\data` |
| `postgresql-x64-18` | Running | Configured for automatic startup; current service state observed as Running | 8000 | `"C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe" runservice -N "postgresql-x64-18" -D "C:\Program Files\PostgreSQL\18\data" -w` | `C:\Program Files\PostgreSQL\18\data` |

**Notes:**
- The service PID (2084 for PG 17, 8000 for PG 18) is the `pg_ctl runservice` process. The actual PostgreSQL postmaster is a child process (see §5).
- The service PathName reveals the data directory via the `-D` flag. No secret or credential information is present in the service path.
- Both services are `Running`. The startup configuration is reported as automatic, but that is a configuration attribute, not an observation of boot behaviour; the only directly observed fact is the current `Running` state. The document therefore states: **configured for automatic startup; current service state observed as Running.**

---

## 5. PostgreSQL Process Hierarchy

| Service | Service PID (pg_ctl) | Postmaster PID | Parent PID | Postmaster start time | Worker/child PIDs |
|---|---|---|---|---|---|
| `postgresql-x64-17` | 2084 | 5908 | 2084 | 2026-11-01 10:19:43 | 4652, 7624, 21904, 16636, 21792, 692, 14532, 19984 (all parent 5908) |
| `postgresql-x64-18` | 8000 | 14220 | 8000 | 2026-11-01 09:39:40 | 14000, 14436, 14444, 14452, 14460, 14468, 14772, 14780, 14788, 5588, 6960, 14904 (all parent 14220) |

**Key correction:** PID 14220 is the **PostgreSQL 18 postmaster** (parent PID 8000 = `postgresql-x64-18` service). It is NOT associated with PostgreSQL 17. PID 5908 is the **PostgreSQL 17 postmaster** (parent PID 2084 = `postgresql-x64-17` service). The earlier reconciliation report (§5) incorrectly stated that "PID 14220 was associated with both PostgreSQL services on port 5432." This was an error. The two postmasters are distinct processes with distinct parents, data directories, and ports.

---

## 6. Actual TCP Listening-Port Ownership

### 6.0 Seven Independent Facts (do not infer one from another)

The evidence below is frequently conflated. These seven concepts are distinct and must be reported separately:

| # | Concept | What it proves | What it does NOT prove |
|---|---|---|---|
| 1 | **Service state** (`Get-Service` → `Running`) | The Windows service object is started and `pg_ctl runservice` is alive | That a postmaster exists, that any port is configured, or that anything listens |
| 2 | **Service PID** (e.g. 2084, 8000) | The `pg_ctl.exe runservice` wrapper process identity | Nothing about the postmaster PID or the listening socket |
| 3 | **Postmaster PID** (e.g. 5908, 14220) | The `postgres.exe` parent process that owns workers | Nothing about which port it has bound, unless paired with a LISTEN socket |
| 4 | **Configured port** (`postgresql.conf` → `port`) | The value the server is configured to use at its next start | That the running process actually bound that port now |
| 5 | **Configured `listen_addresses`** (`postgresql.conf` → `'*'`) | The interfaces the server is configured to bind at its next start | That the running process currently listens on all interfaces |
| 6 | **Observed TCP LISTEN** (`Get-NetTCPConnection -State Listen`) | The strongest local evidence that a socket is accepting connections, and which PID owns it | External reachability (firewall/routing/`pg_hba.conf` are separate) |
| 7 | **External reachability** | That a remote client can actually connect | Nothing derivable from any of the six facts above without network/firewall evidence |

**Rule applied in this document:** a listener is asserted **only** where concept 6 is directly observed. Service state (1), postmaster PID (3), configured port (4), and configured `listen_addresses` (5) are never used to infer concept 6. Concept 6 is never used to infer concept 7.

Only `LISTEN` state entries count as listening sockets.

| Port | Local address (observed, LISTEN state) | Owning PID | Owning process | Parent PID | Parent process | Service | Data directory | Evidence |
|---|---|---|---|---|---|---|---|---|
| 5433 | `[::1]` (IPv6 loopback) — current inspection; earlier inspection showed `127.0.0.1:5433` LISTENING | 5908 | postgres.exe | 2084 | pg_ctl (postgresql-x64-17) | `postgresql-x64-17` | `C:\Program Files\PostgreSQL\17\data` | `Get-NetTCPConnection -State Listen` + `Win32_Process` parent lookup |
| 5432 | *(no LISTEN socket observed in this inspection)* | 14220 (ESTABLISHED/FIN_WAIT_1 only) | postgres.exe | 8000 | pg_ctl (postgresql-x64-18) | `postgresql-x64-18` | `C:\Program Files\PostgreSQL\18\data` | `Get-NetTCPConnection -State Listen` returned no LISTEN entry; netstat shows ESTABLISHED/FIN_WAIT_1 on PID 14220 |
| 5439 | — | — | — | — | — | None | — | No LISTEN socket (temporary cluster stopped) |
| 5440 | — | — | — | — | — | None | — | No LISTEN socket (temporary cluster stopped) |

**Additional `postgresql.conf` metadata (read-only):**
- PG 17 (`C:\Program Files\PostgreSQL\17\data\postgresql.conf`): `listen_addresses = '*'`, `port = 5433`.
- PG 18 (`C:\Program Files\PostgreSQL\18\data\postgresql.conf`): `listen_addresses = '*'`, `port = 5432`.

**Notes:**
- Port 5433 is owned by the PG 17 postmaster (PID 5908). This matches the owner-confirmed test data directory (`C:\Program Files\PostgreSQL\17\data`) and port (5433).
- Port 5432 listener was not observed in this inspection (no LISTEN socket; only ESTABLISHED/FIN_WAIT_1 on PID 14220). The PG 18 service (PID 8000 → postmaster 14220, data dir `C:\Program Files\PostgreSQL\18\data`) is Running per service metadata, but no listening socket is currently observable on 5432. This discrepancy is unresolved (UNKNOWN) — see §6.0.
- Ports 5439 and 5440 have no LISTEN sockets (temporary clusters from the earlier provisioning attempt are stopped).
- Earlier `netstat` output showed `ESTABLISHED` and `FIN_WAIT_1` entries on 5432/5433. These are connection states, not listening sockets. The `LISTEN`-state entries (where observed) are the authoritative evidence; their absence is also evidence.
- An earlier inspection in this same session showed `127.0.0.1:5433` LISTENING; the current inspection shows `[::1]:5433` LISTENING with `127.0.0.1:5433` in CLOSED state. Socket state is not static (see §6.0).

---

## 7. Historical October 29 / November 1 Test Identity Assessment

### Test 1: Temporary PG 17 cluster (port 5439) — FAILED
- **Date:** 2026-10-29 (~14:05 EEST).
- **Environment:** `initdb` in `C:\Users\PC-01\AppData\Local\Temp\opencode\pg-stage2-cluster` (outside repo), port 5439, `listen_addresses = 127.0.0.1`.
- **Result:** Initialized and started; server process (PID 3052) terminated by exception `0xC0000142` on connection attempt. No connection succeeded.
- **Identity:** This was a separate `initdb` cluster in a temp directory — NOT the existing host PG 17 service. Verified by the distinct data directory and port.
- **Evidence:** Stage 2 report §9, server.log (preserved). Confidence: **Verified**.

### Test 2: Temporary PG 18 cluster (port 5440) — FAILED
- **Date:** 2026-10-29 (~14:10 EEST).
- **Environment:** `initdb` in `...\pg-stage2-cluster-18`, port 5440.
- **Result:** Initialized and started; autovacuum worker (PID 5064) terminated by exception `0xC0000142` ~2 min after startup. No connection succeeded.
- **Identity:** Separate `initdb` cluster — NOT the existing host PG 18 service.
- **Evidence:** Stage 2 report §9, server.log (preserved). Confidence: **Verified**.

### Test 3: Successful PG 17 migration run (port 5433)
- **Date:** 2026-11-01 (based on `_migrations.applied_at` timestamps: `2026-11-01 01:30:25` through `01:30:25.944`, with timezone offset `-07:00`).
- **Reported identity (owner-confirmed + SQL-verified):** PostgreSQL 17.11, data dir `C:/Program Files/PostgreSQL/17/data`, port 5433, listen `127.0.0.1,::1`, user `postgres` (superuser, CreateDB), DB `cos_stage2_dryrun` / `cos_stage2_populated_dryrun`.
- **Current OS metadata (2026-11-01 11:42):** PG 17 service (PID 2084) → postmaster PID 5908 → data dir `C:\Program Files\PostgreSQL\17\data` → configured port 5433 → **observed LISTEN socket `[::1]:5433`** (IPv6 loopback). An earlier inspection in this session observed `127.0.0.1:5433`; that entry is historical and is now **CLOSED**. The observed socket is loopback-only; this does **not** establish external reachability (see §6.0, concept 7). This matches the reported test identity on data directory and port, but the match is correlation only.
- **Can the historical identity be established conclusively?** **No.** Current Windows metadata alone does not prove which service owned port 5433 on the test date. The service may have been restarted, the port configuration may have changed, or a different process may have owned the port. The owner-confirmed data directory and port are **consistent with** the current PG 17 service metadata, but this is correlation, not proof of historical state. The `_migrations` timestamps (2026-11-01) are consistent with the test occurring on that date, but do not identify the service.
- **Confidence:** Owner-Confirmed + consistent with current metadata, but **not conclusively proven** by current OS metadata alone. Historical claims require historical evidence (which is not available — no snapshot of service state was captured at test time).

### Additional observation
- The `_migrations.applied_at` timestamps use a `-07:00` offset (PDT), while the OS timezone is EEST (UTC+2/+3). The original recorded timestamp is `2026-11-01 01:30:25 -07:00`. Converting to `+02:00` gives exactly `2026-11-01 10:30:25 +02:00` (not a range). The PG 17 service started at 10:19:43 EEST. The migration timestamps (10:30:25 +02:00) are consistent with the service start time (migrations ran ~10–15 min after service start). This is a minor timezone discrepancy in stored timestamps but does not affect the reconciliation. No action required. **Limitation:** the source does not establish the actual database/session timezone or host timezone at execution time; the `-07:00` offset is recorded in the `applied_at` value but the reason for that offset is not documented. The conversion above is arithmetic only and does not prove which timezone the database session used.

---

## 8. Corrections to the Previous Reconciliation Report

### Correction 1: PID 14220 association (§5 of `phase-12-evidence-consistency-reconciliation.md`)

**Previous (incorrect) statement:** "PID 14220 was associated with both PostgreSQL services on port 5432."

**Corrected statement:** PID 14220 is the **PostgreSQL 18 postmaster** (parent PID 8000 = `postgresql-x64-18` service, data dir `C:\Program Files\PostgreSQL\18\data`), configured for port 5432. **No LISTEN socket was observed for PID 14220 on port 5432 at the latest inspection** (only `ESTABLISHED`/`FIN_WAIT_1` connection entries). PID 5908 is the **PostgreSQL 17 postmaster** (parent PID 2084 = `postgresql-x64-17` service, data dir `C:\Program Files\PostgreSQL\17\data`), observed LISTENING on `[::1]:5433`. The two are distinct processes with distinct parents, data directories, and configured ports. The earlier conflation was an error, and the earlier claim that PID 14220 was listening on 5432 was also unsupported by the observed LISTEN state.

**Impact:** The port-ownership table in §5 of the reconciliation report must be corrected. Port 5432 → PG 18 postmaster (PID 14220) is the **configured** owner, but **no LISTEN socket is currently observed**. Port 5433 → PG 17 postmaster (PID 5908) is observed LISTENING on `[::1]:5433`. No change to the conclusion that the operational PG 18 service (postmaster PID 14220) was not touched.

### Correction 2: PG17 isolation assessment (§6)

**Previous statement:** "Environment isolation: Partially established — database-level isolation (separate DB name) is evident; instance-level isolation is NOT established."

**Confirmed and refined:** The PG 17 test databases (`cos_stage2_dryrun`, `cos_stage2_populated_dryrun`) are separate database names on the existing host PostgreSQL 17 service (port 5433, data dir `C:\Program Files\PostgreSQL\17\data`). This is **database-level isolation** (separate DB name), not instance-level isolation (separate process/data dir). The PG 17 service is the same service that hosts whatever else is on that instance. Whether the PG 17 instance hosts operational data (other than the owner's statement that PG 18 is operational) is Unknown.

**No change to the conclusion:** instance-level isolation is NOT proven. The canonical statement "Migration execution reported successful; full environment-isolation evidence remains unresolved" stands.

### Correction 3: C-02 contradiction register entry

**Previous resolution (C-02):** "Resolved: different environments. The successful test (5433) used the existing host PG 17 service with separate DB names... 'isolated' = database-level (separate DB name), not instance-level."

**Refined resolution:** Confirmed. Additionally, the earlier netstat output (showing PID 14220 on both 5432 and 5433) was misleading — PID 14220 is exclusively the PG 18 postmaster, configured for port 5432 (no LISTEN socket observed there). The 5433 listener is PID 5908 (PG 17). The conflation of PID 14220 with both ports was an error in the reconciliation report's port-ownership table. The C-02 resolution stands but with this correction noted.

---

## 9. Remaining Unknowns

1. **Historical service identity on 2026-11-01 (test date):** which service owned port 5433 at the time of the successful migration test cannot be proven from current metadata. Consistent with (but not proof of) the current PG 17 service.
2. **Whether the PG 17 instance hosts operational data:** Unknown. The owner states PG 18 is operational; whether PG 17 also hosts operational data is not verified.
3. **PG 17 service role:** Unknown whether it is production-adjacent or purely development. The backup script `backup-db-local.ps1` references `cos_db` on `127.0.0.1:5432` (PG 18, per service metadata), suggesting PG 18 hosts operational data. PG 17 on 5433 may be development-only, but this is Inferred, not Verified.
4. **Effective `search_path` in test session:** not verified (may affect schema resolution).
5. **Extension file availability on a given server:** Unknown (relevant for non-superuser installation).
6. **Whether `sessions.json` JsonStore is invoked at runtime:** Unknown.
7. **Production facts (14 items):** all Unknown (no authorized production access).
8. **PG 18 compatibility:** unverified (no isolated PG 18 environment).
9. **Environment-level DLL failure root cause:** likely but unconfirmed (0xC0000142).

---

## 10. Final Authorization and Safety Confirmation

- **No database connection was made** during this inspection (read-only OS metadata only).
- **No SQL was executed.**
- **No PostgreSQL service was modified, stopped, started, or reconfigured.**
- **No temporary cluster was created, modified, or deleted.**
- **No secret, credential, or `.env` value was read or printed.**
- **No application code, migration, schema, configuration, or dependency was changed.**
- **No Git state was modified** (no staging, commit, reset, clean, or branch change).
- **"No modifications" means no system, database, service, or code change.** It explicitly excludes the writing of this documentation: the only files changed in this round are this addendum and `phase-12-prototype-live-api-contract-map.md`.
- **Phase 12 remains OPEN.**
- **Stage 3, Phase 13, D5 execution, D6 execution, D7 implementation, and all production database access remain NOT AUTHORIZED.**

**Do not start Stage 3, Phase 13, D6 production data migration, or D7 adapter implementation.**

---

## Required Final Conclusion

**Which current service owns port 5432?**
The **configured** owner is the PostgreSQL 18 service (`postgresql-x64-18`, service PID 8000, postmaster PID 14220, data dir `C:\Program Files\PostgreSQL\18\data`, `port = 5432`). However, **no LISTEN socket was observed on port 5432** at the latest inspection — only `ESTABLISHED`/`FIN_WAIT_1` connection entries owned by PID 14220. The service is `Running` and the postmaster exists, but current observable TCP listening state on 5432 is **not established**. Do not state that PG 18 is currently LISTENING on 5432.

**Which current service owns port 5433?**
Port 5433 is owned by the **PostgreSQL 17 service** (`postgresql-x64-17`, service PID 2084, postmaster PID 5908, data dir `C:\Program Files\PostgreSQL\17\data`). The **latest observed LISTEN socket is `[::1]:5433`** (IPv6 loopback). An earlier inspection in the same session observed `127.0.0.1:5433`; that entry is historical and currently **CLOSED**. Observed loopback binding does **not** establish external reachability.

**Is there a listening PostgreSQL process on either port?**
**Only on 5433.** PID 5908 (PG 17) is observed LISTENING on `[::1]:5433`. **No listening socket is currently observed on 5432** for PID 14220 (PG 18); a `Running` service state and a configured port do not substitute for a LISTEN observation (see §6.0). Ports 5439 and 5440 have no LISTEN sockets (temporary clusters stopped).


**Can the October 29 / November 1 PG17 test's service identity be established?**
**No — not conclusively.** Current Windows metadata shows the PG 17 service on port 5433 with data dir `C:\Program Files\PostgreSQL\17\data`, which is consistent with the reported test identity (Owner-Confirmed + consistent with current metadata). But current metadata alone does not prove which service owned port 5433 on the test date. The service may have been restarted, or the configuration may have changed. Historical claims require historical evidence, which is not available. **Classification: Owner-Confirmed + consistent with current metadata, but not conclusively proven.**

**Is PG17 instance-level isolation proven?**
**No.** The test databases (`cos_stage2_dryrun`, `cos_stage2_populated_dryrun`) are separate database names on the existing host PostgreSQL 17 service. They share the PG 17 service/process. Whether the PG 17 instance hosts operational data is Unknown. Database-level isolation (separate DB name) is evident; instance-level isolation is not established.

**Does any evidence change the PG18 compatibility status?**
**No.** No PG 18 migration was ever executed. The PG 18 service identity is now clearly established (configured port 5432, data dir `PostgreSQL\18\data`, PID 14220, parent 8000; no LISTEN socket observed on 5432), but this does not change the compatibility status. PG 18 compatibility remains **untested** — no isolated PG 18 environment, no migration execution. The 0xC0000142 failure on the temporary clusters is unchanged. Static observation (standard SQL + contrib extensions) remains the only evidence.

---

**STOP. No implementation. Owner review required.** Phase 12 remains OPEN. No owner authorization boundary changed.