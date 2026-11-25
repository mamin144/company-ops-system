# Phase 12 — R-133: Independent Accuracy Verification of R-132

**Type:** Read-only accuracy addendum. Not a remediation report, not an approval, not a closure record.
**Subject:** `phase-12-consolidated-evidence-remediation-report.md` (R-132, 1073 lines).
**Date:** 2026-11-04.
**Baseline verified at start of this review:** branch `main`, HEAD `f91ed2f9e81db3937e3bcbb1b44e5e2c44e175cf`, remote `mamin144/company-ops-system`, working tree 27 entries in `git status --porcelain` (24 modified + 3 untracked: `docs/`, `COS_Full_Frontend_Rebuild_Phase_Prompts_AR.md`, `COS_Full_Frontend_Rebuild_Plan_AR.md`).
**Output:** this file, and only this file.
**Rule applied throughout:** no `Inferred`, `Historical`, `Owner-Confirmed`, or `Proposed` item is promoted to `Verified`. A correction is only made where a directly readable artefact contradicts R-132's text, or where R-132's own arithmetic contradicts its own table.

---

## 1. Executive Verdict

R-132 is **substantially accurate on its central conclusions** and **materially wrong on four of its stated mechanisms**. The verdict it reached — `BLOCKED — ADDITIONAL EVIDENCE REQUIRED — PHASE 12 REMAINS OPEN` — survives this review unchanged. The reasoning behind it does not survive intact in four places.

| # | R-132's stated mechanism | R-133 finding | Label |
|---|---|---|---|
| 1 | `markAllRead` clears **every** user's unread state (cross-user mutation) | **False.** The SQL only appends the calling username to `read_by`; no other user's entry is read, removed, or rewritten. The real defect is a UI/server read-state disagreement plus a missing recipient model. | `Contradicted` |
| 2 | `crypto.randomUUID()` fails because nothing provides `crypto` | **False.** `@types/node` 24.13.3 declares a global `var crypto`, `tsconfig` enables `types: ["node"]`, and Node ≥ 19 provides `globalThis.crypto`. It type-checks and runs. The column-name defect is real and is sufficient on its own. | `Contradicted` |
| 3 | There is **no** database backup or restore **anywhere**, so condition 10 is "unsatisfiable by the shipped application" | **Overstated to the point of being wrong.** The *application* has no DB backup path (true), but the *repository* ships `pg_dump -Fc` backup scripts, a restore-to-temporary-database script, a daily 02:00 scheduled task, and 14 real dumps. Condition 10 is unmet because no restore test is recorded, not because the capability is absent. | `Contradicted` (scope of the claim) |
| 4 | A failed import leaves "imported rows with no ledger record at all" | **True only if the process dies mid-loop or the ledger insert itself fails.** On the normal completion path both confirm routes write `import_history` with totals, successes, failures, and error text. What is missing is a transaction and a guard around the ledger write. | `Contradicted` (as stated) / `Verified` (narrow form) |

Three of these four errors move in the **same direction: R-132 over-states severity by attributing a defect to the wrong layer** (application vs repository; SQL vs UI; schema vs runtime). One moves in the opposite direction: R-132 **under-states** the notification defect by missing the actual user-visible contradiction between `NotificationBell.tsx:59` and `system.routes.ts:61`.

**Nothing in this addendum makes Phase 12 closer to closure.** Two corrections *reduce* the remediation burden (F-01's crypto line, F-02's "build a capability"), and two *change what must be done* (F-02 becomes "execute and document a restore test"; F-05 becomes "decide the recipient model" rather than "stop a cross-user mutation"). The exit gate itself is unchanged.

### 1.1 خلاصة عربية

- الحكم النهائي لـ R-132 (`BLOCKED / OPEN`) **صحيح ويبقى كما هو**، لكن أربعة من تفسيراته التقنية **خاطئة**.
- `markAllRead` **لا** يمسح قراءة مستخدمين آخرين؛ يضيف اسم المستخدم الحالي فقط. العيب الحقيقي: واجهة `NotificationBell` تعتبر الإشعار مقروءًا إذا قرأه أي مستخدم، بينما العدّاد في الخادم لكل مستخدم.
- `crypto.randomUUID()` **يعمل** (Node ≥ 19 + تعريف `@types/node` العام)؛ عيب F-01 الحقيقي هو أسماء الأعمدة.
- المستودع **يملك** قدرة backup/restore على مستوى السكربتات و14 نسخة احتياطية؛ الشرط 10 غير محقَّق لأن **اختبار الاستعادة غير موثَّق**، لا لأن القدرة غائبة.
- الاستيراد **يسجّل** في `import_history` عند الاكتمال الطبيعي؛ الثغرة فقط عند موت العملية داخل الحلقة أو فشل إدخال السجل.
- لا حاجة لتعديل R-132؛ هذا الملحق هو سجل التصحيح، وPhase 12 تبقى مفتوحة، وStage 3 / Phase 13 غير مُصرَّح بهما.

---

## 2. Baseline, Scope, Method, and Evidence Discipline

### 2.1 What was verified before reading any claim

| Fact | Command (read-only) | Result |
|---|---|---|
| Repository root | working directory | `D:\Default Project\company-ops-system` |
| Branch | `git rev-parse --abbrev-ref HEAD` | `main` |
| HEAD | `git rev-parse HEAD` | `f91ed2f9e81db3937e3bcbb1b44e5e2c44e175cf` |
| Working tree | `git status --porcelain` | 27 entries (24 non-untracked, 3 untracked) |
| R-132 present | read | 1073 lines |
| Addendum target absent | file test | did not exist before this run |

The historical baseline recorded inside R-132 (§3, §14) is **not** assumed to be the current one. The counts differ: R-132 records 24 uncommitted modifications; this review observes 24 modified **plus** 3 untracked paths, i.e. 27 porcelain entries. This is baseline drift, not an error in R-132.

### 2.2 Project instructions and skills

- No `AGENTS.md`, `CLAUDE.md`, or `.cursorrules` exists at repository root. Only `opencode.json` and `README.md`. Therefore no project-local agent instructions were available to constrain this review beyond the task envelope.
- Available skills were inspected but **none was installed**, and none was needed: the task is source verification, not a specialized workflow.

### 2.3 Method

For each contested claim:

1. Read the **entire** R-132 section that states it, including the summary and the register entry, so that a wording error in one location could not be mistaken for a one-off.
2. Locate the **primary artefact** (source file, SQL file, script, or decision record) and read the surrounding block, not a single line.
3. Record the **exact text or SQL** that decides the question.
4. Assign exactly one label from §3.
5. State whether the correction changes (a) severity, (b) an owner decision, or (c) exit readiness.

No claim was accepted or rejected on the basis of R-132's own confidence language. No file was executed. No database was contacted.

### 2.4 What this addendum explicitly did not do

- Did not modify R-132 or any other document, source, SQL, script, or configuration.
- Did not run tests, builds, typechecks, linters, or the application.
- Did not execute SQL, connect to a database, run backup/restore, or touch production.
- Did not read or print `.env`, credentials, tokens, or secrets.
- Did not install tooling, change services, or change device settings.
- Did not perform any Git write operation.
- Did not start D5, D6, D7, Stage 3, or Phase 13.

---

## 3. Evidence Classification Ledger

| Label | Meaning in this addendum | May be promoted to `Verified` here? |
|---|---|---|
| `Verified` | Directly readable in the cited artefact, without inference | — |
| `Owner-Confirmed` | Asserted by an owner artefact; the event itself has no independent timestamp in the repo | No |
| `Historical` | Recorded as having happened; not reproducible from the tree | No |
| `Inferred` | Best explanation consistent with evidence, but not proven | No |
| `Proposed` | A design or remediation suggestion | No |
| `Unknown` | Evidence is absent or the question is not answerable from the tree | No |
| `Contradicted` | A directly readable artefact states the opposite of the claim | No |
| `Not Authorized` | The action that would answer the question is outside the authorised envelope | No |

**Distribution of this addendum's correction verdicts (19 corrections):**

| Verdict | Count | IDs |
|---|---:|---|
| `Contradicted` | 7 | X-01, X-05, X-07, X-10, X-15, X-16, X-18 |
| `Verified` (correction to a citation, count, or classification, not a factual reversal) | 10 | X-02, X-03, X-04, X-06, X-08, X-09, X-11, X-12, X-13, X-17 |
| `Unknown` / `Inferred` (downgrade of an over-claim) | 2 | X-14 (mis-citation, `Verified`), X-19 (baseline drift, `Verified`) |

Correction X-19 is a baseline note, not a defect; it is counted above for completeness. The substantive reversal count is therefore **six**, plus one mis-classification (X-13) and one arithmetic contradiction pair (X-15, X-16).

---

## 4. WS-A — F-05: Notification Subsystem

### 4.1 The contested claim

R-132 states the claim twice.

**R-132 §1, item 3** (lines 43-45):

> "…the notification subsystem has a defect the corpus does not record at all: `markAllRead(username)` clears **every** notification globally, while `list()` returns the latest 100 notifications **for all users** (`Verified`, F-05, F-10)."

**R-132 §5.3, table row 3** (line 225):

> "`markAllRead(username)` | `:60-70` | Executes an `UPDATE ... SET read_by = array_append(...)` with **no `WHERE` on the row set other than unread-ness** — one user's "mark all read" clears the badge for **every user**"

**R-132 §12, F-05** (lines 634-636):

> "notifications have no recipient model; any user's "mark all read" clears every user's unread state; the read list is truncated at 100 globally."

### 4.2 Direct evidence

`apps/api/src/services/notification.service.ts:72-77`:

```ts
async markAllRead(username: string) {
  const { pool } = await import('../database/connection.js');
  await pool.query(
    `UPDATE notifications SET read_by = array_append(read_by, $1) WHERE NOT ($1 = ANY(read_by))`
  );
}
```

The predicate is `NOT ($1 = ANY(read_by))` — where `$1` is the **calling** username. The row set is "every notification the caller has not personally read". The mutation is:

- an **append** of one element (`array_append`);
- of **the caller's own name**;
- to a `read_by` array that is **never** read for another user's membership in a way that changes that user's state;
- with **no** `SET read_by = '{}'`, no removal, and no reference to any other username.

There is no cross-user mutation. The claim is `Contradicted`.

`markRead` (`:64-70`) is correctly per-user and idempotent:

```ts
`UPDATE notifications SET read_by = array_append(read_by, $1) WHERE id = $2 AND NOT ($1 = ANY(read_by))`
```

### 4.3 What R-132 got right in F-05

| Sub-claim | Evidence | Label |
|---|---|---|
| Notifications have no recipient model in `create()` | `notification.service.ts:31-35`: `INSERT INTO notifications (id, type, title, message, link, entity_id, read_by, created_at)` — no recipient column supplied | `Verified` |
| A `user_id` column exists but is unused | `001_initial_schema.sql:304-314`, `user_id` at `:311` | `Verified` |
| `list()` has no recipient filter and a fixed `LIMIT 100` | `notification.service.ts:49-62`, `:51` | `Verified` |
| The API slices the list to 30 items | `system.routes.ts:60-63`, `:62` `items: all.slice(0, 30)` | `Verified` |
| `MAX_NOTIFICATIONS = 2000` is declared and never used | `notification.service.ts:6`; no other reference | `Verified` |
| Dedupe keys on emptiness of `read_by` and therefore stops after the first reader | `notification.service.ts:22-28`: `AND array_length(read_by, 1) IS NULL` | `Verified` |
| Notification content is broadcast, not targeted | `create()` callers: `documents.routes.ts:352-359`, `material-requests.routes.ts:98-105`, `modules/stock/stock.factory.ts:105-113` | `Verified` |

Note on the last row: the payloads carry a document **title**, a material-request **number**, an item **name and stock level**, the acting user's **full name**, and a navigational **link**. That makes the missing recipient model a cross-project **information-disclosure** question, not merely a cosmetic one. Whether those strings are sensitive is a business judgement (`Unknown`).

### 4.4 The defect R-132 missed

`apps/web/src/components/NotificationBell.tsx:59`:

```tsx
const unread = !n.readBy.length;
```

This treats a notification as read **as soon as any user has read it**, because it tests the length of the shared array. The server computes the badge per user (`system.routes.ts:61`):

```ts
unread: all.filter((n: any) => !n.readBy.includes(username)).length,
```

Consequences, all `Verified` from the two files:

1. A notification read by user A renders as **already read** in user B's panel, while user B's badge still counts it as unread. Badge and list disagree in the same render.
2. The item loses its unread styling but still contributes to the badge — a visible, reproducible inconsistency.
3. There is no per-user read state in the UI at all; the UI cannot render per-user read state even if the server sends it correctly (which it does).

This is a **client-side logic defect**, distinct from the schema question, and it is missing from R-132 entirely.

### 4.5 Corrected conclusion for F-05

| Question | Answer | Label |
|---|---|---|
| Does `markAllRead` mutate other users' read state? | No | `Contradicted` |
| Does it mark **every** notification read for the caller? | Yes, including rows outside the 30-item window | `Verified` |
| Is there a recipient model? | No in code; the column exists but is unused. Whether that is a defect or a product decision is not decidable from the tree | `Unknown` |
| Is there a user-visible read-state defect? | Yes, `NotificationBell.tsx:59` vs `system.routes.ts:61` | `Verified` |
| Is there a truncation defect? | Yes: DB `LIMIT 100`, API `slice(0, 30)`, no paging; up to 70 rows are unreachable while still counted by `unread` | `Verified` |
| Is dedupe semantically broken? | Yes: it stops deduplicating globally once any user reads the row | `Verified` |

**Severity:** R-132 `High` → corrected **Medium**. The "cross-user state mutation" that justified `High` does not occur. The residual items are a UI/server contradiction, a truncation bug, a dedupe bug, and an unresolved recipient-model design question.

**Owner decision:** `D-D` is still required, but its question changes. It is no longer "stop the cross-user mutation"; it is "choose the recipient model — (a) populate `user_id` and filter, (b) introduce a per-user join, or (c) document broadcast-only as intended — and fix the client predicate either way."

**Readiness impact:** none. F-05 was not gating.

---

## 5. WS-B — F-01: Data-Migration Script

### 5.1 The contested claim

R-132 §1, item 2 (lines 35-40):

> "It inserts into `projects (name, client_name, consultant_name)` while `001_initial_schema.sql` defines `project_name`, `client`, `main_contractor`, `site_location` … It calls `crypto.randomUUID()` without importing anything that provides it. Its failure is swallowed and the process exits 0."

R-132 §6 table (line 245) labels the `crypto` row `Verified`:

> "`crypto.randomUUID()` used without any import providing `crypto` | `:104`, `:114`, `:172`, `:185` — imports are `pool`, `fs/promises`, `path`, `url` (`:1-4`) | `Verified`"

### 5.2 Direct evidence on `crypto`

| Fact | Evidence | Label |
|---|---|---|
| `data-migration.ts` imports only `pool`, `fs/promises`, `path`, `url` | `data-migration.ts:1-4` | `Verified` |
| No local `crypto` binding exists | full-file read | `Verified` |
| `@types/node` declares a **global** `var crypto` | `node_modules/@types/node/web-globals/crypto.d.ts:31`: `var crypto: typeof globalThis extends { onmessage: any; crypto: infer T } ? T : webcrypto.Crypto;` | `Verified` |
| The API tsconfig enables Node globals | `apps/api/tsconfig.json`: `"types": ["node"]` | `Verified` |
| Installed `@types/node` version | `24.13.3` | `Verified` |
| Runtime provides `globalThis.crypto` | Node `v26.7.0` in this environment; Web Crypto global since Node 19 | `Verified` |
| No flag disables it | no `NODE_OPTIONS`, no `--no-experimental-global-webcrypto` in `package.json`, `apps/api/package.json`, `Dockerfile.api`, or `docker-compose.yml` | `Verified` |

Therefore the identifier `crypto` resolves to the Node global at both typecheck time and runtime. `crypto.randomUUID()` at `:104`, `:114`, `:172`, `:185` is **not** a defect. The claim is `Contradicted`.

This does not "rescue" F-01. It removes one of its three legs and leaves the load-bearing one intact.

### 5.3 What remains true, and what R-132 did not say

| Claim | Evidence | Label |
|---|---|---|
| Inserts `name, client_name, consultant_name` | `data-migration.ts:77` | `Verified` |
| Live table defines `project_name, client, main_contractor, site_location` | `001_initial_schema.sql:57-63` | `Verified` |
| No migration renames those columns | all 19 top-level migrations inspected | `Verified` |
| `projects.json` is non-empty, so the failure path is reachable | `apps/api/data/projects.json`, 761 bytes | `Verified` |
| A single transaction wraps the whole script | `BEGIN` at `:35`, `COMMIT` at `:201`, `ROLLBACK` at `:204` | `Verified` |
| Failure is caught, logged, rolled back, and the process still exits 0 | `:203-205`, `:211` `run().then(() => pool.end()).catch(console.error)` | `Verified` |
| Never invoked | zero references in `app.ts`, `bootstrap.ts`, `migrate.ts`, or any `package.json` script | `Verified` |

Two consequences follow that R-132 did not state:

1. **No partial writes.** Because the entire migration is one transaction, a failure at `:77` rolls back everything. R-132 did not claim partial writes, but its `Critical (integrity)` severity invites that reading. The correct risk is "silent no-op", not "half-migrated database".
2. **Live risk is zero.** The file is unreferenced, so the defect is a **planning** defect only. Its severity is real for any future migration plan, and nil for the running system.

### 5.4 Corrected conclusion for F-01

| Question | Answer | Label |
|---|---|---|
| Does the script fail because of `crypto`? | No | `Contradicted` |
| Does it fail against the live schema? | Yes, at the first project row | `Verified` |
| Does it fail silently with exit 0? | Yes | `Verified` |
| Does it leave partial state? | No — single transaction with `ROLLBACK` | `Verified` |
| Is it wired to anything? | No | `Verified` |

**Severity:** R-132 `Critical` → corrected **Critical as a planning artefact / None as runtime**. The severity label should be split, not lowered, because "any plan that assumes this works is unsound" remains exactly right.

**Owner decision:** `D-B` (repair or retire) is unchanged. The repair is now smaller than R-132 implies: correct the column list at `:77` (and any sibling entity blocks with the same drift), then either wire it or delete it. The `crypto` fix is not needed.

**Readiness impact:** none. F-01 was not gating; it undermines a future plan, not a current capability.

---

## 6. WS-C — F-02: Backup and Restore

### 6.1 The contested claim

R-132 §1, item 1 (lines 28-33):

> "**There is no database backup or restore capability.** `apps/api/src/services/backup.service.ts` copies `data/` and `storage/` only. It never invokes `pg_dump`, never invokes `pg_restore`, and contains no PostgreSQL code path at all. Exit condition 10 … is therefore **not merely unmet — it is currently unsatisfiable by the shipped application** (`Verified`, F-02)."

R-132 §7.1 (lines 286-295):

> "**There is no database backup and no database restore, anywhere in the application.** … A "backup" taken today preserves **no** project, document, IPC, BOQ, stock, audit, session, or user data."

R-132 §16, condition 10 (line 977): `Not met — capability absent`.
R-132 §17.2, `D-A` (line 1011): "Is database backup/restore in Phase 12 scope…"
R-132 §18 (line 1066): "the system has no recoverable state".

### 6.2 Direct evidence: what exists in the repository

| Artefact | What it does | Evidence | Label |
|---|---|---|---|
| `scripts/backup-db.ps1` | `docker exec company-ops-postgres pg_dump -U <user> -Fc -f /tmp/... <db>`, then `docker cp` to `backups/` | `:16-28` | `Verified` |
| `scripts/backup-db-local.ps1` | Host `pg_dump.exe` from `C:\Program Files\PostgreSQL\18\bin`, `-h 127.0.0.1 -p 5432 -Fc`, keeps newest 14 | `:8-14` | `Verified` |
| Daily schedule | `CompanyOps-Backup`, `New-ScheduledTaskTrigger -Daily -At 02:00`, action = `backup-db-local.ps1` | `scripts/install-service.ps1:44-49` | `Verified` |
| `scripts/restore-db.ps1` | Creates `cos_restore_test`, `pg_restore` into it, runs count queries against `projects`, `boq_items`, `ipcs`, `documents`, `document_revisions`, then drops it | `:24-40` | `Verified` |
| Backup artefacts | 14 `.dump` files, 2026-10-14 12:00 → 2026-11-04 11:00, 275,691–285,743 bytes | `backups/` | `Verified` (existence) |
| Documentation of the scripts | `phase-12-stage-2-environment-plan.md:96-98` describes both and calls restore "read-only verification pattern" | `:96-98` | `Verified` |
| Application-layer absence | `backup.service.ts` imports only `fs` primitives; no `child_process`, no SQL | full-file read | `Verified` |

The narrow claim about `backup.service.ts` is correct. The general claim — "no database backup … anywhere", "condition 10 unsatisfiable", "no recoverable state" — is false at repository scope. `Contradicted`.

### 6.3 What is genuinely missing

| Question | Answer | Label |
|---|---|---|
| Is a restore **test** recorded as executed? | No document records a run of `restore-db.ps1`, nor its output, nor the count results | `Unknown` |
| Are the 14 dumps restorable? | Not proven. Existence and non-zero size are not restore evidence | `Unknown` |
| Which PostgreSQL major produced them? | Two majors are referenced by the repo: compose `postgres:16-alpine` (`docker-compose.yml:4`, port 5433 per `:16`) and host PG 18 (`backup-db-local.ps1:8`, `install-service.ps1:33`) | `Verified` (both references) / `Unknown` (which is production) |
| Is the restore path version-matched? | `backup-db-local.ps1` dumps host PG18 on `127.0.0.1:5432`; `restore-db.ps1` restores inside the **container** named `company-ops-postgres`, which compose defines as PG16 on 5433. A PG18 custom-format dump restored by a PG16 `pg_restore` is at minimum unsupported | `Inferred` |
| Were the dumps produced by the 02:00 task? | Timestamps are 12:00 for ten files, then 11:00 for four. Neither matches the scheduled 02:00 | `Unknown` — provenance not established |
| Does condition 11's full text go beyond "tested and verified"? | Yes — see §6.4 | `Verified` |

### 6.4 Condition 11 is quoted incompletely in R-132

R-132 §7.2 quotes condition 11 as:

> "*"Rollback/recovery procedure — tested and verified."*"

The acceptance record says (`phase-12-owner-acceptance-record.md:182`):

> "**Rollback/recovery procedure** — tested and verified (named recovery point, post-cutover write policy, file-attachment recovery, audit-trail evidence)."

The parenthetical is load-bearing. Even a successful `pg_restore` into a temporary database satisfies only the first element. It does not supply a named recovery point tied to a cutover, a post-cutover write policy, file-attachment recovery, or audit-trail evidence. **Condition 11 cannot be closed by running `restore-db.ps1` alone.** R-132's truncated quote is a `Verified` quoting error with a real consequence: it understates what the owner must demand.

### 6.5 Corrected conclusion for F-02

| Question | Answer | Label |
|---|---|---|
| Does the **application** implement DB backup/restore? | No | `Verified` |
| Does the **repository** contain a DB backup capability? | Yes, two script paths plus a scheduled task | `Verified` |
| Has a backup ever run? | Yes — 14 dumps exist | `Historical` |
| Has a restore ever been verified? | Not recorded | `Unknown` |
| Is condition 10 met? | No — no recorded, reviewed restore test | `Verified` (status) |
| Is condition 10 "unsatisfiable"? | No — the scripts exist; what is missing is execution plus evidence | `Contradicted` |
| Is condition 11 met? | No — 3/19 rollback scripts, no runner rollback, and the four named recovery elements are absent | `Verified` (status) |
| Is there "no recoverable state"? | No — there is a dump-based recovery path that has never been proven | `Contradicted` |

**Severity:** `Critical` → **High**. Recoverability is still the top risk, but the risk is "unverified recovery with a version mismatch", not "no recovery mechanism".

**Owner decision:** `D-A` must be re-worded. The decision is not "is DB backup in scope". It is: *"Authorize executing `restore-db.ps1` against a version-matched, isolated target, and record the evidence — or accept in writing that recovery is untested."* This is the only place in this addendum where the **remediation path** changes materially.

**Readiness impact:** verdict unchanged; conditions 10 and 11 remain `Not met`. But the *reason* changes from "capability absent" to "capability present, evidence absent". That distinction matters because the former implies a build task and the latter implies a test-and-document task.

### 6.6 Secret-handling observation (no value reproduced)

`scripts/backup-db-local.ps1:9` sets `PGPASSWORD` to a hard-coded local database password literal. The value is **not** reproduced anywhere in this addendum. Its presence is `Verified`; whether it is a live credential or a disposable local development value is `Unknown`. It is directly relevant to `D5` (secret-management planning) and to R-132's `U-12`-class evidence gaps, and R-132 does not mention it.

---

## 7. WS-D — F-13: Import Integrity and the Ledger

### 7.1 The contested claim

R-132 §9.2 (lines 441-444):

> "The `import_history` row is inserted **after** the loop (`:~455-470`), so a failure before that point produces **imported rows with no ledger record at all**."

R-132 §12, F-13 (summary): "Partial import leaves unauditable data state."

### 7.2 Direct evidence

Both confirm routes write the ledger after the loop, unconditionally on the normal path.

- `smart/confirm`: loop `import.routes.ts:300-346`; ledger `:348-359`, with `totalRows: imported + failures.length`, `successfulRows: imported`, `failedRows: failures.length`, `errors: failures.slice(0, 50)`.
- `:entity/confirm`: loop `:426-456`; ledger `:458-469`, same shape.
- `import_history` exists with exactly those columns: `001_initial_schema.sql:318-329` (`total_rows`, `successful_rows`, `failed_rows`, `errors TEXT[]`).
- The repository insert matches the table (`import-history.repository.ts:26-40`).
- `errors` is `TEXT[]`, so the string-array parameter is valid.

Therefore, on the **normal completion path**, a partial import **is** recorded, with counts and up to 50 error lines. The claim "no ledger record at all" is false for that path. `Contradicted`.

### 7.3 What is true

| Claim | Evidence | Label |
|---|---|---|
| No `BEGIN`/`COMMIT` in the route file | full-file read | `Verified` |
| Rows are inserted one at a time; earlier rows stay committed after a later failure | loop bodies at `:330-341` and `:448-451` | `Verified` |
| A process death **inside the loop** leaves committed rows and no ledger row | ledger write is after the loop | `Verified` |
| The ledger write is **not** guarded by `try/catch` | `:349` and `:459` are bare `await` | `Verified` |
| Express is 4.22.2, which does not catch rejected async handlers | `node_modules/express/package.json` | `Verified` |
| No `unhandledRejection` or `uncaughtException` handler exists in `apps/api/src` | recursive grep, zero hits | `Verified` |
| Consequence of an unguarded ledger failure: no response is sent; the request hangs, and on current Node the rejection is fatal by default | combination of the above | `Inferred` |
| `totalRows` omits skipped duplicates | `:355` and `:465`: `imported + failures.length`, while `continue` at `:301` skips duplicates without counting them | `Verified` |

### 7.4 Corrected conclusion for F-13

| Question | Answer | Label |
|---|---|---|
| Are partial imports always unrecorded? | No | `Contradicted` |
| Can a partial import be unrecorded? | Yes — mid-loop process death | `Verified` |
| Can the ledger insert itself fail and take the response with it? | Yes, structurally; outcome `Inferred` | `Verified` (shape) / `Inferred` (outcome) |
| Does the ledger undercount? | Yes, by the number of skipped duplicate rows | `Verified` |

**Severity:** `Critical` → **High**. The un-auditable window is real but bounded to crash/failure paths, not the normal path.

**Owner decision:** `D-C` (atomic vs explicitly-partial-with-ledger) is unchanged and still correct. If "partial-with-ledger" is chosen, the ledger must be written in a way that cannot be lost — e.g. a transaction per batch, or a pre-loop "started" row updated at the end.

**Readiness impact:** none. F-13 was not gating.

---

## 8. WS-E — Counts, Contradiction Labels, and Arithmetic

### 8.1 F-14 — adapter method count: R-132 is correct

Independent AST count of top-level properties in each exported object literal of
`docs/frontend-rebuild/phase-03-prototype/src/services/api/adapters/mock/api.ts`
(`typescript` `createSourceFile` + `ObjectLiteralExpression` property walk):

| Namespace | Contract map §6.1 | Actual | Delta |
|---|---:|---:|---:|
| `mockApi` | 22 | 22 | 0 |
| `stockApi` | 5 | 5 | 0 |
| `lookups` | 2 | 2 | 0 |
| `boqApi` | 6 | 6 | 0 |
| `ipcApi` | 9 | 9 | 0 |
| `mrApi` | 8 | **9** | +1 |
| `userApi` | 9 | **11** | +2 |
| `reportApi` | 4 | 4 | 0 |
| **Total** | **65** | **68** | **+3** |

The three undocumented members are `mrApi.projects`, `userApi.list`, and `userApi.get`. R-132's §10.2 is `Verified` **except for one citation**: §1 item 4 attributes the finding to "`Verified`, F-15", but F-15 is the HTTP-transport finding. The correct register ID is **F-14**.

### 8.2 F-17 — rollback coverage: R-132 is correct, with one needed qualifier

| Claim | Evidence | Label |
|---|---|---|
| 19 top-level migration files | `migrations/*.sql` count = 19 | `Verified` |
| Only 3 files in `down/` | `19_authz_rebuild.sql`, `20_authz_backfill.sql`, `21_direct_amounts.sql` | `Verified` |
| `migrate.ts` never reads `down/` | full-file read; no `down` reference | `Verified` |
| 16 migrations have no rollback script | 19 − 3 | `Verified` |
| "The runner has no rollback mode at all" | **Qualifier needed.** Each migration runs inside `BEGIN`/`COMMIT`, and a failure triggers `ROLLBACK` (`migrate.ts:47-59`). What is absent is rollback of an **already-applied** migration | `Verified` (with qualifier) |

This is a precision correction, not a reversal. The operational conclusion is unchanged: there is no post-hoc rollback, so "rollback" must mean "restore a verified dump".

### 8.3 F-18 — nomenclature: R-132's `Contradicted` label is wrong

R-132 classifies F-18 as `Contradicted`, on the basis that live tables are named `project_members` / `stock_transactions` / `stock_transaction_lines` while the documented target uses `project_memberships` / `stock_movements` / `stock_movement_lines`.

The contract map's §9 preamble (`phase-12-prototype-live-api-contract-map.md:1132-1134`) says:

> "## 9. Conceptual Target Schema (design only, no DDL)"
> "…**No column is asserted to exist in the legacy database unless it is readable from source**; anything the legacy code does not evidence is marked `[PROP]`."

Therefore the target names are explicitly a **design model**, not a claim about the live database. A design model that renames a concept does not contradict the live schema; it diverges from it. The `[REQ]` tags attach to behaviour ("this table is the scope authority"), not to the identifier.

Corrected label: `Verified` **naming divergence**, with "which name survives" `Unknown`. This matters because `Contradicted` implies R-132 caught the document asserting a false fact about the DB; it did not. The document was correctly labelled as design-only, and the implementer risk is "someone writes DDL from a design doc without checking §9's preamble" — a real but smaller risk.

**Severity:** `Medium` → **Low-Medium** (documentation/naming hygiene). **Owner decision `D-E`** is unchanged but should be framed as a naming decision, not a contradiction resolution.

### 8.4 C-22 … C-28 — corrected labels

| ID | R-132's contradiction | R-133 re-assessment | Label |
|---|---|---|---|
| C-22 | Adapter total 65 vs actual 68 | Correct. Independently recounted by AST | `Verified` |
| C-23 | `project_members` vs `project_memberships`; `stock_transactions` vs `stock_movements` | Not a contradiction; a naming divergence against an explicitly design-only model (§8.3) | `Verified` (divergence) / not `Contradicted` |
| C-24 | `auth.ts:20-24` says `req.user.permissions` is never consulted; `import.routes.ts:381,396` consult `can(ctx, …)` | Correct as a textual contradiction; out of this addendum's re-read scope beyond the cited lines | `Verified` (as cited) |
| C-25 | `errors.ts:5-6` says 4xx is data; `client.ts:42` throws on 4xx | Correct as cited | `Verified` (as cited) |
| C-26 | `projectScope.ts:6-12` "ONLY place" vs routes that bypass it | Correct as cited; the file header itself says "The ONLY place that answers…" | `Verified` (as cited) |
| C-27 | D6 described as "JSON → PostgreSQL" vs runtime already PostgreSQL with a dead JSON path | Correct as cited | `Verified` (as cited) |
| C-28 | Condition 10 assumes `pg_dump` capability; no such capability exists | The premise is false (§6). The contradiction R-132 records is with **its own finding**, not with the corpus | `Contradicted` |

C-23 and C-28 are the two entries that must not be carried forward as written. C-28 in particular is self-referential: it records a contradiction between the acceptance record and R-132's F-02, and F-02's premise is now corrected.

### 8.5 §13.1 "Net effect" — arithmetic does not reconcile with R-132's own table

R-132 §13.1 states (lines 887-888):

> "- **11 of 21** are genuinely closed at the text level (`Verified`).
> - **5** (`C-01`, `C-03`, `C-04`, `C-06`, `C-07`, `C-15` events) rest on asserted history…"

Recomputing from R-132's own §13 table:

| Group | IDs from R-132's table | Count |
|---|---|---:|
| Pure `Verified` | C-05, C-08, C-09, C-15, C-16, C-17, C-18, C-19, C-20, C-21 | **10** |
| `Verified` (text) / `Owner-Confirmed` (event) | C-06, C-07 | 2 |
| Pure `Owner-Confirmed` | C-01, C-02, C-04 | 3 |
| `Historical` | C-03, C-10 | 2 |
| `Inferred` | C-13 | 1 |
| `Unknown` | C-11, C-12, C-14 | 3 |
| **Total** | | **21** |

Defects in R-132's summary:

1. **"11 of 21" matches no partition of its own table.** Pure `Verified` is 10; including the two dual-labelled text halves gives 12. Eleven is not derivable.
2. **A bullet labelled "5" lists six identifiers** (`C-01`, `C-03`, `C-04`, `C-06`, `C-07`, `C-15`).
3. **`C-15` is misclassified in that bullet.** R-132's table labels C-15 `Verified (text)`, not asserted history.
4. **`C-02` is omitted from the bullet** although R-132's table labels it `Owner-Confirmed`.
5. **`C-13` (`Inferred`) is absent from the net-effect accounting entirely**, although it appears in the table.

Corrected statement: **10 of 21 are `Verified` at the text level; 12 if the two dual-labelled text halves are counted. 3 are `Owner-Confirmed`, 2 `Historical`, 1 `Inferred`, 3 `Unknown`.**

**Impact:** the verdict does not depend on this number, but R-132 §18 repeats it ("eleven of twenty-one historical contradictions are properly closed"). That sentence must not be quoted as-is. No severity or decision changes.

### 8.6 §16 "Exit-Criteria Traceability" — summary line compresses the matrix incorrectly

R-132 §16's table uses five distinct statuses. Its summary says (line 984):

> "**Score: 1 substantially met (with 3 corrected errors), 1 historical, 13 not met.**"

Recomputing from the same table:

| Status in table | Conditions | Count |
|---|---|---:|
| Substantially met | 4 | 1 |
| Historical | 3 | 1 |
| Partial | 13 | 1 |
| Not met | 1, 2, 5, 6, 7, 8, 9, 10, 11, 12, 14 | **11** |
| Not Authorized | 15 | 1 |
| **Total** | | **15** |

The summary's "13 not met" merges `Partial` (13) and `Not Authorized` (15) into `Not met`, and then reports 13 — which is neither the merged count (13 would be 11 + Partial(1) + NotAuthorized(1) = 13, so the total reconciles only by coincidence) nor a faithful restatement of the matrix. The table is right; the sentence is misleading. Corrected sentence: **1 substantially met, 1 historical, 1 partial, 11 not met, 1 not authorized.**

Additionally, two **basis** cells are now wrong:

- Condition 10: `Not met — capability absent` → corrected to `Not met — restore test not executed or recorded` (§6).
- Condition 11: `Not met — no mechanism` → corrected to `Not met — mechanism exists but covers 3/19 migrations, has no runner rollback, and lacks the four named recovery elements` (§6.4, §8.2).

The status column for both remains `Not met`. Only the basis changes. This is the correct outcome: the correction does not soften the gate, it renames the work required to pass it.

---

## 9. WS-F — D1 Traceability

### 9.1 The contested claim

R-132 §4.3 (line 157):

> "The two are mutually consistent | `Contradicted` | "Option B is selected as the architecture direction" and "Option A is the operative owner instruction" cannot both be the operative direction without a scope qualifier that changes the answer"

R-132 F-19 (line 828): classification `Contradicted`.

### 9.2 Direct evidence

- `phase-12-owner-decision-record.md:20`: "**Owner decision recorded:** Option B — logical separation with selective reuse — is selected as the architecture direction. It is not an execution authorization…"
- `phase-12-prototype-live-api-contract-map.md:100`: "**D1** | **Architecture Option B** — … *as recorded in the historical ODR*. **Architecture Option A is the operative owner instruction for the current scope**; the divergence is preserved, not resolved (§14.3, §14.4.2)."
- `phase-12-owner-acceptance-record.md` (header): the ODR is described as "the authoritative decision ledger and gate record".

### 9.3 Assessment

Two distinct questions were collapsed into one label.

| Question | Answer | Label |
|---|---|---|
| Do the two documents say different things about which option governs? | Yes, verbatim | `Verified` |
| Are the two statements **logically irreconcilable**? | No. "Architecture direction" and "operative instruction for the current scope" are different scopes. A direction can survive while a narrower operating instruction governs a bounded scope | `Contradicted` — R-132's inference is too strong |
| Is there a dated artefact recording an Option A instruction? | No artefact exists in the tree | `Verified` (absence) |
| Did the owner in fact issue such an instruction? | Not established either way | `Unknown` |
| Is the contract map's Option A sentence supported by the authoritative ledger? | No — the ledger records B only | `Verified` (unsupported assertion) |

So the correct characterisation is **an authority/provenance gap**, not a proven logical contradiction. R-132's own §4.3 acknowledges the scope qualifier and then dismisses it; the dismissal is not evidenced.

Corrected label for F-19: `Unknown` (authority/provenance), with the text divergence `Verified` and the absence of a superseding artefact `Verified`.

**Severity:** `High (governance)` — **unchanged**. The alignment claim still cannot be made.

**Owner decision `D-F`** — unchanged, and correctly worded: either file a dated instruction, or downgrade D-SPEC-15 to "divergence unresolved".

**Readiness impact:** none. D1 was already an open governance item.

---

## 10. Consolidated Correction Register

Each row states R-132's claim, the direct evidence, the corrected conclusion, the label, and the impact on severity / owner decision / exit readiness.

| ID | R-132 claim (location) | Direct evidence | Corrected conclusion | Label | Impact |
|---|---|---|---|---|---|
| X-01 | `markAllRead` clears every user's unread state (§1 item 3; §5.3 row 3; F-05) | `notification.service.ts:72-77` appends only `$1` (caller) and never removes or rewrites another user's entry | Per-user append; no cross-user mutation. Real defects are UI predicate, truncation, dedupe, recipient model | `Contradicted` | Severity High→Medium; `D-D` re-worded; exit unchanged |
| X-02 | Notification line ranges `:19-30`, `:36-52`, `:60-70` (§5.3; F-05) | Actual: `create` 19-47, `list` 49-62, `markAllRead` 72-77 | Citations drifted; correct ranges supplied | `Verified` | None (auditability only) |
| X-03 | Notification subsystem has "three distinct defects" (§5.3) | `NotificationBell.tsx:59` `!n.readBy.length` vs `system.routes.ts:61` `!n.readBy.includes(username)` | A fourth, user-visible defect exists: item styling and badge disagree per user | `Verified` | Adds a defect R-132 missed; severity Medium |
| X-04 | Dedupe stops after the first reader (§5.3) | `notification.service.ts:22-28` `array_length(read_by,1) IS NULL` | Correct as stated | `Verified` | None |
| X-05 | `crypto.randomUUID()` fails; nothing provides `crypto` (§1 item 2; §6 row 4) | `@types/node` 24.13.3 `web-globals/crypto.d.ts:31` global `var crypto`; `apps/api/tsconfig.json` `types:["node"]`; Node v26.7.0 | Typechecks and runs; not a defect | `Contradicted` | F-01 severity should be split (planning vs runtime); `D-B` fix smaller |
| X-06 | Failure swallowed, exit 0 (§6) | `:203-205` catch + `ROLLBACK`; `:211` `.catch(console.error)`; single `BEGIN` `:35` / `COMMIT` `:201` | Correct; additionally there are **no partial writes** | `Verified` | Bounds blast radius; `Critical (integrity)` invites a wrong reading |
| X-07 | No DB backup/restore "anywhere"; condition 10 unsatisfiable; no recoverable state (§1 item 1; §7.1; §16; §18) | `backup-db.ps1:16-28`, `backup-db-local.ps1:8-14`, `restore-db.ps1:24-40`, `install-service.ps1:44-49`, 14 dumps | Application lacks it; repository has it. Condition 10 unmet for want of a recorded restore test | `Contradicted` (scope) | Severity Critical→High; `D-A` re-worded; conditions 10/11 still Not met |
| X-08 | Dumps are evidence of capability (§7 implied) | Timestamps 12:00/11:00 vs 02:00 schedule; PG18 host vs PG16 container | Existence `Verified`; provenance and restorability `Unknown`; version mismatch `Inferred` | `Inferred` | Restore test must target a version-matched environment |
| X-09 | (not mentioned) | `backup-db-local.ps1:9` sets a hard-coded local DB password | Secret literal present in a script; value not reproduced here | `Verified` | Relevant to `D5`; new item |
| X-10 | Failure before the ledger write means "no ledger record at all" (§9.2) | Ledger written at `:348-359` and `:458-469` on the normal path, with counts and errors | True only for mid-loop death or ledger-insert failure | `Contradicted` (as stated) | F-13 severity Critical→High; `D-C` unchanged |
| X-11 | (not mentioned) | Ledger `await` is unguarded; Express 4.22.2; no process-level rejection handler | A ledger failure produces no response and a fatal rejection by default | `Verified` (shape) / `Inferred` (outcome) | New reliability finding |
| X-12 | "imported 40 of 100 is indistinguishable from imported 40 then crashed" (§9.2) | `totalRows: imported + failures.length` excludes skipped duplicates (`:355`, `:465`) | Ledger exists but undercounts by skipped duplicates | `Verified` | New accuracy defect |
| X-13 | F-18 classification `Contradicted` (§12) | Contract map §9 preamble: design only, no DDL; no column asserted to exist | Naming divergence, not contradiction | `Verified` (divergence) | Severity Medium→Low-Medium; `D-E` re-framed |
| X-14 | §1 item 4 cites `F-15` for the adapter count (§1) | F-14 is the adapter-count finding; F-15 is HTTP transport | Mis-citation | `Verified` | None |
| X-15 | "11 of 21" closed; "5" ids listed (§13.1) | Recomputation from R-132's own table | 10 pure `Verified` (12 with dual halves); bullet lists 6 under "5"; C-15 wrong; C-02 omitted; C-13 unaccounted | `Contradicted` | §18's "eleven" must not be quoted; verdict unchanged |
| X-16 | "1 substantially met, 1 historical, 13 not met" (§16) | Same table: 1 / 1 / 1 partial / 11 not met / 1 not authorized | Summary compresses the matrix incorrectly; two basis cells wrong | `Contradicted` | Conditions 10/11 remain Not met; work description changes |
| X-17 | Runner has "no rollback mode at all" (F-17) | `migrate.ts:47-59` wraps each migration in a transaction with `ROLLBACK` on failure | No **applied-migration** rollback; failure rollback exists | `Verified` (with qualifier) | Precision only; F-17 stands |
| X-18 | D1 statements are "mutually consistent = `Contradicted`" (§4.3) | ODR:20 (B = direction); contract map:100 (A = operative for current scope) | Reconcilable by scope; the unsupported element is the A instruction | `Unknown` (authority) | F-19 severity unchanged; `D-F` unchanged |
| X-19 | 24 uncommitted modifications (§14) | Current `git status --porcelain` = 27 (24 modified + 3 untracked) | Baseline drifted; not an error at R-132's time | `Verified` | None; this addendum states its own baseline |

---

## 11. Claims R-132 Got Right (re-verified here)

To keep the record balanced, the following were independently re-read and confirmed. Only items this addendum actually touched are listed.

| Claim | Evidence | Label |
|---|---|---|
| `backup.service.ts` has no `pg_dump`, `pg_restore`, `child_process`, or SQL | full-file read | `Verified` |
| Restore endpoint audits after executing the restore | `system.routes.ts:36-45`; `backup.service.ts:51-71` | `Verified` |
| Notifications have no recipient supplied on insert | `notification.service.ts:31-35` | `Verified` |
| `list()` is global with `LIMIT 100`; API slices to 30 | `notification.service.ts:51`; `system.routes.ts:62` | `Verified` |
| Dedupe semantics end at the first reader | `notification.service.ts:22-28` | `Verified` |
| `data-migration.ts` inserts the wrong `projects` columns | `:77` vs `001_initial_schema.sql:57-63` | `Verified` |
| `data-migration.ts` is never invoked | zero references | `Verified` |
| A populated `projects.json` makes the failure reachable | 761-byte file | `Verified` |
| No transaction in the import confirm routes | full-file read | `Verified` |
| 19 migrations, 3 `down/` scripts, runner ignores `down/` | directory listing + `migrate.ts` | `Verified` |
| Adapter total is 68, not 65 | AST recount | `Verified` |
| `projectScope.ts:6-12` claims to be the "ONLY place" | file header | `Verified` |
| Condition 11 contains a four-element parenthetical | `phase-12-owner-acceptance-record.md:182` | `Verified` |
| Contract map §9 is labelled design-only, no DDL | `:1132-1134` | `Verified` |

**Not re-verified here (outside this addendum's scope):** F-03, F-04, F-06 through F-12, F-15, F-16, F-19's non-D1 content, F-20, Workstream H, and §11 of R-132. Their absence from this table is **not** an endorsement and **not** a rejection.

---

## 12. New Findings and Residual Unknowns Introduced Here

These were not in R-132 and are recorded because they emerged from the same reads.

| ID | Finding | Evidence | Label |
|---|---|---|---|
| N-01 | Notification item styling uses a global "anyone read it" predicate while the badge is per-user | `NotificationBell.tsx:59`; `system.routes.ts:61` | `Verified` |
| N-02 | `notificationService.create(...)` is called without `await` at three sites, so a rejection is unhandled | `documents.routes.ts:352`; `material-requests.routes.ts:98`; `modules/stock/stock.factory.ts:105` | `Verified` (call shape) / `Inferred` (crash outcome) |
| N-03 | The import ledger write is unguarded and the API has no process-level rejection handler | `import.routes.ts:349`, `:459`; Express 4.22.2; zero handler hits | `Verified` / `Inferred` |
| N-04 | `total_rows` undercounts by the number of skipped duplicate rows | `:355`, `:465` vs `:301` | `Verified` |
| N-05 | Two PostgreSQL majors are referenced concurrently by the repository | `docker-compose.yml:4` (16-alpine) vs `backup-db-local.ps1:8` and `install-service.ps1:33` (18) | `Verified` (references) / `Unknown` (production) |
| N-06 | The daily backup task is scheduled for 02:00 but no dump carries a 02:00 timestamp | `install-service.ps1:48` vs `backups/` listing | `Unknown` |
| N-07 | A hard-coded local DB password exists in a backup script | `backup-db-local.ps1:9` (value not reproduced) | `Verified` |
| N-08 | Condition 11 requires four named recovery elements beyond a successful restore | `phase-12-owner-acceptance-record.md:182` | `Verified` |

Residual unknowns that this addendum **cannot** close:

| ID | Unknown | Why it remains open |
|---|---|---|
| Q-1 | Are the 14 dumps restorable? | Requires executing `restore-db.ps1` — `Not Authorized` |
| Q-2 | Which PG major is the operating target? | Requires owner confirmation and environment access |
| Q-3 | Is broadcast notification a defect or an intended product decision? | Business decision; `Unknown` |
| Q-4 | Did an owner ever issue the Option A instruction? | No artefact in the tree |
| Q-5 | Are the 2026-11 dumps evidence of the scheduled task or of manual runs? | Provenance not recorded |
| Q-6 | Was `backup-db-local.ps1`'s password ever a live credential? | Requires owner/D5 input; must not be inferred |

---

## 13. Impact on Severity, Owner Decisions, and Exit Readiness

### 13.1 Severity changes

| Finding | R-132 | R-133 | Reason |
|---|---|---|---|
| F-01 | Critical (integrity/planning) | Critical **as planning** / None **as runtime** | Unreferenced file; `crypto` leg removed; columns still wrong |
| F-02 | Critical (recoverability) | **High** | Scripts and dumps exist; the gap is an unproven restore and a version mismatch |
| F-05 | High | **Medium** | No cross-user mutation; residual is UI/server disagreement plus design question |
| F-13 | Critical | **High** | Ledger exists on the normal path; un-auditable only on crash/failure |
| F-17 | High | High (unchanged) | Precision qualifier only |
| F-18 | Medium | **Low-Medium** | Naming divergence against a design-only model |
| F-19 | High (governance) | High (unchanged) | Authority gap, not logical contradiction |

The risk ranking in R-132 §17.1 needs one adjustment: rank 4 ("cross-user notification state mutation, High likelihood") should fall or be replaced by "notification recipient model unresolved + UI read-state defect" at Medium. Rank 1 ("destructive migration with no recoverable backup") should read "with no **verified** recovery point".

### 13.2 Owner decisions

| Decision | Status after R-133 | What changes |
|---|---|---|
| `D-A` backup/restore scope | **Still required** | Re-worded: from "is backup in scope / build it" to "authorize a version-matched restore test and record evidence, or accept untested recovery in writing" |
| `D-B` repair vs retire `data-migration.ts` | **Still required** | Smaller repair: columns only; `crypto` is not a defect |
| `D-C` atomic vs partial-with-ledger | **Still required** | Unchanged in substance; add "make the ledger write durable and guarded" |
| `D-D` notification recipient model | **Still required** | Re-worded: choose recipient model or document broadcast; fix the client predicate regardless |
| `D-E` naming | **Still required** | Re-framed as a naming decision, not a contradiction |
| `D-F` D1 instruction | **Still required** | Unchanged; the absence of a dated instruction is the whole issue |
| `D-G` D6 scope | **Still required** | Unchanged (not re-audited here) |
| `D-H`, `D-I` | **Still required** | Unchanged |

No decision is closed by this addendum. No decision is newly authorised.

### 13.3 Exit readiness

| Question | Answer |
|---|---|
| Does the verdict change? | **No.** `BLOCKED — ADDITIONAL EVIDENCE REQUIRED — PHASE 12 REMAINS OPEN` |
| Does Phase 12 close? | **No** |
| Are conditions 10 and 11 met? | **No** — both remain `Not met` |
| Does the path to closing them change? | **Yes.** From "build a backup capability" to "execute and document a version-matched restore test, and supply the four named recovery elements" |
| Does Stage 3 become authorised? | **No** |
| Does Phase 13 become authorised? | **No** |
| Are D5 / D6 / D7 authorised? | **No** |

The single sentence that must change in any future citation of R-132 is: *"condition 10 is unsatisfiable by the shipped application."* It is not unsatisfiable. It is unproven, and proving it is a bounded, authorised task away.

---

## 14. Corrected Exit-Criteria Truth Table

Against `phase-12-owner-acceptance-record.md:170-184`. Statuses are R-132's unless marked; only the two corrected basis cells are changed.

| # | Condition | Status | Corrected basis |
|---|---|---|---|
| 1 | Isolated PG 18 environment | `Not met` | `0xC0000142` reproduced (`Historical`) |
| 2 | Repeat dry run on PG 18 | `Not met` | Blocked by 1 |
| 3 | D4 repair + green typecheck | `Historical` (2026-10-29) | Not re-run — `Not Authorized` |
| 4 | Contract map finalized | `Substantially met` | Adapter count and F-18 labelling still wrong (X-05, X-13) |
| 5 | D5 secret handling plan | `Not met` | `Not Authorized`; N-07 adds an unlisted secret-handling item |
| 6 | D6 field mapping + idempotency proof | `Not met` | Scope itself mis-stated (F-16) |
| 7 | D7 adapter design | `Not met` | Transport cannot authenticate (F-15) |
| 8 | Production baseline | `Not met` | U-2, U-3, U-4; N-05 adds PG-major ambiguity |
| 9 | Pre-migration validation queries | `Not met` | `Not Authorized` |
| 10 | Backup/snapshot `pg_dump` + restore test | `Not met` | **Capability exists; no executed/reviewed restore test is recorded** (X-07) |
| 11 | Rollback/recovery tested | `Not met` | **Mechanism exists (dump + 3 down scripts); covers 3/19, no runner rollback, and lacks the four named recovery elements** (X-07, X-17, N-08) |
| 12 | Session-revocation communication plan | `Not met` | `Not Authorized` |
| 13 | Owner approval at each gate | `Partial` | Phase 12 remains OPEN |
| 14 | Stage 3 entry criteria | `Not met` | Depends on 1-12 |
| 15 | Phase 13 chartering | `Not Authorized` | Blocked |

**Corrected score:** 1 substantially met, 1 historical, 1 partial, **11 not met**, 1 not authorized — 15 total.

**Corrected reading of conditions 10 and 11:** they are not "documentation only" and they are not "capability absent". They are **evidence-absent**: the mechanism exists, has never been exercised under a recorded, reviewed test, and condition 11 additionally demands four recovery artefacts that no script produces.

---

## 15. Authorization Audit — What This Addendum Did and Did Not Do

| Action class | Authorized | Executed | Evidence |
|---|---|---|---|
| Read repository files | Yes | Yes | every citation above |
| Read Git metadata (`branch`, `HEAD`, `status`) | Yes | Yes | §2.1 |
| Static trace of source, SQL, scripts, docs | Yes | Yes | §4-§9 |
| Machine count of exported adapter members (in-memory, no file written) | Yes | Yes | §8.1 |
| Create one new Markdown file | Yes | Yes | this file, sole write |
| Modify R-132 or any existing file | No | No | R-132 unchanged |
| Run tests / build / typecheck / lint / app | No | No | no process started |
| Execute SQL / connect to a database | No | No | no connection |
| Execute backup or restore | No | No | no script run |
| Production access | No | No | none |
| Read or print secrets / `.env` / credentials / tokens | **No** | **No** | the literal at `backup-db-local.ps1:9` is referenced, never reproduced |
| Install tooling or packages | No | No | none |
| Change services or system settings | No | No | none |
| Git write (add/commit/checkout/reset/clean/stash/merge/rebase/push) | No | No | none |
| Deploy | No | No | none |
| Start D5 / D6 / D7 / Stage 3 / Phase 13 | No | No | none |

**Integrity notes.**

1. `docs/` is untracked in this repository. Consequently **this file does not appear as a tracked change in `git status`**, exactly as R-132 noted for itself. An auditor comparing commits will not see it. This is a provenance hazard, not a defect of the addendum.
2. The working tree already contained 24 modified tracked files and 3 untracked paths before this review began. None was created, reverted, staged, or altered by this addendum.
3. No claim in this addendum is derived from a command whose output was not read. No output was paraphrased into a stronger label than it supports.
4. Where this addendum cites a line range, the range was read as a block. Where R-132's range was wrong, the correction is recorded (X-02).
5. This addendum is **not** an approval of R-132, **not** a remediation plan, **not** a closure record, and **not** an authorisation of any kind.

---

## 16. Final Recommendation for Phase 12

**Verdict, unchanged and singular:**

> ## `BLOCKED — ADDITIONAL EVIDENCE REQUIRED — PHASE 12 REMAINS OPEN`

**What this addendum establishes:**

1. R-132's **verdict is sound**. Four of its mechanisms are not.
2. The two findings that drive `BLOCKED` remain valid, but for narrower reasons:
   - F-01 is a real, unreferenced, schema-mismatched, silent-failure script — **and** its `crypto` objection is void.
   - F-02 is a real **evidence** gap — **not** a missing capability.
3. Two findings are **less severe** than stated (F-05, F-18) and one is **differently severe** (F-01: high for planning, nil at runtime).
4. Two **new** user-facing or operational defects were found in the same code R-132 read (N-01, N-03/N-04), so the correction is not a net reduction in findings.
5. R-132's §13.1 and §16 **summary lines must not be quoted**; their tables may be.

**Recommended next actions — for the owner, not for execution now:**

1. **Re-issue `D-A` in its corrected form.** Authorise a version-matched restore test (`restore-db.ps1` against an isolated PG major that matches the dump producer), record the command, the output, and the verification counts. Until that exists, condition 10 stays `Not met` — but it is now a bounded task, not an impossible one.
2. **Rule `D-C` and harden the import ledger.** Whichever model is chosen, the `import_history` write must be guarded and must not be able to turn a completed import into a hung request. Add skipped-duplicate rows to `total_rows`.
3. **Rule `D-D` on the notification recipient model, and fix `NotificationBell.tsx:59` regardless.** The client predicate is wrong under every possible recipient design; it does not need to wait for the schema decision.
4. **Rule `D-B` and `D-E` as small, separate items.** `D-B`: correct the column list and decide wire-or-delete. `D-E`: pick one naming set; no "contradiction" needs resolving.
5. **Do not re-open R-132's verdict on the strength of this addendum.** The corrections change *why* Phase 12 is blocked and *what* the remediation looks like. They do not change *whether* it is blocked. Conditions 10 and 11 remain `Not met`; condition 11 remains unreachable by a restore test alone.

**What is explicitly not claimed here:**

- Phase 12 is **not** complete.
- Phase 13 is **not** recommended.
- Stage 3 is **not** authorised.
- D5, D6, D7 are **not** authorised.
- No production fact is asserted.
- No `Inferred`, `Historical`, or `Owner-Confirmed` item was promoted.
- This addendum is **not** an approval of the remediation it describes.

---

**End of addendum.**

**No file other than this one was created or modified. No command beyond read-only inspection was executed. No database was contacted. No backup or restore was run. No secret value was printed. No Git write was performed.**
