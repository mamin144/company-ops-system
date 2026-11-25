# Phase 12 — R-135: PostgreSQL Archive Metadata and Backup Provenance Verification

**Document:** `docs/frontend-rebuild/phase-12/phase-12-r134-postgresql-archive-correction-r135.md`
**Review date:** 2026-11-05
**Audits:** R-134 (`phase-12-r133-internal-consistency-addendum-r134.md`), specifically §5.2, §5.3, §5.4, §11.1, §12 item 6, and the uncertainty register entries U-5/U-6.
**Type:** Read-only correction. No migration, backup, restore, database connection, service action, or Git write.
**Status:** `BLOCKED — ADDITIONAL EVIDENCE REQUIRED — PHASE 12 REMAINS OPEN`

---

## 1. Document Control and Executive Verdict

| Field | Value |
|---|---|
| Repository | `D:\Default Project\company-ops-system` |
| Branch | `main` |
| HEAD | `f91ed2f9e81db3937e3bcbb1b44e5e2c44e175cf` |
| Remote | `https://github.com/mamin144/company-ops-system.git` |
| Working-tree state before review | 27 porcelain entries — 24 modified, 3 untracked |
| Working-tree state after review | Unchanged; no tracked file touched; one new untracked document (this file) |
| Archives examined | 14 of 14 in `backups/` |
| Executed operations | `pg_restore --list` variants only (PostgreSQL 18.4 binary) |
| Files modified | None |

### 1.1 Verdict

R-134's **factual observation is correct and survives**: all fourteen custom-format archives contain a genuine `DATABASE` TOC entry whose definition is a `CREATE DATABASE cos_db …` statement.

R-134's **inference from that observation is false**: the presence of a `DATABASE` entry does **not** prove that `pg_dump` was invoked with `-C`/`--create`. For non-text archive formats, `pg_dump` writes the `DATABASE` entry unconditionally, and the documentation states that `-C` *is ignored when emitting an archive (non-text) output file*. The `-C` that matters at listing/restore time is a **`pg_restore`** option, and it controls only whether the entry is *used*, not whether it was *written*.

Consequences:

1. R-134's positive reason to doubt the producer — "the producing command carried a flag no repository script passes" — is **withdrawn**.
2. The specific exclusion of `backup-db-local.ps1` "as written" in R-134 §12 item 6 is **withdrawn**. `backup-db-local.ps1` is fully capable of producing these archives, and it remains the leading repository candidate.
3. Provenance (R-134 fact **F**, uncertainty **U-5**) remains **`Unknown`**, but on the two surviving reasons only: the filenames/timestamps never match the repository's `02:00` trigger, and no execution log exists. That is weaker evidence than R-134 claimed, not stronger.
4. The archive format string `1.16.0` is written by **both PostgreSQL 17 and PostgreSQL 18** (`K_VERS_MINOR` is `16` in both branches). It cannot identify the client as 18.x. The producer evidence is the two version *strings*: `remoteVersionStr = 18.4` (source server) and `PG_VERSION = 18.4` (client).
5. A PostgreSQL 16 `pg_restore` rejects `1.16.0` in `ReadHead` before any TOC processing, because `1.16.0 > K_VERS_MAX = 1.15.255`. This is now `Verified` **from source**, not executed (no PG 16 binary is installed locally).
6. Nothing is unblocked. Condition 10 remains **Not met**; condition 11 remains **Not met**; `D-A` remains required. Phase 12 remains **OPEN**.

### 1.2 خلاصة عربية

- الملاحظة الواقعية في R-134 صحيحة: جميع الأرشيفات الأربعة عشر تحتوي فعلاً على مُدخل `DATABASE` يحمل `CREATE DATABASE cos_db …`.
- لكن الاستنتاج خاطئ: وجود المُدخل **لا يُثبت** استخدام `pg_dump --create`. فـ `pg_dump` يكتب مُدخل `DATABASE` دائماً في الأرشيفات غير النصية، والتوثيق ينص على أن `-C` **يُتجاهل** عند إخراج أرشيف غير نصي.
- `-C` المؤثر في السرد والاستعادة هو خيار **`pg_restore`**، وهو يحدد هل يُستخدم المُدخل، لا هل كُتب.
- لذلك يُلغى "دليل التعارض" الذي استند إليه R-134، ويُلغى استبعاد `backup-db-local.ps1`.
- سلسلة `1.16.0` يكتبها كلٌّ من PostgreSQL 17 و18؛ فهي لا تحدد العميل بـ 18 وحدها. الدليل هو `remoteVersionStr = 18.4` (الخادم) و`PG_VERSION = 18.4` (العميل).
- `pg_restore` من الإصدار 16 يرفض `1.16.0` في `ReadHead` قبل معالجة الفهرس، لأن `1.16.0 > 1.15.255`.
- الحالة تبقى: `BLOCKED — ADDITIONAL EVIDENCE REQUIRED — PHASE 12 REMAINS OPEN`.

---

## 2. Repository Baseline and Evidence Boundary

### 2.1 Baseline verified before any claim was read

| Check | Result | Label |
|---|---|---|
| Branch is `main` | `main` | `Verified` |
| HEAD | `f91ed2f9e81db3937e3bcbb1b44e5e2c44e175cf` | `Verified` |
| Remote | `https://github.com/mamin144/company-ops-system.git` | `Verified` |
| Porcelain entries before review | 27 (24 modified, 3 untracked) | `Verified` |
| Existing work preserved | No checkout, reset, stash, clean, or add performed | `Verified` (no write issued) |
| Target document absent before creation | `Test-Path` → absent | `Verified` |
| `backups/` archive count | 14 | `Verified` |
| Archive name range | `cos_db_2026-10-14_12-00.dump` … `cos_db_2026-11-04_11-00.dump` | `Verified` |
| Archive size range | 275,691 – 285,743 bytes | `Verified` |

`docs/` is untracked and `backups/` is gitignored in this working tree, so creating this document does not change the 27-entry porcelain count. No `git add` was performed.

### 2.2 Documents read

| Document | Role in this review |
|---|---|
| `phase-12-consolidated-evidence-remediation-report.md` (R-132) | Original backup/restore findings; read for the claims R-133/R-134 correct |
| `phase-12-r132-accuracy-addendum-r133.md` (R-133) | Intervening corrections; read for §6.3, §6.5, §10, §15 |
| `phase-12-r133-internal-consistency-addendum-r134.md` (R-134) | **Object of this audit**; exact text at `:261`, `:279`, `:283-286`, `:292-296`, `:304-311`, `:494`, `:528-529`, `:546`, `:608`, `:614` |
| `phase-12-owner-acceptance-record.md` | Conditions 10 and 11 (`:170-186`), closing status (`:188-194`) |
| `phase-12-stage-2-environment-plan.md` | Script descriptions (`:95-99`) |
| `phase-12-owner-decision-record.md` | `D-A` framing (read-only cross-check) |

### 2.3 Files inspected

| File | Purpose | Sensitive handling |
|---|---|---|
| `backups/cos_db_*.dump` (14) | Byte-level header parse; TOC listing | No file modified; opened read-only |
| `scripts/backup-db-local.ps1` | Producer candidate (host PG 18) | Line 9 printed as `<REDACTED — literal not reproduced>` |
| `scripts/backup-db.ps1` | Producer candidate (Docker) | No secret lines present |
| `scripts/restore-db.ps1` | Consumer candidate | No secret lines present |
| `scripts/install-service.ps1` | Task trigger and service dependency | No secret lines present |
| `docker-compose.yml` | Image pin and published port | No secret lines present |

### 2.4 Evidence boundary

- **No database was contacted.** No connection string was used; `.env` was not opened.
- **No script was executed.** `backup-db-local.ps1`, `backup-db.ps1`, `restore-db.ps1`, and `install-service.ps1` were read only.
- **No backup or restore was run.** No `pg_dump`, no `psql`, no `pg_restore` restore mode.
- **Task Scheduler was not inspected.** Task installation and last-run state remain `Unknown`.
- **No migration was executed.** No test, build, typecheck, or lint was run.
- **No Git write occurred.** No stage, commit, push, branch, or tag.
- **No software was installed.** The PostgreSQL 18.4 and 17.11 binaries already present on the host were used in listing mode only; PostgreSQL 16 is absent.

---

## 3. Method, Tools, and Executed Operations

### 3.1 Permitted operation

The only executable operation used against the archives was:

```
"C:\Program Files\PostgreSQL\18\bin\pg_restore.exe" --list [--create] [--verbose] <file>
```

Version recorded: `pg_restore (PostgreSQL) 18.4`.

`pg_restore` is **not** on `PATH`; the absolute path above was used for every invocation so that no other installation could be selected implicitly.

| Installation | Path | State |
|---|---|---|
| PostgreSQL 18 | `C:\Program Files\PostgreSQL\18\bin\pg_restore.exe` | Present, 18.4 |
| PostgreSQL 17 | `C:\Program Files\PostgreSQL\17\bin\pg_restore.exe` | Present, 17.11 |
| PostgreSQL 16 | `C:\Program Files\PostgreSQL\16\bin\pg_restore.exe` | **Absent** |

### 3.2 Header parser

The header was parsed directly from bytes, independently of `pg_restore`, using the layout in `WriteHead()` (`src/bin/pg_dump/pg_backup_archiver.c`, `REL_18_STABLE`):

```
"PGDMP" (5 bytes)
version major, minor, rev (1 byte each)
intSize, offSize, format, compression algorithm (1 byte each)
7 × WriteInt  (sec, min, hour, mday, mon, year, isdst)
WriteStr(dbname)
WriteStr(remoteVersionStr)
WriteStr(PG_VERSION)
```

`WriteInt` is **not** a plain big-endian integer. It writes one sign byte, then `intSize` little-endian bytes. With `intSize = 4`, every integer occupies **5 bytes**. `WriteStr` writes a length as a `WriteInt`, then exactly that many bytes with **no NUL terminator**.

This encoding is validated empirically: with it, the seven date integers reproduce each file's timestamp to the second, and the header ends at byte offset **76** in all fourteen files. A naive 4-byte big-endian parse does not align and was discarded.

### 3.3 Listing modes and count reconciliation

Three listing modes were applied to all fourteen archives:

| Mode | Purpose | Entry lines |
|---|---|---|
| `--list` | Default listing; applies restore-option filtering | **160** |
| `--list --create` | Same, with `createDB` set | **161** |
| `--list --verbose` | Bypasses the filter, prints every TOC entry | **164** |

Reconciliation (identical in all 14 files):

```
164  header TOC count (also printed by --verbose)
-160  default listing
=  4  entries hidden by default
      = ENCODING (special) + STDSTRINGS (special) + SEARCHPATH (special) + DATABASE (createDB-gated)
```

And:

```
161  with --create
-160  default
=  1  DATABASE entry only
```

Observed across **3 modes × 14 files = 42 listing observations**, with **0 non-zero exit codes**. Every `--list` and `--list --create` invocation exited 0.

### 3.4 Why the default listing hides the entry (source)

`PrintTOCSummary()` computes each entry's requirements and prints it only if:

```c
if (ropt->verbose ||
    (te->reqs & (REQ_SCHEMA | REQ_DATA | REQ_STATS)) != 0)
```

`_tocEntryRequired()` returns:

- `REQ_SPECIAL` for `ENCODING`, `STDSTRINGS`, `SEARCHPATH` — which contains none of `REQ_SCHEMA | REQ_DATA | REQ_STATS`, so these are hidden unless `--verbose`;
- `REQ_SCHEMA` for `DATABASE` / `DATABASE PROPERTIES` **only when `ropt->createDB` is set**, otherwise `0`.

Therefore the default listing cannot be used as evidence about whether a `DATABASE` entry exists on disk. It reports a **restore-policy view**, not an archive-content view.

---

## 4. WS-A — The `DATABASE` TOC Entry: Fact Versus Inference

### 4.1 The four primary R-134 sites, verbatim

| # | Location | R-134 text |
|---|---|---|
| S1 | §5.2 table, `:279` | "`DATABASE` TOC entry \| present, containing `CREATE DATABASE cos_db WITH TEMPLATE = template0 …` \| same block" |
| S2 | §5.3 point 1, `:292` | "But every one of the fourteen archives contains a `DATABASE` TOC entry with `CREATE DATABASE`, which `pg_dump` emits only under `--create`. The producing command therefore passed a flag that **neither repository script passes**." |
| S3 | Correction register R134-C11, `:494` | "**every** archive carries a `DATABASE`/`CREATE DATABASE` TOC entry, which requires `--create`" |
| S4 | §12 item 6, `:608` | "**not** reproducible by `backup-db-local.ps1` as written (no `--create`, and every archive carries a `DATABASE` TOC entry)" |

Two further sites restate the same inference and are dependent on it:

| # | Location | R-134 text |
|---|---|---|
| S5 | U-5, `:528` | "producer command carried `--create`, which no repository script passes" |
| S6 | U-6, `:529` | "Why do the dumps carry `--create`, and what command produced them?" |

S2 contains **two separable assertions**: (a) `pg_dump` emits the entry only under `--create`; (b) therefore the producing command passed a flag neither script passes. They are corrected separately below.

### 4.2 What the bytes prove

All fourteen archives contain one `DATABASE` TOC entry. The literal `DATABASE` occurs exactly **3** times per file:

1. the entry description/tag `DATABASE`;
2. `CREATE DATABASE cos_db WITH TEMPLATE = template0 ENCODING = 'UTF8' LOCALE_PROVIDER = libc LOCALE = 'Arabic_Egypt.utf8';`;
3. `DROP DATABASE cos_db;`.

The entry begins near byte **611**, inside the uncompressed TOC (the TOC is never compressed). Listing with `--create` exposes it identically in all fourteen files:

```
5465; 1262 16389 DATABASE - cos_db cos
```

This is a real TOC entry, not a comment and not a function body. R-134's **observation** is `Verified`.

### 4.3 What the source proves

In `dumpDatabase()` (`src/bin/pg_dump/pg_dump.c`, `REL_18_STABLE`), the `CREATE DATABASE` text and the `DROP DATABASE` text are built unconditionally, and the entry is registered unconditionally:

```c
ArchiveEntry(fout,
             dbCatId,        /* catalog ID */
             dbDumpId,       /* dump ID */
             ARCHIVE_OPTS(.tag = datname,
                          .owner = dba,
                          .description = "DATABASE",
                          .section = SECTION_PRE_DATA,
                          .createStmt = creaQry->data,
                          .dropStmt = delQry->data));
```

There is no test of `dopt->outputCreateDB` around this `ArchiveEntry` call. The only conditional near it concerns the `TABLESPACE` clause (`dopt->outputNoTablespaces`), not the entry itself.

The `-C` flag is consumed later, on the **restore/list** side, by `_tocEntryRequired()`:

```c
if (strcmp(te->desc, "DATABASE") == 0 ||
    strcmp(te->desc, "DATABASE PROPERTIES") == 0)
{
    if (ropt->createDB)
        return REQ_SCHEMA;
    else
        return 0;
}
```

`ropt->createDB` is set by `pg_restore -C` (in `pg_restore.c`, `case 'C': opts->createDB = 1;`). It is not set by `pg_dump -C` in the produced archive.

### 4.4 What the documentation proves

PostgreSQL 18 documentation, `app-pgdump.html`, under `-C / --create`:

> "This option is ignored when emitting an archive (non-text) output file. For the archive formats, you can specify the option when you call `pg_restore`."

The documentation therefore states the correction twice in one sentence: for archive output the `pg_dump` flag is inert, and the operative flag belongs to `pg_restore`.

### 4.5 Corrected statement

> A `DATABASE` TOC entry is **always** written into a custom-format archive by `pg_dump`, whether or not `-C` was supplied. Its presence is therefore not evidence about the producer's command line. `pg_restore -C` decides whether the entry is *used*; its absence from a default `pg_restore --list` output only reflects that `createDB` was not set on the reader.

### 4.6 Why R-134's error is a method error, not a typo

R-134 read the correct bytes but interpreted a **restore-policy view** as an **archive-content view**. It used a default `pg_restore --list` (or an equivalent printable-ASCII scan) and concluded that the entry's presence implied a producer flag. Two safeguards would have caught it:

1. Re-running the listing with `--create` shows the entry appears from the same file — proving the file did not change and the difference is reader policy.
2. Reading `pg_dump`'s `dumpDatabase()` shows no `-C` gate on archive output.

The same error class appears in R-134's own warning at `:283` ("`1.16.0` is the archive format, not the server version"), which is correct. The `DATABASE` inference did not receive equivalent scrutiny.

### 4.7 What the correction does **not** do

It does **not** establish that `backup-db-local.ps1` produced these files. Capability is not execution. It only removes one of R-134's three stated reasons for doubting that attribution. The remaining reasons are addressed in §7 and §10.

---

## 5. WS-B — Independent Archive-Header Inventory (14/14)

### 5.1 Uniform signature

All fourteen files share one header signature:

| Field | Value | Basis |
|---|---|---|
| Magic | `PGDMP` | bytes 0–4, ASCII |
| Archive format version | `1.16.0` | bytes 5–7 |
| `intSize` / `offSize` | `4` / `8` | bytes 8–9 |
| Format code | `1` = Custom (`archCustom`) | byte 10 |
| Compression algorithm | `1` = gzip (`PG_COMPRESSION_GZIP`) | byte 11 |
| Database name | `cos_db` | first `WriteStr` |
| `remoteVersionStr` | `18.4` | second `WriteStr` |
| `PG_VERSION` | `18.4` | third `WriteStr` |
| Header end offset | `76` | after the third string |

No file deviates. There is no second signature class.

### 5.2 Identity, size, and timestamps

| # | File | Bytes | File mtime | Header create timestamp | Δ |
|---:|---|---:|---|---|---:|
| 1 | `cos_db_2026-10-14_12-00.dump` | 275,691 | 2026-10-14 12:00:03 | 2026-10-14 12:00:03 | 0 s |
| 2 | `cos_db_2026-10-15_12-00.dump` | 276,152 | 2026-10-15 12:00:02 | 2026-10-15 12:00:02 | 0 s |
| 3 | `cos_db_2026-10-17_12-00.dump` | 278,114 | 2026-10-17 12:00:03 | 2026-10-17 12:00:02 | −1 s |
| 4 | `cos_db_2026-10-18_12-00.dump` | 278,117 | 2026-10-18 12:00:03 | 2026-10-18 12:00:02 | −1 s |
| 5 | `cos_db_2026-10-19_12-00.dump` | 278,117 | 2026-10-19 12:00:03 | 2026-10-19 12:00:02 | −1 s |
| 6 | `cos_db_2026-10-20_12-00.dump` | 278,117 | 2026-10-20 12:00:02 | 2026-10-20 12:00:02 | 0 s |
| 7 | `cos_db_2026-10-22_12-00.dump` | 278,342 | 2026-10-22 12:00:02 | 2026-10-22 12:00:02 | 0 s |
| 8 | `cos_db_2026-10-26_12-00.dump` | 278,458 | 2026-10-26 12:00:02 | 2026-10-26 12:00:02 | 0 s |
| 9 | `cos_db_2026-10-27_12-00.dump` | 278,575 | 2026-10-27 12:00:03 | 2026-10-27 12:00:02 | −1 s |
| 10 | `cos_db_2026-10-28_12-00.dump` | 278,577 | 2026-10-28 12:00:03 | 2026-10-28 12:00:02 | −1 s |
| 11 | `cos_db_2026-10-29_12-00.dump` | 285,366 | 2026-10-29 12:00:03 | 2026-10-29 12:00:02 | −1 s |
| 12 | `cos_db_2026-11-01_11-00.dump` | 285,366 | 2026-11-01 11:00:04 | 2026-11-01 11:00:03 | −1 s |
| 13 | `cos_db_2026-11-02_11-00.dump` | 285,367 | 2026-11-02 11:00:03 | 2026-11-02 11:00:02 | −1 s |
| 14 | `cos_db_2026-11-04_11-00.dump` | 285,743 | 2026-11-04 11:00:04 | 2026-11-04 11:00:04 | 0 s |

Observation: the header's creation timestamp and the filesystem mtime agree within 0–1 second in all fourteen files. This is consistent with each file being written at the moment recorded in its header. It does **not** identify the writing process: a copy operation that preserves or resets mtime cannot be excluded from timestamps alone.

The `12:00 → 11:00` step occurs at the `2026-10-29 → 2026-11-01` boundary. R-134's DST explanation (`:294`) is unaffected by this review and remains `Inferred`.

### 5.3 Per-file header fields

All rows are byte-derived; none are copied from `pg_restore` output.

| # | File | Magic | Archive | int/off | Format | Compression | `remoteVersionStr` | `PG_VERSION` | Header end |
|---:|---|---|---|---|---|---|---|---|---:|
| 1 | 2026-10-14 | `PGDMP` | `1.16.0` | 4 / 8 | 1 Custom | 1 gzip | `18.4` | `18.4` | 76 |
| 2 | 2026-10-15 | `PGDMP` | `1.16.0` | 4 / 8 | 1 Custom | 1 gzip | `18.4` | `18.4` | 76 |
| 3 | 2026-10-17 | `PGDMP` | `1.16.0` | 4 / 8 | 1 Custom | 1 gzip | `18.4` | `18.4` | 76 |
| 4 | 2026-10-18 | `PGDMP` | `1.16.0` | 4 / 8 | 1 Custom | 1 gzip | `18.4` | `18.4` | 76 |
| 5 | 2026-10-19 | `PGDMP` | `1.16.0` | 4 / 8 | 1 Custom | 1 gzip | `18.4` | `18.4` | 76 |
| 6 | 2026-10-20 | `PGDMP` | `1.16.0` | 4 / 8 | 1 Custom | 1 gzip | `18.4` | `18.4` | 76 |
| 7 | 2026-10-22 | `PGDMP` | `1.16.0` | 4 / 8 | 1 Custom | 1 gzip | `18.4` | `18.4` | 76 |
| 8 | 2026-10-26 | `PGDMP` | `1.16.0` | 4 / 8 | 1 Custom | 1 gzip | `18.4` | `18.4` | 76 |
| 9 | 2026-10-27 | `PGDMP` | `1.16.0` | 4 / 8 | 1 Custom | 1 gzip | `18.4` | `18.4` | 76 |
| 10 | 2026-10-28 | `PGDMP` | `1.16.0` | 4 / 8 | 1 Custom | 1 gzip | `18.4` | `18.4` | 76 |
| 11 | 2026-10-29 | `PGDMP` | `1.16.0` | 4 / 8 | 1 Custom | 1 gzip | `18.4` | `18.4` | 76 |
| 12 | 2026-11-01 | `PGDMP` | `1.16.0` | 4 / 8 | 1 Custom | 1 gzip | `18.4` | `18.4` | 76 |
| 13 | 2026-11-02 | `PGDMP` | `1.16.0` | 4 / 8 | 1 Custom | 1 gzip | `18.4` | `18.4` | 76 |
| 14 | 2026-11-04 | `PGDMP` | `1.16.0` | 4 / 8 | 1 Custom | 1 gzip | `18.4` | `18.4` | 76 |

### 5.4 Per-file TOC findings

| # | File | Header TOC count | `--list` | `--list --create` | `--list --verbose` | `DATABASE` entry | Entry line |
|---:|---|---:|---:|---:|---:|---|---|
| 1 | 2026-10-14 | 164 | 160 | 161 | 164 | Present | `5465; 1262 16389 DATABASE - cos_db cos` |
| 2 | 2026-10-15 | 164 | 160 | 161 | 164 | Present | same |
| 3 | 2026-10-17 | 164 | 160 | 161 | 164 | Present | same |
| 4 | 2026-10-18 | 164 | 160 | 161 | 164 | Present | same |
| 5 | 2026-10-19 | 164 | 160 | 161 | 164 | Present | same |
| 6 | 2026-10-20 | 164 | 160 | 161 | 164 | Present | same |
| 7 | 2026-10-22 | 164 | 160 | 161 | 164 | Present | same |
| 8 | 2026-10-26 | 164 | 160 | 161 | 164 | Present | same |
| 9 | 2026-10-27 | 164 | 160 | 161 | 164 | Present | same |
| 10 | 2026-10-28 | 164 | 160 | 161 | 164 | Present | same |
| 11 | 2026-10-29 | 164 | 160 | 161 | 164 | Present | same |
| 12 | 2026-11-01 | 164 | 160 | 161 | 164 | Present | same |
| 13 | 2026-11-02 | 164 | 160 | 161 | 164 | Present | same |
| 14 | 2026-11-04 | 164 | 160 | 161 | 164 | Present | same |

The identity of the hidden entries was confirmed once per file by `--verbose`:

```
5462; 0 0 ENCODING - ENCODING
5463; 0 0 STDSTRINGS - STDSTRINGS
5464; 0 0 SEARCHPATH - SEARCHPATH
5465; 1262 16389 DATABASE - cos_db cos
```

### 5.5 What the header establishes, and what it does not

**Establishes (`Verified`):**

- the files are PostgreSQL custom-format archives with a coherent, self-consistent header;
- the source **server** reported `18.4`;
- the **client** that wrote them was compiled as `PG_VERSION = 18.4`;
- the dump database was `cos_db`;
- compression is gzip;
- each archive carries 164 TOC entries, including one `DATABASE` entry.

**Does not establish:**

- which executable path, host, user, or scheduler produced them;
- that the files are uncorrupted beyond the header and TOC (§9, L4–L5);
- that they can be restored (§9, L6);
- that the source server on `127.0.0.1:5432` is still 18.4 today.

---

## 6. WS-B (continued) — Field Semantics: `1.16.0`, `remoteVersionStr`, `PG_VERSION`

### 6.1 `1.16.0` is an archive-format version, and it is **not** unique to PG 18

Source constants (`src/bin/pg_dump/pg_backup_archiver.h`):

| Branch | `K_VERS_MAJOR` | `K_VERS_MINOR` | `K_VERS_REV` | `K_VERS_SELF` | Max readable (`K_VERS_MAX`) |
|---|---:|---:|---:|---|---|
| `REL_16_STABLE` | 1 | 15 | 0 | `1.15.0` | `1.15.255` |
| `REL_17_STABLE` | 1 | 16 | 0 | `1.16.0` | `1.16.255` |
| `REL_18_STABLE` | 1 | 16 | 0 | `1.16.0` | `1.16.255` |

`pg_dump` writes `AH->version = K_VERS_SELF`. Therefore:

- `1.16.0` is written by **PostgreSQL 17 and PostgreSQL 18**;
- `1.16.0` **excludes** PostgreSQL 16 and earlier;
- `1.16.0` does **not** identify the producer as 18.x.

This directly strengthens R-134's caution at `:283` and weakens the framing of its §12 item 6, which reads as if `1.16.0` plus `18.4` jointly identify a PG 18 producer. Only the version *strings* do that.

### 6.2 `remoteVersionStr` is the source server

`WriteHead()` writes `AH->public.remoteVersionStr`. On the dump side, `ConnectDatabase()` sets it from libpq:

```c
remoteversion_str = PQparameterStatus(AH->connection, "server_version");
...
AH->public.remoteVersionStr = pg_strdup(remoteversion_str);
```

So the first `18.4` is the **server** version reported by the connection, not the client. R-134's `Inferred` label at `:284` for this field's position is now upgraded: the position is fixed by `WriteHead()` source, and the value parses at the expected offset in all fourteen files.

### 6.3 `PG_VERSION` is the client build

The third string is the compile-time `PG_VERSION` of the `pg_dump` binary. It is `18.4`, which identifies the **client** as 18.4. This field is independent of the server: a PG 18.4 `pg_dump` can dump a PG 16 server. In this corpus, both strings are `18.4`, which is consistent with a same-major dump, but the two facts must be stated separately.

R-134's §5.2 table recorded only one `18.4` ("Source server version string") and did not name the `PG_VERSION` field. The distinction matters for the reader question in §8: archive readability is governed by the **archive format**, while data compatibility is governed by the **source server major**.

### 6.4 Summary of the three identifiers

| Header element | Meaning | Margin of inference | Label |
|---|---|---|---|
| `1.16.0` | Archive format written by `pg_dump` 17 or 18 | Excludes ≤16; does not distinguish 17 from 18 | `Verified` |
| `remoteVersionStr = 18.4` | Source **server** version | Identifies source major 18 | `Verified` |
| `PG_VERSION = 18.4` | **Client** `pg_dump` build | Identifies client 18.4 | `Verified` |
| `cos_db` | Dumped database name | None | `Verified` |
| `1` (byte 11) | Compression algorithm gzip | Enum value from `pg_backup.h`; not a compression level | `Verified` |

### 6.5 Compression byte

The byte is the **algorithm** selector, not a level. In the current format it is written by `WriteHead()` as `AH->compression_spec.algorithm`; `1` maps to `PG_COMPRESSION_GZIP`. A level, if any, is stored in the per-data-block framing, not in this header byte. No claim is made here about the level or about the integrity of the compressed payload.

---

## 7. WS-C — Script Capability Classification

Capability is a statement about what a script *can* produce or consume given its command line and pinned image. Execution is a statement about what actually ran. They are classified separately and never merged.

### 7.1 Classification table

| Script | Role | Decisive configuration | Relation to the observed artefacts | Classification |
|---|---|---|---|---|
| `scripts/backup-db-local.ps1` | Producer (host-native) | `pgDump = C:\Program Files\PostgreSQL\18\bin\pg_dump.exe` (`:8`); `-U cos -h 127.0.0.1 -p 5432 -Fc -f <file> cos_db` (`:15`); no `-C` | A PG 18.4 client writing `-Fc` to a Windows host path **does** produce `1.16.0`, `remoteVersionStr` from the server, `PG_VERSION=18.4`, and an unconditional `DATABASE` entry. If the server on 5432 is 18.4, the header matches exactly. | **`Verified` (compatible capability)** |
| `scripts/backup-db.ps1` | Producer (Docker) | `docker exec company-ops-postgres pg_dump -U $dbUser -Fc -f … $dbName` (`:24`); image pinned `postgres:16-alpine` (`docker-compose.yml:4`) | PG 16 `pg_dump` writes archive format `1.15.0` (`K_VERS_MINOR = 15`), cannot write `1.16.0`, and cannot report a source server `18.4` from a PG 16 container. It **cannot** have produced these files *if the pinned image is the running image*. | **`Incompatible` (repo-defined image)** / `Unknown` (live image) |
| `scripts/restore-db.ps1` | Consumer | `docker exec … pg_restore` into `cos_restore_test`; no `--create` (`:24-32`) | A PG 16 `pg_restore` rejects `1.16.0` at `ReadHead` (§8.2). The absence of `--create` is **not** a defect here: restoring into an existing temporary database is the intended pattern. | **`Incompatible` (repo-defined image)** / `Unknown` (live image) |
| `scripts/install-service.ps1` | Scheduler only | `New-ScheduledTaskTrigger -Daily -At 02:00` (`:48`); `DependOnService postgresql-x64-18` (`:33`); action → `backup-db-local.ps1` | Defines a path to a compatible producer, but proves neither installation nor execution. It cannot itself produce an archive. | `Verified` (definition) / `Unknown` (execution) |

### 7.2 `backup-db-local.ps1` — reinstated as a candidate

R-134 excluded it on the `--create` inference. That exclusion is withdrawn. On archive evidence alone, this script is the **most consistent** repository candidate:

- client path is explicitly PG 18, producing `1.16.0`;
- target is `127.0.0.1:5432`, the host-native instance;
- the `DATABASE` definition records `LOCALE = 'Arabic_Egypt.utf8'`, a **Windows** locale name, which is consistent with a native Windows server and inconsistent with a Linux `postgres:16-alpine` cluster;
- the output path matches `backups/cos_db_<stamp>.dump`;
- the retention rule keeps 14 files, matching the observed count.

None of this proves execution. The naming timestamps still do not match the `02:00` trigger (§7.5).

### 7.3 `backup-db.ps1` — excluded only conditionally

The exclusion is `Verified` **conditional on the pinned image**. `docker-compose.yml:4` pins `postgres:16-alpine`; a PG 16 `pg_dump` writes `1.15.0`. If the running container were retagged to a newer image, the conclusion would change. The live image was not inspected. The honest statement is:

> `backup-db.ps1`, **as configured by the repository**, cannot produce `1.16.0`. Whether the running container matches the repository pin is `Unknown`.

### 7.4 `restore-db.ps1` — incompatible reader, not a broken script

The script is structurally reasonable: dump/restore into a scratch database, no destructive operation on `cos_db`. Its defect is environmental, not logical: the `pg_restore` inside the PG 16 container predates the archive format. This is the same mismatch R-134 identified, now with a precise mechanism (§8.2).

### 7.5 Capability ≠ execution, restated

| Proposition | Label | Reason |
|---|---|---|
| `backup-db-local.ps1` can produce these archives | `Verified` (capability) | Command line + client major + format constants |
| `backup-db-local.ps1` produced these archives | `Unknown` | No log; filenames at `12:00`/`11:00` vs `02:00` trigger |
| `backup-db.ps1` can produce these archives under the pinned image | `Incompatible` | PG 16 writes `1.15.0` |
| `restore-db.ps1` can read these archives under the pinned image | `Incompatible` | PG 16 `ReadHead` rejects `1.16.0` |
| The scheduled task executed at all | `Unknown` | Task Scheduler not inspectable |
| The scheduled task produced any of these files | `Unknown` | Same |

---

## 8. WS-D — Reader Compatibility: Three Separable Questions

R-134 ran three different questions together. They are separated here because they have different answers and different evidence.

### 8.1 The three questions

| ID | Question | Gate | Answer | Label |
|---|---|---|---|---|
| **A** | Can a **PostgreSQL 16 `pg_restore`** read a `1.16.0` archive? | `K_VERS_MAX` in `ReadHead` | **No — fatal, before TOC** | `Verified` from source; not executed |
| **B** | Can a **PostgreSQL 17 or 18 `pg_restore`** read a `1.16.0` archive? | `K_VERS_MAX` in `ReadHead` | **Yes** | `Verified`; PG 18.4 executed, PG 17 source-derived |
| **C** | Can a PG 18 reader **load** that archive into a **PostgreSQL 16 server**? | No client version gate; server SQL compatibility | **Attempt allowed, outcome not guaranteed** | `Unknown` / `Not Authorized` |

### 8.2 (A) PG 16 reader — exact rejection path

`ReadHead()` in `REL_16_STABLE` reads the magic, then:

```c
vmaj = AH->ReadBytePtr(AH);
vmin = AH->ReadBytePtr(AH);

if (vmaj > 1 || (vmaj == 1 && vmin > 0))   /* Version > 1.0 */
    vrev = AH->ReadBytePtr(AH);
else
    vrev = 0;

AH->version = MAKE_ARCHIVE_VERSION(vmaj, vmin, vrev);

if (AH->version < K_VERS_1_0 || AH->version > K_VERS_MAX)
    pg_fatal("unsupported version (%d.%d) in file header",
             vmaj, vmin);
```

With `K_VERS_MAX = MAKE_ARCHIVE_VERSION(1, 15, 255)`, the comparison for our files is:

```
MAKE_ARCHIVE_VERSION(1, 16, 0)  >  MAKE_ARCHIVE_VERSION(1, 15, 255)
```

so `pg_fatal` fires with the formatted message:

```
unsupported version (1.16) in file header
```

The failure occurs **before** `AH->intSize`, before the date fields, before the TOC, and before any SQL. The process exits with status 1 (`pg_fatal` semantics). This is deterministic for any PG 16 build, independent of the archive's contents.

**Not executed:** the PG 16 binary is not installed on this host (`C:\Program Files\PostgreSQL\16\bin\pg_restore.exe` absent). The label is therefore `Verified` **from source**, not `Verified` by observation. The distinction is preserved in §10.

Note also: the message prints `1.16`, not `1.16.0`; the revision byte is not included in the format string. Quoting the full `1.16.0` as the error text would be inaccurate.

### 8.3 (B) PG 17 / PG 18 reader — accepted

`K_VERS_MAX = 1.16.255` in both branches, so `1.16.0` is within range and `ReadHead` proceeds to read `intSize`, `offSize`, format, compression algorithm, date, dbname, and version strings, then the format-specific TOC.

**Executed:** PostgreSQL 18.4 `pg_restore --list` (and `--create`, `--verbose`) on all fourteen files. Every invocation exited 0 and produced a coherent header block and TOC. This is `Verified` by observation for PG 18.4. PG 17.11 is present on the host but was not used; its acceptance is `Verified` from source only.

### 8.4 (C) PG 18 reader → PG 16 server — no version gate

This question is separate from (A). If the consumer binary were upgraded to 18.4 while the target server remained PostgreSQL 16, the client would **not** refuse on version grounds. `RestoreArchive()` deliberately disables the server-version check for direct database connections:

```c
/*
 * We don't want to guess at whether the dump will successfully
 * restore; allow the attempt regardless of the version of the restore
 * target.
 */
AHX->minRemoteVersion = 0;
AHX->maxRemoteVersion = 9999999;

ConnectDatabaseAhx(AHX, &ropt->cparams, false);
```

`ConnectDatabase()` therefore permits any server version:

```c
if (remoteversion != PG_VERSION_NUM
    && (remoteversion < AH->public.minRemoteVersion ||
        remoteversion > AH->public.maxRemoteVersion))
```

With `min = 0` and `max = 9999999`, the condition cannot be true. The restore is *attempted*.

The documentation is explicit that success is not promised:

> "Because `pg_dump` is used to transfer data to newer versions of PostgreSQL, the output of `pg_dump` can be expected to load into PostgreSQL server versions newer than `pg_dump`'s version. … Also, it is not guaranteed that `pg_dump`'s output can be loaded into a server of an older major version — not even if the dump was taken from a server of that version. Loading a dump file into an older server may require manual editing of the dump file to remove syntax not understood by the older server."

So (C) is `Unknown`, and attempting it is `Not Authorized` in this review. No specific per-object failure is asserted, because none was tested.

**Critical framing:** the repository's actual path is (A), not (C). `restore-db.ps1` invokes `pg_restore` **inside** the container, so the binary and the server are both PG 16. Upgrading only the target server, or only the client binary, is not sufficient:

- client PG 16 + archive 1.16.0 → fails at `ReadHead` (A);
- client PG 18 + target PG 16 → attempt proceeds but is unsupported (C);
- the version-consistent path is client **and** target at PG 18 (or newer).

Additionally, `pg_dump` **cannot** regenerate a PG 18.4 dump with a PG 16 client. The same documentation states that `pg_dump` "cannot dump from PostgreSQL servers newer than its own major version; it will refuse to even try". Producing a PG 16-readable archive from this source would require a PG 16-or-newer **client** (PG 16 cannot dump an 18.4 server) — which is impossible at PG 16 — or a downgrade of the source server, which is out of scope and not authorized.

### 8.5 Compatibility matrix

| Reader | Archive `1.16.0` | Gate | Result | Evidence |
|---|---|---|---|---|
| PG 16 `pg_restore` | declared | `1.16.0 > 1.15.255` | **Reject** at `ReadHead`, exit 1 | Source; not executed |
| PG 17.11 `pg_restore` | declared | `1.16.0 ≤ 1.16.255` | **Accept** | Source; not executed |
| PG 18.4 `pg_restore` | declared | `1.16.0 ≤ 1.16.255` | **Accept** | Executed, 42 listing runs, 0 failures |
| PG 18.4 → PG 16 server | declared | none (`0 … 9999999`) | **Attempt allowed; success not guaranteed** | Source + docs; not executed |

### 8.6 What this changes in R-134

R-134 called the compatibility gate `Inferred` (`:306`) and the actual rejection `Not Authorized` (`:307`). The correct split is finer:

- the **reader-level rejection by PG 16** is now `Verified` from source (a deterministic code path), while still `Not Authorized` to execute;
- the **destination-level outcome** (C) remains `Unknown` and `Not Authorized`;
- the **PG 18.4 reader acceptance** is `Verified` by execution.

R-134's substantive conclusion — that a PG 18.4 archive is being fed to a PG 16 consumer — stands, and the mechanism is now named precisely.

---

## 9. WS-E — Six Integrity Levels

"Valid archive" is not one property. Six levels are distinguished, and only the first three were assessed.

| Level | Property | Method | Result | Label |
|---|---|---|---|---|
| **L1** | File exists, has plausible size and name | Filesystem metadata | 14 files, 275,691–285,743 B, `cos_db_YYYY-MM-DD_HH-mm.dump` | `Verified` |
| **L2** | Magic and header are coherent | Byte parser using `WriteHead()` layout | `PGDMP`, `1.16.0`, 4/8, format 1, gzip, dates consistent, end offset 76 — all 14 | `Verified` |
| **L3** | TOC is readable by a compatible reader | `pg_restore --list` 18.4, three modes | Exit 0; 164 total; 160 default; 161 with `--create` — all 14 | `Verified` |
| **L4** | Data blocks are present and offsets are intact | Would require reading block headers/offsets throughout the file | Not performed; `--list` reads the TOC only | `Unknown` |
| **L5** | Compression streams are intact (gzip decompresses fully) | Would require decompressing every data block | Not performed; outside the permitted operation | `Unknown` |
| **L6** | Archive restores into a database (schema, data, row counts) | Would require a restore against an authorized target | Not performed | `Not Authorized` |

### 9.1 Why L3 cannot promote L4 or L5

The TOC in a custom archive is uncompressed; `pg_restore --list` reads the TOC and prints it. It does not seek into, read, or decompress any data block. A file truncated after the TOC, or with a corrupted gzip stream in the middle, can still list successfully with 164 coherent entries. Therefore:

> `pg_restore --list` proves **structural readability of the catalog**, not **payload integrity** and not **restorability**.

R-134's phrase "structurally valid custom-format archives" (`:261`, `:286`) is accurate only at L1–L3. Read as a statement about the whole archive, it overstates what was tested. This is corrected in §10 (CR-08).

### 9.2 Count reconciliation for this section

```
6 integrity levels
  = 3 Verified  (L1 existence/name/size, L2 header, L3 TOC readability)
  + 2 Unknown   (L4 data-block presence/offsets, L5 compression-stream integrity)
  + 1 Not Authorized (L6 restore)
```

No level was inferred from the level above it.

---

## 10. WS-F — Correction Register for R-134

Classification vocabulary used here:

- **`Contradicted`** — the claim is false on source or measurement.
- **`Partially Verified`** — the claim is true for the part tested and over-stated for the part not tested.
- **`Upgraded`** — the claim was weaker than the evidence now supports.
- **`Verified (unchanged)`** — the claim stands.

### 10.1 Correction table

| ID | R-134 location and original text | Evidence | Corrected claim | Classification | Effect on `D-A` / conditions |
|---|---|---|---|---|---|
| **CR-01** | §5.3 point 1, `:292`: "which `pg_dump` emits only under `--create`" | `dumpDatabase()` calls `ArchiveEntry(... .description = "DATABASE", .createStmt = creaQry->data ...)` with no `-C` gate; docs: "`-C` … This option is ignored when emitting an archive (non-text) output file." | `pg_dump` writes the `DATABASE` entry into custom archives unconditionally. No producer flag is required. | **`Contradicted`** | Removes the asserted flag mismatch from `D-A` (iii) and from the condition-10 rationale. |
| **CR-02** | §5.3 point 1, `:292`: "The producing command therefore passed a flag that **neither repository script passes**." | Same as CR-01; `-C` is a `pg_restore` restore-policy flag, not an archive-content prerequisite. | Nothing follows about the producing command from the presence of the entry. The inference is void. | **`Contradicted`** | Collapses the exclusion of `backup-db-local.ps1`; provenance doubt weakens. |
| **CR-03** | R134-C11, `:494`: "**every** archive carries a `DATABASE`/`CREATE DATABASE` TOC entry, which requires `--create`"; and the cell "`Verified` (flag mismatch)" | Same as CR-01; 14/14 contain the entry, and `--list --create` reveals it in 14/14. | The entry is present in 14/14. The "requires `--create`" clause is false, and "flag mismatch" is not a verified fact. | **`Contradicted`** | The row's rationale must be rewritten; the `Unknown` attribution label itself survives on other grounds. |
| **CR-04** | §12 item 6, `:608`: "**not** reproducible by `backup-db-local.ps1` as written (no `--create`, and every archive carries a `DATABASE` TOC entry)" | CR-01 + §7.2: PG 18 client, `-Fc`, host 5432, Windows locale, retention 14 — all consistent. | `backup-db-local.ps1` **is** capable of producing these archives as written. It is not excluded by the archive evidence. | **`Contradicted`** | The strongest stated exclusion is withdrawn. `backup-db-local.ps1` becomes the leading candidate; execution remains `Unknown`. |
| **CR-05** | U-5, `:528`: "producer command carried `--create`, which no repository script passes" | CR-01/CR-02 | The producer did not need `--create`. U-5's stated basis is invalid. | **`Contradicted`** | U-5 remains `Unknown` for two other reasons: timestamp mismatch and no log. |
| **CR-06** | U-6, `:529`: "Why do the dumps carry `--create`, and what command produced them?" | CR-01 | The premise is false; the dumps need not carry `--create`. | **`Contradicted`** (question void) | Replace with: "Which job or command produced them, and on what schedule?" |
| **CR-07** | §5.2 table, `:279`: "`DATABASE` TOC entry \| present, containing `CREATE DATABASE cos_db WITH TEMPLATE = template0 …`" | Byte-level: literal at offset 611; entry `5465; 1262 16389 DATABASE - cos_db cos`; defn includes `LOCALE_PROVIDER = libc LOCALE = 'Arabic_Egypt.utf8'` and `DROP DATABASE cos_db;` | Correct as stated. | **`Verified (unchanged)`** | None. |
| **CR-08** | §5.1 E, `:261`: "valid PostgreSQL custom-format archives"; §5.2 conclusion, `:286`: "structurally valid custom-format archives produced from a PostgreSQL **18.4** server" | L1–L3 verified; L4–L5 not inspected; L6 not authorized (§9). | Header and TOC are valid and readable. Payload presence, compression integrity, and restorability are **not** established. | **`Partially Verified`** (over-stated) | Condition 10 cannot be treated as met on this wording; it remains `Not met`. |
| **CR-09** | §5.2 caution, `:284`: "That its position in the header is the source-server version field is `Inferred` from `pg_dump`'s custom-format layout." | `WriteHead()` writes `remoteVersionStr` immediately after the dbname and before `PG_VERSION`; the parse lands at offset 76 in all 14 files. | The field position is established by source and confirmed by byte parsing. | **`Upgraded`** to `Verified` | Strengthens the producer-major conclusion; no change to exit status. |
| **CR-10** | §5.4 table, `:306`: compatibility gate "`pg_restore` refuses an archive whose format version exceeds the one it was built for" — `Inferred`; rejection `Not Authorized`. | `ReadHead()` `AH->version > K_VERS_MAX` → `pg_fatal("unsupported version (%d.%d) in file header")`; PG 16 max `1.15.255`. | The PG 16 refusal is a deterministic code path, `Verified` from source. It remains **not executed** (no PG 16 binary). | **`Upgraded`** (source-verified), still `Not Authorized` to execute | Strengthens the case that `restore-db.ps1` cannot consume these archives; condition 10 stays `Not met`. |
| **CR-11** | §5.3 point 2, `:293`: "A dump taken inside that container cannot carry a `1.16.0` archive header or a `18.4` source version." | `REL_16_STABLE` `K_VERS_MINOR = 15`; `postgres:16-alpine` pin at `docker-compose.yml:4`. | Correct for the repository-pinned image. The live image was not inspected. | **`Verified (unchanged)`**, with a residual `Unknown` on the live image | Reaffirms that `backup-db.ps1` is not the producer *as configured*. |
| **CR-12** | §5.2 caution, `:283`: "`1.16.0` is the **archive format** version … not evidence, by itself, that the server was 18.x." | `REL_17_STABLE` and `REL_18_STABLE` both have `K_VERS_MINOR = 16` and both write `1.16.0`. | Correct, and stronger than stated: `1.16.0` does not even identify the **client** as 18.x; it is written by 17 and 18. | **`Verified (unchanged)`** (strengthened) | Producer major 18 rests on the version strings, not the format code. |

### 10.2 Count reconciliation

```
12 correction rows
  = 6 Contradicted        (CR-01 … CR-06)
  + 1 Verified (unchanged DB-TOC observation)  (CR-07)
  + 1 Partially Verified  (CR-08)
  + 2 Upgraded            (CR-09, CR-10)
  + 2 Verified (unchanged) (CR-11, CR-12)
```

DATABASE-TOC sites:

```
6 sites
  = 4 primary   (S1 §5.2 :279, S2 §5.3 :292, S3 R134-C11 :494, S4 §12 item 6 :608)
  + 2 dependent (S5 U-5 :528, S6 U-6 :529)

7 assertions at those 6 sites
  (S2 contains two separable claims: "emits only under --create" and "therefore passed the flag")
  = 6 Contradicted (S2a, S2b, S3, S4, S5, S6)
  + 1 Verified     (S1)
```

This reconciles with CR-01 … CR-07: 6 contradicted assertions plus 1 verified observation.

### 10.3 R-134 text that remains correct

The following statements were re-tested and stand:

- The dumps are PostgreSQL custom-format archives (§5.2 fields all correct).
- The source server was PostgreSQL 18.4 (`remoteVersionStr`), and the client was 18.4 (`PG_VERSION`).
- `1.16.0` is not the server version (`:283`).
- A PG 16 `pg_dump` cannot produce `1.16.0` or a 18.4 source string (`:293`).
- The restore consumer is a PG 16 container *as configured* (`:305`).
- Provenance remains `Unknown` (`:296`), and `D-A` must address provenance.
- Condition 10 remains `Not met` (`:614`).

### 10.4 Reassessment of X-11

R-134's X-11 is the **unguarded `import_history` ledger write** (`:168`, `:485`, `:546`), arising from `data-migration.ts`, not from the archive metadata. Checked for dependency:

| Question | Answer | Evidence |
|---|---|---|
| Does X-11 rely on the `--create` inference? | **No** | X-11 concerns a missing ledger write in `data-migration.ts`; the archive claim is used nowhere in that finding |
| Does the `DATABASE` correction change X-11's evidence? | **No** | X-11's evidence is the transaction/ledger code path, not `backups/` |
| Does X-11's label change? | **No** | The dual-level `Verified` (shape) / `Inferred` (outcome) classification stands |
| Does the correction affect the §11.1 recommendation for `D-C`? | **No** | `D-C` is independent of backup provenance |

X-11 is therefore **unaffected**. The `DATABASE` error is confined to the backup-provenance reasoning (R134-C11, U-5, U-6, §12 item 6) and does not propagate into the data-migration findings. This containment check is reported because R-134's correction register mixes both domains in one table; a false premise in one row does not invalidate rows that never cite it.

---

## 11. Impact on `D-A` and Owner Conditions 10 and 11

### 11.1 `D-A` — backup/restore scope

R-134's three-part `D-A` (`:546`) remains the right shape, but part (i) changes rationale and part (iii) loses its strongest stated basis.

| Part | R-134 wording | Status after R-135 | Corrected rationale |
|---|---|---|---|
| (i) Restore consumer | "repair `restore-db.ps1` so its consumer matches a PG 18 producer — today it restores into a PG 16 container" | **Still required** | Correct, and now mechanically proven: PG 16 `K_VERS_MAX = 1.15.255`, so `1.16.0` is rejected in `ReadHead`. The reason is the **consumer's archive-format ceiling**, not a producer flag. The target **server** must also be PG 18 (see §8.4, case C). |
| (ii) Executed restore | "execute a restore against a PG 18 target and record the command, output, and verification counts" | **Still required** | Unchanged. No restore was executed here; L6 remains `Not Authorized`. |
| (iii) Provenance | "establish and record the **provenance** of the recovery point, since the existing dumps cannot be attributed to the scheduled job" | **Still required, weaker basis** | The "flag no script passes" argument is withdrawn. Remaining basis: (a) filenames at `12:00`/`11:00` never match the `02:00` trigger; (b) no run log or `Last Run Result` artefact. `backup-db-local.ps1` is now a **plausible** producer, not an excluded one. |

`D-A` is **not** closed, relaxed, or newly authorized. It becomes more accurate: the recovery path must be PG 18 end-to-end (client and target), and provenance must be established by a recorded run, not inferred from archive metadata.

### 11.2 Condition 10 — backup/snapshot procedure tested and verified

Owner condition 10 (`phase-12-owner-acceptance-record.md:181`):

> "**Backup/snapshot procedure** — tested and verified (pg_dump + restore to temporary DB)."

**Status: `Not met` — unchanged.**

| Requirement | Evidence | Status |
|---|---|---|
| A backup procedure exists | `backup-db-local.ps1`, `backup-db.ps1`, `install-service.ps1` | `Verified` (text) |
| Backups exist | 14 archives, header/TOC valid (L1–L3) | `Verified` |
| A restore has been tested | No executed restore in this review; no transcript in the tree | `Unknown` / `Not Authorized` |
| The configured restore path can consume the archives | PG 16 consumer vs `1.16.0` | **`Incompatible`** as configured (`Verified` from source) |
| The recovery points' provenance is recorded | No log; timestamps mismatch trigger | `Unknown` |

The correction does **not** move condition 10 closer to met. It removes a false reason for distrust but substitutes a mechanical incompatibility that is easier to act on. The condition still requires an executed, reviewed restore into a temporary database under an authorized PG 18 environment.

### 11.3 Condition 11 — rollback/recovery procedure tested and verified

Owner condition 11 (`:182`):

> "**Rollback/recovery procedure** — tested and verified (named recovery point, post-cutover write policy, file-attachment recovery, audit-trail evidence)."

**Status: `Not met` — unchanged.**

R-135 produces no new evidence for condition 11. One cross-effect is worth recording: if the rollback design names any of these fourteen archives as its recovery point, the same PG 16 consumer defect prevents validating that recovery point with the repository's current restore script. That is a consequence for the *recovery-point validation method*, not a finding that condition 11 has regressed. The condition was already unmet on the record.

### 11.4 What would close the gap (not authorized here)

For the owner's planning only; **none of this was performed or is authorized by this document**:

1. Provision an isolated PG 18 environment (already condition 1).
2. Restore one archive with a PG 18 `pg_restore` into a temporary PG 18 database, with `--exit-on-error`, and record command, output, and object counts.
3. Run a schema comparison against the expected migration state.
4. Record the producing job identity and schedule for the recovery point.
5. Only then re-assess condition 10.

### 11.5 Corrected provenance statement

Replace R-134's §5.1 fact F rationale with:

> **F. The dumps were produced by the scheduled task — `Unknown`.** The archives are consistent with `backup-db-local.ps1` in capability (PG 18 client, custom format, host path, Windows locale), and the `DATABASE` entry does not exclude it. However, all filenames are stamped `12:00` or `11:00` while the repository registers the task at `02:00`, and no execution record exists. Neither installation nor execution of `CompanyOps-Backup` is established.

---

## 12. Residual Unknowns and Explicit Non-Claims

### 12.1 Residual unknowns

| ID | Unknown | Why it remains open | Label |
|---|---|---|---|
| U-1 | Which process or job wrote the 14 files | No log; timestamps do not match the `02:00` trigger; capability alone is not execution | `Unknown` |
| U-2 | Whether the running container image matches `postgres:16-alpine` | Docker was not queried; no container inspection performed | `Unknown` |
| U-3 | Whether a real PG 16 binary emits exactly `unsupported version (1.16) in file header` | PG 16 is not installed; conclusion is source-derived | `Verified` from source / not observed |
| U-4 | Whether all data blocks are present and offsets intact (L4) | `--list` reads TOC only | `Unknown` |
| U-5 | Whether the gzip streams decompress fully (L5) | Decompression not performed | `Unknown` |
| U-6 | Whether any archive restores successfully (L6) | Restore not authorized | `Not Authorized` |
| U-7 | Which server the running API targets (`DATABASE_URL`) | `.env` not opened | `Unknown` |
| U-8 | Whether the TOC's 164 entries cover the expected application schema | No comparison against a live or reference database | `Unknown` |
| U-9 | Whether `CompanyOps-Backup` is installed and enabled | Task Scheduler not inspected | `Unknown` |
| U-10 | Whether condition 10 was ever satisfied outside the repository tree | No external evidence supplied | `Unknown` |

### 12.2 Explicit non-claims

- This document does **not** assert that `backup-db-local.ps1` produced the archives.
- It does **not** invent or name an alternative producer.
- It does **not** assert that any archive is corrupt, truncated, or unrestorable.
- It does **not** assert that a PG 16 restore was attempted or failed.
- It does **not** assert that restoring into a PG 16 server would fail for a specific SQL reason.
- It does **not** promote any `Inferred` or `Unknown` item to `Verified` beyond the source-level statements explicitly labelled.
- It does **not** authorize a restore, a backup, a container change, or a scheduler change.
- It does **not** approve R-132, R-133, or R-134.

---

## 13. Disposition and Status

### 13.1 Disposition of R-134

| R-134 element | Disposition |
|---|---|
| §5.2 factual table (except the E wording) | **Upheld** |
| §5.3 point 1 | **Contradicted** — `--create` inference withdrawn |
| §5.3 point 2 | **Upheld** (PG 16 cannot produce `1.16.0`) |
| §5.3 point 3 (timestamps) | **Upheld**, still `Inferred` |
| §5.4 structural mismatch | **Upheld and strengthened** (PG 16 `K_VERS_MAX = 1.15.255`) |
| §11.1 `D-A` | **Upheld**, part (i) rationale corrected, part (iii) basis narrowed |
| §12 item 6 | **Corrected** — `backup-db-local.ps1` no longer excluded |
| U-5, U-6 | **Corrected** — false premise removed; U-5 remains `Unknown` |
| X-11 | **Unaffected** |
| Condition 10 / 11 conclusions | **Unchanged** — both remain `Not met` |

### 13.2 Net effect on the phase

- Phase 12 is **not** complete.
- Stage 3 is **not** authorized.
- Phase 13 is **not** recommended.
- D5, D6, D7 remain **not** authorized.
- No production fact is asserted.
- No recovery capability is demonstrated.

The correction changes *why* the backup/restore gap exists and *what* must be repaired: a PG 18 producer feeding a PG 16 consumer, with an archive format (`1.16.0`) that the consumer cannot parse. It does not change *whether* the gap exists.

### 13.3 Final status

```
BLOCKED — ADDITIONAL EVIDENCE REQUIRED — PHASE 12 REMAINS OPEN
```

**End of R-135.**

**No file other than this one was created or modified. No command beyond read-only inspection and `pg_restore --list` was executed. No database was contacted. No backup or restore was run. No secret value was reproduced. No Git write was performed.**
