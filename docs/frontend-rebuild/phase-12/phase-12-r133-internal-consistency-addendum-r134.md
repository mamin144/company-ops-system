# Phase 12 — R-134: R-133 Internal Consistency & Transaction-Proof Verification

**Type:** Read-only accuracy addendum. Not a remediation report, not an approval, not a closure record, not an authorisation.
**Subject:** `phase-12-r132-accuracy-addendum-r133.md` (R-133, 788 lines), which audits `phase-12-consolidated-evidence-remediation-report.md` (R-132, 1073 lines).
**Date:** 2026-11-04.
**Baseline verified at start of this review:** branch `main`, HEAD `f91ed2f9e81db3937e3bcbb1b44e5e2c44e175cf`, remote `mamin144/company-ops-system`, working tree 27 entries in `git status --porcelain` (24 modified + 3 untracked).
**Output:** this file, and only this file.
**Rule applied throughout:** no `Inferred`, `Historical`, `Owner-Confirmed`, or `Proposed` item is promoted to `Verified`. A correction is made only where a directly readable artefact contradicts R-133's text, or where R-133's own arithmetic contradicts its own register. Where this review could not establish a fact, the label is `Unknown` and the fact is not asserted.

---

## 1. Executive Verdict

R-133 is **substantially correct in substance and materially wrong in its own bookkeeping**. Its central corrections survive: R-132 did over-state four mechanisms, the backup capability does exist at repository scope, the import ledger does record the normal path, and the `crypto` objection is void. Those conclusions are re-confirmed here.

R-133 is nevertheless **not internally consistent**, in five distinct ways:

| # | Defect class | Location | Consequence |
|---|---|---|---|
| 1 | Its summary distribution table contradicts its own detailed register | §3 vs §10 | Four of nineteen IDs are filed under the wrong verdict; two of the three summary counts are wrong |
| 2 | It double-counts two corrections | §3, closing paragraph | The stated "six" plus "arithmetic pair (X-15, X-16)" counts the same two IDs twice |
| 3 | It asserts an action it did not perform | §1, §5.2, §10 X-05 | "It type-checks and runs" — neither a typecheck nor a run was authorised |
| 4 | It draws a fatal conclusion that its own evidence base reverses | §7.3, §7.4, §12 N-03, §16 | The API *does* install async-error forwarding (`express-async-errors` at `app.ts:1`); a ledger failure produces an HTTP 500, not a hung request or a fatal rejection |
| 5 | It says it did not read secrets while elsewhere establishing that it did read the line containing one | §2.4 vs §6.6 / §15 | Wording inconsistency that understates what the review touched |

Two further findings are **new**, not corrections of R-133:

- **Every one of the fourteen dumps is a PostgreSQL 18.4 custom-format archive** (`PGDMP`, archive format `1.16.0`, header version string `18.4`). R-133 left the producing major `Unknown`. It is now `Verified` on the producer side.
- **The only restore script restores into a PG 16 container.** The version mismatch R-133 called `Inferred` is a `Verified` structural mismatch between a 1.16.0 archive and a PG 16 `pg_restore`, with the runtime rejection still `Inferred` because it was not executed.

The net effect on the verdict is **nil**:

> **`BLOCKED — ADDITIONAL EVIDENCE REQUIRED — PHASE 12 REMAINS OPEN`**

The net effect on the *reason* is real: the backup remediation is now narrower and more concrete (produce and restore on PG 18, and repair the restore script), and the import-ledger remediation loses the "hung request" premise.

### 1.1 خلاصة عربية

- R-133 صحيح في جوهره، لكن **جداول ملخّصه تخالف سجلّه التفصيلي**: أربعة معرّفات من أصل 19 مصنَّفة في غير موضعها، وعدّان من ثلاثة عدّادات خاطئان.
- التوزيع الصحيح المستخرج من §10 هو: **6 Contradicted** (منها 4 آليات + 2 حساب) و**11 Verified** (إحداها X-11 مزدوجة المستوى) و**1 Inferred** (X-08) و**1 Unknown** (X-18) = 19.
- عبارة "It type-checks and runs" في R-133 **غير مصرَّح بها**: لم يُشغَّل typecheck ولا تنفيذ. الصحيح: توافر الـAPI وتعريفات TS وإعداد runtime كلها `Verified`، أما التنفيذ فـ`Not Authorized`.
- ادعاء أن فشل كتابة السجل يُنتج "طلبًا معلّقًا" ورفضًا قاتلًا **مُدحَض**: المشروع يستورد `express-async-errors` في `app.ts:1`، و`errorHandler` يردّ بـ500.
- ذرّية `data-migration.ts` **مدعومة بالمصدر**: كل العبارات تمر عبر `client` واحد من `pool.connect()`، مع `ROLLBACK` على نفس العميل و`release()` في `finally`.
- النسخ الاحتياطية الـ14 كلها أرشيف **PostgreSQL 18.4** (archive 1.16.0)، بينما `restore-db.ps1` يستعيد داخل حاوية **PG 16** — تعارض إصدارات مؤكَّد بنيويًا، غير مُختبر تنفيذيًا.
- الحكم النهائي لم يتغير: `BLOCKED — ADDITIONAL EVIDENCE REQUIRED — PHASE 12 REMAINS OPEN`. لا إغلاق، ولا تصريح لـStage 3 أو Phase 13 أو D5/D6/D7.

---

## 2. Repository Baseline and Provenance

### 2.1 What was verified before reading any claim

| Fact | Method (read-only) | Result |
|---|---|---|
| Repository root | working directory | `D:\Default Project\company-ops-system` |
| Branch | `git rev-parse --abbrev-ref HEAD` | `main` |
| HEAD | `git rev-parse HEAD` | `f91ed2f9e81db3937e3bcbb1b44e5e2c44e175cf` |
| Remote | `git config --get remote.origin.url` | `https://github.com/mamin144/company-ops-system.git` |
| Working tree | `git status --porcelain` | 27 entries (24 modified tracked + 3 untracked) |
| R-132 present | file test + read | 1073 lines, 61,635 B |
| R-133 present | file test + read | 788 lines, 60,025 B |
| Owner Acceptance Record present | file test + read | 194 lines, 15,099 B |
| Stage 2 Environment Plan present | file test + read | 244 lines, 21,278 B |
| R-134 target absent before this run | file test | did not exist |

The historical baseline named in the task is still the current HEAD. The working-tree count is unchanged from R-133's own observation, so R-133's baseline note (X-19) is correct for this session as well.

### 2.2 Provenance hazards that constrain every claim below

1. **`docs/` is untracked.** No document in this corpus — R-132, R-133, R-134 — is attributable to a commit. An auditor comparing commits will not see any of them. This is a provenance hazard in the corpus, not a defect of this addendum, and it is repeated here because R-133 relies on it in X-19.
2. **`backups/` is gitignored.** The fourteen dump files are not repository artefacts; they are host state. Their existence is observable, their authorship is not recorded anywhere.
3. **`scripts/install-service.ps1` is one of the 24 modified tracked files.** Its working-tree diff against HEAD is exactly one line:

   ```diff
   @@ -9 +9 @@
   -$ProjectRoot = 'C:\Users\PC-01\Documents\Default Project\company-ops-system'
   +$ProjectRoot = 'D:\Default Project\company-ops-system'
   ```

   The `-At 02:00` trigger line is **not** part of the modification; it is identical to HEAD. This matters because R-133 cites `install-service.ps1:48` for the schedule, and that citation is unaffected by the working-tree drift. What the file says is still only what the file says — it is not evidence of what is installed.
4. **Line numbers in R-133 were taken against this working tree**, not against HEAD. Since twelve route files and one script are modified, a line citation is valid only for the current tree. This review re-resolved every citation it relied on.

### 2.3 Method

For every contested statement in R-133:

1. Quote the statement verbatim, with its section and line.
2. Re-read the primary artefact — not R-133's paraphrase of it — as a block.
3. Recompute any arithmetic from the artefact's own numbers.
4. Assign a label using R-133's own §3 taxonomy, so that a disagreement is about evidence, not about vocabulary.
5. Record the effect on severity, on owner decisions, and on exit readiness — separately, because they are not the same thing.

Dump files were examined by reading their **first 4096 bytes** through `System.IO.File.OpenRead`. This is a byte read of a file on disk. It is not a database connection, not a `pg_restore`, and not an execution of any script.

### 2.4 What this addendum did not do

- Did not modify R-132, R-133, the Owner Acceptance Record, the Stage 2 plan, or any other existing file.
- Did not run tests, builds, typechecks, linters, or start the application.
- Did not run `data-migration.ts` or any SQL; did not connect to any database.
- Did not run `backup-db.ps1`, `backup-db-local.ps1`, or `restore-db.ps1`.
- Did not inspect or change Windows Task Scheduler state.
- Did not access production.
- Did not read any `.env` file. `.env.example` was read; it contains documented placeholders, not credentials.
- Did not install tooling or change services or device settings.
- Did not perform any Git write operation.

A note on secrets is deferred to §8, because the wording there is itself one of the findings.

---

## 3. R-133 Correction-Register Classification Reconciliation

### 3.1 The register is authoritative; the summary is not

R-133 states its distribution twice. §10 (lines 567-587) gives one row per ID with a `Label` column. §3 (lines 95-103) gives an aggregate table. They disagree. The §10 register is the only place where each label is attached to the evidence that produced it, so §10 is treated as authoritative and §3 is reconciled against it.

Extracted directly from the `Label` column of §10:

| ID | §10 label (verbatim) | Primary verdict |
|---|---|---|
| X-01 | `Contradicted` | Contradicted |
| X-02 | `Verified` | Verified |
| X-03 | `Verified` | Verified |
| X-04 | `Verified` | Verified |
| X-05 | `Contradicted` | Contradicted |
| X-06 | `Verified` | Verified |
| X-07 | `Contradicted` (scope) | Contradicted |
| X-08 | `Inferred` | **Inferred** |
| X-09 | `Verified` | Verified |
| X-10 | `Contradicted` (as stated) | Contradicted |
| X-11 | `Verified` (shape) / `Inferred` (outcome) | **Verified, dual-level** |
| X-12 | `Verified` | Verified |
| X-13 | `Verified` (divergence) | Verified |
| X-14 | `Verified` | Verified |
| X-15 | `Contradicted` | Contradicted |
| X-16 | `Contradicted` | Contradicted |
| X-17 | `Verified` (with qualifier) | Verified |
| X-18 | `Unknown` (authority) | **Unknown** |
| X-19 | `Verified` | Verified |

### 3.2 Corrected distribution

| Verdict | Count | IDs |
|---|---:|---|
| `Contradicted` | **6** | X-01, X-05, X-07, X-10, X-15, X-16 |
| `Verified` (primary) | **11** | X-02, X-03, X-04, X-06, X-09, X-11, X-12, X-13, X-14, X-17, X-19 |
| `Inferred` | **1** | X-08 |
| `Unknown` | **1** | X-18 |
| **Total** | **19** | X-01 … X-19 |

`X-11` is counted once, under `Verified`, because its first-level verdict is `Verified` (the *shape* of the defect is directly readable). It carries a second level, `Inferred`, for the *outcome*. R-133 is correct not to force a single label here, and this addendum preserves both levels rather than collapsing them.

`Verified` decomposes as **10 pure + 1 dual (X-11) = 11**.

### 3.3 Functional reconciliation of the same 19 IDs

The labels above are the authoritative count. A functional breakdown is given because the task asks for reconciliation of specific correction classes; it partitions the same 19 IDs and does not replace §3.2.

| Class | Count | IDs |
|---|---:|---|
| Substantive factual reversals (`Contradicted`) | **6** | X-01, X-05, X-07, X-10, X-15, X-16 |
| — of which mechanism reversals | 4 | X-01 (notification SQL), X-05 (`crypto`), X-07 (backup scope), X-10 (import ledger) |
| — of which arithmetic reversals | 2 | X-15 (13.1 counts), X-16 (§16 summary) |
| Citation-only corrections | **2** | X-02 (line ranges), X-14 (F-15 → F-14 register ID) |
| Evidence-classification corrections | **3** | X-08 (implied → `Inferred`), X-13 (`Contradicted` → `Verified` divergence), X-18 (`Contradicted` → `Unknown` authority) |
| Qualification-only correction | **1** | X-17 (adds the "applied-migration" qualifier) |
| Confirmations (no defect found) | **2** | X-04 (dedupe semantics), X-06 (transaction/rollback shape) |
| New findings introduced by R-133 | **4** | X-03 (fourth notification defect), X-09 (secret literal), X-11 (unguarded ledger write), X-12 (`total_rows` undercount) |
| Baseline note (not a defect) | **1** | X-19 |
| **Total** | **19** | |

Check: 6 + 2 + 3 + 1 + 2 + 4 + 1 = 19. ✓

Every stated total in this addendum is reproducible from the §10 register by reading one column.

### 3.4 The four §3 misplacements

| ID | §3 table row | §3 count contribution | §10 truth | Direction |
|---|---|---|---|---|
| X-18 | `Contradicted` | counts toward 7 | `Unknown` (authority) | over-stated by one |
| X-08 | `Verified` | counts toward 10 | `Inferred` | over-stated by one |
| X-14 | `Unknown` / `Inferred` | counts toward 2 | `Verified` | under-stated by one |
| X-19 | `Unknown` / `Inferred` | counts toward 2 | `Verified` | under-stated by one |

The third row is additionally mis-captioned: it is headed "`Unknown` / `Inferred` (downgrade of an over-claim)", but its only two members are both labelled `Verified` in the same sentence. The caption describes no member of the row.

### 3.5 The double count

§3 closes with:

> "The substantive reversal count is therefore **six**, plus one mis-classification (X-13) and one arithmetic contradiction pair (X-15, X-16)."

`X-15` and `X-16` **are two of the six**. The sentence therefore asserts 6 + 1 + 2 = 9 substantive items while the register supports 6. The correct decomposition is: four mechanism reversals (X-01, X-05, X-07, X-10) **plus** two arithmetic reversals (X-15, X-16) **equals** six. The arithmetic pair is inside the six, not additional to it.

This is the only place where R-133's §1 ("materially wrong on four of its stated mechanisms") and §3 ("six") can be reconciled: four mechanisms + two arithmetic errors = six reversed claims. The two sentences are consistent with each other once the double count is removed; they were never inconsistent about the four mechanisms.

---

## 4. F-01 Transaction Guarantee Reassessment

### 4.1 The six questions, answered from source

`apps/api/src/database/data-migration.ts` is 211 lines. Every statement relevant to the transaction is enumerated below from a direct read of the file.

| # | Question | Answer | Evidence | Label |
|---|---|---|---|---|
| 1 | Does the script acquire one dedicated `PoolClient` via `pool.connect()`? | **Yes** | `:31` `const client = await pool.connect();` | `Verified` |
| 2 | Do all transaction statements run through that same client? | **Yes** | `BEGIN` `:35`; data statements `:40, 52, 64, 76, 88, 100, 110, 124, 136, 148, 160, 169, 183, 193`; `COMMIT` `:201`; `ROLLBACK` `:204` — all `client.query(...)` | `Verified` |
| 3 | Does any statement instead use `pool.query()`? | **No.** The only other `pool` references are `pool.connect()` at `:31` and `pool.end()` at `:211` | exhaustive `pool\.` scan of the file | `Verified` |
| 4 | Is the client reliably released? | **Yes on both paths** — `client.release()` sits in the `finally` block at `:207` | `:203-208` | `Verified` |
| 5 | Can the error path issue `ROLLBACK` on the same client? | **Yes** — the `catch` at `:203` calls `client.query('ROLLBACK')` on the same `client` | `:203-205` | `Verified` |
| 6 | Can any write occur outside the intended transaction? | **No write does.** Every `INSERT` is a `client.query` between `BEGIN` and `COMMIT`; there is no autocommit-path write in the file | full-file read | `Verified` (source) / `Inferred` (runtime) |

The node-postgres requirement — one connection for the whole transaction — is satisfied structurally. R-133's statement that "a single transaction wraps the whole script" (§5.3, `:244`) and that there are "no partial writes" (§5.3, `:250`) is therefore **supported by source and needs no substantive correction**.

### 4.2 What R-133 over-claimed, and what it under-claimed

Two boundary errors remain, and neither is a reversal:

**(a) Runtime behaviour was never exercised.** The `Verified` label is correct for "the source is written this way". It is not correct for "the transaction committed successfully against a live server". No execution was authorised in R-133 or in this review. The correct composite is `Verified` (source) / `Not Authorized` (execution).

**(b) The "process still exits 0" claim is right for the wrong currency.** `:211` is:

```ts
run().then(() => pool.end()).catch(console.error);
```

On the failure path the `.then` is skipped, so `pool.end()` is **never called**. `client.release()` returns the connection to the pool, and `connection.ts:18` sets `idleTimeoutMillis: 30000`. The process therefore stays alive until the pool's idle timer closes the connection — up to ~30 s — and then exits with code 0, because `.catch(console.error)` neither rethrows nor sets `process.exitCode`. "Exits 0" is `Verified`; "immediately" would not be, and R-133 does not claim it. The observable difference matters for a supervisor: a 30-second linger is not a hang, but it is not an instant exit either. The 30-second figure is `Inferred` (from `idleTimeoutMillis`), not measured.

### 4.3 `crypto.randomUUID()` — four levels, separated

R-133's §1 row 2, §5.2 `:232`, and §10 X-05 all assert: *"It type-checks and runs."* Neither a typecheck nor a run was authorised in R-133, and neither has been authorised here. That sentence must be withdrawn as an assertion and replaced by a level-by-level statement.

| Level | Claim | Evidence | Label |
|---|---|---|---|
| API availability | Node provides `globalThis.crypto` (Web Crypto) from Node 19 onward | Node `v26.7.0` reported by the environment; documented platform behaviour | `Verified` (platform fact) |
| TypeScript declarations | `@types/node` 24.13.3 declares a **global** `var crypto` | `node_modules/@types/node/web-globals/crypto.d.ts:31` | `Verified` |
| Target runtime configuration | `apps/api/tsconfig.json` enables `"types": ["node"]`; no `NODE_OPTIONS` or `--no-experimental-global-webcrypto` appears in `package.json`, `apps/api/package.json`, `Dockerfile.api`, or `docker-compose.yml` | those four files | `Verified` |
| **Actual execution / typecheck of this script** | **Not performed** in R-133 or R-134 | no run authorised | **`Not Authorized`** |

Conclusion: the *defect* claim in R-132 ("`crypto.randomUUID()` fails because nothing provides `crypto`") is `Contradicted` — correctly. But the *positive* claim "it type-checks and runs" is an unauthorised empirical assertion. The honest formulation is:

> All four preconditions that would make `crypto.randomUUID()` resolve are verified in source and configuration; no typecheck or execution was run, so "it compiles and runs" is `Inferred`, not `Verified`.

The substantive outcome for F-01 is unchanged: the `crypto` leg of R-132's objection is void, and the load-bearing defect remains the wrong `projects` column list at `:77`.

---

## 5. F-02 Backup Task and Dump Provenance Reassessment

### 5.1 The seven facts, separated

R-133 collapsed several of these. Each is now stated on its own evidence.

| Fact | Statement | Evidence | Label |
|---|---|---|---|
| **A** | A repository script **defines** a scheduled task | `scripts/install-service.ps1:44-50`: `New-ScheduledTaskAction` → `backup-db-local.ps1`; `New-ScheduledTaskTrigger -Daily -At 02:00`; `Register-ScheduledTask -TaskName 'CompanyOps-Backup' -User 'SYSTEM' -RunLevel Highest` | `Verified` (text) |
| **B** | The task is **installed and enabled** on the host | Not inspectable — Task Scheduler inspection prohibited | **`Unknown`** |
| **C** | The task has **executed successfully** | No execution log, no transcript, no `Last Run Result` artefact in the tree; `apps/api/logs/` covers the API service, not the task | **`Unknown`** |
| **D** | The dump files **exist** | 14 files in `backups/`, 2026-10-14 12:00 → 2026-11-04 11:00, 275,691–285,743 B | `Verified` |
| **E** | The dump files are **valid PostgreSQL custom-format** archives | All 14 begin with the `PGDMP` magic and declare archive format `1.16.0`, `intSize=4`, `offSize=8`, `format=1`, `compression=1` (see §5.2) | `Verified` |
| **F** | The dumps were **produced by the scheduled task** | Producer signature does not match either repository script's command line (see §5.3); file times do not match the 02:00 trigger | **`Unknown`** |
| **G** | The dumps **can be restored successfully** | Requires executing `restore-db.ps1` | **`Not Authorized`** |

A does not imply B. B does not imply C. D does not imply E, F, or G. E does not imply G. R-133 respected this for B, C, and G but was loose on E and F: it treated "14 `.dump` files" as evidence of existence only, and separately called a backup having "ever run" `Historical` on the strength of the same file list.

### 5.2 What the dump headers actually say

Reading the first 4096 bytes of each file is sufficient to establish format and producer class, because the custom-format header carries both.

| Field | Value, all 14 files | How established |
|---|---|---|
| Magic | `PGDMP` (`50 47 44 4D 50`) | bytes 0-4, ASCII |
| Archive format version | `1.16.0` (`01 10 00`) | bytes 5-7 |
| Integer size / offset size | `4` / `8` | bytes 8-9 |
| Format code | `1` (custom) | byte 10 |
| Compression | `1` | byte 11 |
| Source server version string | **`18.4`**, appearing immediately after the database name `cos_db` | printable-ASCII scan of the header block |
| `DATABASE` TOC entry | present, containing `CREATE DATABASE cos_db WITH TEMPLATE = template0 …` | same block |

Two cautions, stated so that this addendum does not repeat the error it is auditing:

- `1.16.0` is the **archive format** version written by `pg_dump`, **not** the server version. It is not evidence, by itself, that the server was 18.x.
- The string `18.4` is read directly (`Verified` bytes). That its position in the header is the source-server version field is `Inferred` from `pg_dump`'s custom-format layout. The two pieces agree, and the database locale recorded in the archive — `Arabic_Egypt.utf8` — is a **Windows** locale name, which is consistent with a native Windows PostgreSQL installation rather than a Linux `postgres:16-alpine` container.

**Conclusion for E:** all fourteen dumps are structurally valid custom-format archives produced from a PostgreSQL **18.4** server. This upgrades R-133's "which major produced them" from `Unknown` to `Verified` for the producer.

### 5.3 Why F stays `Unknown` — and is now weaker than R-133 assumed

Three independent observations push against attributing these files to `CompanyOps-Backup` → `backup-db-local.ps1`:

1. **The command line does not reproduce the artefact.** `backup-db-local.ps1:15` is `& $pgDump -U cos -h 127.0.0.1 -p 5432 -Fc -f $hostFile cos_db` — no `-C` / `--create`. `backup-db.ps1:24` is `docker exec … pg_dump -U $dbUser -Fc -f … $dbName` — also no `-C`. But every one of the fourteen archives contains a `DATABASE` TOC entry with `CREATE DATABASE`, which `pg_dump` emits only under `--create`. The producing command therefore passed a flag that **neither repository script passes**. (`Verified`: the TOC entry is present. `Inferred`: the flag was `--create`.)
2. **The producer is PG 18, the Docker script's container is PG 16.** `docker-compose.yml:4` pins `postgres:16-alpine`. A dump taken inside that container cannot carry a `1.16.0` archive header or a `18.4` source version. So `backup-db.ps1` is excluded as producer. That leaves the host-native PG 18 path — but see (1), and see (3) for the target database.
3. **The file times do not match the trigger, and they move.** Ten files are stamped `12:00`; the last four are stamped `11:00`. The trigger at `install-service.ps1:48` is `-Daily -At 02:00`, and the filename stamp is generated locally by `Get-Date -Format 'yyyy-MM-dd_HH-mm'` (`:10`). A local-time 02:00 job would produce `02-00` names. It does not. The `12:00 → 11:00` step occurs at the 2026-10-29 → 2026-11-01 boundary, which coincides with the end of Egypt's daylight-saving period; a step of exactly −1 h at that boundary is consistent with a fixed-UTC trigger around 09:00 UTC and inconsistent with a fixed local 02:00 trigger. (`Inferred` from timestamps; the scheduling configuration that would confirm it is not in the tree and Task Scheduler must not be inspected.)

**Conclusion for F:** `Unknown`, unchanged in label, but now with a documented positive reason to doubt the attribution rather than merely a missing record. R-133's Q-5 ("Are the 2026-11 dumps evidence of the scheduled task or of manual runs?") remains open; this review narrows it to "manual or ad-hoc run of a PG 18 command with `--create`, or a scheduled job other than the one the repository defines".

### 5.4 The version mismatch is now Verified on the structural side

R-133 called the restore path "at minimum unsupported" and labelled it `Inferred` (§6.3, `:308`). With the producer major established, the two ends can be named:

| End | Artefact | Evidence | Label |
|---|---|---|---|
| Producer | PostgreSQL **18.4**, streamed to a `1.16.0` custom archive, host `127.0.0.1:5432` | dump headers; `backup-db-local.ps1:8,15` | `Verified` (producer major) / `Unknown` (which job) |
| Consumer | `pg_restore` **inside** container `company-ops-postgres`, defined as `postgres:16-alpine` | `restore-db.ps1:22,28-32`; `docker-compose.yml:4-5` | `Verified` |
| Compatibility gate | `pg_restore` refuses an archive whose format version exceeds the one it was built for | documented tool behaviour, not exercised here | `Inferred` |
| Actual rejection | Would `pg_restore` fail on these files? | not executed | **`Not Authorized`** |

So the corrected statement is: **the restore path is structurally mismatched — a PG 18.4 / 1.16.0 archive against a PG 16 consumer — and the mismatch is `Verified`; the rejection itself is `Inferred` and must be demonstrated before it is asserted as observed.** R-133's error was to label the whole thing `Inferred` while elsewhere treating the mismatch as established.

Note also the target-database mismatch that R-133 did not record: `backup-db-local.ps1:15` dumps **`127.0.0.1:5432`** (host-native), whereas `restore-db.ps1` restores into the **Docker container** whose published port is `127.0.0.1:5433` (`docker-compose.yml:16`). The two scripts therefore address different servers regardless of version. Which of the two the running API uses is determined by `DATABASE_URL`, which lives in `.env` and was not read — so it is `Unknown`.

### 5.5 A correction to how R-133 counted "has a backup ever run"

R-133 §6.5 `:330` answers "Has a backup ever run? — Yes — 14 dumps exist — `Historical`". The label is wrong on its own terms. `Historical` means "recorded as having happened; not reproducible from the tree". A dump file is not a record of an event; it is an artefact of one. What the artefact proves is that *some* `pg_dump` process completed against a PG 18.4 server fourteen times. It does not prove *which* process, whether it was the scheduled task, or whether the run was supervised.

Correct formulation: **"At least fourteen dump-producing operations completed — `Verified` (artefact). Whether any of them was the scheduled task — `Unknown`."**

This is not pedantry: `D-A` is worded around "a version-matched restore test", and the owner needs to know whether the existing recovery points come from the controlled job or from ad-hoc runs.

### 5.6 The task-definition language in §1

R-133 §1 `:20` says the repository "ships … a daily 02:00 scheduled task". What the repository ships is a **script that would register** such a task. Whether it was ever run, and whether the task exists on the host, is B and C above — both `Unknown`.

---

## 6. F-13 Error-Semantics Reassessment

### 6.1 The decisive artefact R-133 missed

`apps/api/src/app.ts` line 1 is:

```ts
import 'express-async-errors';
```

`express-async-errors@3.1.1` is a declared dependency (`apps/api/package.json:21`), resolved in the repository lockfile, and installed at `node_modules/express-async-errors` (version 3.1.1). It patches Express 4's router layer so that a rejected promise returned by an `async` handler is passed to `next(err)` instead of escaping as an unhandled rejection.

Express itself is `^4.21.2` (`apps/api/package.json:20`), installed at **4.22.2** at the repository root. R-133's factual statement about Express — that Express 4 does not natively catch rejected async handlers — is true. It is also **not dispositive**, because the application installs that behaviour explicitly.

### 6.2 The seven verification points

| # | Point | Finding | Evidence | Label |
|---|---|---|---|---|
| 1 | Normal completion path | Both confirm routes write the ledger after the loop, then respond | `import.routes.ts:348-361`; `:458-471` | `Verified` |
| 2 | Per-row failure behaviour | Each row is caught individually; failure is pushed to `failures`, loop continues | `:310-345`; `:432-455` | `Verified` |
| 3 | Ledger-write failure path | The ledger `await` is **unguarded** (no `try/catch`), so a rejection propagates out of the handler | `:349-359`; `:459-469` | `Verified` |
| 4 | Process termination during the row loop | A crash between row inserts leaves previously inserted rows committed, with no ledger row | sequential `await` per row, no transaction in the route file | `Verified` (shape) / `Inferred` (event) |
| 5 | Is the rejected promise forwarded to Express? | **Yes** — `express-async-errors` is imported before any router is constructed | `app.ts:1`; `routes/index.ts` imported at `app.ts:7` | `Verified` |
| 6 | Process-level rejection handler outside routes? | **None exists** — zero matches for `unhandledRejection`, `uncaughtException`, or `process.on(` across all of `apps/api/src` | recursive scan | `Verified` |
| 7 | Are skipped duplicates in total row counts? | **No.** `continue` at `:301` skips a duplicate before any counter is touched; `totalRows` is `imported + failures.length` | `:301`, `:355`, `:465` | `Verified` |

Point 5 is the one R-133 got wrong, and point 6 is the one it read as if point 5 did not exist. Those two facts are individually true and jointly decisive in the opposite direction.

### 6.3 What actually happens on a ledger-write failure

`express-async-errors` converts the rejection into `next(err)`. `apps/api/src/middleware/errors.ts:7-32` is a four-argument Express error handler that ends in:

```ts
res.status(status).json({ message });
```

with `status` defaulting to `500` for an error carrying no `.status` and no mapped PostgreSQL `code`.

Therefore, on the ledger-write failure path:

| Question | R-133's answer | Corrected answer | Label |
|---|---|---|---|
| Is a response sent? | No — "no response is sent" | **Yes — an HTTP 500 JSON body** | `Contradicted` |
| Does the request hang? | Yes | **No** | `Contradicted` |
| Is the rejection fatal to the process? | "fatal by default" | **No — it is caught and routed to the error middleware** | `Contradicted` |
| Do the imported rows remain? | Yes (implied) | **Yes — each row was its own auto-committed statement** | `Verified` |
| Is there a ledger row? | No (implied) | **No** | `Verified` |
| Is the partial state unauditable? | Yes | **Yes — but the client is told the request failed, and the rows are still there** | `Verified` |

So the residual F-13 defect is real and is arguably *worse* than a hang in one respect: the client receives a clean `500`, may retry, and the retry duplicates the already-inserted rows, because nothing marks them. That is a concrete, describable risk that R-133's "hung request" framing concealed.

### 6.4 Severity and decision impact

R-133 set F-13 from `Critical` to `High`. That remains correct, for a different reason: the un-auditable window is bounded to (a) mid-loop process death and (b) ledger-insert failure, and in case (b) the failure is now known to be *visible* to the client rather than silent. Severity stays **High**, unchanged.

`D-C` (atomic import vs explicitly-partial-with-ledger) remains required. Its wording should change in one respect: R-133's recommended action ("must not be able to turn a completed import into a hung request") targets a failure mode that does not exist on the established path. The correct requirement is that a ledger failure must not leave committed rows without a record, and must not invite a duplicate-producing retry.

---

## 7. Exit-Criteria Arithmetic and Citation Corrections

### 7.1 The condition-4 citation is wrong in both slots

R-133 §14, row 4 (`:700`):

> "| 4 | Contract map finalized | `Substantially met` | Adapter count and F-18 labelling still wrong (X-05, X-13) |"

Neither cited ID supports the basis it is attached to:

- **X-05** is the `crypto.randomUUID()` correction. It has nothing to do with adapter counts or with the contract map's completeness.
- **X-13** is the F-18 table-naming classification correction. It supports the "F-18 labelling" half, and only that half.
- The **adapter-count** finding is established in **§8.1** (AST recount: `mockApi` 22, `stockApi` 5, `lookups` 2, `boqApi` 6, `ipcApi` 9, `mrApi` 9, `userApi` 11, `reportApi` 4 → 68 actual vs 65 documented) and its register entry is **X-14** (the `F-15` → `F-14` mis-citation). A third, adjacent fact is §8.1's own correction that R-132 §1 item 4 attributes the finding to `F-15`, which is the HTTP-transport finding.

Corrected basis for condition 4: **"Adapter count corrected to 68 against 65 documented (§8.1), and its register mis-citation corrected (X-14); F-18 labelling corrected (X-13)."**

**Status is unchanged: `Substantially met`.** A citation error is not evidence that the condition's substance moved, and the task's instruction — do not change a status because its explanation needs correction — is respected here.

**Observation, offered and not acted on:** condition 4's own text (`phase-12-owner-acceptance-record.md:175`) requires "per-endpoint HTTP method/request shapes generated". That clause points at the HTTP-transport finding `F-15`, which R-133 explicitly separated from the adapter count in §8.1. R-133's basis therefore omits the one finding that bears on the condition's literal wording. Whether that omission changes condition 4's status is **not** decided here: verifying F-15 was outside R-133's and this addendum's scope, and the status is left untouched.

### 7.2 The fifteen-condition score reconciles

Recount from the §14 table itself:

| Status | Count | Condition numbers |
|---|---:|---|
| `Not met` | **11** | 1, 2, 5, 6, 7, 8, 9, 10, 11, 12, 14 |
| `Historical` | **1** | 3 |
| `Substantially met` | **1** | 4 |
| `Partial` | **1** | 13 |
| `Not Authorized` | **1** | 15 |
| **Total** | **15** | 1-15 |

11 + 1 + 1 + 1 + 1 = 15. ✓

R-133 §14 `:713` states "1 substantially met, 1 historical, 1 partial, 11 not met, 1 not authorized — 15 total". That sentence is arithmetically **correct** and agrees with every row of its own table. No correction to the score is required. The only defect in §14 is the row-4 citation.

For completeness: R-133's X-16 correction of R-132's "1 substantially met, 1 historical, 13 not met" is therefore sound. R-132's summary compressed a five-way matrix into three buckets and lost the `Partial` and `Not Authorized` rows.

### 7.3 Statuses that must not move

| Condition | Status | Why it must not move |
|---|---|---|
| 4 | `Substantially met` | Citation repair only |
| 10 | `Not met` | Dump provenance is now better understood, and restorability is still unproven |
| 11 | `Not met` | Unchanged; the four named recovery elements are still absent, and R-133's N-08 is unaffected |
| 3 | `Historical` | Not re-run; `Not Authorized` |

---

## 8. Secret-Handling Evidence Wording Review

### 8.1 The four states, separated

Four different things are routinely collapsed into "did not read secrets". They are not the same:

| State | Meaning | Establishable from the tree? |
|---|---|---|
| **S1** — value not reproduced | The value appears in no output, quotation, log, or summary | Yes, by inspection of the artefacts |
| **S2** — literal detected | A credential-shaped assignment was observed at a known location | Yes, by reading the line |
| **S3** — value actually read | The characters of the value entered the reviewing process | Yes — and it is unavoidable if S2 is established by reading the file |
| **S4** — value not accessed | The file or region was never opened | Only if the line was never read |

An honest review that establishes S2 by reading a script has performed S3. It can still truthfully claim S1. It cannot claim S4.

### 8.2 Where R-133 says what

| Location | R-133 text | State actually supported |
|---|---|---|
| §2.4 `:75` | "Did not read or print `.env`, credentials, tokens, or secrets." | **S4 is false** for `backup-db-local.ps1:9`; S1 is true |
| §6.6 `:345` | "sets `PGPASSWORD` to a hard-coded local database password literal. The value is **not** reproduced anywhere in this addendum." | **S2 + S1 — accurate** |
| §15 `:733` | "Read or print secrets / `.env` / credentials / tokens \| **No** \| **No** \| the literal at `backup-db-local.ps1:9` is referenced, never reproduced" | The "Executed: No" cell is **wrong** for "read"; the evidence cell is right |
| §16 `:788` | "No secret value was printed." | **S1 — accurate** |

The corpus is therefore self-consistent everywhere except §2.4 and the `Executed` cell of §15, which overreach from S1 to S4.

### 8.3 Corrected formulation

The canonical wording should be the §6.6 form, generalised:

> The file containing the credential literal was read in order to establish that the literal exists and to cite its exact line. The value was not reproduced, quoted, paraphrased, or copied into any artefact produced by this review, and no `.env` file was opened. Reading the containing line is not the same as treating the value as evidence, but it is reading; the claim made is **not reproduced**, not **not read**.

Applied to this addendum: `scripts/backup-db-local.ps1` was read with line 9 replaced by a marker before any output was produced. The file content was therefore processed by the review, and the value never entered any quotation, table, summary, or log written to disk. `.env` was not opened at any point; `.env.example` was read and contains the documented placeholder `change-me`, which is not a credential.

### 8.4 Consequence

This is a wording defect in an audit document about evidence discipline, so it matters more than its size suggests. R-133's authority audit is otherwise scrupulous — it correctly records "no database contacted", "no script run", "no Git write" — and one overstated cell weakens the whole table by inviting the reader to ask what else was overstated.

No severity, owner decision, or exit condition is affected. `N-07` (the literal exists, value not reproduced) stands as `Verified`.

---

## 9. Consolidated Correction Register

Each row gives R-133's original statement, the exact evidence location, the corrected statement, the evidence classification, and the effect. Rows are ordered by R-133 section.

| ID | R-133 original statement (location) | Exact evidence location | Corrected statement | Label | Effect on severity / owner decision / exit readiness |
|---|---|---|---|---|---|
| **R134-C01** | "`Contradicted` \| 7 \| X-01, X-05, X-07, X-10, X-15, X-16, **X-18**" (§3 `:99`) | R-133 §10 `:586` labels X-18 `Unknown` (authority) | `Contradicted` = **6**: X-01, X-05, X-07, X-10, X-15, X-16. X-18 is `Unknown` | `Verified` | None on severity or exit; corrects the audit's own arithmetic |
| **R134-C02** | "`Verified` … \| 10 \| X-02, X-03, X-04, X-06, **X-08**, X-09, X-11, X-12, X-13, X-17" (§3 `:100`) | R-133 §10 `:576` labels X-08 `Inferred` | X-08 moves to `Inferred`; `Verified` = **11** (adding X-14, X-19) | `Verified` | None |
| **R134-C03** | "`Unknown` / `Inferred` (downgrade of an over-claim) \| 2 \| X-14 (mis-citation, `Verified`), X-19 (baseline drift, `Verified`)" (§3 `:101`) | R-133 §10 `:582`, `:587` — both labelled `Verified` | Row has zero members: X-14 and X-19 are `Verified`; the `Unknown`/`Inferred` row holds X-08 and X-18 only | `Verified` | None |
| **R134-C04** | "The substantive reversal count is therefore **six**, plus one mis-classification (X-13) and one arithmetic contradiction pair (X-15, X-16)" (§3 `:103`) | R-133 §10 `:583`, `:584` — X-15 and X-16 are two of the six `Contradicted` | "Four mechanism reversals (X-01, X-05, X-07, X-10) **plus** two arithmetic reversals (X-15, X-16) **equals** six" | `Verified` | None; removes a double count |
| **R134-C05** | "It type-checks and runs." (§1 `:19`; §5.2 `:232`; §10 X-05 `:573`) | No typecheck or execution was authorised in R-133 or R-134 | "API availability, TS declarations, and runtime configuration are each `Verified`; compilation and execution are `Not Authorized` and therefore `Inferred`" | `Not Authorized` (execution) / `Verified` (each precondition) | F-01 severity unchanged; `D-B` unchanged; no exit effect |
| **R134-C06** | "A single transaction wraps the whole script … `Verified`" and "**No partial writes.**" (§5.3 `:244`, `:250`) | `data-migration.ts:31` `pool.connect()`; `:35` `BEGIN`; all 14 inserts + `:201` `COMMIT` + `:204` `ROLLBACK` via `client.query`; `:207` `release()` in `finally`; no `pool.query` | **Confirmed at source.** Every transaction statement uses the one dedicated client. Add the boundary: this is `Verified` (source) / `Not Authorized` (execution) | `Verified` (source) | None; R-133's conclusion stands |
| **R134-C07** | "Failure is caught, logged, rolled back, and the process still exits 0" (§5.3 `:245`) | `:211` `run().then(() => pool.end()).catch(console.error)`; `connection.ts:18` `idleTimeoutMillis: 30000` | "Exits 0" is `Verified`. On failure `pool.end()` is never called, so the process lingers until the pool idle timer closes the connection (~30 s, `Inferred`) before exiting 0 | `Verified` (exit 0) / `Inferred` (duration) | None; affects how a supervisor would observe the failure |
| **R134-C08** | "the *repository* ships … a daily 02:00 scheduled task" (§1 `:20`); "Daily schedule \| `CompanyOps-Backup` … \| `Verified`" (§6.2 `:293`) | `install-service.ps1:44-50` defines the task; no evidence of installation or execution | "The repository ships a **script that would register** a daily 02:00 task. Installation (B) and execution (C) are `Unknown`" | `Verified` (script text) / `Unknown` (B, C) | `D-A` unchanged; wording becomes "authorise and supervise", not "the task already runs" |
| **R134-C09** | "Which PostgreSQL major produced them? … `Verified` (both references) / `Unknown` (which is production)" (§6.3 `:307`; §12 N-05 `:626`) | All 14 dumps: `PGDMP`, archive `1.16.0`, header version string `18.4`, Windows locale `Arabic_Egypt.utf8` | Producer major = **PostgreSQL 18.x**, `Verified`. Which server the running API targets remains `Unknown` (`.env` not read) | `Verified` (producer) / `Unknown` (API target) | Narrows `D-A`: the restore target must be **PG 18**, not "any version" |
| **R134-C10** | "Is the restore path version-matched? … at minimum unsupported \| `Inferred`" (§6.3 `:308`) | Producer: PG 18.4 archive `1.16.0` (dump headers; `backup-db-local.ps1:8,15`). Consumer: `postgres:16-alpine` (`docker-compose.yml:4`), `pg_restore` invoked in that container (`restore-db.ps1:28-32`) | The mismatch is **`Verified` structurally** (PG 18.4 / 1.16.0 archive → PG 16 consumer). The actual rejection is `Inferred`; no restore was run | `Verified` (structure) / `Inferred` (rejection) | Raises the confidence of the top recovery risk; `D-A` must name PG 18 explicitly |
| **R134-C11** | "Were the dumps produced by the 02:00 task? … `Unknown` — provenance not established" (§6.3 `:309`) | Times: ten at `12:00`, four at `11:00`; trigger `-At 02:00` (`install-service.ps1:48`); **every** archive carries a `DATABASE`/`CREATE DATABASE` TOC entry, which requires `--create`; neither `backup-db-local.ps1:15` nor `backup-db.ps1:24` passes `-C` | `Unknown` **retained**, with a positive reason to doubt attribution: the producing command carried a flag no repository script passes, and the timestamps never match 02:00 | `Unknown` (attribution) / `Verified` (flag mismatch) | Strengthens Q-5; `D-A` should require the recovery point's provenance, not just its existence |
| **R134-C12** | "Has a backup ever run? \| Yes — 14 dumps exist \| `Historical`" (§6.5 `:330`) | 14 files in `backups/`; no run log, no transcript | "At least fourteen dump-producing operations completed — `Verified` (artefact). Whether any was the scheduled task — `Unknown`" | `Verified` (artefact) / `Unknown` (agent) | Corrects the label; no status change |
| **R134-C13** | "Scripts and dumps exist; the gap is an unproven restore **and a version mismatch**" (§13.1 `:651`) | As C09-C10 | The version mismatch is no longer a hedge: producer 18.4 vs consumer 16 is `Verified`. The gap is an unproven, and currently mis-targeted, restore | `Verified` | F-02 severity stays **High**; the remediation now includes editing `restore-db.ps1` |
| **R134-C14** | "Express is 4.22.2, which does not catch rejected async handlers \| `Verified`" (§7.3 `:379`) | `app.ts:1` `import 'express-async-errors'`; `apps/api/package.json:21` `^3.1.1`; installed `node_modules/express-async-errors` v3.1.1; Express 4.22.2 at root | True of Express alone, **not dispositive**: the application installs async-error forwarding before any router is constructed. The isolated fact is `Verified`; any conclusion drawn from it without this fact is not | `Verified` (fact) / **material omission** | Invalidates the inference built on it (C15) |
| **R134-C15** | "no response is sent; the request hangs, and on current Node the rejection is fatal by default \| `Inferred`" (§7.3 `:381`); "take the response with it? … `Inferred`" (§7.4 `:390`); N-03 (§12 `:624`) | `app.ts:1` + `middleware/errors.ts:7-32` (`res.status(status).json({ message })`, default 500) | A ledger-write rejection is forwarded to the error handler and answered with **HTTP 500 JSON**. The request does not hang; the process does not die. The rows remain committed with no ledger row, and a client retry can duplicate them | **`Contradicted`** | F-13 stays **High**; `D-C` re-worded (see C16); no exit-status change |
| **R134-C16** | "the `import_history` write must be guarded and must not be able to turn a completed import into a hung request" (§16 `:769`) | As C15 | "…must be guarded so that a ledger failure cannot leave committed rows unrecorded, and must not invite a duplicate-producing retry" | `Verified` (requirement) | Changes what the owner must ask for; `D-C` still required |
| **R134-C17** | "No `unhandledRejection` or `uncaughtException` handler exists in `apps/api/src` \| `Verified`" (§7.3 `:380`); N-03 | recursive scan of `apps/api/src/**/*.ts` — zero matches | **Correct**, and now correctly bounded: absent, but not load-bearing, because `express-async-errors` handles route-level rejections. Process-level handling is still absent for rejections raised **outside** a request (see N-02 in R-133) | `Verified` (absence) / `Inferred` (crash outcome for non-route rejections) | N-02 survives; N-03 does not |
| **R134-C18** | "`totalRows` omits skipped duplicates \| `Verified`" (§7.3 `:382`; N-04 `:625`) | `:301` `continue` fires before any counter; `:355` and `:465` `totalRows: imported + failures.length` | **Confirmed.** Duplicates skipped under `skipDuplicates` are counted in neither successes nor failures | `Verified` | Unchanged; N-04 stands as an accuracy defect |
| **R134-C19** | "Adapter count and F-18 labelling still wrong (**X-05**, X-13)" (§14 `:700`) | §8.1 adapter AST recount (68 vs 65); §10 X-14 for the register mis-citation; `:581` X-13 for F-18 | Basis = "adapter count 68 vs 65 (§8.1, X-14); F-18 labelling (X-13)". **X-05 is unrelated and must be removed** | `Verified` | Condition 4 stays **`Substantially met`** |
| **R134-C20** | "Did not read or print `.env`, credentials, tokens, or secrets" (§2.4 `:75`); "Read or print secrets … **No** \| **No**" (§15 `:733`) | §6.6 `:345` establishes the literal at `backup-db-local.ps1:9` was observed and cited by line | "The containing line was read in order to establish and cite the literal. The value was **not reproduced** anywhere. No `.env` was opened" | `Verified` (S2 + S1) / `Contradicted` (S4) | None on severity or exit; restores the integrity of the authorisation table |
| **R134-C21** | "No secret value was printed" (§16 `:788`) | As C20 | Accurate as written. It does not establish "not read", and should not be cited as if it did | `Verified` | None |

**Count:** 21 corrections. Of these:
- **4** are classification/arithmetic repairs internal to R-133 (C01-C04);
- **1** is an unauthorised-claim withdrawal (C05);
- **2** are boundary refinements that leave R-133's result intact (C06, C07);
- **5** are backup-provenance corrections or upgrades (C08-C12), with one downstream severity-basis correction (C13);
- **4** are F-13 error-semantics corrections (C14-C17);
- **1** is a citation repair (C19);
- **1** is a confirmation (C18);
- **2** are secret-wording repairs (C20, C21).

---

## 10. Remaining Unknowns

These are open after R-134. None may be closed by inference.

| ID | Unknown | Why it remains open | Class |
|---|---|---|---|
| **U-1** | Are the fourteen dumps restorable at all? | Requires running `pg_restore` — `Not Authorized` | `Not Authorized` |
| **U-2** | Would a PG 16 `pg_restore` reject these 1.16.0 archives? | Structurally unavoidable, but not executed. The rejection is `Inferred`, not observed | `Inferred` |
| **U-3** | Which PostgreSQL server does the running API use — host PG 18 on 5432, or the PG 16 container on 5433? | Determined by `DATABASE_URL` in `.env`, which was not opened. `install-service.ps1:33` declares `DependOnService postgresql-x64-18`, which is suggestive, not conclusive | `Unknown` |
| **U-4** | Is `CompanyOps-Backup` installed, enabled, and succeeding on the host? | Task Scheduler inspection prohibited | `Not Authorized` |
| **U-5** | Did the scheduled task produce any of the fourteen dumps? | No run log; producer command carried `--create`, which no repository script passes | `Unknown` |
| **U-6** | Why do the dumps carry `--create`, and what command produced them? | Not recorded in the tree | `Unknown` |
| **U-7** | Does `express-async-errors` behave identically in the compiled `dist/` build used by the Windows service? | Requires building and running — `Not Authorized`. The source-level import precedes all router construction, which is the condition the package requires | `Inferred` |
| **U-8** | What does a ledger-write failure actually return to the client, end to end? | Requires inducing a failure — `Not Authorized` | `Inferred` |
| **U-9** | Does `data-migration.ts` roll back correctly against a live server? | Requires execution — `Not Authorized` | `Not Authorized` |
| **U-10** | Is the credential literal at `backup-db-local.ps1:9` a live credential? | Requires owner/D5 input; must not be inferred | `Unknown` |
| **U-11** | Does condition 4's "per-endpoint HTTP method/request shapes" clause fail because of F-15? | F-15 was outside both R-133's and this addendum's scope | `Unknown` |

U-2, U-7, and U-8 are `Inferred` rather than `Unknown` because a mechanism is established and only its runtime expression is unobserved. The distinction matters for `D-A` and `D-C`: an `Inferred` mechanism is a testable hypothesis; an `Unknown` is a missing fact.

---

## 11. Effect on Owner Decisions and Phase 12 Readiness

### 11.1 Owner decisions

| Decision | Status after R-134 | What changed |
|---|---|---|
| **`D-A`** backup/restore scope | **Still required** | Now three-part: (i) repair `restore-db.ps1` so its consumer matches a PG 18 producer — today it restores into a PG 16 container; (ii) execute a restore against a PG 18 target and record the command, output, and verification counts; (iii) establish and record the **provenance** of the recovery point, since the existing dumps cannot be attributed to the scheduled job |
| **`D-B`** repair vs retire `data-migration.ts` | **Still required** | Unchanged. `crypto` is not a defect (C05). The column list at `:77` is. Source-level atomicity is confirmed (C06) |
| **`D-C`** atomic import vs partial-with-ledger | **Still required** | Wording changes: the risk is not a hung request (C15) but committed rows with no ledger row plus a 500 that invites a duplicating retry. Add: count skipped duplicates in `total_rows` (C18) |
| **`D-D`** notification recipient model | **Still required** | Unchanged; not re-audited here |
| **`D-E`** naming | **Still required** | Unchanged |
| **`D-F`** D1 instruction | **Still required** | Unchanged |
| **`D-G`** D6 scope | **Still required** | Unchanged (X-18 downgrade already recorded by R-133) |
| **`D-H`, `D-I`** | **Still required** | Unchanged |

No decision is closed here. No decision is newly authorised. `D-A` becomes more precise and therefore *more* actionable, not easier.

### 11.2 Exit conditions

| Condition | After R-134 | Basis |
|---|---|---|
| 4 — Contract map finalized | **`Substantially met`** (unchanged) | Citation repaired (C19). A citation error does not move a condition |
| 10 — Backup + restore test | **`Not met`** | Still no recorded restore test. The producer/consumer mismatch is now `Verified`, which makes a naive restore test a *known* failure rather than a possible one |
| 11 — Rollback/recovery tested | **`Not met`** | Unchanged. The four named recovery elements remain absent; a successful restore closes only the first |
| 15-condition score | **11 / 1 / 1 / 1 / 1 = 15** | Confirmed from §14; no change |

### 11.3 Severity

| Finding | R-133 | R-134 | Reason |
|---|---|---|---|
| F-01 | Critical (planning) / None (runtime) | **Unchanged** | `crypto` leg still void; source atomicity confirmed; execution untested |
| F-02 | High | **High** — basis strengthened | Version mismatch upgraded from `Inferred` to `Verified` (structural); restorability still unproven |
| F-05 | Medium | **Unchanged** | Not re-audited |
| F-13 | High | **High** — basis corrected | Failure mode is a visible 500 with committed, unrecorded rows — not a hang |
| F-17 | High | **Unchanged** | Not re-audited |
| F-18 | Low-Medium | **Unchanged** | Not re-audited |
| F-19 | High | **Unchanged** | Not re-audited |

No severity decreases. One basis strengthens (F-02), one basis corrects without moving the level (F-13).

### 11.4 Readiness

| Question | Answer |
|---|---|
| Does the verdict change? | **No** — `BLOCKED — ADDITIONAL EVIDENCE REQUIRED — PHASE 12 REMAINS OPEN` |
| Does Phase 12 close? | **No** |
| Are conditions 10 and 11 met? | **No** — both remain `Not met` |
| Does the path to closing condition 10 change? | **Yes, concretely.** From "run a restore test" to "repair the restore target to PG 18, then run it, then record it" |
| Does the path to closing condition 11 change? | **No** — the four named recovery elements are still absent |
| Does Stage 3 become authorised? | **No** |
| Does Phase 13 become authorised? | **No** |
| Are D5 / D6 / D7 authorised? | **No** |

---

## 12. Final Recommendation

**Verdict, unchanged and singular:**

> ## `BLOCKED — ADDITIONAL EVIDENCE REQUIRED — PHASE 12 REMAINS OPEN`

**What this addendum establishes:**

1. **R-133's substantive corrections survive.** R-132 did over-state four mechanisms; the backup capability does exist at repository scope; the import ledger does record the normal path; the `crypto` objection is void. R-134 confirms all four.
2. **R-133's own bookkeeping does not survive.** Four of nineteen IDs are filed under the wrong verdict, two of three summary counts are wrong, and the "six" is double-counted. The correct distribution, reproducible from R-133's own §10, is **6 `Contradicted` / 11 `Verified` (one dual-level) / 1 `Inferred` / 1 `Unknown` = 19**.
3. **R-133 asserted an action it did not perform.** "It type-checks and runs" must be withdrawn; the four evidence levels separate cleanly, and execution is `Not Authorized`.
4. **R-133's transaction claim is correct at source.** One `PoolClient`, every statement through it, `ROLLBACK` on the same client, `release()` in `finally`, no `pool.query`. Runtime remains untested.
5. **R-133's error-semantics claim is wrong, and it depends on an artefact R-133 did not cite.** `express-async-errors@3.1.1` is imported at `app.ts:1` and installed. A ledger-write rejection becomes an HTTP 500 through `errorHandler`; the request does not hang and the process does not die. The defect that remains — committed rows, no ledger row, retry-induced duplication — is real, is `Verified` in shape, and is *not* the defect R-133 described.
6. **The backup provenance question can now be answered on the producer side.** All fourteen dumps are PostgreSQL **18.4** custom archives (archive format `1.16.0`, header version string `18.4`, Windows locale). They were **not** produced by `backup-db.ps1` (PG 16 container) and are **not** reproducible by `backup-db-local.ps1` as written (no `--create`, and every archive carries a `DATABASE` TOC entry).
7. **The restore path is structurally mismatched, not merely suspect.** A PG 18.4 / 1.16.0 archive is fed to a `pg_restore` inside a `postgres:16-alpine` container. The mismatch is `Verified`; the rejection is `Inferred` and must be demonstrated.
8. **One secret-handling sentence in R-133 overstates what it did.** The value was not reproduced — which is the claim that matters — but the containing line was read, and "not read" is not supported.

**Recommended next actions — for the owner, not for execution now:**

1. **Re-issue `D-A` in its three-part form** (§11.1): repair the restore consumer to PG 18, execute a restore against a PG 18 target, and record the recovery point's provenance. Until an executed, reviewed restore exists, condition 10 stays `Not met`.
2. **Rule `D-C` on the corrected risk.** Guard the `import_history` write so a failure cannot leave committed rows unrecorded, and so a client retry cannot silently duplicate the import. Count skipped duplicates in `total_rows`.
3. **Do not re-open R-132's verdict on the strength of R-134.** The corrections change *why* Phase 12 is blocked and *what* the remediation looks like. They do not change *whether* it is blocked.
4. **Do not quote R-133 §3, §7.3, §7.4, or the condition-4 basis cell of §14.** Use §10 for the register, §6.6 for secret wording, and this addendum's §7 for the exit-criteria basis. R-133's §10 remains the best single-page summary in the corpus of what R-132 got wrong.

**What is explicitly not claimed here:**

- Phase 12 is **not** complete.
- Phase 13 is **not** recommended.
- Stage 3 is **not** authorised.
- D5, D6, D7 are **not** authorised.
- No production fact is asserted.
- No `Inferred`, `Historical`, or `Owner-Confirmed` item was promoted to `Verified`.
- No database was contacted; no script was executed; no dump was restored.
- This addendum is **not** an approval of R-132 or of R-133.

---

**End of addendum.**

**No file other than this one was created or modified. No command beyond read-only inspection was executed. No database was contacted. No backup or restore was run. No secret value was reproduced. No Git write was performed.**
