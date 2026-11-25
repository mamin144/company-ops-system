# Phase 12 — R-140: WP-03 Stage A/B Execution Report (I-WIN — Windows Native PostgreSQL 18.4)

**Status:** `DOCUMENTATION ONLY — EXECUTION REPORT — STAGES A/B ONLY — PHASE 12 REMAINS OPEN`

**Repository:** `D:\Default Project\company-ops-system`
**Branch:** `main`
**HEAD:** `f91ed2f9e81db3937e3bcbb1b44e5e2c44e175cf`
**Remote:** `https://github.com/mamin144/company-ops-system.git`
**Execution/report date:** `2026-11-09`

---

## 1. Owner authorization scope and date

| Field | Value |
|---|---|
| Authorization | Separate **WP-03 execution authorization** (satisfying R-138 §9.6) |
| Given by | Owner assignment titled "COS Phase 12 — WP-03 Execution Authorization and Stage A/B Execution — I-WIN — Existing Windows Native PostgreSQL 18.4" |
| Date | `2026-11-09` |
| Scope | **Stage A** (read-only environment re-verification and network/firewall assessment), **Stage B** (isolation assessment), **Stage D** (evidence capture and this report) — **only** |
| Explicitly out of scope | **Stage C is NOT AUTHORIZED YET** (requires Stage-B acceptance by owner); WP-04; WP-05; restore; Stage 3; Phase 13 |

The second Stage-C gate — owner acceptance of the Stage B isolation assessment — is **not** satisfied by this report. It is the decision this report returns to the owner.

**Precedence:** R-138 §9 dependency/authorization model and R-139's I-WIN decision record remain controlling. This report supersedes nothing.

**Labels used:** `Verified` (command outputs recorded below) · `Owner-Confirmed` (R-139-established facts restated) · `Not Verified` (attempted, blocked, or out of scope) · `Not Applicable` · `Conflicting Evidence`.

---

## 2. Host identity / execution location

| Item | Evidence | Classification |
|---|---|---|
| Execution host | `PC-01`; `Microsoft Windows 11 Pro` (Win32_OperatingSystem) | `Verified` |
| Services on this host | `postgresql-x64-18` and `postgresql-x64-17` both discovered locally via Win32_Service | `Verified` |
| Conclusion | Stage A executed on the intended existing Windows host containing both PostgreSQL services. No substituted machine; no inference from another host | — |

---

## 3. Stage A command inventory and evidence outputs

All commands below were executed read-only. No service, configuration, firewall, network, database, or application change was made by any command. Password prompts/credentials: none used; nothing echoed, copied, or recorded.

| # | Command (read-only) | Purpose | Result classification |
|---|---|---|---|
| A1-1 | `Get-CimInstance Win32_Service -Filter "Name='postgresql-x64-18' OR Name='postgresql-x64-17'"` | Service state/mode/executable | `Verified` |
| A1-2 | `Get-CimInstance Win32_Process` forthewrapper PIDs 6460 (PG18) and 6764 (PG17), then child query for `postgres.exe` | Process tree | `Verified` (paths not retrievable — §4) |
| A2-1 | `"C:\Program Files\PostgreSQL\18\bin\postgres.exe" --version` | Server binary version | `Verified` |
| A2-2 | `pg_dump.exe --version`; `pg_restore.exe --version` | Client tool versions | `Verified` |
| A2-3 | `pg_isready.exe -h 127.0.0.1 -p 5432` (run 3×) | Readiness | `Verified` |
| A2-4 | `netstat -ano` / `Get-NetTCPConnection -LocalPort 5432, 5433`; `-OwningProcess 9168` | Listener ownership/state | `Conflicting Evidence` (§5) |
| A2-5 | `Test-NetConnection 127.0.0.1 -Port 5432` | Loopback TCP connect (allowed per authorization) | `Verified` |
| A3-1 | `psql.exe -w -h 127.0.0.1 -p 5432 -U postgres -d postgres -c "SELECT current_user, current_database();"` | Catalog access attempt, never-prompts mode | **Failed by design-gate** — `fe_sendauth: no password supplied`, exit 2. No credential was available, and credentials/`.env`/secret files may not be read. Catalog queries therefore not executed (§7) |
| A3-2 | Filtered read of `C:\Program Files\PostgreSQL\18\data\postgresql.conf`; `postgresql.auto.conf`; `pg_hba.conf` | Non-secret configuration file inspection | `Verified` (§7). Files readable; read access permitted (read-only). No secret-like values present in the lines read and reproduced |
| A4-1 | `Get-NetFirewallProfile` | Profile state / default inbound actions | `Verified` (§6) |
| A4-2 | `Get-NetFirewallRule -Direction Inbound -Enabled True` + `Get-NetFirewallApplicationFilter` join on program `*postgres*` | PostgreSQL program-scoped rules | `Verified` (§6) |
| A4-3 | `Get-NetFirewallPortFilter` for LocalPort 5432 | Port-scoped rules | **Access denied without elevation** — `Not Verified` (access limitation) |
| A4-4 | Registry enumeration `HKLM:\...\FirewallPolicy\FirewallRules` filtering values containing `5432` or `postgres` | All rules (enabled and disabled), independent of elevation-blocked cmdlet | `Verified` (§6) |
| A4-5 | Broad-allow scan: enabled inbound TCP **Any-port** allow rules + address filters | Indirect exposure risk | `Verified` (§6) |
| A4-6 | `HKLM:\SOFTWARE\Policies\Microsoft\WindowsFirewall\<profile>` GPO keys | Policy overrides | `Verified` (§6) |

One command in the A4-2 series contained a typo (`-AssociatedAppFilter?`); the cmdlet rejected the unknown parameter and performed no action. It was rerun correctly. Recorded for transcript completeness.

---

## 4. PostgreSQL 18 and 17 service/version/process findings

### 4.1 Services (`Win32_Service`)

| Service | State | StartMode | Service PID | PathName | Runs as |
|---|---|---|---|---|---|
| `postgresql-x64-18` | **Running** | **Auto** | 6460 | `"C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe" runservice -N "postgresql-x64-18" -D "C:\Program Files\PostgreSQL\18\data" -w` | `NT AUTHORITY\NetworkService` |
| `postgresql-x64-17` | **Running** | **Auto** | 6764 | `"C:\Program Files\PostgreSQL\17\bin\pg_ctl.exe" runservice -N "postgresql-x64-17" -D "C:\Program Files\PostgreSQL\17\data" -w` | `NT AUTHORITY\NetworkService` |

Data directories confirmed from service start lines: `C:\Program Files\PostgreSQL\18\data` and `C:\Program Files\PostgreSQL\17\data`. Both match R-139 §2.1/§2.2 (`Owner-Confirmed` > now locally re-verified for PG18).

### 4.2 Process tree

| PID | Name | Parent PID | Parent identity | Notes |
|---|---|---|---|---|
| 6460 | `pg_ctl.exe` | 956 | `services.exe` (Service Control Manager) | PG18 service wrapper |
| 6764 | `pg_ctl.exe` | 956 | `services.exe` | PG17 service wrapper |
| 9168 | `postgres.exe` | 6460 | PG18 wrapper | PG18 postmaster, created 2026-11-09 10:01:19 (local) |
| 6172 | `postgres.exe` | 6764 | PG17 wrapper | PG17 postmaster, created 2026-11-09 10:01:19 (local) |

Both postmasters are first-generation children of their `pg_ctl` service wrappers under SCM — a normal `pg_ctl runservice` architecture. `ExecutablePath` / `CommandLine` were returned empty for these NetworkService-owned processes (not retrievable without elevation) — recorded as an access limitation; executable paths are instead evidenced by the service `PathName` (§4.1) and by version output below.

### 4.3 Versions

| Item | Value | Classification |
|---|---|---|
| PG18 server binary `postgres.exe --version` | `postgres (PostgreSQL) 18.4` | `Verified` |
| PG18 `pg_dump --version` | `pg_dump (PostgreSQL) 18.4` | `Verified` |
| PG18 `pg_restore --version` | `pg_restore (PostgreSQL) 18.4` | `Verified` |
| R-136 Section C reader compatibility implication | Version-consistent 18.4 reader/target **exists on this host** (supports a future WP-05 consumer-repair decision; nothing executed) | Derived — `Verified` (structure) |

PostgreSQL 17 was not probed beyond service/process/listener observation, per the untouched requirement.

---

## 5. Port/listener/readiness consistency

| Item | Observation | Classification |
|---|---|---|
| `pg_isready 127.0.0.1:5432` (3 runs) | `accepting connections` every run | `Verified` |
| TCP connect `Test-NetConnection 127.0.0.1:5432` | `TcpTestSucceeded = True` | `Verified` |
| Listener owner | PID 9168 owns sockets for 5432 — identical to the PG18 postmaster PID (process tree, §4.2) | `Verified` |
| Listener address binding | Sockets held by 9168 on `0.0.0.0:5432` (IPv4) and `::5432` (IPv6) — **wildcard binding on all interfaces**, consistent with `listen_addresses='*'` (§7) | `Verified` (ownership + address set) |
| Listener runtime state display | `netstat -ano` and `Get-NetTCPConnection` simultaneously showed the 5432 sockets' State rendered inconsistently across runs (blank / `FinWait1`), while readiness and a successful TCP connect were reproduced every time. State display of owned wildcard sockets is anomalous in this environment | **`Conflicting Evidence`** — snapshot state fields not trustworthy; functional listening is proven by 3× `pg_isready` + 1× successful TCP connect + stable PID ownership |
| PG17 listener (informational only) | PID 6172 listens on `::1:5433` (IPv6 loopback; IPv4 `127.0.0.1:5433` observed alternating between `Closed`/`Listen` across snapshots) — PG17 was not otherwise touched | `Verified` (observation-only) |

**Conclusion:** listener evidence **agrees** with the readiness result: PG18 is functionally listening on 5432, owned by the PG18 postmaster, bound wildcard on two stacks. The inconsistent *state-field* rendering is a display/snapshot artifact and is explicitly not converted into any safety claim.

---

## 6. Relevant Windows Firewall findings

| Item | Observation | Classification |
|---|---|---|
| Profiles | Domain, Private, Public — **all Enabled**; `DefaultInboundAction` and `DefaultOutboundAction` on all three: **`NotConfigured`** | `Verified` |
| GPO overrides | No policy keys exist under `HKLM:\SOFTWARE\Policies\Microsoft\WindowsFirewall\{DomainProfile,PrivateProfile,PublicProfile}` — no administrative override of profile defaults was found | `Verified` |
| Effective inbound default | `NotConfigured` means profile defaults inherit the OS default. OS default inbound posture for enabled profiles is implicitly deny-unless-allowed (exceptions model), but the precise effective value could not be confirmed without elevation | `Not Verified` (access limitation) — **never converted into an assumed safe default** |
| PostgreSQL program-scoped inbound rules | Full `Get-NetFirewallApplicationFilter` enumeration joined to enabled inbound rules: **zero** rules with a program filter matching `postgres` | `Verified` |
| Port 5432 inbound rules | Unauthorized available: `Get-NetFirewallPortFilter` enumeration was **access-denied without elevation** | `Not Verified` (access limitation) |
| Registry-based complement to the port query | All stored firewall rule values (enabled and disabled) under `FirewallPolicy\FirewallRules` scanned for `5432` or `postgres`: **0 matches of any kind** | `Verified` |
| Broad any-port inbound TCP allow rules (indirect exposure risk) | 27 enabled inbound `Action=Allow` TCP **Any-port** rules exist with `RemoteAddress=Any` — e.g. Remote Assistance, Connected Devices Platform, Hyper-V WMI, Node.js JavaScript Runtime, adb.exe, dartvm.exe, OpenJDK, Microsoft Teams/Copilot, AnyDesk, Snappy Driver Installer, Tencent app components. **All are program-scoped**; none matches a PostgreSQL binary. A program-unscoped, port-unrestricted allow rule was **not** found by this scan | `Verified` (within scan limits of the elevated-denied port-filter API) |
| External reachability | **Not tested** — external-vantage testing not authorized/available this session | `NOT VERIFIED — external vantage not authorized/available` |

**Interpretation limits (binding):** the evidence shows no firewall *rule* that explicitly admits inbound connections to PostgreSQL. It does **not** prove effective external unreachability, because (a) the effective default inbound action was not confirmable without elevation, (b) the port-filter API check is incomplete (registry complement covers rule database content but not rule activation ordering or third-party packet filters), and (c) no external-vantage test occurred. External reachability remains `NOT VERIFIED — external vantage not authorized/available`.

---

## 7. Non-secret PostgreSQL configuration and HBA findings

Catalog access was unavailable (§3 A3-1 — no credentials available within the safety rules). Substituted evidence: direct, filtered reads of the non-secret configuration files in the confirmed data directory. These are read-only inspections; the lines reproduced contain no secrets (HBA files never contain passwords; the conf lines shown are connection/display settings only).

### 7.1 `postgresql.conf` (data dir `C:\Program Files\PostgreSQL\18\data`)

| Item | Value | Classification |
|---|---|---|
| `listen_addresses` | `'*'` (line 60 — uncommented) | `Verified` (file read) |
| `port` | `5432` (line 64) | `Verified` (file read) |
| SSL line scan | No uncommented `ssl = ...` line was found by the targeted scan | `Not Verified` via catalog (`ssl` GUC state unconfirmed) — file scan found no active `ssl=` line (i.e., not enabled in the main conf file; an include override was not found — see auto.conf) |
| `postgresql.auto.conf` | Present, contains **2 lines, both comments only** ("Do not edit this file manually! / It will be overwritten by ALTER SYSTEM") — **no settings, no overrides** | `Verified` |
| `config_file` / `hba_file` paths | Not confirmed via catalog; inferred with high confidence: service start line passes only `-D <datadir> -w`, so the default `postgresql.conf` and `pg_hba.conf` inside the data directory apply, matching the files actually read | Inferred — `Verified` (structure); catalog confirmation NOT VERIFIED |
| `server_version` | Not queried (catalog); **equivalent verified** via `postgres --version` = 18.4 (§4.3) | `Verified` (binary evidence) |

### 7.2 `pg_hba.conf` — complete effective rule set (all non-comment lines)

```
local   all             all             scram-sha-256
host    all             all             127.0.0.1/32            scram-sha-256
host    all             all             ::1/128                 scram-sha-256
local   replication     all             scram-sha-256
host    replication     all             127.0.0.1/32            scram-sha-256
host    replication     all             ::1/128                 scram-sha-256
```

| Item | Observation | Classification |
|---|---|---|
| Authentication method | `scram-sha-256` throughout | `Verified` |
| Address scope of TCP rules | **Loopback-only** (`127.0.0.1/32`, `::1/128`) — no external subnet rule exists | `Verified` |
| Database/user applicability | `all` → `all`: HBA rules are **not** database-restricted — they accept, from loopback, connections by any user to **any database on the instance, including `cos_db` and `cos_authz_unit`** (subject to CONNECT privilege — see §8/§9.2) | `Verified` (rule reading) |
| No parse errors observed | Rule lines are well-formed | `Verified` (file reading) |
| `pg_hba_file_rules` catalog view | Not queried (no credentials) — file-read evidence substitutes for rule content; the catalog's effective-state cross-check remains NOT VERIFIED | `Not Verified` (catalog cross-check) |

---

## 8. Database-level ACL / PUBLIC CONNECT assessment

**Status: `NOT VERIFIED` — catalog queries could not be executed** (no credentials available within the session's safety rules; the connection attempt in never-prompt mode failed by design-gate, §3 A3-1).

The concern recorded by the assignment stands anyway as a **design certainty of the default PostgreSQL security model** (classification: `Verified` from PostgreSQL's documented default behavior, not from this instance's catalogs):

- In a stock installation, **`PUBLIC` holds the database CONNECT privilege** on regular databases, and every login role is implicitly a member of `PUBLIC`.
- The HBA rules grant (from loopback) `all` databases to `all` users with `scram-sha-256`.

Therefore, unless existing database ACLs state otherwise (unverified — catalogs unread), **a future validation login role would be able to CONNECT to `cos_db` and `cos_authz_unit` from loopback without any change to those databases.** Closing that gap requires one of:

1. `REVOKE CONNECT ON DATABASE <existing-db> FROM PUBLIC;` on `cos_db`/`cos_authz_unit` — **prohibited in this session** (touches existing security controls/ACLs), or
2. a per-database HBA restriction — **prohibited in this session** (no `pg_hba.conf` changes), or
3. an owner decision explicitly accepting the boundary as designed.

No database, role, grant, or password was touched in resolving this item. The proposed validation role was not logged into (it does not exist; per assignment, no attempt was made).

Roles capability flags from `pg_roles` (existence of roles, superusers, replication rights): `NOT VERIFIED` — same block.

---

## 9. Stage B — isolation assessment

### 9.1 Exact original Condition 1 requirement (R-136 §D.1, row 1 — quoted verbatim)

The status-table row text:

> | **1** | Isolated PostgreSQL 18 environment provisioned (VM, separate host, or approved container); isolation evidence reviewed; no `0xC0000142` | **`Not met`** | `phase-12-stage-2b-report.md`: local provisioning crashed `0xC0000142`; clusters stopped. No VM/host/container exists | A working, isolated PG 18 instance and evidence of isolation | Provision **and** review isolation evidence; a local retry that crashes again does not satisfy it | Required — `D-I` | Root dependency for 2, 9, 10 (test), 14 |

Supporting original definitions in the same document:

- §D.4 flip criterion, Condition 1: *"A working isolated PG 18 environment"* — blocked by *"Environment/host availability (`D-I`)"*.
- §B (PB-07): *"Local PG 17/18 provisioning crashed; no VM/separate host/approved container exists"*; resolution path: *"Provision an isolated PG 18 environment (VM, separate host, or approved container)"*.
- §G row WP-03 (the package itself): scope *"Provision, snapshot, prove isolation, record evidence, tear down"*; safe deliverable *"Isolation evidence and a reproducible provisioning record"*; prohibition §G.1: *"Must not reuse the failed local provisioning approach without diagnosing `0xC0000142`"*.
- §F.2 dependency: `D-I` → Condition 1 → Condition 2 (dry run); WP-04 prerequisite table cites *"WP-03, condition 1"*; and line *"One authorized restore into a temporary PG 18 database"* as the flip path for conditions 10/11 elements.

### 9.2 Does the original wording allow an existing instance on the same Windows host?

Analysis against the original text, without relaxing it:

| Original element | Reading | Same-instance application |
|---|---|---|
| "Isolated PostgreSQL 18 environment provisioned" | The substantive acceptance criterion in the row's own *Missing evidence* column is **"a working, isolated PG 18 instance and evidence of isolation"** — the parenthetical "(VM, separate host, or approved container)" is the then-considered option enumeration | **Does not categorically require a separate machine/container.** But the R-136 decision option space (§E.9) itself contained **I4 — "Existing managed instance in an isolated database"**, explicitly flagged: *"real server, but shared-instance blast radius."* So the original record treats same-instance/isolated-database as a **real option with an accepted-risk caveat**, not as a forbidden layout |
| "isolation evidence reviewed" | Positive requirement: isolation must be *demonstrated with evidence*, not assumed from settings | **Not satisfied today** — the WB-03 proposal's §8 checklist items 1.2–1.8 are largely `NOT VERIFIED` (§9.3–§9.9 below) |
| "no `0xC0000142`" | Non-recurrence of the Stage-2B local-provisioning crash | **Satisfied structurally** — under I-WIN there is no provisioning at all; no `initdb`/cluster creation occurs (WP-03 proposal §3.4); no container is involved |
| WP-03 package verbs "Provision, snapshot, prove isolation, record evidence, **tear down**" | Snapshot-before / teardown-after discipline applies to disposable provisioned environments; for the I4-style arrangement lifecycle becomes create-validate-retain-or-drop — still requiring a validated recovery story before destructive-capable steps | Requires the recovery/lifecycle gap (§9.8) to be closed by owner decision; **cannot be closed inside WP-03** |

**B1 verdict:** the original acceptance criteria **permit** a same-host existing-instance arrangement only as the I4-style option — i.e., only if (a) the owner explicitly accepts the shared-instance blast radius R-136 itself flagged, and (b) reviewed isolation evidence exists for the boundaries that a separate database *can* provide. It cannot be satisfied today, and it must not be treated as satisfied by I-WIN's direction approval. If the owner declines to accept the blast radius, the conditions-as-written cannot be met by I-WIN and would require the separate-boundary alternatives (rejected/not approved — §1.2 of R-139) or a new owner decision.

### 9.3 Boundary 1 — Database boundary

- Validation database `cos_phase12_validation`: **not created** (Stage C deferred) → no dedicated boundary exists yet. `NOT APPLICABLE YET` / proposal-only.
- Existing databases: untouched; zero queries against `cos_db`/`cos_authz_unit` executed ✓.
- Is **separate database ownership sufficient** for the original Condition 1? Database-level separation provides **logical data isolation only**. It does not provide process/memory/config/log/file-system isolation. R-136's own I4 analysis names the residual: *shared-instance blast radius*. Sufficient **only if** the owner accepts that residual in a recorded decision.

### 9.4 Boundary 2 — Privilege boundary

| Question | Finding |
|---|---|
| `postgres` superuser for app/test execution? | Prohibited by design (WP-03 proposal §5.1; R-139 §3). Not used in this session; would never be used |
| Proposed validator role existence | Does not exist (Stage C deferred). No login attempted ✓ |
| PUBLIC CONNECT on existing databases | Catalog-`NOT VERIFIED` (§8) — but as a documented PostgreSQL default, PUBLIC CONNECT is expected present, and HBA admits `all→all` from loopback |
| Could the validator role connect to `cos_db`/`cos_authz_unit` without ACL modification? | **Yes, expected to be possible as-installed** (default PUBLIC CONNECT + `all→all` HBA). Preventing it requires an ACL revoke or per-database HBA — both **prohibited without a new owner decision** |
| Can least privilege be demonstrated without weakening/altering existing controls? | **Not fully.** Role-only scoping demonstrates *intended* discipline but not *enforced* isolation while the existing databases remain reachable by that role from loopback |

### 9.5 Boundary 3 — Network boundary

| Question | Finding |
|---|---|
| `listen_addresses='*'` | `Verified` (conf file read + wildcard-bound sockets owned by PID 9168) — the instance **requests listening on all interfaces**; this is distinct from what mortals may reach |
| `pg_hba.conf` | Loopback-only TCP rules, `all` databases/users, `scram-sha-256`, no parse errors (§7.2). External addresses are refused at the authentication layer **if they can reach the socket** |
| Firewall | No PostgreSQL-specific or 5432-specific allow rule exists in any stored rule (registry scan `Verified`); 27 broad any-port allows are all program-scoped, none PostgreSQL; effective default inbound action **not confirmable without elevation** (§6) |
| Listening interface vs successful authenticated external access | **Distinguished and evidenced separately:** the listener is demonstrably wildcard (listening interface), while successful *authenticated* external access is **`NOT VERIFIED`** — no external-vantage probe was authorized, so reachability stays unknown. No "loopback-only isolation" claim is made: the *listener* is not loopback-only, and effective external exposure is undetermined |
| Outcome | Network boundary evidence is incomplete; cannot support an isolation claim by itself |

### 9.6 Boundary 4 — Instance/host blast radius

- The same `postgresql-x64-18` service, same postmaster (PID 9168), same host serve `cos_db`, `cos_authz_unit`, `postgres`, and the future validation database.
- **What is isolated by a separate database:** data (separate catalog/storage extent), role space, per-database ACLs, per-database connection pool — within the instance's security model, with the PUBLIC-CONNECT caveat of §9.4.
- **What is not isolated:** the postmaster process's availability and memory; the shared `postgres` superuser authority; the data-directory file system; server logs and `pg_log`/`pg_wal` rotation; instance configuration; and **host-level Windows service lifecycle** (a service failure/crash/corruption recovery takes down the operational databases at the same moment as the validation database). `postgresql-x64-17` is a separate service/process (PID 6172) on port 5433 and is not incidentally coupled.
- Superuser access impact: anyone with the `postgres` credential — or any OS account with administrative file access to `C:\Program Files\PostgreSQL\18\data` (NetworkService + Administrators file ACLs; file-level role mapping not separately verified) — reaches **every** database on the instance.
- Therefore blast-radius isolation **cannot** exist in the I-WIN arrangement; residual risk must be owner-accepted.

### 9.7 Boundary 5 — Artifact boundary (proposal, nothing created)

Proposed separate artifact location (proposal only — **not created**): a repository-external, operational-data-free directory reserved for Phase-12 WP-03 evidence (e.g., `%LOCALAPPDATA%\COS\phase-12\wp-03-evidence\` or an owner-designated path), holding only transcripts, read-only command outputs, and — in future authorized stages — validation-database artifacts. Separation requirements already fixed by WP-03 proposal §5.1 (no production credentials; no operational schemas). `NOT CREATED — PROPOSAL ONLY`.

### 9.8 Boundary 6 — Recovery and lifecycle

- No validated backup/restore story for the existing instance exists: `NOT VERIFIED` (and outside WP-03's scope to fix — producing it sits behind WP-05/D-A/condition-10 sub-elements).
- Destructive-capable future operations that would require a **separate recovery gate** before authorization: `DROP DATABASE <validation_db>`, any `CREATE DATABASE` (disk-space/token concerns), `pg_restore`/`pg_dump` runs, `REINDEX`/large maintenance operations, and any ACL/HBA/config adjustment on the instance.
- Lifecycle controls (creation → use → retention → drop or retain) require the owner-accepted design (WP-03 proposal §5.1 lifecycle row; §8 checklist items 1.9/1.12). Gap stands.

### 9.9 Evidence gaps inventory (all `NOT VERIFIED`)

| # | Unresolved gap | Why it remains unsettled |
|---|---|---|
| 1 | Effective external network reachability of 5432 | External-vantage test not authorized; firewall default action not confirmable without elevation |
| 2 | Effective default inbound firewall action per profile | `NotConfigured` + no GPO override found; precise effective value needs elevated inspection |
| 3 | `pg_database` ACLs / PUBLIC CONNECT on `cos_db`, `cos_authz_unit`, `postgres` | Catalog unreachable without credentials (safety rules) |
| 4 | Existing role inventory and capability flags (`pg_roles`) | Same as #3 |
| 5 | `ssl` GUC state / any other catalog-resident settings | Same as #3 (file scan found no active `ssl=` line; catalog cross-check absent) |
| 6 | Catalog cross-check of `pg_hba_file_rules` vs file | Same as #3 (file evidence substitutes for content only) |
| 7 | Backup/recovery evidence for the instance | Not authorized to produce (WP-05/D-A domain) |
| 8 | Acceptability decision for `listen_addresses='*'` | Owner/policy question — unassessed by design |
| 9 | TCP state display anomaly root cause | Snapshot-display artifact observed; not diagnosable further without deeper privileged tooling; functional listening is separately proven — recorded as Conflicting Evidence |
| 10 | Whether existing service-level settings satisfy isolation intent (WP-03 NOT-VERIFIED item 3) | Requires elevated inspection + owner acceptance criteria |

### 9.10 Isolation conclusion

> **`CONDITIONAL — MORE OWNER DECISIONS OR EVIDENCE REQUIRED`**

No `PASS` is possible: at least one mandatory isolation property of the original Condition 1 — reviewed isolation evidence covering privilege enforcement (§9.4), effective network exposure (§9.5), and recovery/lifecycle (§9.8) — is unknown or unsupported today, and the shared-instance blast radius (§9.6) is an inherent, unaccepted residual that R-136 itself flagged when first optioning I4.

A categorical `FAIL` is **not** issued: the original record's option space explicitly contemplated an existing-managed-instance arrangement (I4) with an isolated database, so the I-WIN design is not excluded by the original criteria — it is excluded **today** only because its required evidence and owner acceptances do not yet exist.

---

## 10. R-138 and R-139 dependency interpretation (controlling)

- **R-138 §9:** an owner decision is not an execution authorization (§9.1); WP-03 requires its **own explicit execution authorization** (§9.6); Condition 1 → WP-04 requires separate authorization; Condition 2 is soft for WP-05; D-A + separate restore authorization precede WP-05. Preserved unchanged.
- **R-139:** I-WIN is the **current D-I direction** (direction-only). Conditions 1/2/10/11 remain `NOT MET`; D-A remains `PENDING OWNER DECISION`; Stage 3/Phase 13 remain `NOT AUTHORIZED`.
- **This authorization:** WP-03 gating satisfied (execution authorization, dated 2026-11-09). Stage-C double gate: (1) WP-03 execution authorization ✓ recorded; (2) owner acceptance of Stage B assessment **pending — this report is that request**.

| Item | Status |
|---|---|
| `D-I` / I-WIN | `DECIDED — direction` (R-139); execution authority for WP-03 Stage A/B given 2026-11-09 |
| WP-03 | Stage A `EXECUTED`; Stage B `EXECUTED`; Stage D (this report) `EXECUTED`; **Stage C `NOT AUTHORIZED`** |
| Condition 1 | **`NOT MET`** — unchanged; this report does not flip it (§9.2/§9.10) |
| Condition 2 / 10 / 11 | `NOT MET` — unchanged |
| `D-A` | `PENDING OWNER DECISION` — unchanged |
| WP-04 / WP-05 / Stage 3 / Phase 13 | `NOT AUTHORIZED` — unchanged |

---

## 11. Boundary-by-boundary analysis summary

| Boundary | State actually achieved today | Verdict vs. original Condition 1 |
|---|---|---|
| Database | None yet (validation DB proposal-only) | Not established |
| Privilege | `postgres`=superuser discipline recorded; validator role absent; PUBLIC-CONNECT default exposure expected; no enforced least privilege possible without prohibited changes | **Gap — needs owner decision (ACL/HBA) or acceptance** |
| Network | HBA loopback-only verified; listener wildcard verified; firewall shows no explicit allow; effective default/external reachability unknown | **Gap — unverified; no isolation claim made** |
| Instance/host | Shared service/process/host — inherent blast radius (PG17 decoupled as separate service) | **Residual risk — owner must explicitly accept (I4 caveat) or a new direction decision** |
| Artifact | Location proposed, not created | Defer to Stage C (with separate authorization/acceptance) |
| Recovery/lifecycle | No validated backup story; destructive-capable ops need separate gate | **Gap — needed before any destructive-capable Stage C work** |
| `0xC0000142` non-recurrence | Structurally satisfied (no provisioning exists under I-WIN) | `Verified` (structural) |

---

## 12. Stop conditions and recommended next owner decision (exact)

**Stop-point reached:** Assessment completed; creation stage returns to owner. No prohibited remedy was improvised at any point (§6 of the assignment).

**Minimum decisions/evidence the owner is asked to provide before Stage C:**

1. **Blast-radius acceptance (gating):** explicitly accept, or refuse, the I-WIN shared-instance residual: same Windows host, same `postgresql-x64-18` service (postmaster PID 9168), shared superuser authority, joint service-failure exposure of `cos_db`/`cos_authz_unit` and any future validation database. If refused → I-WIN cannot close the original Condition 1 as written; the owner would need to reopen the environment decision (separate-boundary options were not approved — R-139 §1.2).
2. **Placement decision:** approve (or redesign) the artifact/evidence location proposal and the artifact boundary (§9.7).
3. **Credential/elevation support:** authorize an escalation mechanism for the remaining catalog and firewall checks — minimum remedies: (a) owner-run read-only SQL against `postgres` at `127.0.0.1:5432` (queries below), and/or (b) an elevated, read-only PowerShell inspection of effective firewall policy and port-filter rules. Exact read-only SQL for the catalog items: `SELECT datname, datacl FROM pg_database ORDER BY 1;` · `SELECT rolname, rolsuper, rolcreaterole, rolcreatedb, rolcanlogin FROM pg_roles ORDER BY 1;` · `SELECT name, setting FROM pg_settings WHERE name IN ('server_version','data_directory','config_file','hba_file','listen_addresses','port','ssl');` · `SELECT * FROM pg_hba_file_rules;` — nothing else, no writes.
4. **Enforcement decision for the privilege boundary:** whether a `REVOKE CONNECT ... FROM PUBLIC` on `cos_db`/`cos_authz_unit` (or a per-database HBA rule) is approved as a **separate, explicitly scoped owner decision** — both are prohibited without it, and neither should be improvised.
5. **Recovery gate:** whether a validated backup/restore story must exist before any Stage-C creation work is authorized (recommended: yes, consistent with D.3/condition-10 sub-element discipline).

Stage C remains deferred pending these; no deadline is claimed by this report.

---

## 13. Non-actions and status confirmation

None of the following occurred in this session:

- Creating, altering, or deleting a database, role, grant, schema, or password.
- Any change to `postgresql.conf`, `pg_hba.conf` (read-only filtered reads only), `postgresql.auto.conf`, Windows Firewall rules, network configuration, or any service configuration.
- Starting, stopping, or restarting `postgresql-x64-18` or `postgresql-x64-17`.
- Any SQL statement against `cos_db`, `cos_authz_unit`, or `postgres` beyond a single failed, never-prompt connection attempt to `postgres` (no password existed to submit).
- Migrations, `pg_dump`, `pg_restore`, backups, or restores.
- Reading `.env`, credentials, tokens, or secret files.
- Application start, build, deployment, or code change.
- Docker/container/VM operations; any installation.
- Git writes: none (no stage, commit, push, branch, tag, reset, stash, clean).

**Stage C was NOT executed.** No validation database, validation role, or validation artifact was created. Condition 1 was **not** marked met. Conditions 2/10/11 remain `NOT MET`. WP-04, WP-05, Stage 3, and Phase 13 remain **`NOT AUTHORIZED`**.

---

## 14. Final verification

| Item | Result |
|---|---|
| Output path | `docs/frontend-rebuild/phase-12/phase-12-wp-03-stage-a-b-windows-native-execution-report-r140.md` |
| Next R-number | `R-140` verified unused repo-wide before this report |
| Documents modified in body by this session | **None** — R-139, the WP-03 proposal, R-136, R-138, the D-I/I3 addendum, and all prior reports are untouched |
| Working tree | Pre-existing dirty state preserved (24 modified tracked + 3 untracked porcelain entries at session start); no Git writes; verified again at close |
| Final Phase 12 verdict | `BLOCKED — ADDITIONAL EVIDENCE REQUIRED — PHASE 12 REMAINS OPEN` (unchanged) |

**Required final state:**
`WP-03 AUTHORIZED — STAGE A/B EXECUTED — STAGE C DEFERRED PENDING OWNER ACCEPTANCE — CONDITION 1 NOT AUTOMATICALLY MET — NO PROHIBITED OPERATION — PHASE 12 REMAINS OPEN.`

---

**End of R-140. Stop here.**
