# Phase 12 — WP-03 Isolated PostgreSQL 18 Container Execution Proposal

**Status:** `PROPOSED — NOT AUTHORIZED — DOCUMENTATION ONLY — PHASE 12 REMAINS OPEN`

**Repository:** `D:\Default Project\company-ops-system`
**Branch:** `main`
**HEAD:** `f91ed2f9e81db3937e3bcbb1b44e5e2c44e175cf`
**Remote:** `https://github.com/mamin144/company-ops-system.git`
**Date:** `2026-11-05`

This document is an **execution proposal** for work package `WP-03` (isolated PostgreSQL 18 environment provisioning under the container approach selected by owner decision `D-I` / option `I3`). It describes *how* `WP-03` could be executed safely **after** a separate, explicit provisioning authorization is granted. It does **not** authorize, start, or perform any provisioning.

**Every fact about the actual host in this document is classified `UNKNOWN — NOT INSPECTED`.** No container runtime, service, image, volume, port, or database was queried, pulled, created, or connected to while producing this document.

---

## 1. Purpose, scope, and document classification

### 1.1 Purpose

`D-I` selected the *approach* (`I3 — Approved isolated PostgreSQL 18 Container`). Per R-138 §9.1, a decision of approach "does **not** create an environment." Between the decision and any provisioning there must be:

1. a **separate explicit provisioning execution authorization** (R-138 §9.6, WP-03 prerequisites), and
2. an agreed, reviewable plan for what the provisioned environment must prove (condition-1 evidence).

This document supplies item (2) and records the exact gate for item (1).

### 1.2 In scope

- Definition of the isolated environment `WP-03` would create (container design, naming, isolation boundaries).
- Image-selection rules, with the exact tag/digest deferred to authorized implementation.
- The condition-1 evidence checklist the environment must satisfy.
- A staged procedure (`A`–`E`) for a future authorized execution session, every command marked `PROPOSED — NOT EXECUTED`.
- The `R-138` dependency/authorization table for `WP-03` → `WP-04` → `WP-05`.
- Risk register, non-actions, and the stop report.

### 1.3 Out of scope (explicitly not performed and not proposed as performed here)

- Provisioning, container creation, image pull, runtime inspection, service or Task Scheduler inspection.
- Database connections, queries, migrations, backup, or restore.
- Production access of any kind; reading `.env` or any secret.
- Tests, builds, typechecks, lint, scripts.
- Git writes (stage, commit, push, branch, tag, reset, stash, clean).
- Reading or modifying application source code.
- Modification of any existing file (including `R-132`…`R-138`, the `D-I` addendum, `docker-compose.yml`, `Dockerfile.api`, `Dockerfile.web`).
- Creation of any Compose file, Dockerfile, script, or auxiliary artifact. **Exactly one new file** is created: this document.

### 1.4 Document classification

| Field | Value |
|---|---|
| Document type | Execution proposal (planning artifact) |
| Authorization produced | **None** |
| Authorization required before execution | Separate, explicit **provisioning execution authorization** for `WP-03` |
| Commands in §9 | `PROPOSED — NOT EXECUTED` |
| Work-package status | `WP-03 — PROPOSED — NOT AUTHORIZED` |
| Condition 1 status | `NOT MET` (unchanged; no isolation evidence exists yet) |

---

## 2. Controlling records and unchanged facts

This proposal is subordinate to and consistent with the following records, none of which it modifies:

| Record | What it controls here | Status |
|---|---|---|
| `phase-12-owner-decision-addendum-d-i-i3.md` | `D-I = DECIDED — I3 SELECTED`; execution `NOT AUTHORIZED`; owner-identifying fields intentionally blank | Unmodified |
| `phase-12-r137-identifier-and-dependency-integrity-correction-r138.md` §9, §11, §13 | Controlling dependency/authorization model; four non-interchangeable concepts; WP prerequisites; status preservation | Unmodified |
| `phase-12-final-evidence-and-owner-decision-pack-r136.md` E.9 / F / G / H / I.9, Section C | `D-I` option set and recommendation; conditions 1–15 statuses; archive provenance and reader-compatibility facts; authorization matrix (no action authorized) | Unmodified |
| `phase-12-stage-2b-report.md` | The `0xC0000142` local-provisioning failure record and the "do not repeat without diagnostic justification" instruction | Unmodified |
| `phase-12-stage-2c-production-readiness-gap-assessment.md` | PG18 compatibility gap; container test-strategy decision tree; unknowns classification | Unmodified |
| `docker-compose.yml` (read as read-only text) | Existing stack identifiers that `WP-03` must **not** collide with (§6.2) | Unmodified |

**Facts carried forward unchanged (not re-derived, not re-verified here):**

- Phase 12 verdict: `BLOCKED — ADDITIONAL EVIDENCE REQUIRED — PHASE 12 REMAINS OPEN`.
- All fifteen condition statuses in R-136 Section D remain as recorded; condition 1 is `Not met`.
- All owner decisions `D-A` … `D-I` keep their recorded statuses. **`D-A` remains `PENDING OWNER DECISION`.**
- The local isolated-cluster provisioning attempts (PG17/PG18) failed with `0xC0000142` (`STATUS_DLL_INIT_FAILED`) during worker initialization (Stage 2B).
- Repository archives are `PGDMP` format `1.16.0`, header `18.4` (R-136 Section C / C.4). The repository's own restore path uses a PG16 client via `postgres:16-alpine`, which **rejects** these archives (Case A). The version-consistent path requires a **PG18+ client and a PG18+ target server**.
- The local host has PostgreSQL 18 binaries under `C:\Program Files\PostgreSQL\18\bin\` and an operational PostgreSQL 18 service (Stage 2B/2C, as cited there). That service and its data directory are **outside** this proposal's boundary and must not be touched.

---

## 3. Authorization state — what `D-I` does and does not authorize

R-138 §9 separates four non-interchangeable concepts: **owner decision**, **execution authorization**, **completed technical activity**, and **accepted exit-condition evidence**. None implies another. Applied to this proposal:

| Question | Answer |
|---|---|
| Has the owner chosen the environment approach? | **Yes** — `D-I = DECIDED — I3 SELECTED` (decision only) |
| Does that choice authorize provisioning? | **No** — `D-I` "is **not** provisioning authorization" (R-138 §9.1) |
| Is the separate provisioning authorization granted? | **No** — `NOT MET` / not granted as of this document |
| May `WP-03` run now? | **No** — `WP-03` is `PROPOSED — NOT AUTHORIZED` |
| Does this proposal grant anything? | **No** — it is documentation only |
| What unlocks `WP-03`? | An explicit, separate **provisioning execution authorization** naming `WP-03`, granted after owner review of this proposal |
| What does `WP-04` need? | `WP-03` completed + condition 1 accepted + a **separate test execution authorization** |
| What does `WP-05` need? | `D-A` (still `PENDING OWNER DECISION`) + condition 1 / isolated target + named archive + compatible client/target + a **separate restore execution authorization**; condition 2 is **soft/recommended**, not a hard prerequisite |
| Does `D-I` or this proposal imply restore permission? | **No** — no direct `D-I`→restore edge exists (R-138 §9.2/§9.3) |

**Gate statement:** nothing in this document may be executed until a separate provisioning execution authorization is recorded. Recording that authorization is an owner action, not an outcome of reading this proposal.

---

## 4. Host and runtime facts — `UNKNOWN — NOT INSPECTED`

No host inspection was performed for this document. Every row below is classified `UNKNOWN — NOT INSPECTED` as of `2026-11-05`. None may be assumed true, and none may be filled in from memory, from the repository, or from prior reports — each must be established by an **authorized** pre-implementation inspection (Stage A, §9).

### 4.1 Host identification placeholder

| Field | Value |
|---|---|
| Host identifier | `(TO BE COMPLETED BY OWNER — placeholder; intentionally blank)` |
| Owner / operator of the host | `(TO BE COMPLETED BY OWNER — placeholder; intentionally blank)` |
| Host role (dev workstation / dedicated test host / other) | `UNKNOWN — NOT INSPECTED` |
| Host location / network trust zone | `UNKNOWN — NOT INSPECTED` |
| Applicable container policy (permitted / restricted / prohibited) | `UNKNOWN — NOT INSPECTED` (the `D-I` addendum records that policy was never established) |

### 4.2 Runtime and capacity facts

| Fact | Value |
|---|---|
| Container runtime installed | `UNKNOWN — NOT INSPECTED` |
| Runtime type and exact version (Docker Desktop / engine / other) | `UNKNOWN — NOT INSPECTED` |
| Runtime can actually start containers on this host | `UNKNOWN — NOT INSPECTED` |
| Engine backend (WSL2 / Hyper-V / native) | `UNKNOWN — NOT INSPECTED` |
| Free disk space for images and volumes | `UNKNOWN — NOT INSPECTED` |
| Available memory / CPU | `UNKNOWN — NOT INSPECTED` |
| Network egress available for an image pull | `UNKNOWN — NOT INSPECTED` |
| Existing containers, volumes, networks, published ports | `UNKNOWN — NOT INSPECTED` |
| Running host PostgreSQL services and their ports | `UNKNOWN — NOT INSPECTED` |
| Task Scheduler / service state relevant to any runtime | `UNKNOWN — NOT INSPECTED` |
| Whether the host exhibits the `0xC0000142`-class defect | `UNKNOWN — NOT INSPECTED` (prior failure was in *local cluster* provisioning, a different mechanism — see §8) |

### 4.3 Explicit prohibition on invention

This proposal **must not** be read as asserting that Docker (or any runtime) is installed, that the host has any capacity, or that containers are permitted. The `D-I` addendum and R-136 E.9 both record that container availability and policy were **not** established. Stage A (§9) exists precisely to replace these `UNKNOWN — NOT INSPECTED` rows with observed, evidenced values — and only in an authorized session.

---

## 5. Image selection plan — `PENDING AUTHORIZED IMPLEMENTATION`

### 5.1 Selection rules

| Rule | Requirement |
|---|---|
| Major version | PostgreSQL **18** (required for version-consistent archive handling, R-136 C.4) |
| Exact tag | `PENDING AUTHORIZED IMPLEMENTATION` — to be determined at authorized implementation time from what the registry actually offers |
| Exact digest (`sha256:…`) | `PENDING AUTHORIZED IMPLEMENTATION` — the image must be pinned by digest before any container is started |
| Floating tags (`latest`, `18`, `18-alpine`, etc.) | **Prohibited.** No floating tag may be used to start the environment |
| Assumption that the image is `18.4` | **Prohibited.** The `18.4` value comes from archive headers and the local host install; it says nothing about which image tags exist. The archive's `18.4` provenance constrains the *target server must be PG18+*, not "must be exactly 18.4" — and it must not be assumed as an available tag |
| Variant (debian-based vs `alpine`) | `PENDING AUTHORIZED IMPLEMENTATION` — decision recorded at Stage B with rationale (client-tooling availability inside the container matters for later `pg_restore` use) |
| Source registry | `PENDING AUTHORIZED IMPLEMENTATION` — must be recorded with the digest so the artifact is reproducible |
| Digest verification | Recorded via `docker image inspect` output retained as evidence |

### 5.2 Compatibility note (why PG18 and not the repository's PG16)

The repository's existing Compose stack runs `postgres:16-alpine`. R-136 Section C establishes that a PG16 `pg_restore` **rejects** the repository's `PGDMP 1.16.0 / header 18.4` archives (Case A). Therefore the `WP-03` environment is specified as **PostgreSQL 18 major**, which simultaneously provides:

1. a **PG18+ target server** for the version-consistent restore path, and
2. a **PG18+ client** (`pg_dump`/`pg_restore` inside the container) for reading those archives in later work packages.

This proposal does not select the image, does not pull it, and does not assert any tag exists.

---

## 6. Isolation design

### 6.1 Isolation boundaries the design intends

The container must be isolated along all of these axes; each is verified in Stage D (§9) and feeds the condition-1 checklist (§7):

1. **Process isolation** — dedicated container; no reuse of any existing container.
2. **Storage isolation** — dedicated, WP-03-only named volume; no shared bind mounts; the host's operational PostgreSQL data directories (`C:\Program Files\PostgreSQL\18\data` and any PG17 data dir) are never mounted, read, or written.
3. **Network isolation** — **no published host ports**; access only via `docker exec` inside the container. This removes any possibility of colliding with, or reaching through localhost, the existing stack's `127.0.0.1:5433` mapping or any host PostgreSQL listener.
4. **Service isolation** — no connection strings, environment variables, or credentials pointing at the operational PostgreSQL 18 service, the existing `company-ops-postgres` container, or production.
5. **Identity isolation** — distinct container name, volume name, and network name (§6.2) so nothing in `WP-03` can be mistaken for, or clobber, application infrastructure.
6. **Lifecycle isolation** — `--restart no` (or equivalent manual start); the environment does not survive reboots as a zombie, and tear-down (Stage E) is trivial and complete.
7. **Data lifecycle** — snapshot/evidence capture before teardown; volume removal only after evidence is retained and only per the authorized procedure.

### 6.2 Collision-avoidance table (existing stack vs. `WP-03`)

The existing `docker-compose.yml` was read as **read-only text** and must not be modified. The `WP-03` identifiers below are chosen to be disjoint from it:

| Resource | Existing stack (do not touch) | `WP-03` proposal (disjoint) |
|---|---|---|
| Image | `postgres:16-alpine` | `postgres:<EXACT-TAG-PENDING>@sha256:<DIGEST-PENDING>` (PG18, pinned) |
| Container name | `company-ops-postgres` (also `company-ops-api`, etc.) | `cos-phase12-wp03-pg18` |
| Volume | `pgdata` | `cos-phase12-wp03-pg18-pgdata` |
| Published port | `127.0.0.1:5433:5432` | **none** (exec-only access) |
| Network | Compose default network | `cos-phase12-wp03-net` (WP-03-only) |
| Restart policy | `unless-stopped` | `no` |
| Database name | from `.env` (`POSTGRES_DB`) | `cos_wp03_isolated` (proposed) |
| Credentials | from `.env` | `PENDING AUTHORIZED IMPLEMENTATION` — supplied through an authorized channel at implementation time; **never** read from `.env` or reused from production |

No Compose file, Dockerfile, `.env` entry, or script is created or changed for `WP-03` by this proposal; §9's procedure uses direct `docker run` as a *proposed* mechanism only.

---

## 7. Condition-1 evidence definition and checklist

Condition 1 ("isolated PG18 proven", R-138 §9.2 `X1`) is **assessed**, not assumed. It stays `NOT MET` until each row below is satisfied by retained evidence from an **authorized** execution. This checklist is the acceptance contract for `WP-03`.

| # | Evidence item | How it would be established (Stage) | Status now |
|---|---|---|---|
| 1.1 | Container runtime observed present and able to start containers | A | `NOT MET — runtime UNKNOWN` |
| 1.2 | Image pinned by exact digest; digest recorded | B | `NOT MET — image PENDING` |
| 1.3 | Server version reported by the running container is PostgreSQL 18.x (from inside the container) | D | `NOT MET` |
| 1.4 | Data directory is the dedicated WP-03 volume path, not a host path | D | `NOT MET` |
| 1.5 | Volume, container, and network names are the disjoint WP-03 identifiers (§6.2) | D | `NOT MET` |
| 1.6 | **No** published host ports on the WP-03 container | D | `NOT MET` |
| 1.7 | **No** shared volumes/bind mounts with the existing stack or host PostgreSQL data dirs | D | `NOT MET` |
| 1.8 | **No** connectivity to the operational PG18 service, `company-ops-postgres`, or production (no such DSN present; no such port reachable from the container by design) | D | `NOT MET` |
| 1.9 | Container created with no restart policy that outlives the session; lifecycle is owned by `WP-03` | C | `NOT MET` |
| 1.10 | Failure record: the `0xC0000142` non-repetition justification (§8) is attached to the execution | A/C | `NOT MET` |
| 1.11 | Full command/output/timestamp transcript retained as evidence | A–E | `NOT MET` |
| 1.12 | Tear-down plan agreed; snapshot/evidence taken before removal | E | `NOT MET` |

**Rule:** if any row fails, condition 1 remains `NOT MET` and `WP-04` cannot proceed. Partial evidence is recorded as partial; it is not rounded up.

---

## 8. Non-repetition requirement for the `0xC0000142` failure

Stage 2B records that prior **local** isolated-cluster provisioning attempts (PG17 and PG18) crashed with `0xC0000142` (`STATUS_DLL_INIT_FAILED`) during worker initialization, and instructs: **"Do not repeat the same provisioning attempts without a specific diagnostic justification."**

This proposal honors that instruction:

1. **Different mechanism, still gated.** The container approach changes the provisioning mechanism (a containerized server instead of a local `initdb`/service install on the host). That difference is *not* by itself the diagnostic justification — it is the reason the failure mode is expected not to recur, which must be **observed**, not assumed (Stage D).
2. **No local-cluster retry.** Stage A–E contain **no** local `initdb`, no local service install, no reuse of `C:\Program Files\PostgreSQL\18\bin\` provisioning paths, and no re-attempt of the crashed workflow. The local binaries are referenced only as a boundary not to cross.
3. **Host-defect check in Stage A.** Before any provisioning, the authorized session must record whether the host shows generic `0xC0000142`-class symptoms for other processes. If yes, provisioning stops and the defect is diagnosed first; the container path is not used to paper over a host problem.
4. **Abort rule in Stage C.** If container startup fails with a DLL-init-class error, the attempt is aborted, classified as a host/runtime defect (not a design flaw), and reported for owner review — no blind retry.
5. **One attempt, fully evidenced.** The design favors a single, well-instrumented attempt (§9) over repeated provisioning cycles.

---

## 9. Staged execution procedure `A`–`E`

> **STATUS OF EVERYTHING IN THIS SECTION: `PROPOSED — NOT EXECUTED`.**
> No command in this section has been run. This section is a proposal for a future session that has received a **separate provisioning execution authorization** naming `WP-03`. Placeholders in `<ANGLE BRACKETS>` are unresolved by design (`PENDING AUTHORIZED IMPLEMENTATION`). If executed later, each stage's output must be captured verbatim as condition-1 evidence (§7).

### Stage A — Authorized pre-implementation host inspection

Purpose: replace every `UNKNOWN — NOT INSPECTED` row in §4 with observed values; confirm policy permits containers; confirm the `0xC0000142` non-repetition gate (§8).

```powershell
# PROPOSED — NOT EXECUTED
docker version
docker info
Get-PSDrive                                    # free disk on the system drive
Get-CimInstance Win32_OperatingSystem | Select-Object FreePhysicalMemory, TotalVisibleMemorySize
docker ps -a                                   # existing containers (collision check)
docker volume ls                               # existing volumes (collision check)
docker network ls                              # existing networks (collision check)
```

**Stop conditions:** runtime absent or unable to start containers → `WP-03` cannot proceed on this host, report and stop; policy prohibits containers → report and stop; host shows `0xC0000142`-class symptoms → diagnose first, stop.

### Stage B — Image selection and acquisition (post-authorization)

Purpose: resolve `PENDING AUTHORIZED IMPLEMENTATION` into an exact, digest-pinned artifact and record it.

```powershell
# PROPOSED — NOT EXECUTED
# <EXACT-TAG> and <SHA256-DIGEST> are to be determined at authorized implementation
# time from the registry's actual PG18 offerings. No floating tag. No assumed 18.4.
docker pull postgres:<EXACT-TAG>@sha256:<SHA256-DIGEST>
docker image inspect postgres:<EXACT-TAG>@sha256:<SHA256-DIGEST>   # retain digest, layers, created
```

**Stop conditions:** no PG18 image obtainable → report and stop; digest cannot be pinned → stop (floating tags prohibited).

### Stage C — Isolated environment creation (post-authorization)

Purpose: create the disjoint, exec-only, non-restarting environment described in §6.

```powershell
# PROPOSED — NOT EXECUTED
docker network create cos-phase12-wp03-net

docker run -d `
  --name cos-phase12-wp03-pg18 `
  --network cos-phase12-wp03-net `
  --restart no `
  -e POSTGRES_USER=cos_wp03 `
  -e POSTGRES_PASSWORD=<OWNER-SUPPLIED-VIA-AUTHORIZED-CHANNEL> `
  -e POSTGRES_DB=cos_wp03_isolated `
  -v cos-phase12-wp03-pg18-pgdata:/var/lib/postgresql/data `
  postgres:<EXACT-TAG>@sha256:<SHA256-DIGEST>
# NOTE: no -p / --publish flag — no host port is published (§6.1.3).
# NOTE: password is a placeholder; it must be supplied through an authorized
# channel at implementation time — never read from .env, never from production.
```

**Stop conditions:** container fails to start with a DLL-init-class error → abort per §8.4; name/volume/network collision detected → stop and re-plan; any temptation to add a published port or share `pgdata` → prohibited, stop.

### Stage D — Isolation verification (condition-1 evidence capture)

Purpose: produce the evidence rows 1.3–1.10 of §7.

```powershell
# PROPOSED — NOT EXECUTED
docker exec cos-phase12-wp03-pg18 psql -U cos_wp03 -d cos_wp03_isolated -tAc "select version();"
docker exec cos-phase12-wp03-pg18 psql -U cos_wp03 -d cos_wp03_isolated -tAc "show data_directory;"
docker inspect cos-phase12-wp03-pg18        # binds, network, PortBindings (expect empty), RestartPolicy (expect "no")
docker volume inspect cos-phase12-wp03-pg18-pgdata
docker network inspect cos-phase12-wp03-net
```

**Evidence expectations:** `version()` reports `PostgreSQL 18.x`; `data_directory` is the container path under the dedicated volume; `PortBindings` empty; `RestartPolicy` `no`; no bind mounts into host PostgreSQL directories; no reference to `company-ops-postgres`, `pgdata`, or port `5433`.

**Stop conditions:** any §7 row fails → condition 1 stays `NOT MET`; do not proceed to `WP-04`.

### Stage E — Tear-down and evidence retention (post-verification)

Purpose: leave no residue; retain evidence before removal.

```powershell
# PROPOSED — NOT EXECUTED — only after evidence capture and per the authorized procedure
docker stop cos-phase12-wp03-pg18
docker rm cos-phase12-wp03-pg18
docker volume rm cos-phase12-wp03-pg18-pgdata    # only after evidence retained; owner-approved
docker network rm cos-phase12-wp03-net
```

The existing application stack (`company-ops-*`, `pgdata`, port `5433`) is **never** stopped, removed, or modified by any stage above.

---

## 10. Post-provisioning use boundary (what `WP-03` does *not* license)

Even after an authorized `WP-03` succeeds and condition 1 is assessed:

- **`WP-04`** (PG18 migration dry run) requires its **own** separate test-execution authorization (R-138 §9.6).
- **`WP-05`** (restore rehearsal) requires `D-A` (still `PENDING OWNER DECISION`), a **separate restore execution authorization**, a named archive, and a compatible client/target — and condition 2 remains **soft/recommended**, not a hard prerequisite.
- **Condition 2** is assessed *after* `WP-04` work, never assumed from `WP-03`.
- Production remains out of reach: no production connection, credential, or data path is introduced by this design.
- Completing `WP-03` does not close condition 1 by itself — condition 1 closes only through **assessment of the §7 evidence**.

---

## 11. `R-138` dependency and authorization table

Reproduced from R-138 §9.3/§9.6 for this proposal's scope; no edge is changed here.

| From | To | Strength | Relevance to `WP-03` |
|---|---|---|---|
| `D-I` | provisioning authorization | **Authorization gate** | The owner decision must be converted to explicit execution permission — **this gate is currently closed** |
| provisioning authorization | Condition 1 | **Hard** | Environment must exist and be proven isolated before any dry run |
| Condition 1 | Condition 2 | Hard (dry-run path only) | The PG18 dry run needs the isolated environment |
| `WP-03` prerequisites | `D-I` + host capacity/policy + **separate explicit provisioning authorization** | Hard | Host capacity/policy are `UNKNOWN — NOT INSPECTED` (§4) |
| `WP-04` prerequisites | `WP-03` completed + condition 1 accepted + **separate test execution authorization** | Hard | Not reachable from this proposal |
| `WP-05` prerequisites | `D-A` + `WP-03`/condition 1 + named archive + compatible client/target + **separate restore execution authorization**; condition 2 soft/recommended | Hard (authorization), **soft** (condition 2) | `D-A` remains `PENDING OWNER DECISION` |
| `D-A` | restore execution authorization | **Authorization gate** | No `D-I`→restore edge exists; this proposal creates none |

**Net effect:** `WP-03` sits behind exactly one closed gate (provisioning authorization) plus one unknown block (host facts). Nothing downstream (`WP-04`, `WP-05`, condition 2, condition 10, condition 11) may be inferred from the existence of this proposal.

---

## 12. Risk register

| # | Risk | Likelihood (judgment) | Impact | Mitigation in this proposal |
|---|---|---|---|---|
| R1 | Container runtime absent or broken on the host | Unknown (host not inspected) | `WP-03` infeasible on this host | Stage A gate; stop-and-report, no workaround |
| R2 | Container policy prohibits the approach | Unknown (policy never established) | `WP-03` blocked; `D-I` approach unimplementable here | Stage A records policy; fallback is an owner re-decision, not silent substitution |
| R3 | Mistaking `D-I` for execution authorization | Process risk | Unauthorized provisioning | §3 gate statement; every stage marked `PROPOSED — NOT EXECUTED` |
| R4 | Floating-tag drift (`latest`, `18`) | Medium if rules ignored | Non-reproducible environment; silent major drift | §5.1 pinning rules; digest required before start |
| R5 | Assuming image `18.4` exists | Medium if provenance misread | Failed pull or wrong artifact | §5.1 explicit prohibition; `PENDING AUTHORIZED IMPLEMENTATION` |
| R6 | Collision with existing stack (`company-ops-postgres`, `pgdata`, `5433`) | Medium without the table | Data loss / outage of app stack | §6.2 disjoint identifiers; no published ports; existing stack never touched |
| R7 | Accidental connection to operational PG18 or production | Medium without boundaries | Severe (data integrity/compliance) | §6.1.4 DSN prohibition; Stage D checks; no production credentials anywhere in the design |
| R8 | Recurrence of `0xC0000142`-class failure in the runtime | Low–medium (host defect class previously observed) | Failed attempt; wasted cycle | §8 non-repetition rules; Stage A symptom check; Stage C abort rule; single instrumented attempt |
| R9 | `.env` or secret leakage into the proposal or the environment | Process risk | Secret exposure | §6.2/§9 credentials via authorized channel only; `.env` never read |
| R10 | Scope creep (Compose file, Dockerfile, scripts created) | Low | Unreviewable artifact sprawl | §1.3: exactly one new file; no auxiliary artifacts |
| R11 | Evidence too weak to satisfy condition 1 | Medium | Condition 1 stays `NOT MET`; downstream stalls | §7 twelve-row checklist with stop conditions |
| R12 | Premature `WP-04`/`WP-05` inference | Process risk | Authorization bypass | §10 use boundary; §11 table |

---

## 13. Explicit non-actions performed in producing this document

The following were **not** performed:

- No provisioning; no container, image, volume, or network was created, inspected, or removed.
- No Docker/container/runtime/service/Task Scheduler query of any kind.
- No image pull; no registry access.
- No database connection; no query; no migration; no backup; no restore.
- No production access; no operational PostgreSQL 18 access.
- No `.env` read; no secret value opened or reproduced.
- No test, build, typecheck, lint, script, or query execution.
- No Git write (no stage, commit, push, branch, tag, reset, stash, clean).
- No application source file read or modified.
- No modification of any existing file: `R-132`…`R-138`, the `D-I` addendum, `docker-compose.yml`, `Dockerfile.api`, `Dockerfile.web`, and all other tracked/untracked files are unchanged.
- No Compose file, Dockerfile, script, or auxiliary artifact created; **exactly one new Markdown file** (this proposal) exists.
- Existing dirty working tree (24 modified tracked + 3 untracked entries) preserved as found.

---

## 14. Open items required before an authorization decision

For the owner to decide on granting a provisioning authorization, these remain open:

1. **Host identification** — the §4.1 placeholder must be completed by the owner.
2. **Host facts** — every `UNKNOWN — NOT INSPECTED` row (§4.2) must be filled by an *authorized* Stage A inspection; this document cannot fill them.
3. **Container policy** — explicit confirmation that containers are permitted on that host (never established per the `D-I` addendum).
4. **Provisioning execution authorization** — a separate, explicit grant naming `WP-03`; not derivable from `D-I` or from this proposal.
5. **Image selection** — resolution of all `PENDING AUTHORIZED IMPLEMENTATION` fields in §5 at implementation time.
6. **Credential channel** — how the Stage C password is supplied without `.env` or production reuse.
7. **`D-A`** — remains `PENDING OWNER DECISION`; required before any `WP-05` planning, not before `WP-03`.

---

## 15. Final stop report

| Field | Value |
|---|---|
| Output path | `D:\Default Project\company-ops-system\docs\frontend-rebuild\phase-12\phase-12-wp-03-isolated-postgresql18-container-execution-proposal.md` |
| Target pre-checked | Yes — file did not exist before creation (`Test-Path` → `False`); no conflict |
| Files created | Exactly **1** (this document) |
| Files modified | **0** |
| Repository root | `D:/Default Project/company-ops-system` |
| Branch / HEAD | `main` / `f91ed2f9e81db3937e3bcbb1b44e5e2c44e175cf` |
| Remote | `https://github.com/mamin144/company-ops-system.git` |
| Working tree before | 27 porcelain entries (24 modified tracked, 3 untracked) |
| Working tree after | Unchanged — same 27 entries; this document is one new untracked file alongside the pre-existing untracked set |
| Host facts | All classified `UNKNOWN — NOT INSPECTED`; none invented |
| Image selection | `PENDING AUTHORIZED IMPLEMENTATION`; no floating `latest`; no assumed `18.4` |
| Commands in §9 | All `PROPOSED — NOT EXECUTED` |
| `WP-03` status | `PROPOSED — NOT AUTHORIZED` |
| Condition 1 | `NOT MET` (unchanged) |
| Condition 2 | `SOFT / RECOMMENDED` for `WP-05` (unchanged; not a hard prerequisite) |
| `D-I` | `DECIDED — I3 SELECTED`; execution `NOT AUTHORIZED` (unchanged) |
| `D-A` | `PENDING OWNER DECISION` (unchanged) |
| `WP-04` / `WP-05` | Each requires its own separate authorization (unchanged) |
| Prior deliverables (R-137, R-138, `D-I` addendum) | Unmodified |
| Stage 3 / Phase 13 / D5 / D6 / D7 | Remain `Not Authorized` (unchanged) |

**Final Phase 12 verdict (unchanged):** `BLOCKED — ADDITIONAL EVIDENCE REQUIRED — PHASE 12 REMAINS OPEN`

**End of WP-03 execution proposal. Stop here.**

---

## Appendix — Supersession Notice (2026-11-09), R-139

> **NOTICE APPENDED ONLY — the body of this execution proposal above remains unchanged and is preserved as historical evidence.**

As of the owner decision amendment **R-139** (`phase-12-owner-decision-amendment-r139-d-i-windows-native-pg18.md`, dated 2026-11-09):

| Item | Prior recorded state (this document) | Current state |
|---|---|---|
| WP-03 direction | Isolated PostgreSQL 18 **container** proposal (Docker-based, under I3) | `SUPERSEDED AS WP-03 DIRECTION; PRESERVED AS HISTORICAL EVIDENCE` |
| Docker as environment direction | The approved basis for this proposal | **No longer approved** — Docker is not part of the I-WIN direction |
| Role of this document | Active WP-03 proposal | **Historical evidence only** — discoverable, not erased; its condition-1 evidence discipline, staged `PROPOSED — NOT EXECUTED` pattern, and `0xC0000142` non-repetition rules remain citable guidance where applicable |
| Execution status | `PROPOSED — NOT EXECUTED` / `NOT AUTHORIZED` | Remains `NOT AUTHORIZED`; nothing in this proposal was ever executed |
| Replacement | — | `phase-12-wp-03-windows-native-pg18-existing-instance-proposal.md` (I-WIN: existing Windows Native PostgreSQL 18.4 instance) |

No Docker, provisioning, configuration, database, migration, backup, or restore operation was ever performed under this proposal.

**End of supersession notice.**
