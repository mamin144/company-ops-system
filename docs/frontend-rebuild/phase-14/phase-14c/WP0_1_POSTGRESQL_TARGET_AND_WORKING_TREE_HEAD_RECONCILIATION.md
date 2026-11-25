# WP-0.1 — PostgreSQL Target Identification and Working-Tree / HEAD Reconciliation

| Field | Value |
| --- | --- |
| Work package | WP-0.1 |
| Repository | `D:\Default Project\company-ops-system` |
| Branch | `main` |
| HEAD | `f91ed2f9e81db3937e3bcbb1b44e5e2c44e175cf` |
| Authoring mode | Read-only investigation only |
| Mutations performed | One new report file. No source, config, database, migration, or Git mutation. |
| Report status | `WP-0.1 PARTIALLY VERIFIED — DATABASE IDENTITY AND LEDGER VERIFIED; RUNTIME PROHIBITED` |

---

## Evidence labels used in this report

| Label | Meaning |
| --- | --- |
| `VERIFIED` | Direct evidence observed first-hand during WP-0.1 (command output, file bytes, database response). |
| `PARTIALLY VERIFIED` | Some direct evidence exists, but at least one material link in the chain is inference or was not directly observed. |
| `NOT VERIFIED` | Asserted by a source artefact or by a previous work package, but not confirmed by direct evidence here. |
| `BLOCKED` | Cannot be determined under the WP-0.1 safety envelope (e.g. requires execution, mutation, or an unavailable tool). |
| `NOT IN SCOPE` | Outside WP-0.1 authority; carried forward untouched. |

Two evidence kinds are distinguished throughout: **direct evidence** (observed output) and **inference** (reasoned conclusion from source). Every inference is labelled as such.

### Three-level target distinction (used in §5, §7, §8)

| Level | Question answered | WP-0.1 result |
| --- | --- | --- |
| **Configuration target identified** | What does committed/working configuration say to connect to? | Identified (`VERIFIED`) |
| **Runtime target identified** | What did a running COS API process actually connect to? | **Unknown / not established** — execution prohibited |
| **Database identity verified** | Does the reachable instance prove it is the configured target? | Verified for the configured target only (`VERIFIED`) |

---

## 1. Executive summary

WP-0.1 had two workstreams: (A) identify the intended PostgreSQL instance and verify its identity read-only, and (B) reconcile the uncommitted Password Reset implementation against committed `HEAD`.

**Workstream A — the target is now unambiguous.**

- The configured target is `postgresql://<user>@localhost:5432/cos_db`, supplied by `apps/api/.env` (`DATABASE_URL`). `VERIFIED` by in-memory parse of the file; no secret value is reproduced in this report.
- Two PostgreSQL clusters are installed and running side by side: **PostgreSQL 18** on `0.0.0.0:5432` and **PostgreSQL 17** on `127.0.0.1:5433`. Both are Windows services in `Automatic`/`Running` state. `VERIFIED`.
- The 5432 instance identifies itself as **PostgreSQL 18.4**, database `cos_db`, user `cos`, `inet_server_port() = 5432`, and a successful credential exchange from the configured credentials. `VERIFIED`.
- The 5433 instance is a **different** PostgreSQL 17 cluster and **rejects the configured credentials** (`FATAL: password authentication failed for user "cos"`). `VERIFIED`. It is therefore excluded as the target.
- Read-only operation was guaranteed before any query: `PGOPTIONS='-c default_transaction_read_only=on'` and the session confirmed `current_setting('transaction_read_only') = on`. `VERIFIED`.
- **Migration ledger contradiction is now directly verified, not inferred**: 22 migration files exist on disk; `_migrations` holds **19** rows (ids 1–19, last entry `21_direct_amounts.sql`). Migrations **22, 23 and 24 are unapplied**. `VERIFIED`.
- Consequence, also directly verified: `password_reset_tokens`, `ipc_status_events` and `backups` **do not exist**; `users` has no `department`/`title`; `projects` has no `deleted_at`/`deleted_by`; `ipcs_status_check` does **not** permit `under-review`.

**Workstream B — the Password Reset work is not merely incomplete, it is unreachable and internally broken.**

- Committed `HEAD` contains **no** Password Reset feature at all: zero tracked paths match `password|reset`, and the only reset endpoint is the admin-initiated `POST /users/:id/reset-password` (`auth.routes.ts` L274).
- The working tree adds `/auth/request-reset` and `/auth/use-reset`, but its import `'../password-reset-token/service.js'` resolves to `apps/api/src/modules/password-reset-token/service.js`, **which does not exist**. `VERIFIED`.
- The only `password-reset-token` implementation on disk is `apps/api/src/services/password-reset-token.service.ts`, at the wrong path for that import, and it additionally (a) references `usageToken` inside a SQL parameter array **one block before** its `const` declaration (temporal dead zone), (b) declares `ValidateResult` with invalid TypeScript syntax, (c) imports the undeclared and uninstalled package `uuid`, and (d) never returns `rawToken`, so `validateAndMarkUsed` can never succeed. `VERIFIED`.
- **A materially new finding that reframes all prior "the API cannot boot" language**: committed `HEAD` itself contains unresolved merge-conflict markers in **33 source files** (18 backend, 15 frontend). So the API is unloadable at `HEAD` for a *different* reason than the one previously recorded. `VERIFIED`.

**Net assessment.** Workstream A met both of its goals and moved beyond inference into direct database evidence. Workstream B established that the Password Reset feature exists **only** as uncommitted, non-loadable code, and that the repository's `HEAD` is itself syntactically broken. No repair, migration, RBAC assignment or integration is performed or implied.

---

## 2. Scope and safety compliance

### 2.1 Authorised actions taken

| Category | Action | Bound |
| --- | --- | --- |
| Source reading | Read API/web source, migrations, `package.json`, `.env` **structure** | Read-only |
| Config inspection | Parsed `DATABASE_URL` and root `.env` in memory; printed only scheme/host/port/db/user/param-presence | No secret emitted |
| Git metadata | `rev-parse`, `log`, `status`, `diff`, `ls-files`, `ls-tree`, `show`, `cat-file`, `stash list`, `diff --cached` | No mutation |
| Service/process inspection | `Get-Service`, `Get-Process`, `Get-NetTCPConnection`, `postmaster.pid` reads, `PG_VERSION`, `postgresql.conf` | Read-only |
| PostgreSQL client | `C:\Program Files\PostgreSQL\18\bin\psql.exe` (already installed) | Read-only session |
| SQL | `SELECT`, `information_schema`, `pg_catalog`, `to_regclass`, `current_setting` | `default_transaction_read_only=on` |
| Deliverable | Created this one report | New file only |

### 2.2 Prohibited actions — confirmed not performed

| Prohibition | Status |
| --- | --- |
| Source / config / `.env` edits | Not performed |
| DDL or DML of any kind | Not performed |
| Migration, seed, backfill, schema change | Not performed |
| Password Reset implementation or repair | Not performed |
| API adapter or frontend integration | Not performed |
| Package installs or dependency changes | Not performed |
| PostgreSQL start / stop / restart / reconfigure / upgrade | Not performed |
| Docker / container creation or execution | Not performed |
| API or server startup | Not performed |
| Test suite / build / application execution | Not performed |
| Git mutation (`checkout`, `restore`, `reset`, `clean`, `stash`, `stage`, `commit`, `push`, `merge`, `rebase`, branch switch) | Not performed |
| Deleting or modifying existing files | Not performed |
| Secret values in terminal output or this report | Not emitted. One pre-existing plaintext credential found in a repo script is described but **redacted**. |
| Helper scripts / temp files / snapshots / exports inside the repo | None created |

### 2.3 Read-only guarantee evidence

Read-only was established at the session level, not merely by intent:

```
SET (via PGOPTIONS): default_transaction_read_only = on
statement_timeout = 15000
Observed: current_setting('transaction_read_only') = on
```

Selected database: `cos_db` on port `5432`, after identity was confirmed. No `INSERT`/`UPDATE`/`DELETE`/`CREATE`/`ALTER`/`DROP` statement was issued at any point.

### 2.4 Scope ambiguities resolved conservatively

- **5433 was not assumed to be the target.** `.env.example` files and `docker-compose.yml` describe a *different*, Docker-based target on host port 5433. The actual runtime configuration in `apps/api/.env` points at 5432. The `.env.example` value is documented as contradictory (§5.4) rather than silently preferred.
- **`pg_ctl status` was not treated as evidence.** `pg_ctl status -D <datadir>` returned `pg_ctl: no server running` (exit 3) for both clusters despite live `postmaster.pid` files. This is treated as a Windows path/case-comparison artefact of `pg_ctl` and **not** as evidence about cluster liveness. Cluster identity was instead established from `postmaster.pid` contents, the listening sockets, and a live authenticated session. Documented in §6.5.
- **Migration application was not inferred from file presence.** The ledger was queried directly (§9).
- **Table existence was not inferred from source references.** `to_regclass` was queried directly (§8).

---

## 3. Initial and final Git state

### 3.1 Initial state — captured before any investigation read

| Property | Value |
| --- | --- |
| Branch | `main` |
| HEAD | `f91ed2f9e81db3937e3bcbb1b44e5e2c44e175cf` |
| HEAD subject | `f91ed2f 2026-10-11 09:19:57 +0000 Merge branch 'main' of https://github.com/mamin144/company-ops-system` |
| `git status --porcelain=v1` lines | **46** |
| Staged (`git diff --cached --name-status`) | **0** |
| Stashes (`git stash list`) | **0** |
| Tracked files under `docs/` (`git ls-files docs`) | **0** |
| Untracked paths under `docs/` | **350** |

Baseline matches the WP-0 baseline exactly: 46 porcelain, 0 staged, 0 stashes, HEAD `f91ed2f`. `VERIFIED`.

The 46 porcelain entries comprise 34 tracked modifications plus 12 untracked entries — among which `docs/` appears as a **single collapsed directory entry**. Because `docs/` is wholly untracked, adding one file inside it does not change the porcelain count.

### 3.2 Final state — captured after report authoring

| Property | Value | Δ vs initial |
| --- | --- | --- |
| Branch | `main` | none |
| HEAD | `f91ed2f9e81db3937e3bcbb1b44e5e2c44e175cf` | none |
| Porcelain lines | **46** | none |
| Staged | **0** | none |
| Stashes | **0** | none |
| Tracked modifications | **34** (unchanged set) | none |
| New file created | `docs/frontend-rebuild/phase-14/phase-14c/WP0_1_POSTGRESQL_TARGET_AND_WORKING_TREE_HEAD_RECONCILIATION.md` (untracked, inside untracked `docs/`) | +1 untracked path |
| Existing files modified by WP-0.1 | **0** | none |

Git state is identical to the initial baseline. The only filesystem delta is this report. `VERIFIED`.

### 3.3 Pre-existing working-tree content (explicitly not created by WP-0.1)

The working tree was already dirty before WP-0.1 began. The following untracked artefacts are pre-existing and were **read only**:

| Path | Relevance |
| --- | --- |
| `apps/api/src/services/password-reset-token.service.ts` | The Password Reset service candidate (§10, §11, §12) |
| `scripts/fix-password-reset.js` | A pre-existing DDL repair attempt (§12.4) |
| `apps/api/src/database/migrations/22_phase14_core_columns.sql` | Unapplied migration (§9) |
| `apps/api/src/database/migrations/23_phase14_ipc_workflow.sql` | Unapplied migration (§9) |
| `apps/api/src/database/migrations/24_phase14_recovery_import_tables.sql` | Unapplied migration (§9) |
| `apps/api/src/services/financials.service.ts` | Out of scope |
| `apps/api/tests/migration.phase14.test.ts` | Out of scope; references dry-run databases |
| `PHASE14_FINAL_REPORT.md`, `WP2_VERIFICATION_REPORT.md`, `COS_Full_Frontend_Rebuild_*.md` | Out of scope |

Note on tone discipline: this repository is **not** clean, and this report does not describe it as clean. The dirty state is the object of study, not a defect introduced here.

---

## 4. Skills discovery, acquisition, reading, and application evidence

### 4.1 Discovery

| Step | Result |
| --- | --- |
| Project-local skill directories (`.opencode/skills`, `.claude/skills`, etc.) | **None found** |
| User-level skill root | `C:\Users\PC-01\.config\opencode\skills` |
| Skill directories present at that root | **1,405** |

### 4.2 Selected skills and acquisition outcome

All seven were **already installed** at the user level. No installation, download, or modification of any skill was required or performed.

| # | Skill | Location | Version / provenance | Install outcome |
| --- | --- | --- | --- | --- |
| 1 | `postgresql-cli` | `…\.config\opencode\skills\postgresql-cli\` | Local user install; no embedded version string; `SKILL.md` 498 lines | Already installed — no action |
| 2 | `postgres-best-practices` | `…\skills\postgres-best-practices\` | Local user install; no embedded version; `SKILL.md` 63 lines | Already installed — no action |
| 3 | `cred-omega` | `…\skills\cred-omega\` | Local user install; no embedded version; `SKILL.md` 886 lines | Already installed — no action |
| 4 | `logic-diff` | `…\skills\logic-diff\` | Local user install; `SKILL.md` 50 lines; `logic-diff-guide.md` 75 lines | Already installed — no action |
| 5 | `git-advanced-workflows` | `…\skills\git-advanced-workflows\` | Local user install; `SKILL.md` 420 lines | Already installed — no action |
| 6 | `broken-authentication` | `…\skills\broken-authentication\` | Local user install; `SKILL.md` 480 lines | Already installed — no action |
| 7 | `auth-implementation-patterns` | `…\skills\auth-implementation-patterns\` | Local user install; `SKILL.md` 47 lines + `resources/implementation-playbook.md` | Already installed — no action |

Provenance note: these are local, user-scoped skill bundles with no upstream commit SHA recorded inside them. Version is therefore recorded as **"no embedded version string; local user install"** rather than invented.

### 4.3 Reading evidence

| Skill | Files read | Extent |
| --- | --- | --- |
| `postgresql-cli` | `SKILL.md`; `references/tips-workflows.md`; `references/cli-options-and-variables.md` | Full `SKILL.md` (498 L); full tips file (407 L); L300–379 of the options reference |
| `postgres-best-practices` | `SKILL.md` | Full (63 L) |
| `cred-omega` | `SKILL.md` | Full (886 L) |
| `logic-diff` | `SKILL.md`; `logic-diff-guide.md` | Full (50 L / 75 L) |
| `git-advanced-workflows` | `SKILL.md` | Full (420 L) |
| `broken-authentication` | `SKILL.md` | Full (480 L) |
| `auth-implementation-patterns` | `SKILL.md`; `resources/implementation-playbook.md` | Full `SKILL.md` (47 L); L585–618 of the playbook |

A referenced cross-skill file, `../_shared/common.md` (expected at `C:\Users\PC-01\.config\opencode\skills\_shared\common.md`), **does not exist** — `_shared` is absent. Recorded as **Unavailable** below.

### 4.4 Application evidence — what was actually applied, and how

Reading is not application. Each row below names the concrete artefact in this report that the skill changed.

| Skill | Status | Concrete application in WP-0.1 |
| --- | --- | --- |
| `postgresql-cli` | **Applied** | Supplied the exact read-only invocation pattern used for every SQL statement: absolute `psql.exe` path (client is not on `PATH`), `-X` to ignore `psqlrc`, `-w` to never prompt for a password, `-A -F '|'` for parseable output, `-v ON_ERROR_STOP=1`, and the `PGOPTIONS='-c default_transaction_read_only=on -c statement_timeout=15000'` guard. This is the mechanism behind §2.3 and every result in §8/§9. |
| `postgres-best-practices` | **Applied** | Governed the *diagnostic* catalogue used in §8/§9/§12: verify ledger-vs-disk parity from the ledger table rather than from file presence; check `to_regclass` before asserting object existence; inspect `pg_get_constraintdef` for enum-like `CHECK` constraints instead of assuming allowed values; confirm `transaction_read_only` before trusting a session. |
| `cred-omega` | **Applied** | Governed credential handling: values were parsed into process environment variables for the duration of a single call, never echoed; only scheme/host/port/database/user and *presence* of a password were reported; `Env:` variables were removed after each call; the pre-existing plaintext credential in `scripts/fix-password-reset.js` is described structurally and redacted (§12.4). |
| `logic-diff` | **Applied (degraded)** | Used as the comparison method for §10 and §11: state premises, trace each version independently, then record divergence and consequence. Applied from `SKILL.md` + `logic-diff-guide.md` only. |
| `logic-diff` | **Unavailable (partially)** | Its referenced `../_shared/common.md` does not exist, so the shared preamble could not be read. The method was applied from the two local files alone. This is disclosed rather than glossed. |
| `git-advanced-workflows` | **Applied** | Governed the read-only Git technique: `git -C <root>` to avoid CWD drift, `git show HEAD:<path>` / `git cat-file -e` to test historical existence instead of touching the index, `ls-tree -r` to enumerate committed paths, and strict avoidance of any command that writes to the index, refs, or working tree. |
| `broken-authentication` | **Applied** | Supplied the authentication-specific failure catalogue used in §10/§12: enumeration-resistant reset flows, single-use token semantics, "raw token must reach the client" requirement, one-active-token invalidation, and the observation that a reset endpoint requiring both a server-issued handle and a secret the server never discloses is unusable by construction. |
| `auth-implementation-patterns` | **Applied** | Used to judge the reset flow against a correct baseline: hash-only storage, bounded TTL, single-use marking, session revocation after reset, and generic error responses. Applied to classify which parts of the candidate implementation are *sound in design* versus *broken in execution* (§10.5). |

### 4.5 Truthfulness statement

No skill is claimed as **Applied** on the basis of having been read. Where a skill informed only the reasoning and produced no identifiable artefact, it is not listed. `logic-diff` is explicitly split into **Applied (degraded)** and **Unavailable (partially)** because its shared dependency was missing.

---

## 5. Configuration target identification

**Outcome: configuration target IDENTIFIED (`VERIFIED`).**

### 5.1 Primary source — `apps/api/.env`

| Property | Value | Note |
| --- | --- | --- |
| Keys present | `DATABASE_URL`, `PORT`, `JWT_SECRET` | 3 keys total |
| `DATABASE_URL` length | 61 characters | |
| Scheme | `postgresql` | |
| Host | `localhost` | |
| Port | `5432` | |
| Database | `cos_db` | |
| User | `cos` | Safe to disclose as non-secret identity metadata |
| Password | present — 22 characters | **Never printed, never stored in this report** |
| Query parameters | none | No `sslmode`, no `schema`, no `options` |

`JWT_SECRET` is present (64 characters) and was not read into any output. `PORT` is a 4-character value; it was not needed for WP-0.1 and is not disclosed.

### 5.2 Driver behaviour — `apps/api/src/database/connection.ts`

`VERIFIED` by source read (L6–20):

- `DATABASE_URL` is **required**; the module throws if it is absent. There is no fallback to discrete `PG*` variables and no default host.
- Pool constructed as `new Pool({ connectionString, max: 20, idleTimeoutMillis: 30000, connectionTimeoutMillis: 2000 })`.
- **No `ssl` option is configured.** Combined with the absent `sslmode` query parameter, the effective connection is plaintext local TCP.

### 5.3 Secondary source — root `.env`

| Key | Status |
| --- | --- |
| `POSTGRES_USER` | `cos` — consistent with `DATABASE_URL` |
| `POSTGRES_PASSWORD` | present, 22 characters — consistent length with the `DATABASE_URL` password |
| `POSTGRES_DB` | `cos_db` — consistent |

The root `.env` corroborates the API `.env`. Neither file was modified.

### 5.4 Contradictory documentation — documented, not resolved by preference

| Artefact | Declared target | Relationship to actual config |
| --- | --- | --- |
| `docker-compose.yml` | `postgres:16-alpine`, publishes `127.0.0.1:5433:5432`; API container uses `@postgres:5432` | Describes a **Docker** topology on host port **5433** with PostgreSQL **16** |
| `.env.example` (repo) | Docker-oriented values on port 5433 | Contradicts actual 5432 |
| Actual `apps/api/.env` | native `localhost:5432`, `cos_db`, `cos` | Authoritative for the working copy |

**This is recorded as a documentation/target contradiction, not as a defect to fix.** It matters because a future reader could reasonably follow `.env.example` and connect to the wrong cluster. WP-0.1 does **not** choose between them by preference: the operative configuration is `apps/api/.env`, and that is what §7 verified. Note additionally that the 5433 listener is a **native `postgres.exe`**, not a Docker proxy (§6.3), so the compose file's port mapping is not what is currently bound.

### 5.5 Three-level statement

| Level | Result |
| --- | --- |
| Configuration target identified | **IDENTIFIED** — `localhost:5432` / `cos_db` / user `cos`, no SSL, from `apps/api/.env` (`VERIFIED`) |
| Runtime target identified | **UNKNOWN** — no evidence any COS API process ever ran against any database; startup is prohibited (§7.4) |
| Database identity verified | **VERIFIED for the configured target only** — see §7 |

---

## 6. PostgreSQL installation, process, and port inventory

**Outcome: two distinct clusters installed and running (`VERIFIED`).**

### 6.1 Services

| Service name | State | Start mode | Command line (service registry) |
| --- | --- | --- | --- |
| `postgresql-x64-17` | Running | Automatic | `pg_ctl.exe runservice -N "postgresql-x64-17" -D "C:\Program Files\PostgreSQL\17\data" -w` |
| `postgresql-x64-18` | Running | Automatic | `pg_ctl.exe runservice -N "postgresql-x64-18" -D "C:\Program Files\PostgreSQL\18\data" -w` |

Both services were already running. **Neither was started, stopped, or reconfigured by WP-0.1.**

### 6.2 Processes

- **19** `postgres.exe` processes observed in total (two clusters, each with a postmaster plus background workers).
- Two root processes (each with its own parent):
  - **PID 8220** — parent PID 6428
  - **PID 8248** — parent PID 6792
- `ExecutablePath` and `CommandLine` are **blank for all 19 processes** when queried via CIM. This is an access/permission artefact, not evidence about what the processes are. Cluster attribution therefore relies on `postmaster.pid` + sockets (§6.4), not on process command lines.

### 6.3 Listening sockets

| Address | Port | Owning PID | Attribution |
| --- | --- | --- | --- |
| `0.0.0.0` | 5432 | 8220 | PostgreSQL 18 cluster |
| `[::]` | 5432 | 8220 | PostgreSQL 18 cluster (IPv6) |
| `127.0.0.1` | 5433 | 8248 | PostgreSQL 17 cluster |
| `[::1]` | 5433 | 8248 | PostgreSQL 17 cluster (IPv6) |

- No other listener was found anywhere in the 5400–5600 range.
- **Both 5432 and 5433 are served by native `postgres.exe` processes**, not by a container proxy. The `docker-compose.yml` port mapping for 5433 is therefore not what is bound at present.
- Binding asymmetry is significant: 5432 listens on **all interfaces**, 5433 on **loopback only**.

### 6.4 Cluster attribution via `postmaster.pid` and `PG_VERSION`

| Cluster | Data directory | PID in `postmaster.pid` | Port | `listen_addresses` (in pid file) | `PG_VERSION` | `postgresql.conf` port |
| --- | --- | --- | --- | --- | --- | --- |
| 17 | `C:/Program Files/PostgreSQL/17/data` | 8248 | 5433 | `127.0.0.1` | 17 | 5433 |
| 18 | `C:/Program Files/PostgreSQL/18/data` | 8220 | 5432 | `*` | 18 | 5432 |

Both `postgresql.conf` files declare `listen_addresses = '*'`; the effective difference is the configured `port`. The `postmaster.pid` PID for each cluster matches the socket-owning PID exactly, which is what makes the attribution `VERIFIED` rather than inferred.

### 6.5 `pg_ctl status` anomaly — explicitly not used as evidence

`pg_ctl status -D "<datadir>"` returned `pg_ctl: no server running` (exit code 3) for **both** data directories, despite live `postmaster.pid` files, live listeners, and a successful authenticated session on 5432.

Interpretation: a Windows-specific `pg_ctl` path/argument-comparison artefact. It is **not** consistent with the other three independent signals (pid file, socket ownership, live session), and it is **not** treated as evidence that either cluster is down. This is recorded so a future reader does not repeat the mistake.

### 6.6 Client availability

| Item | Result |
| --- | --- |
| `psql` on `PATH` | **Not found** |
| Absolute client path | `C:\Program Files\PostgreSQL\18\bin\psql.exe` |
| Client version | `psql (PostgreSQL) 18.4` |
| PG 17 client present | Yes — same directory set under `…\PostgreSQL\17\bin\` (`psql.exe` 635,392 B vs PG 18's 651,264 B) |

**This materially narrows a WP-0 blocker** (see §13, BLOCKER-5): the client was never missing — it was merely not on `PATH`.

### 6.7 Installation inventory conclusion

| Conclusion | Label |
| --- | --- |
| Two PostgreSQL clusters installed (17 and 18) | `VERIFIED` |
| Both currently running as Windows services | `VERIFIED` |
| 18 serves 5432 on all interfaces; 17 serves 5433 on loopback | `VERIFIED` |
| The two clusters are **not** interchangeable, and the configured credentials work on only one | `VERIFIED` (§7.2) |
| No third PostgreSQL installation was found in the scanned ranges | `PARTIALLY VERIFIED` — the scan covered 5400–5600 listeners and the two known service names; it did not enumerate every installed product on disk |

---

## 7. Database identity verification

**Outcome: identity VERIFIED for the configured target; the alternative candidate is definitively excluded.**

### 7.1 Why verification was permitted to proceed

Three preconditions were all satisfied before the first SQL statement was issued:

1. **Target unambiguous** — `apps/api/.env` names exactly one host/port/database/user, and the two listeners are distinguishable by port (§5, §6).
2. **Client already installed** — `psql.exe` 18.4 was present; nothing was installed.
3. **Read-only guaranteeable** — `PGOPTIONS='-c default_transaction_read_only=on'` was applied, and the session independently confirmed it (§2.3).

No precondition required an environment change.

### 7.2 Candidate rejection — PostgreSQL 17 on 5433

An authentication attempt against the PG 17 cluster using the credentials from `apps/api/.env` (in memory only) failed:

```
FATAL: password authentication failed for user "cos"
exit code 2
```

This is a **definitive exclusion**, not a preference: the configured credentials do not authenticate against that cluster. Additionally, the database name `cos_db` did not appear in that cluster's catalogue. The 5433 cluster is therefore **not** the configured COS target. `VERIFIED`.

### 7.3 Identity of the accepted target — PostgreSQL 18 on 5432

| Evidence | Observed value | Label |
| --- | --- | --- |
| Server version string | `PostgreSQL 18.4 on x86_64-windows, compiled by msvc-19.44.35227, 64-bit` | `VERIFIED` |
| `server_version` | `18.4` | `VERIFIED` |
| `current_database()` | `cos_db` | `VERIFIED` |
| `current_user` | `cos` | `VERIFIED` |
| `inet_server_addr()` | `::1/128` (loopback IPv6) | `VERIFIED` |
| `inet_server_port()` | `5432` | `VERIFIED` |
| `current_setting('transaction_read_only')` | `on` | `VERIFIED` |
| `pg_postmaster_start_time()` | `2026-11-18 00:01:42.291322-08` | `VERIFIED` |
| Authenticated with configured credentials | Yes | `VERIFIED` |

The combination of (a) successful credential exchange with the values from `apps/api/.env`, (b) `current_database()` equal to the configured database name, (c) `inet_server_port()` equal to the configured port, and (d) a server version matching the PID-8220 / `PG_VERSION=18` cluster attribution, closes the chain. Identity is `VERIFIED`, not inferred from "something is listening on 5432".

### 7.4 Runtime target — deliberately NOT established

| Question | Answer |
| --- | --- |
| Was the COS API observed connecting to this database? | **No** |
| Is there evidence of a prior API run against it? | None that WP-0.1 is willing to assert. `apps/api/logs/service-*.log` exist and are modified in the working tree, but inspecting them for connection evidence is not proof of a *current* runtime target, and API startup is prohibited. |
| Can runtime target be determined under this envelope? | **No — `BLOCKED` by design** |

Per instruction, no identity behind `audit_logs` login events is inferred. The runtime target remains **unknown** and this report does not upgrade the configuration target into a runtime claim.

### 7.5 Consolidated database conclusions

**Intended target**

| Question | Conclusion |
| --- | --- |
| Intended target identified? | **IDENTIFIED** — `localhost:5432` / `cos_db` / `cos`, PostgreSQL 18.4 (`VERIFIED`) |
| Ambiguous? | **NO** — 5433 excluded by authentication failure (`VERIFIED`) |
| Unknown? | No |

**Verified inventory (running instances)**

| Instance | Port | Bind | Version | Status |
| --- | --- | --- | --- | --- |
| PostgreSQL 18 | 5432 | `*` | 18.4 | Running, **accepted target** |
| PostgreSQL 17 | 5433 | `127.0.0.1` | 17 | Running, **rejected candidate** |

**Target process, port, identity, ledger, migrations, RBAC**

| Item | Conclusion | Label |
| --- | --- | --- |
| Target process | PID 8220, data `C:/Program Files/PostgreSQL/18/data` | `VERIFIED` |
| Target port | 5432 | `VERIFIED` |
| Database identity | `cos_db` as `cos` on an 18.4 server | `VERIFIED` |
| Migration ledger state | 19 rows, ids 1–19 | `VERIFIED` |
| Migrations 22–24 applied | **No — all three unapplied** | `VERIFIED` |
| RBAC rows (`roles`, `user_permission_overrides`) | Read successfully; contents enumerated in §8.4 | `VERIFIED` |

**Required schema objects**

| Object | State | Label |
| --- | --- | --- |
| `password_reset_tokens` | **ABSENT** | `VERIFIED` |
| `ipc_status_events` | **ABSENT** | `VERIFIED` |
| `backups` | **ABSENT** | `VERIFIED` |
| `users.department`, `users.title` | **ABSENT** | `VERIFIED` |
| `projects.deleted_at`, `projects.deleted_by` | **ABSENT** | `VERIFIED` |
| `ipcs` status value `under-review` | **NOT PERMITTED** by `ipcs_status_check` | `VERIFIED` |
| `roles`, `users`, `projects`, `ipcs`, `sessions`, `audit_logs`, `user_permission_overrides` | **PRESENT** | `VERIFIED` |
| Any other object not explicitly queried | **UNKNOWN** | `NOT VERIFIED` |

---

## 8. Read-only database findings

All findings in this section were produced by `SELECT`-only statements inside a session where `transaction_read_only = on`.

### 8.1 Databases

| Database | Owner | Size |
| --- | --- | --- |
| `cos_authz_unit` | `cos` | 9449 kB |
| `cos_db` | `cos` | 12 MB |
| `postgres` | `postgres` | 7857 kB |

Non-default databases beyond these were not enumerated; no `cos_stage2_*` or `cos_phase14_test` database appears in this list.

### 8.2 Schemas

Only `public` exists as a user schema. No separate schema namespacing is in use.

### 8.3 Tables — 27 in `public`

`_migrations`, `audit_logs`, `boq_items`, `categories`, `counters`, `document_links`, `document_revisions`, `documents`, `folders`, `import_history`, `ipc_items`, `ipcs`, `items`, `material_request_lines`, `material_requests`, `notifications`, `project_members`, `projects`, `roles`, `sessions`, `sites`, `stock_transaction_lines`, `stock_transactions`, `units`, `user_permission_overrides`, `users`, `warehouses`.

Relative sizes are consistent with a populated but modest dataset (`audit_logs` 1392 kB, `documents` 456 kB, `sessions` 536 kB, `projects` 112 kB, `users` 112 kB).

### 8.4 RBAC rows

Five system roles, all `is_system = true`:

| Role | Distinct permission entries |
| --- | --- |
| `admin` | 30 |
| `warehouse` | 13 |
| `management` | 10 |
| `technical` | 8 |
| `viewer` | 5 |

Permissions are stored as a text array column (`roles.permissions`); there are no separate `role_permissions` or `permissions` tables.

Key presence findings:

| Key | `admin` | `management` | `technical` | `viewer` | `warehouse` |
| --- | --- | --- | --- | --- | --- |
| `ipcs.approve` | **absent** | absent | absent | absent | absent |
| `ipcs.resubmit` | **absent** | absent | absent | absent | absent |
| `roles.manage` | present | absent | absent | absent | absent |
| `projects.access` | present | absent | absent | absent | absent |
| `users.resetPassword` | present | absent | absent | absent | absent |

Distinct key prefixes actually granted across all roles: `archive` (5), `warehouse` (9), `projects` (5), `materialRequests` (4), `users` (2), `audit` (1), `backup` (1), `reports` (1), `roles` (1), `settings` (1). **No `ipcs.*` prefix exists in any role.**

`user_permission_overrides`: 28 rows, 28 distinct `permission_key` values (one row per key), columns `user_id`, `permission_key`, `effect`, `created_by`, `created_at`. The key set contains `projects.access` and `roles.manage` but **no `ipcs.*` key**.

**Consequence (direct evidence, not inference):** because no role and no override carries `ipcs.approve` or `ipcs.resubmit`, any route gated solely on those keys is unreachable for every existing principal in this database. This converts a prior source-only observation into a database-backed fact.

### 8.5 Schema state relevant to the candidate implementation

| Object | State |
| --- | --- |
| `password_reset_tokens` | **does not exist** (`to_regclass` → NULL) |
| `ipc_status_events` | **does not exist** |
| `backups` | **does not exist** |
| `users` columns | `id, username, full_name, password_hash, role_name, is_active, created_at, updated_at` — **no `department`, no `title`** |
| `projects` | **no `deleted_at`, no `deleted_by`** |
| `ipcs.ipcs_status_check` | Live definition (normalised from `pg_get_constraintdef`): `CHECK (status IN ('draft','submitted','approved','rejected'))` — **`under-review` not permitted** |

The `ipcs_status_check` definition is quoted from `pg_get_constraintdef`, which is direct evidence of the *enforced* constraint rather than the source file's intent.

### 8.6 What these findings do NOT establish

- They do not establish that any application ever read or wrote these tables (**runtime target unknown**, §7.4).
- They do not establish the *content* of business data. Row counts were not enumerated beyond the RBAC and ledger tables.
- They do not establish that `cos_authz_unit` or the `postgres` database are unused by COS. Their role is **unknown**.

---

## 9. Migration ledger and migrations 22–24 verification

**Outcome: ledger-vs-disk contradiction directly VERIFIED; migrations 22, 23 and 24 are unapplied.**

### 9.1 Runner semantics — `apps/api/src/database/migrate.ts`

`VERIFIED` by source read:

- `runMigrations()` enumerates the migrations directory.
- Files are ordered with `localeCompare` on the filename — **not** numeric ordering. This matters: `11_add_stock_items_column.sql` and `11_modernize_dms.sql` share a prefix, and ordering is lexicographic.
- Each file runs inside its own `BEGIN` / `COMMIT`.
- Successful application is recorded by an insert into `_migrations`.
- `runMigrations()` is invoked from `app.ts` L18 during `createApp()`, i.e. **on every server boot**, and also has a standalone entry point at `migrate.ts` L76.

This last point is important for reasoning: migrations are not a separate deploy step that might have been skipped — they run at startup. Since no API startup occurred under WP-0.1, and the ledger is short, the unapplied state is the observable present state, not a timing artefact of WP-0.1.

### 9.2 Ledger table

| Property | Value |
| --- | --- |
| Columns | `id integer NOT NULL`, `name varchar NOT NULL`, `applied_at timestamptz NOT NULL` |
| Row count | **19** |
| id range | **1 – 19** |
| Highest applied entry | `21_direct_amounts.sql` at `2026-10-04 02:08:35.372655-07` |
| Previous entries | `20_authz_backfill.sql`, `19_authz_rebuild.sql` |

### 9.3 Files on disk — 22

In runner (`localeCompare`) order:

| # | File | In ledger? |
| --- | --- | --- |
| 1 | `001_initial_schema.sql` | yes |
| 2 | `05_create_boq_and_ipcs.sql` | yes |
| 3 | `06_add_ipc_deductions.sql` | yes |
| 4 | `07_add_region_and_doc_ipc_link.sql` | yes |
| 5 | `08_seed_doc_categories.sql` | yes |
| 6 | `09_fix_document_categories.sql` | yes |
| 7 | `10_add_revisions_column.sql` | yes |
| 8 | `11_add_stock_items_column.sql` | yes |
| 9 | `11_modernize_dms.sql` | yes |
| 10 | `12_backfill_document_revisions.sql` | yes |
| 11 | `13_add_project_owner.sql` | yes |
| 12 | `14_seed_runtime_stores.sql` | yes |
| 13 | `15_import_json_history.sql` | yes |
| 14 | `16_ipc_rejected_status.sql` | yes |
| 15 | `17_core_uniqueness.sql` | yes |
| 16 | `18_modernize_dms.sql` | yes |
| 17 | `19_authz_rebuild.sql` | yes |
| 18 | `20_authz_backfill.sql` | yes |
| 19 | `21_direct_amounts.sql` | yes |
| 20 | `22_phase14_core_columns.sql` | **NO** |
| 21 | `23_phase14_ipc_workflow.sql` | **NO** |
| 22 | `24_phase14_recovery_import_tables.sql` | **NO** |

Parity check both ways:

- All 19 ledger entries correspond to a file on disk — **no orphaned ledger rows**.
- Exactly 3 files are unapplied: **22, 23, 24**.

Note: the numeric gap (`001` then `05`) is pre-existing and matches the ledger, so it is not an anomaly introduced now.

### 9.4 Migration 22 — `22_phase14_core_columns.sql` (UNAPPLIED)

`VERIFIED` by source read. Declared as additive only, no renames, no drops, no backfill, re-runnable via `IF NOT EXISTS`:

- `users.department VARCHAR(100)`, `users.title VARCHAR(100)` — with an explicit comment that `email` is intentionally **not** touched per owner decision.
- `projects.deleted_at TIMESTAMPTZ`, `projects.deleted_by UUID REFERENCES users(id)` — soft delete; children and history untouched.

Database consequence (`VERIFIED`, §8.5): none of these four columns exist. So any code path selecting or writing `users.department`, `users.title`, or filtering on `projects.deleted_at` would fail at runtime against this instance.

### 9.5 Migration 23 — `23_phase14_ipc_workflow.sql` (UNAPPLIED)

`VERIFIED` by source read. Rebuilds the `ipcs` status `CHECK` to admit `under-review`, creates `ipc_status_events`, and relaxes financial `NULL` semantics.

Database consequence (`VERIFIED`, §8.5):

- `ipcs_status_check` still permits only `draft, submitted, approved, rejected`.
- `ipc_status_events` does not exist.

Therefore, on this instance, **any attempt to persist an IPC with status `under-review` violates the live constraint**, and any audit-event write to `ipc_status_events` fails with relation-not-found.

### 9.6 Migration 24 — `24_phase14_recovery_import_tables.sql` (UNAPPLIED)

`VERIFIED` by source read. Creates three metadata tables, each `IF NOT EXISTS` and explicitly described as exposing no public endpoint:

1. `password_reset_tokens` — `id UUID PK`, `user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE`, `token_hash VARCHAR(64) NOT NULL UNIQUE`, `expires_at TIMESTAMPTZ NOT NULL`, `used_at TIMESTAMPTZ`, `requested_ip VARCHAR(45)`, `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`. Plus index `idx_password_reset_tokens_user` on `user_id`.
2. `backups` — metadata index only.
3. A third recovery/import metadata table.

Database consequence (`VERIFIED`, §8.5): **all three tables are absent.**

### 9.7 Consolidated migration conclusion

| Statement | Label |
| --- | --- |
| 22 files on disk, 19 ledger rows | `VERIFIED` |
| Migrations 22, 23, 24 unapplied | `VERIFIED` |
| No ledger row lacks a file | `VERIFIED` |
| `password_reset_tokens` absent (dependent on 24) | `VERIFIED` |
| `ipc_status_events` absent (dependent on 23) | `VERIFIED` |
| `users.department`/`title`, `projects.deleted_at`/`deleted_by` absent (dependent on 22) | `VERIFIED` |
| `under-review` rejected by live constraint (dependent on 23) | `VERIFIED` |
| Whether the *intended deployment* should have these applied | **NOT IN SCOPE** — an owner decision |

---

## 10. Password Reset — committed HEAD vs working tree

**Outcome: the feature exists only in the working tree, does not resolve, does not compile, and cannot execute.**

### 10.1 Method

Per `logic-diff` (applied from `SKILL.md` and `logic-diff-guide.md`): each version is traced independently against the same premises, then divergences are recorded with their consequence. Premises: the module graph is ESM (`"type": "module"`); imports are resolved at link time before execution; the target database is `cos_db` with the schema state of §8.

### 10.2 Required comparison table

| Attribute | Committed `HEAD` (`f91ed2f`) | Working Tree | Evidence | Confidence |
| --- | --- | --- | --- | --- |
| **Password Reset route** | Only `usersExtRouter.post('/:id/reset-password', requireAnyPermission('users.manage','users.resetPassword'), …)` at `auth.routes.ts` L274 — an **admin-initiated** reset for another user. No self-service request/use endpoints. | Adds `authRouter.post('/request-reset', …)` at L472–488 and `authRouter.post('/use-reset', …)` at L494–517, plus `POST /users/:id/reset-password` still present. | `git show HEAD:…auth.routes.ts` (482 lines) vs working-tree file (519 lines); direct line reads | High — direct line-level evidence both sides |
| **Service import path** | No import of any password-reset service exists in `HEAD` (no such module tracked). | `auth.routes.ts` L11: `import { passwordResetTokenService } from '../password-reset-token/service.js';` → resolves to `apps/api/src/modules/password-reset-token/service.js` | Direct read of WT L11; path resolution against `apps/api/src/modules/` directory listing (13 module dirs, none named `password-reset-token`) | High — path arithmetic is deterministic |
| **Service file existence** | **No** — zero tracked paths match `password|reset`; `git cat-file -e HEAD:…services/password-reset-token.service.ts` → *"exists on disk, but not in 'HEAD'"* | File exists **at the wrong path**: `apps/api/src/services/password-reset-token.service.ts` (4,021 B). The imported path `modules/password-reset-token/` **does not exist**. | `git ls-tree -r --name-only HEAD \| Select-String 'password\|reset'` → empty; `Test-Path modules\password-reset-token` → False; recursive file scan → single candidate | High — direct filesystem + Git object checks |
| **Temporal-dead-zone risk** | Not applicable — no service file in `HEAD`. | **Present.** `usageToken` is used as `$4` in the `INSERT` parameter array at **L34**, but declared `const usageToken = uuidv4();` at **L40**. Accessing a `const` binding lexically before its declaration throws `ReferenceError: Cannot access 'usageToken' before initialization` at call time. | Direct read of the file, L31–40 | High — lexical position is unambiguous |
| **`usage_token` references** | Zero occurrences anywhere in `HEAD` (no such identifier in any tracked file). | Four sites: service L32 (`INSERT` column list) and L58 (`SELECT … WHERE usage_token = $1`); `auth.routes.ts` L479/483/486 (response field) and L495–503 (request field + call). Outside source: `scripts/fix-password-reset.js` L13 (`ALTER TABLE … ADD COLUMN IF NOT EXISTS usage_token`). | Repo-wide `Select-String` for `usage_token\|usageToken` excluding `node_modules`/`dist` | High — exhaustive text scan of tracked extensions |
| **Migration/schema support** | **None.** Migration 24 is untracked in `HEAD`, and in the live database `password_reset_tokens` does not exist at all. | Migration 24 (untracked) defines `password_reset_tokens` with columns `id, user_id, token_hash, expires_at, used_at, requested_ip, created_at` — **no `usage_token` column**. Migration is **unapplied**, so the table does not exist. | Migration 24 L10–18 read directly; `to_regclass('public.password_reset_tokens')` → NULL; ledger check §9.2 | High — schema definition and live catalogue both observed |
| **Auth router loading implication** | `routes/index.ts` contains **3** merge-conflict marker lines; `auth.routes.ts` contains **9**. The router module cannot be parsed, so the API cannot be constructed at all — **for a reason unrelated to Password Reset**. | `routes/index.ts` is clean (markers resolved). `auth.routes.ts` parses as text, but its L11 static import targets a nonexistent module. Under ESM, link-time resolution fails for the **entire** import graph, so the API still fails to load — and the failure takes down every route, not only the reset endpoints. | Marker counts from `git show HEAD:<path>` filtered on `^(<<<<<<<\|=======\|>>>>>>>)`; WT marker scan shows `routes/index.ts` clean; module directory listing | High for HEAD; High for the import defect; the exact runtime error string is **not observed** because execution is prohibited |

### 10.3 Diff magnitude — `git diff --numstat`

| File | Added | Removed |
| --- | --- | --- |
| `apps/api/src/modules/auth/auth.routes.ts` | 56 | 19 |
| `apps/api/src/modules/projects/ipc.routes.ts` | 150 | 33 |
| `apps/api/src/routes/index.ts` | 0 | 16 |
| `apps/api/src/services/authorization.service.ts` | 4 | 4 |
| `apps/api/src/middleware/auth.ts` | 0 | 9 |
| `apps/api/src/services/auth.service.ts` | 0 | 4 |
| `package/shared/src/permissions.ts` | 2 | 0 |
| `apps/web/src/lib/permissions.ts` | 1 | 35 |

The dominant pattern is **removal**: `routes/index.ts` (−16), `middleware/auth.ts` (−9), `auth.service.ts` (−4), `apps/web/src/lib/permissions.ts` (−35) are almost entirely deletions. That is the signature of conflict-marker resolution removing the duplicate side of a merge, not of feature development. The Password Reset additions (+56/−19 in `auth.routes.ts`) are a genuine feature delta sitting inside an otherwise conflict-resolving change set.

### 10.4 The `HEAD` repository is itself broken — materially new finding

`VERIFIED` by scanning every `*.ts/*.tsx/*.js/.jsx/.mjs/.cjs` blob in `HEAD` (163 candidate files) for lines beginning `<<<<<<<`, `=======`, or `>>>>>>>`:

**33 files in `HEAD` contain unresolved merge-conflict markers** — 18 under `apps/api/src`, 15 under `apps/web`.

Backend (18): `middleware/auth.ts`, `modules/auth/auth.routes.ts`, `modules/documents/documents.routes.ts`, `modules/folders/folders.routes.ts`, `modules/import/import.routes.ts`, `modules/material-requests/material-requests.routes.ts`, `modules/projects/boq.routes.ts`, `modules/projects/ipc.routes.ts`, `modules/projects/projects.routes.ts`, `modules/roles/roles.routes.ts`, `modules/sites/sites.routes.ts`, `modules/stock/stock.routes.ts`, `modules/warehouses/warehouses.routes.ts`, `routes/index.ts`, `services/auth.service.ts`, `services/authorization.service.ts`, `services/global-search.service.ts`, `services/projectScope.ts`.

Frontend (15): `App.tsx`, `components/projects/ProjectIpcsTab.tsx`, `components/ui.tsx`, `lib/permissions.ts`, `pages/AdminUsersTab.tsx`, `pages/ArchivePage.tsx`, `pages/DashboardPage.tsx`, `pages/FinancialsPage.tsx`, `pages/ItemsPage.tsx`, `pages/MaterialRequestsPage.tsx`, `pages/ProjectDetailsPage.tsx`, `pages/ProjectsPage.tsx`, `pages/StockPage.tsx`, `pages/WarehousesPage.tsx`, `tests/authz.spec.ts`.

Marker provenance is visible in the text, e.g. `>>>>>>> 22bb86216dfc3ef7502b7c36906e4665ecfd9f5e`, and the two sides differ systematically in **import specifier style** (`.js`-suffixed vs extensionless), which is consistent with 22bb862 being a NodeNext/ESM migration branch.

Working tree status of those 33 files:

- **18 backend files + `apps/web/src/lib/permissions.ts` = 19 files** now have markers resolved.
- **14 frontend files still contain markers and are byte-identical to `HEAD`** (i.e. unmodified): `App.tsx`, `components/projects/ProjectIpcsTab.tsx`, `components/ui.tsx`, `pages/AdminUsersTab.tsx`, `pages/ArchivePage.tsx`, `pages/DashboardPage.tsx`, `pages/FinancialsPage.tsx`, `pages/ItemsPage.tsx`, `pages/MaterialRequestsPage.tsx`, `pages/ProjectDetailsPage.tsx`, `pages/ProjectsPage.tsx`, `pages/StockPage.tsx`, `pages/WarehousesPage.tsx`, `tests/authz.spec.ts`.

Marker density varies sharply — `ArchivePage.tsx` (51 marker lines), `MaterialRequestsPage.tsx` (39), `DashboardPage.tsx` (27), `App.tsx` (21), `ProjectDetailsPage.tsx` and `ProjectsPage.tsx` (18 each), `StockPage.tsx` (12), `ProjectIpcsTab.tsx` (6), and several with 3.

**Why this matters:** any statement of the form "the API cannot boot" is true for `HEAD`, but the previously recorded *reason* (a missing module at runtime) is wrong for `HEAD`. At `HEAD` the failure is a **parse/syntax failure inside the committed tree**. The missing-module failure belongs exclusively to the working tree. These are different defects with different remedies, and conflating them would misdirect the repair.

### 10.5 Design-level assessment of the candidate implementation

Separating design from execution (per `auth-implementation-patterns` and `broken-authentication`):

**Sound in design:**

- Hash-only storage (`token_hash VARCHAR(64) UNIQUE`, SHA-256 hex) — raw token never persisted.
- Bounded TTL (15 minutes) and single-use marking via `used_at`.
- One-active-token policy: prior unused tokens are deleted before issuing a new one.
- Enumeration resistance: `/request-reset` returns a generic success with a null token when the username is unknown.
- Session revocation after a successful reset (`sessionService.revokeAllForUser`, which exists and accepts the right shape).
- Generic client-facing errors that do not reveal expired vs invalid vs used.
- `userRepository.update(id, { passwordHash })` is a real, compatible API (`user.repository.ts` L38, L45).
- `auditService.log(...)` is a real method (`audit.service.ts` L61) and is called with a plausible shape.

**Broken in execution (four independent blockers):**

1. **Import path** — `'../password-reset-token/service.js'` does not exist; the real file is `src/services/password-reset-token.service.ts`.
2. **Invalid TypeScript** — `ValidateResult` at L12–13:
   `export interface ValidateResult { valid: true; userId: string } | { valid: false; reason: … };`
   A union type cannot appear inside/after an `interface` body. This is a syntax error, so the file cannot be transpiled.
3. **Temporal dead zone** — `usageToken` used at L34, declared at L40.
4. **`rawToken` never returned** — `store()` generates `rawToken` (L26) and returns only `{ usageToken, expiresAt }` (L42–45). `/use-reset` requires the client to supply `rawToken`. Since the raw token is never disclosed to any client, `validateAndMarkUsed(usageToken, rawToken)` will always hit the `if (!rawToken)` branch (L76) and return `{ valid: false, reason: 'invalid' }`. **The reset flow is unusable by construction even if it compiled.**

Plus a fifth, dependency-level blocker: `import { v4 as uuidv4 } from 'uuid'` — `uuid` is **not declared** in `apps/api/package.json`, is **not installed** in `apps/api/node_modules`, and is **not hoisted** to the workspace root. This is the *only* file in `apps/api/src` that imports `uuid`; the rest of the codebase uses `createId()` from `apps/api/src/shared/id.ts`, which wraps `randomUUID` from `node:crypto`.

### 10.6 Underlying schema would still fail first

Because `password_reset_tokens` **does not exist** (§8.5), even a repaired service would fail before reaching any `usage_token` column error: both the `DELETE` at L21–24 and the `INSERT` at L31–35 would raise relation-not-found. The `usage_token` column mismatch (§12) is therefore a **second-order** defect, not the first one encountered.

---

## 11. Import resolution and static loading analysis

**Outcome: the entire API module graph is unloadable in both versions, for different reasons.**

### 11.1 Resolution path arithmetic

`apps/api/src/modules/auth/auth.routes.ts` L11 specifies `'../password-reset-token/service.js'`.

- Base directory: `apps/api/src/modules/auth/`
- `../` → `apps/api/src/modules/`
- Resolved target: `apps/api/src/modules/password-reset-token/service.js`

Directory listing of `apps/api/src/modules/` contains exactly 13 entries: `auth`, `config`, `documents`, `folders`, `import`, `items`, `material-requests`, `projects`, `roles`, `sites`, `stock`, `system`, `warehouses`. **No `password-reset-token`.**

The only implementation on disk is `apps/api/src/services/password-reset-token.service.ts`. A correct specifier from `auth.routes.ts` would be `'../../services/password-reset-token.service.js'`. Both the directory and the filename differ from the current specifier.

### 11.2 Why the blast radius is the whole application

`apps/api/package.json` declares `"type": "module"`. Under ESM:

1. The loader builds the full module graph by resolving every static `import` **before** executing any module body.
2. A specifier that cannot be resolved aborts linking with `ERR_MODULE_NOT_FOUND`.
3. Therefore one bad import in `auth.routes.ts` prevents the process from constructing **any** route, not merely the reset routes.

Chain of consequence:

```
server.ts
  └── app.ts                     (imports routes/index.js at L7; calls runMigrations() at L18; mounts at L40)
        └── routes/index.js      (imports auth.routes.js)
              └── auth.routes.ts (L11 → './password-reset-token/service.js' — UNRESOLVABLE)
```

So a single unresolved specifier in a leaf-ish module severs `app.ts` → `apiRouter` → every `router.use(...)` in `routes/index.ts`.

### 11.3 Router mounting facts (`VERIFIED`)

- `routes/index.ts` exports `apiRouter` and mounts `apiRouter.use('/auth', authRouter)`.
- `auth.routes.ts` exports `authRouter` (WT L81), `usersExtRouter` (WT L253), and `usersRouter` (WT L150, exported at L519) — matching `HEAD` shapes at L93 / L269 / L482.
- `app.ts` imports `apiRouter` at L7, awaits `runMigrations()` at L18, and mounts `app.use('/api', apiRouter)` at L40.
- `runMigrations()` also has a standalone invocation at `migrate.ts` L76, so the migration runner is reachable outside server boot — but it is not invoked by WP-0.1.

The route exports are consistent between versions, so the Password Reset additions do not disturb the export surface. The failure is purely in resolution and syntax.

### 11.4 Three independent load failures, correctly attributed

| Version | Failure | Evidence | Consequence |
| --- | --- | --- | --- |
| `HEAD` | Unresolved merge-conflict markers in 33 files, including `routes/index.ts` (3 marker lines) and `auth.routes.ts` (9) | `git show HEAD:<path>` marker scan | Parse failure in committed tree. API cannot be constructed. **Unrelated to Password Reset.** |
| Working tree (backend) | `ERR_MODULE_NOT_FOUND` for `modules/password-reset-token/service.js` | Path arithmetic + directory listing | Link failure. API cannot be constructed. Affects **all** routes. |
| Working tree (frontend) | 14 files still carry markers (`App.tsx` 21, `ArchivePage.tsx` 51, etc.) | Working-tree marker scan; `git status` shows all 14 unmodified | Web build cannot succeed; independent of the API. |

Two further defects would still block the backend even if the specifier were corrected: the invalid `ValidateResult` declaration and the undeclared `uuid` dependency. Both are `VERIFIED` from file bytes and package metadata.

### 11.5 What is NOT claimed

- No runtime error string was observed. Naming `ERR_MODULE_NOT_FOUND` is a statement about ESM semantics plus the *prior* WP-0 observation, not a fresh execution result. Execution is prohibited.
- No claim is made about whether the built `dist/` output exists or is stale. `dist/` was excluded from scans and is **NOT VERIFIED**.
- No claim is made that fixing the import would make the API boot; the other four defects would still fire.

---

## 12. `usage_token` schema compatibility

**Outcome: the column does not exist in any schema definition, and the table itself does not exist in the live database.**

### 12.1 Where `usage_token` appears

Exhaustive scan for `usage_token` / `usageToken` across `*.ts`, `*.tsx`, `*.sql`, `*.js` (excluding `node_modules`, `dist`, `build`):

| Location | Line | Role |
| --- | --- | --- |
| `apps/api/src/services/password-reset-token.service.ts` | L32 | Column in `INSERT INTO password_reset_tokens (…)` |
| `apps/api/src/services/password-reset-token.service.ts` | L58 | Predicate in `SELECT … WHERE usage_token = $1` |
| `apps/api/src/modules/auth/auth.routes.ts` | L471, L491 | Doc comments |
| `apps/api/src/modules/auth/auth.routes.ts` | L479, L483, L486 | Response field `usageToken` |
| `apps/api/src/modules/auth/auth.routes.ts` | L495–503 | Request field `usageToken` + call argument |
| `scripts/fix-password-reset.js` | L13 | `ALTER TABLE password_reset_tokens ADD COLUMN IF NOT EXISTS usage_token VARCHAR(255)` |

No occurrence exists in any migration file, and none exists in `HEAD`.

### 12.2 Schema definition vs code expectation

| Aspect | Migration 24 (definition) | Service (expectation) | Match |
| --- | --- | --- | --- |
| Table | `password_reset_tokens` | `password_reset_tokens` | ✅ |
| `id` | `UUID PK DEFAULT uuid_generate_v4()` | supplied as `$1` (`uuidv4()`) | ⚠️ supplied explicitly; DEFAULT unused |
| `user_id` | `UUID NOT NULL REFERENCES users(id)` | `$2` | ✅ |
| `token_hash` | `VARCHAR(64) NOT NULL UNIQUE` | `$3` (SHA-256 hex, 64 chars) | ✅ |
| `usage_token` | **absent** | `$4` + `WHERE usage_token = $1` | ❌ **no such column** |
| `expires_at` | `TIMESTAMPTZ NOT NULL` | `$5` (JS `Date`) | ✅ |
| `requested_ip` | `VARCHAR(45)` | `$6` | ✅ |
| `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT NOW()` | `$7` (`nowIso()`) | ⚠️ explicit value shadows the default — harmless |

So the service's column list has 7 entries and the schema has 7 entries, but the sets are **not** the same: the schema has 6 of the service's 7 plus a differently-named/absent column. Concretely, the service binds 7 parameters to a table that would accept 6 — a mismatch that would produce `column "usage_token" of relation "password_reset_tokens" does not exist`.

### 12.3 Live database state — the error the code would actually hit first

| Check | Result |
| --- | --- |
| `to_regclass('public.password_reset_tokens')` | **NULL** — table absent |
| Migration 24 ledger entry | Absent (§9.2) |

Therefore the first error encountered at runtime would be **relation-not-found on the table**, not the column mismatch. The `usage_token` incompatibility is real but second in the failure order.

### 12.4 `scripts/fix-password-reset.js` — why it would not have fixed anything

`VERIFIED` by direct read (26 lines). Characteristics, all material to the reconciliation:

| Property | Finding |
| --- | --- |
| Purpose | `ALTER TABLE password_reset_tokens ADD COLUMN IF NOT EXISTS usage_token VARCHAR(255)` |
| Target cluster | **PostgreSQL 17** on `127.0.0.1:5433` — the candidate **excluded** in §7.2 |
| Target database | `cos_stage2_populated_dryrun` — **not** `cos_db`, and not among the databases observed on the verified target (`cos_authz_unit`, `cos_db`, `postgres`) |
| Target user | `postgres` (not `cos`) |
| Credential in file | Plaintext password embedded in source (scheme/user/host/port/database are connection metadata; the password value is **withheld**). Its very presence is a finding. |
| Syntax validity | **Invalid.** L17 contains **2 literal backslash characters** wrapping the template-literal backticks: `await pool.query(\`SELECT … \`);`. A backslash-escaped backtick outside a string is a syntax error, so the file cannot be parsed or run. |
| Tracked? | No — untracked in the working tree |

Net: the pre-existing repair attempt targeted the wrong cluster and the wrong database, and could not execute. It is a **historical artefact**, not a step in the current state, and it is not evidence that `usage_token` was ever intended by the schema.

### 12.5 Compatibility conclusion

| Statement | Label |
| --- | --- |
| `usage_token` is absent from every migration definition | `VERIFIED` |
| `usage_token` exists only in the candidate service, its route, and an unrunnable repair script | `VERIFIED` |
| The live table does not exist, so no column can exist | `VERIFIED` |
| The service/route pair cannot be reconciled with the committed schema without a schema change | `VERIFIED` |
| Whether a `usage_token` column *should* be added (and whether the token design should instead return the raw token) | **NOT IN SCOPE** — design decision, not a WP-0.1 finding |
| Whether applying migration 24 is safe/authorised | **NOT IN SCOPE** |

---

## 13. WP-0 findings reconciliation

WP-0 was delivered as `WP-0 PARTIALLY VERIFIED — DATABASE OR SOURCE LIMITATIONS`, 83,172 B / 1,159 lines, 16 sections, untracked.

**Scope of this reconciliation:** WP-0 §7.2, §11, §12.1–§12.5, and the final verdict were re-read and cross-checked. WP-0 sections **not** re-read are explicitly marked **NOT REVALIDATED** and retain their WP-0 status unchanged.

### 13.1 Reconciliation table

| WP-0 finding | WP-0 status | WP-0.1 status | Change and basis |
| --- | --- | --- | --- |
| **BLOCKER-5** — "PostgreSQL client unavailable" | BLOCKED | **NARROWED — client was never missing** | `psql.exe` exists at `C:\Program Files\PostgreSQL\18\bin\psql.exe` (v18.4) and at the PG 17 bin dir. It is simply **not on `PATH`**. The blocker was an invocation-path problem, not a missing tool. `VERIFIED` (§6.6). |
| **§12.1** — "API cannot boot" | Asserted, reason = missing module | **RESTATED — two distinct failures** | At `HEAD` the API fails to parse because **33 files carry merge-conflict markers** (18 backend, 15 frontend), including `routes/index.ts` (3 marker lines) and `auth.routes.ts` (9). The missing-module failure belongs **only** to the working tree (`ERR_MODULE_NOT_FOUND` on `modules/password-reset-token/service.js`). `VERIFIED` (§10.4, §11.4). |
| **§7.2** — `ipcs.approve` / `ipcs.resubmit` are "vocabulary only", assigned to no role; distribution unresolved (D1) | PARTIALLY VERIFIED (source-only) | **UPGRADED TO VERIFIED (database-backed)** | Direct query confirms: no role among all 5 carries either key; `user_permission_overrides` (28 rows, 28 distinct keys) carries no `ipcs.*` key; no `ipcs.*` prefix exists across any role. Consequence is now a database fact, not a source reading. **D1 remains unresolved** — no assignment was made or suggested. (§8.4) |
| **§7.2** — resubmit route is effectively optional because `ipcs.resubmit` OR `projects.edit` | PARTIALLY VERIFIED | **RETAINED, with added DB nuance** | Working tree uses `requireAnyProjectAccess(['ipcs.resubmit','projects.edit'])`; because `projects.edit` *is* granted to several roles while `ipcs.resubmit` is granted to none, the OR-branch fully determines behaviour. The approve/reject paths, gated on `ipcs.approve` alone, deny **everyone**. Not repaired; owner decision. (§8.4, §10.5) |
| **§11** — migration state / ledger unresolved or partially inferred | PARTIALLY VERIFIED | **UPGRADED TO VERIFIED** | Ledger read directly: 19 rows, ids 1–19, last `21_direct_amounts.sql`. Disk holds 22 files. 22/23/24 unapplied; no orphan ledger rows. (§9.2–9.3) |
| **§11** — `password_reset_tokens` state | Unresolved | **VERIFIED ABSENT** | `to_regclass` → NULL. Dependent on unapplied migration 24. (§8.5) |
| Database identity as a whole | PARTIALLY VERIFIED / limitations | **VERIFIED for the configured target** | 5432 = PostgreSQL 18.4 / `cos_db` / `cos`, read-only confirmed; 5433 = PG 17, credentials rejected. (§7) |
| **RBAC keys `roles.manage` / `projects.access` / `users.resetPassword`** | Noted as enforced but not administrable | **RETAINED, now DB-confirmed** | Present in the `admin` role's array, absent from every other role, and absent from `ALL_PERMISSIONS` in `packages/shared/src/permissions.ts`. So they are *enforceable* from DB data while *unadministrable* through the shared vocabulary. Unchanged by WP-0.1; recorded, not fixed. |
| Runtime behaviour of any kind | Not established | **Still not established — `BLOCKED` by design** | No API start, no build, no test run. No WP-0 runtime claim is upgraded. (§7.4) |
| WP-0 §4–§6, §8–§10, §13–§16 | Various | **NOT REVALIDATED** | Outside WP-0.1 scope; WP-0 statuses stand as written. No silent upgrades. |

### 13.2 Items explicitly NOT upgraded

- WP-0's overall verdict is **not** upgraded. `PARTIALLY VERIFIED` is retained at the package level even though several individual findings now have direct evidence.
- No finding is marked `VERIFIED` on the strength of source reading alone.
- No WP-0 finding outside the §7.2 / §11 / §12.1–§12.5 / verdict set was touched.

---

## 14. Unresolved questions and blockers

| # | Question / blocker | Status | Why unresolved | What would resolve it |
| --- | --- | --- | --- | --- |
| Q1 | Does the intended deployment require migrations 22–24 applied, or is 19-of-22 the deliberate production state? | **OPEN — owner decision** | Answering requires either a documented deployment policy or applying migrations. Both are out of scope. | Owner statement of intended ledger state, or an authorised migration run. |
| Q2 | Should `ipcs.approve` / `ipcs.resubmit` be granted to any role? (carried D1) | **OPEN — owner decision** | WP-0 and WP-0.1 both prohibit assignment. | Owner assignment decision; permission data change. |
| Q3 | Was `apps/api/.env`'s 5432 target ever used by a running API? | **BLOCKED** | Requires execution or log forensics that WP-0.1 will not assert from modified log files. | Authorised runtime verification run. |
| Q4 | Which topology is authoritative — the native 5432 install or the documented Docker 5433? | **OPEN — documentation contradiction** | `.env.example` / `docker-compose.yml` say 5433/Docker/PG16; the live config says 5432/native/PG18. WP-0.1 verified what is configured, not what is intended. | Owner decision on deployment topology; documentation alignment. |
| Q5 | Is `cos_authz_unit` (on the verified instance) in use? | **UNKNOWN** | Not inspected beyond existence/size. Read-only inspection of its contents was not necessary for WP-0.1's questions. | Scoped follow-up if RBAC unit-test isolation matters. |
| Q6 | Does `dist/` exist, and is it stale? | **NOT VERIFIED** | Excluded from scans; inspecting it was not required and could mislead about the runtime target. | Authorised build inspection. |
| Q7 | Is the Password Reset feature intended at all, and in what shape? | **OPEN — design decision** | Four independent execution blockers plus an absent table and an undeclared dependency. Choosing between "fix the import", "add a column", "return the raw token", or "abandon the feature" is design work. | Owner decision, then a scoped implementation work package. |
| Q8 | How should the 14 frontend files with unresolved markers be handled? | **OPEN — out of scope** | Conflict resolution is a code change. | A dedicated conflict-resolution work package. |
| Q9 | `scripts/fix-password-reset.js` contains a plaintext credential and targets the wrong cluster/DB. | **OPEN — security hygiene finding** | Removing or rotating the credential is a mutation. | Owner-led credential rotation and file removal. |

No blocker prevented WP-0.1 from completing its two assigned goals. Q3 and Q6 are blockers *by design*, not by accident.

---

## 15. Evidence index

### 15.1 Commands executed (read-only), with what each established

| # | Command class | Established |
| --- | --- | --- |
| E1 | `git -C <root> rev-parse --abbrev-ref HEAD` / `rev-parse HEAD` / `log -1` | Branch `main`, HEAD `f91ed2f`, commit date and subject (§3) |
| E2 | `git status --porcelain=v1`, `diff --cached --name-status`, `stash list` | 46 / 0 / 0 baseline and final (§3) |
| E3 | `git ls-files docs`, `ls-files --others --exclude-standard docs` | `docs/` fully untracked; 350 untracked paths; 1 collapsed porcelain entry (§3.1) |
| E4 | `git ls-tree -r --name-only HEAD` filtered on `password|reset` | Zero tracked Password Reset paths (§10.2) |
| E5 | `git cat-file -e HEAD:<path>` | Service file present on disk but absent from `HEAD` (§10.2) |
| E6 | `git show HEAD:<path>` piped to marker regex `^(<<<<<<<|=======|>>>>>>>)` | 33 HEAD files with markers; per-file marker counts (§10.4) |
| E7 | `git diff --numstat` on 8 key files | Exact add/remove counts (§10.3) |
| E8 | `git diff -U3` on `auth.routes.ts`, `routes/index.ts`, `authorization.service.ts`, `middleware/auth.ts`, `auth.service.ts`, both `permissions.ts` | Nature of each hunk; import-specifier conflict sides (§10, §11) |
| E9 | `Get-Service postgresql-x64-*` | Both services Running/Automatic, with `-D` data dirs (§6.1) |
| E10 | `Get-Process postgres`, `Get-CimInstance Win32_Process` | 19 processes, roots 8220 and 8248, blank `ExecutablePath`/`CommandLine` (§6.2) |
| E11 | `Get-NetTCPConnection` on 5400–5600 | 5432 ← 8220, 5433 ← 8248; no other listeners (§6.3) |
| E12 | Read `postmaster.pid` (both data dirs), `PG_VERSION`, `postgresql.conf` | Cluster attribution table (§6.4) |
| E13 | `pg_ctl status -D <datadir>` | Exit 3 for both — recorded as artefact, not evidence (§6.5) |
| E14 | `Get-Command psql`, `<abs>\psql.exe --version` | Not on PATH; client v18.4 (§6.6) |
| E15 | In-memory parse of `apps/api/.env` `DATABASE_URL` + root `.env` | Scheme/host/port/db/user, password presence and length only (§5) |
| E16 | `psql` auth attempt against 5433 with configured credentials | `FATAL: password authentication failed for user "cos"`, exit 2 → candidate excluded (§7.2) |
| E17 | `psql` identity query on 5432 | `cos_db` / `cos` / 5432 / `transaction_read_only=on` / 18.4 / `::1` / start time (§7.3) |
| E18 | `psql` DB + schema inventory | `cos_authz_unit`, `cos_db`, `postgres`; `public` only (§8.1–8.2) |
| E19 | `psql` table inventory + sizes | 27 tables (§8.3) |
| E20 | `psql` `_migrations` count/min/max + top 3 by id | 19 rows, 1–19, last `21_direct_amounts.sql` (§9.2) |
| E21 | `psql` `to_regclass` for `password_reset_tokens`, `ipc_status_events`, `backups` | All NULL → all absent (§8.5) |
| E22 | `psql` `information_schema.columns` for `users`, `projects`, `roles`, `user_permission_overrides` | Column sets; missing `department`/`title`/`deleted_at`/`deleted_by` (§8.4–8.5) |
| E23 | `psql` `pg_get_constraintdef` on `ipcs` CHECK constraints | `ipcs_status_check` excludes `under-review` (§8.5) |
| E24 | `psql` role permission predicates (`= ANY(permissions)`) | No role holds `ipcs.approve`/`ipcs.resubmit`; three admin keys admin-only (§8.4) |
| E25 | `psql` distinct `permission_key` from overrides | 28 rows / 28 distinct keys; no `ipcs.*` (§8.4) |
| E26 | `psql` distinct permission prefixes across roles | 10 prefixes; no `ipcs` (§8.4) |
| E27 | Repo-wide `Select-String` for `usage_token|usageToken` and `password_reset_tokens` | Exhaustive reference list (§12.1) |
| E28 | Recursive filename scan for `*password*` / `*reset*` under `apps/api/src` | Single candidate service file (§10.2) |
| E29 | Directory listing of `apps/api/src/modules/` | 13 dirs; no `password-reset-token` (§11.1) |
| E30 | `Select-String` on `apps/api/package.json`; `Test-Path node_modules\uuid`; root `node_modules\uuid` | `uuid` undeclared, uninstalled, unhoisted (§11.4) |
| E31 | Working-tree marker scan over 6 source extensions (excluding `node_modules`, `dist`, `build`) | 14 remaining files with markers (§10.4) |
| E32 | `git status --porcelain=v1 -- <each of the 14>` | All 14 byte-identical to `HEAD` (§10.4) |
| E33 | Migration directory file listing | 22 `.sql` files, runner order (§9.3) |
| E34 | Read `migrate.ts` | `localeCompare` ordering, per-file transaction, ledger insert, invocation sites (§9.1) |
| E35 | Read migrations 22/23/24 | DDL content and guarantees (§9.4–9.6) |
| E36 | Read `password-reset-token.service.ts` (95 L) in full | TDZ, invalid interface, `rawToken` non-disclosure, `uuid` import (§10.5, §12) |
| E37 | Read WT `auth.routes.ts` L465–519 and L11 | Reset endpoint bodies and import specifier (§10.2) |
| E38 | Read `user.repository.ts`, `session.service.ts`, `audit.service.ts` signatures | Downstream helpers exist and are compatible (§10.5) |
| E39 | Read `app.ts` in full, `routes/index.ts` (HEAD + WT) | Mount chain and `runMigrations()` on boot (§11.3) |
| E40 | Read `scripts/fix-password-reset.js`; backslash/backtick count on L17 | Wrong cluster/DB, plaintext credential (redacted), invalid syntax (§12.4) |

### 15.2 Files read (primary sources)

- `apps/api/.env` (structure only), root `.env` (structure only)
- `apps/api/src/database/connection.ts`, `migrate.ts`
- `apps/api/src/app.ts`, `src/server.ts`, `src/routes/index.ts`
- `apps/api/src/modules/auth/auth.routes.ts` (HEAD and WT)
- `apps/api/src/modules/projects/ipc.routes.ts` (HEAD and WT)
- `apps/api/src/services/password-reset-token.service.ts` (untracked)
- `apps/api/src/services/authorization.service.ts`, `auth.service.ts`, `audit.service.ts`, `session.service.ts`
- `apps/api/src/middleware/auth.ts`
- `apps/api/src/repositories/user.repository.ts`
- `apps/api/src/shared/id.ts`, `shared/time.ts`
- `apps/api/src/database/migrations/22_…sql`, `23_…sql`, `24_…sql`
- `apps/api/package.json`, root `package.json`, `package-lock.json` (metadata only)
- `packages/shared/src/permissions.ts`
- `apps/web/src/lib/permissions.ts`
- `docker-compose.yml`
- `scripts/fix-password-reset.js` (untracked)
- `apps/api/tests/migration.phase14.test.ts` (header only, untracked)
- `docs/frontend-rebuild/phase-14/phase-14c/WP0_BACKEND_REBASELINE_AND_DATABASE_READONLY_VERIFICATION.md` (§7.2, §11, §12.1–§12.5, verdict)

### 15.3 Report location

`docs/frontend-rebuild/phase-14/phase-14c/WP0_1_POSTGRESQL_TARGET_AND_WORKING_TREE_HEAD_RECONCILIATION.md`

Directory already existed (14 prior reports). No directory was created.

### 15.4 Secret-handling attestation

- No password, token, connection string with embedded credentials, JWT secret, or private key appears in this report.
- `DATABASE_URL` is characterised by scheme/host/port/database/user and by the *presence and length* of a password — never the value.
- The pre-existing plaintext credential in `scripts/fix-password-reset.js` is described structurally and **redacted**; it was never printed to terminal output during WP-0.1.
- All `PG*` environment variables were removed from the process environment after each database call.

### 15.5 Temp-file attestation

No helper scripts, temporary files, logs, exports, or snapshots were created inside the repository. No temp artefacts were created outside it either; nothing required cleanup.

---

## 16. Final verdict and recommended next decision

### 16.1 Verdict

**`WP-0.1 PARTIALLY VERIFIED — DATABASE IDENTITY AND LEDGER VERIFIED; RUNTIME PROHIBITED`**

Justification for the label:

- The **configured target is fully identified and its identity verified** with direct evidence, and the competing candidate is definitively excluded. This is stronger than WP-0 achieved.
- The **runtime target remains unknown**, and this is by design: the envelope prohibits starting the API. A claim about runtime would be an overstatement, so the package as a whole is not `VERIFIED`.
- The **Password Reset reconciliation is complete** and conclusive: the feature exists only in the working tree, does not resolve, does not compile, and cannot execute even if repaired at the import level.
- A **materially new finding** — 33 files of unresolved conflict markers inside committed `HEAD` — reframes all previous "API cannot boot" statements and is the single most consequential discovery of this package.

### 16.2 What WP-0.1 changes in the project's understanding

1. **The database question is closed.** There is no ambiguity left about which PostgreSQL instance the configuration means, and the 5433 confusion is now explained: it is a second, separate PG 17 cluster on loopback that rejects the configured credentials. The `.env.example` / `docker-compose.yml` 5433 guidance is a documented contradiction, not the operative target.
2. **The ledger contradiction is no longer an inference.** 22 files, 19 applied, 22/23/24 outstanding, and three named tables/columns confirmed absent from the live catalogue.
3. **`HEAD` is not stale — it is syntactically broken.** Previous language attributed the boot failure to a missing module. That is true only of the working tree. At `HEAD`, conflict markers prevent parsing in 33 files.
4. **The Password Reset work is not merely unfinished.** It has four independent execution-level defects plus an undeclared dependency, and its table does not exist.
5. **The IPCS approval vocabulary has no teeth.** No role and no override carries `ipcs.approve` or `ipcs.resubmit`, so those gates deny everyone; and even if granted, `under-review` cannot be persisted because the live `CHECK` constraint rejects it.

### 16.3 Recommended next decision (for owner review — not authorised by this report)

Presented as a decision, not a work order. The ordering reflects dependency, not priority preference.

| # | Decision needed | Why it must be decided first |
| --- | --- | --- |
| D-1 | **Confirm the authoritative deployment topology** — native PG 18 on 5432 (what runs) vs the documented Docker PG 16 on 5433 (what `.env.example`/compose describe) | Every migration, RBAC and schema conclusion in this report is scoped to the 5432 instance. If the intended topology is the Docker one, the ledger and schema findings must be re-established there. |
| D-2 | **Confirm the intended migration ledger state** — is 19-of-22 correct, or should 22/23/24 be applied? | `password_reset_tokens`, `ipc_status_events`, `users.department/title`, `projects.deleted_at` and `under-review` all depend on this single answer. |
| D-3 | **Decide the fate of the Password Reset feature** — abandon, or authorise a scoped implementation package | Four defects plus an absent table plus an undeclared dependency mean "fix in passing" is not realistic. |
| D-4 | **Decide whether `HEAD`'s 33 conflict-marker files get a dedicated resolution package** | Until `HEAD` parses, no runtime verification of any backend behaviour is possible, which caps what any later package can prove. |
| D-5 | **Resolve D1 (carried)** — role assignment for `ipcs.approve` / `ipcs.resubmit` | Approve/reject are currently dead gates; resubmit is de facto governed by `projects.edit`. |
| D-6 | **Handle the exposed credential** in `scripts/fix-password-reset.js` | A plaintext credential in an untracked repo file targeting the wrong cluster. |
| D-7 | **Authorise (or decline) a runtime verification package** | The only remaining gap between `PARTIALLY VERIFIED` and `VERIFIED` is runtime, and it requires execution. |

### 16.4 Explicit non-authorisation

This report documents state. It does **not** authorise:

- WP-1 or any successor work package;
- Password Reset repair or implementation;
- API startup, build, or runtime testing;
- any PostgreSQL service, configuration, or version change;
- any migration, seed, backfill, or data change;
- any RBAC change or permission assignment;
- any document transition policy;
- any frontend/backend integration;
- any implementation of the recommendations above.

**WP-0.1 is complete. Awaiting explicit owner review.**

---

*End of report.*
