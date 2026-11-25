# Phase 12 — New System Separation & Migration Architecture Report

Status: **Discovery + architecture design + documentation only.** Nothing below was implemented.
Baseline: HEAD `f91ed2f9` on branch `main`, October 2026.
Docs in this folder: A (this report) · B (`phase-12-data-migration-matrix.md`) · C (`phase-12-api-auth-permissions-map.md`) · D (`phase-12-migration-validation-rollback-plan.md`) · E (`phase-12-owner-decision-record.md`).

**Language note (disclosed to owner):** the technical body of docs A–D was written in English for accuracy and stability of generation; doc A carries an Arabic executive summary below, and the final Phase 12 chat report is composed in Arabic.

---

## Executive Summary (بالعربية)

هدفت المرحلة 12 إلى دراسة معمارية مستندة إلى الشيفرة الفعلية، لتقييم الحاجة إلى فصل النظام الجديد عن البنية الحالية أو الاستمرار في إعادة استخدام مكوناتها. المرحلة نفسها كانت دراسة وتوثيقًا فقط؛ لم يُنفَّذ خلالها أي تغيير تشغيلي.

المنهجية: فحص قرائي لمصادر `apps/api/**` و`packages/shared/**` وطبقة البيانات، مع معاملة تقارير المراحل السابقة بوصفها خيوط تحقق لا حقائق مستقرة، وربط الاستنتاجات بمسارات الشيفرة الفعلية.

الاستنتاجات المحورية:

1. **مخزن التشغيل الفعلي للكيانات الجوهرية هو PostgreSQL** (Verified): 14 من 16 مستودعًا ترث `PgBaseRepository` وتقرأ/تكتب في جداول PostgreSQL، وخدمة الجلسات تستخدم جدول `sessions`. مع ذلك، لا يزال مستودعا `audit_logs` و`notifications` يعتمدان على الملفات رغم وجود جدولين مقابلين في مخطط PostgreSQL. لم يثبت وجود مزامنة نشطة بين المخزنين، وما يتجاوز الأدلة المحددة يظل **Unknown**. يوجد أيضًا الملف `data/.jwt-secret` بوصفه بديلًا محتملًا لسر التوقيع؛ لم تُسجَّل قيمته، ومصدر السر النشط في الإنتاج لا يزال مجهولًا.
2. **الشيفرة الخلفية لا تجتاز الفحص الحالي**: 18 ملفًا في `apps/api/src/**` تحمل علامات تعارض Git نشطة، ويفشل `npm run typecheck` بأخطاء TS1185 (Verified). وافق المالك على إنشاء مهمة إصلاح مستقلة ومحدودة، لكن توقيت تنفيذها مؤجّل، ولم يُنفَّذ الإصلاح بعد. اكتمال الإصلاح ونجاح `typecheck` شرط قبل Stage 2. لم يُستنتج من ذلك شيء عن محتوى `dist/**` أو حالة النشر الفعلية.
3. **لا توجد فروقات دلالية مثبتة بين الواجهتين حتى الآن**: الواجهة الجديدة لا تزال `mock-only`، ومحول HTTP لم يُنفَّذ. وافق المالك على مهمة HTTP adapter مستقلة ضد الـ API الحالي، لكن تنفيذها يظل خلف خريطة العقود وبوابات D8. إلى أن تكتمل خريطة العقود، تبقى أي فروقات محتملة **Unknown**.
4. **قرارات المالك الحالية مسجّلة وليست مجرد فرضيات**: سجّل المالك D1 = Option B (الفصل المنطقي مع إعادة الاستخدام الانتقائية)، وD2 = إعادة استخدام قاعدة PostgreSQL الحالية. وسجّل D3 = تأجيل القرار النهائي بشأن API namespace حتى اكتمال خريطة العقود، مع الإبقاء على `/api/**` وعدم اعتماد namespace جديدة الآن. هذه القرارات تحدد الاتجاه فقط ولا تمنح إذنًا بالتنفيذ. أما D8 فحصل على موافقة أولية لمراجعة خطة Doc D؛ الخطة غير معتمدة نهائيًا.

الحد الفاصل: موافقات D4 وD6 وD7 تخص إنشاء المهام المنفصلة بالنطاق المسجل في Doc E، ولا تعني تنفيذها فورًا. تمت الموافقة على إعداد خطة آمنة لإدارة `data/.jwt-secret`، بينما النقل والتدوير مؤجلان إلى حين التحقق من مصدر السر في الإنتاج وتقييم أثر تسجيل الدخول والجلسات. لا يبدأ Stage 2 قبل اكتمال إصلاح D4 ونجاح `typecheck`. D8 معتمد نهائيًا (2026-10-29)؛ نتائج Stage 0 تتطلب مراجعة وقبولًا قبل التقدم، ولا يبدأ أي تنفيذ ترحيل أو Phase 13 قبل استيفاء بوابات كل مرحلة.

ملاحظة نطاق التعديل: جرى تحديث صياغات حالة القرار في Doc A لتتوافق مع سجل المالك الحالي في Doc E. لم تتغير أدلة المصدر أو تصنيفات Verified/Unknown، ولم تُعدَّل الوثائق B–E أو الشيفرة أو البيانات أو إعدادات التشغيل.

---

## 1. Scope & Limits of This Study

**Included** (per prompt §1-6): discovery of backend/DB/auth from source code; evaluation of A/B/C architecture options under identical verified requirements; DB option comparison (logical / operational / security isolation separated); migration and rollback design; documentation.
**Excluded** (Verified — no source or schema touched): any app file change, any DB change, any migration execution, any auth/RBAC change, any data operation, any deployment change, any dependency install, any Git mutation, any Phase 13 work, any fix to the merge-conflict markers.

Concrete Phase 12 point-of-truth artifacts: the five files listed in the doc header. All claims cite file paths + line numbers where available.

**Audit scope statement (final closure pass):** five documents were reviewed for internal consistency (A, B, C, D, E). Files actually modified in each pass, from the real edit history of this task:
- Consistency audit pass: doc B, doc C, doc D, doc E.
- Residual fixes pass: doc A, doc B, doc D, doc E.
- Final alignment pass: doc A, doc B, doc D, doc E.
- Closure pass: doc A, doc C, doc E (doc D re-verified only; doc B re-verified only and no longer containing stale terms).
- Final closeout pass (historical): doc A only — three wording corrections concerning the R2 comparison, per-file JSON verification, and unknown deployed runtime status.
- Owner-decision synchronization pass (latest): doc A only — synchronized the Arabic Executive Summary and decision-state wording in §§5–12 with the decisions recorded in doc E. Source evidence and verification labels were preserved; docs B–E, application code, data, and operating configuration were not changed in this pass.

No invented counts: all lists reflect the actual edit history of this task. The documentation passes themselves did not grant approvals; the Owner decisions recorded subsequently in doc E control the current decision state. No implementation, migration, or Phase 13 work is authorized by the documentation edits.

---

## 2. Repository State & Evidence Examined

| Item | State | Evidence |
|---|---|---|
| Branch / HEAD | `main` / `f91ed2f9` (Verified) | `git rev-parse HEAD`, Oct 2026 |
| Working tree | Pre-existing modifications preserved untouched (list in doc D §8) | `git status --short` |
| Prior reports | Treated as leads, not truth. Option A decision history preserved from `phase-10/phase-10-cross-app-qa-report.md` and `phase-11/phase-11-release-readiness-handover-report.md`; its suspension/re-enactment status in this phase is Unknown | Verified |
| Backend source tree | `apps/api/**` — full module/repo/service/middleware inventory | Verified |
| Shared package | `packages/shared/**` — 4 source files incl. 31-key permission vocabulary | Verified |
| DB schema | 19 SQL migration files under `apps/api/src/database/migrations/` (1 duplicate, byte-identical: `11_modernize_dms.sql` = `18_modernize_dms.sql`) | Verified |
| Frontends | `apps/web/**` (old build served by API) + `docs/frontend-rebuild/phase-03-prototype/**` (new prototype, mock-only) | Verified |
| Docs directory convention | `docs/frontend-rebuild/phase-NN/**` — matches existing pattern | Verified |

**Defect surfaced (Verified, pre-existing):** 18 source files under `apps/api/src/**` contain unresolved merge markers ⇒ `npm run typecheck` fails with TS1185. The markers are **active source text in the working tree**, i.e. real compile-failing defects — not comments. Consequences asserted and not asserted from this evidence:

- **Asserted:** the API/backend source is currently non-compilable; any "backend green in earlier phases" claim needs re-verification.
- **Not asserted:** nothing is inferred about `dist/**` contents, runtime deployment behavior, or a "both sides active in production" situation. No such claim was made.
- **Frontend vs backend build evidence kept distinct:** the frontend (phase-03 prototype / phase-11 fresh build) was previously verified to build; the backend/API has the verified typecheck failure. The two are not merged into one "app broken" conclusion.

---

## 3. Backend Map (summary — full details in doc C)

Framework: Express 4.21 ESM; single process, listens on `PORT ?? 4001`; mounting `/api` via `routes/index.ts`; also serves built frontend (one-port deployment model). Data access: repository pattern with two base classes (file-based vs PG-based). Cross-cutting services: authorization, projectScope, audit, notification, smart-import, backup, global-search. Validation: zod; auth: jsonwebtoken + bcryptjs; uploads: multer; export: archiver.

Reuse classification (per prompt §4):

| Part | Location | Role | Verdict |
|---|---|---|---|
| Express app / server bootstrap | `app.ts`, `server.ts` | Framework shell, CORS, static SPA, health | **Reuse as-is** (with conflict-marker repair prerequisite) |
| Routes & controllers | `modules/*/routes.ts` | Endpoint definitions | **Reuse with adaptation** (depends on the finalized contract map; namespace choice itself is undecided — see §6) |
| Business logic in services | `services/*` (auth/authorization/projectScope/stock/smart-import/…) | Core rules | **Reuse as-is** (authorization.service is the latest architecture in the codebase) |
| Repositories (PG) | `repositories/*.repository.ts` (14/16) | Data access | **Reuse as-is** |
| Repositories (file) | `audit-log.repository.ts`, `notification.repository.ts` | Audit + notifications | **Proposed remediation to migrate to Postgres** (doc B Transform rows) — may apply independently of the selected architecture (A, B, or C), but requires separate explicit Owner approval; selecting any option does not automatically authorize it, and it has not been performed. Doc D/E Decision 6 |
| Shared permission vocabulary | `packages/shared/src/permissions.ts` | 28 legacy + 3 admin keys | **Reuse as-is** (any new key pre-migration, per doc C §5) |
| JSON data layer | `data/…` JSON files | Bootstrap/legacy | **Verify per file, not a blanket retirement.** The runtime evidence supports: (a) legacy/bootstrap JSON artifacts (actors of acts/units/categories and leftover sessions.json) → make read-only or retire **only** after their no-runtime-dependency and data-completeness are verified; (b) files still written by runtime code today — `audit_log.json` and `notifications.json` (file-backed repos) → migrate via the **separately approved proposal** (doc E Decision 6), not by deletion; (c) secret material — `data/.jwt-secret` (fallback signing secret) → belongs to secrets handling, never deleted as a data record; (d) files whose runtime dependency cannot be established from source → **Unknown**, do not remove. No file has been moved, retired, or migrated so far |
| `.jwt-secret` file | `data/.jwt-secret` path exists; value never recorded | Secret material | **Move to secrets store + rotation** (proposed; applies to all options) |
| Files on disk | `storage/documents/**` | Attachment binaries | **Untouched by this study** / independent of SQL migration |
| Conflict-marker damage | 18 files | Source repair | **Separate owner-approved task** — precondition for almost everything else |

---

## 4. Old vs New Capability Matrix

**Reference of truth for full parity:** `docs/frontend-rebuild/phase-10/phase-10-cross-app-qa-report.md` appendix A1–H1 (referenced by path, not re-copied).

Prototype-side module surface (Verified, `docs/frontend-rebuild/phase-03-prototype/**`): dashboard, inventory (items/warehouses/stock), projects (with BOQ/IPC), requests (material requests), reports, archive (documents), administration (users/roles/audit/settings).

| Domain | Existing backend/API as represented in source; deployed runtime status Unknown (source tree has a verified typecheck failure; production deployment not verified in Phase 12) | New prototype (mock-only) | Proven semantic difference? | Verdict under neutrality |
|---|---|---|---|---|
| Projects + BOQ + IPC | Full API + PG tables (`projects`, `boq_items`, `ipcs`, `ipc_items`) + direct amounts (migration 21) | Mock adapter; contract map incomplete | **No proven business-rule diff** (entry formats only) | Backend reuse favored on evidence |
| Documents / Archive / Revisions | DMS API + revisions + document_links + folders + category lookups | Mock | Field/name differences not proven semantic | Backend reuse favored on evidence |
| Inventory (items/warehouses/stock) | Full API + transactions + lines | Mock | None proven | Backend reuse favored on evidence |
| Material requests | Full API with approve/issue states | Mock | Status lifecycle matches current CHECK list | Backend reuse favored on evidence |
| Import / smart import | API + history store | Mock | — | Backend reuse favored on evidence |
| Auth / Sessions / RBAC | JWT `sub+sid`, DB-backed, 31 keys, project narrowing | Mock | Same key vocabulary; no proven delta | Backend reuse favored on evidence |
| Administration | Endpoint definitions present in source | Mock | — | Backend reuse favored on evidence |
| Reports | `reports.view` + global-search service | Mock | **Unknown**: whether new report pages demand new aggregations | Cannot decide until contract map finalizes |

Key insight (Inferred): **current evidence does not yet prove a need for a different data model or permission model.** Differences observed so far are naming/UX and an incomplete contract map rather than semantics. Equally, nothing proves that strict continuation (Option A) is safe — its supporting narrative predates today's verified conflict-marker defect. Both directions therefore sit on incomparable-in-scope evidence until the repair task and contract-map completion happen.

---

## 5. Architecture Options Comparison (neutral evaluation)

All three options were scored qualitatively against the same verified requirements: (R1) code health, (R2) one authoritative data store, (R3) server-side permission enforcement with the shared vocabulary, (R4) the new UI reaching real HTTP, (R5) minimizing duplicated semantics while differences are unproven, (R6) reversible steps with explicit roll-back. No numeric scoring; labels are qualitative.

| Requirement | Option A — strict continuation (preserves current architecture; permits, but does not automatically authorize, separately approved maintenance) | Option B — logical separation with selective reuse (owner-selected direction; implementation remains conditional) | Option C — fully independent system |
|---|---|---|---|
| R1 code health | Postpones repair; defect persists in "no change" mode | Repair as explicit Stage-1 prerequisite | Same prerequisite; plus duplicate codebases to keep green |
| R2 authoritative store | Preserves the current architecture; audit/notifications remain file-backed until the separately approved D6 task is executed and verified. D6 is not immediate execution | Intended single authoritative store after the D6 remediation is executed and verified; the remediation applies to **all three options**, not uniquely to B | Depends on how identity is federated; typically two stores to reconcile |
| R3 permission model | Preserved as-is (31 keys) | Preserved as-is | Duplicates or federates identity; no evidence of need |
| R4 new UI real HTTP | No path defined → mock-vs-real drift risk stays | Standalone HTTP-adapter task approved against the current API; implementation remains pending contract map and final D8 gates | Requires building a full second backend before any adapter is meaningful |
| R5 avoid premature duplication | Preserves one system (strength), but keeps an unrepaired unverifiable one | Reuses verified components; separates only at the contract boundary when proven | Duplicates deployments/backups/upgrade paths with unproven divergence |
| R6 reversibility | Matches status quo (reversible, but defect-blocking) | Staged approach with explicit per-stage rollback (doc D) | Hardest to revert once split (infrastructure-level) |

### Option A — keep current backend unchanged
- What stays shared: everything (API, DB, permissions).
- Semantics of Option A: it means preserving the existing architecture **while permitting separately approved maintenance fixes**. The D6 JSON-to-PostgreSQL audit/notification task is now approved as a separate task, but it is not bundled into Option A and remains unexecuted behind the final D8 and stage gates.
- Strength: minimal new surface; matches prior phase-10/11 decision history.
- Weakness against verified evidence: its audit trail does not match today's tree — the conflict-marker defect and the missing HTTP adapter shift costs into late-stage integration risk (Inferred). The audit/notifications file-store inconsistency remains unresolved until the separate D6 JSON-to-PostgreSQL task is executed and verified. D6 has been approved as a task, but execution remains gated; that status is independent of selecting Option A.

### Option B — logical separation with selective reuse (**owner-selected architecture direction; implementation remains conditional**)
- What stays shared (selected direction): Express runtime, shared permission vocabulary, and the existing PostgreSQL-backed `users`/`roles`/`sessions` identity chain, subject to verification of production facts at Stage 0. D2 records the Owner's selection to reuse the current PostgreSQL database. This topology choice does not authorize schema changes, data movement, or production operations.
- Audit/notifications note: the Owner has approved a separate task to migrate `audit_logs`/`notifications` from JSON to PostgreSQL. This is a store-consistency task, not an automatic effect or unique advantage of Option B; execution remains blocked by the final D8 approval and applicable stage gates.
- What becomes separated (selected direction, implementation pending): a clear **contract boundary**. The Owner has approved a standalone HTTP-adapter task against the current API first; any semantic deltas become explicit extension points only when proven. The adapter has **not** been implemented (see doc C).
- Basis: expected work includes the separately scoped conflict-marker repair, an HTTP adapter, and the approved store-migration task; this is not a backend rewrite (Inferred). Each task remains subject to its own timing and gate conditions.
- Why it was favored in the analysis: it addresses the identified blockers (code health, real HTTP integration, and the file-store inconsistency) without creating a second system whose semantics have not been proven different (R5, R1–R6). The Owner has recorded Option B as the architecture direction. Outcomes remain conditional: repair timing is deferred, the adapter has not been implemented, the D6 migration has not been executed, and production/contract facts remain incomplete. Selecting Option B alone does not make the backend compile, connect the prototype to real HTTP, or consolidate stores.

### Option C — fully independent system
- Everything separate: backend, DB, permissions, identity.
- Verdict: **over-engineered under current evidence** (Inferred); nothing supports divergent permission semantics or data models. C becomes appropriate **if** a finalized contract map shows rules the current 31-key vocabulary or current tables cannot express (e.g. genuinely new financial scope, divergent role structure, multi-tenant identity) — all currently unproven.
- Cost/maintenance grounds: doubles backups, deployments, credentials, upgrade paths; needs identity federation or duplicated users to reach shared projects.

---

## 6. API / Business-Logic Boundary (namespace decision deferred under D3)

The Owner has recorded D3: defer the final namespace policy until the prototype-to-live-API contract map is complete. Keep the current `/api/**` namespace for the present work; no new namespace (including `/api/v2/**`) is approved now. This records the current direction without deciding whether a new namespace may be warranted after the contract map.

1. Keep the existing `/api/**` routes stable while the contract map is completed and before the approved HTTP-adapter task is implemented.
2. Build the adapter against the current API first, subject to the contract map and applicable stage gates. The task is approved; implementation is not authorized to begin now.
3. If the finalized contract map proves semantic deltas, present explicit naming and mounting choices for a fresh Owner decision; do not introduce a namespace by implication.
4. `packages/shared` remains the single permission vocabulary; any new permission key must be introduced upstream (`shared/src/permissions.ts`) and enforced server-side in `authorization.service.ts`, never only in UI.

Security boundary (Verified): all permission enforcement stays server-side; hiding UI actions is never sufficient.

## 7. Authentication / Identity / Permissions Strategy

Reuse of the existing identity store is consistent with the Owner-selected Option B and D2 topology (bcrypt + JWT `sub+sid` + `sessions` + `roles`; hash portability within bcrypt — Inferred), subject to Stage-0 verification of production facts. Under Option C a separate identity chain or federation would be needed; no evidence currently supports that need. Secret source resolution is verified in source (`auth.service.ts:15-23`): the `JWT_SECRET` environment variable takes priority, and `data/.jwt-secret` is a fallback auto-created when the variable is absent; the active production source remains Unknown. The Owner approved preparing a safe secret-handling and rotation plan, but actual movement, configuration changes, and rotation are deferred pending production-source verification and login/session-impact assessment; no secret operation is authorized now. Coexistence rules and the dual-write prohibition are in doc D. The permission vocabulary remains shared; additions require proven new business rules (doc C §5).

---

## 8. Migration Classification Summary

Full table in doc B §3. Highlights:

**Conditional applicability:** the classifications below (Direct Copy / Transform / Restructure / Rebuild-Regenerate / Historical-Read-only / Do Not Migrate / Undetermined) are a preliminary plan for a target system/database under the target-schema assumptions stated in doc B §3. They are **not** a universal instruction to migrate data under every architecture option. Distinguish: (1) reuse the existing database without moving the corresponding data; (2) move data to a separate database with an equivalent schema; (3) migrate into a redesigned schema whose semantics and relationships may differ. Where the target schema is not finalized, the classification is conditional or `Undetermined` — no claim is made that all known entities must be copied or that no restructuring will be needed.

- **Direct Copy** (schema/table availability): users, roles, overrides, project_members, sites, projects, documents, revisions, links, folders, warehouses, items, stock txs (+lines), boq_items, ipcs (+items), categories, units, counters, import_history (runtime PostgreSQL table — `import-history.repository.ts:7,9`; the legacy JSON variant is Historical/Read-only, not an automatic migration source), `storage/documents/**`.
- **Sessions**: the `sessions` table/schema exists in PostgreSQL (`001_initial_schema.sql`). Reusing the current database under D2 does **not** itself require copying, invalidating, or resetting session rows. Any later session-affecting change requires an explicit policy based on the actual change, verification of production secret/session behavior, and Owner approval; a global reset or one re-login per user is not a default. Expired/revoked/invalid sessions must never be resurrected.
- **Transform (approved as a separate task; execution gated)**: JSON `audit_logs` and `notifications` → PostgreSQL tables. Field/timestamp/actor/`read_by` mappings and recovery behavior must be designed and verified before execution (mapping precedent at `data-migration.ts:122-131`).
- **Restructure**: none demonstrated by the current evidence; re-evaluate if the completed contract map or target-schema verification proves otherwise.
- **Rebuild/Regenerate**: the frontend prototype still requires the separately approved HTTP-adapter task; the adapter has not been implemented, and implementation remains behind the contract map and final D8 gate. This is a frontend integration task, not by itself a data migration.
- **Historical/Read-only**: `apps/api/backup/**`, `apps/api/temp/**`.
- **Do Not Migrate**: `data/.jwt-secret` as a data record (moves to secrets handling instead).

---

## 9. Migration / Validation / Rollback Design

Full plan in doc D. Highlights: Stage 0 (readiness/baseline facts) → Stage 6 (post-migration verification), with the mandatory precondition of resolving the 18-file conflict block and getting `npm run typecheck` green **before** any migration stage is attempted. Rollback distinguishes app rollback from data rollback explicitly (doc D §5), dual-writes are forbidden (doc D §4), and no stage executes without explicit owner approval (doc E gates). **Rollback limitation:** restoring a pre-cutover snapshot does not preserve writes accepted afterward; audit logs cannot be relied on for reversal until before/after information and operation coverage are verified; file attachments need their own recovery plan; if no reliable rollback path exists, rollback is unsafe and blocks cutover approval.

---

## 10. Risks & Assumptions & Gaps

| Risk | Evidence | Likelihood | Impact | Mitigation | Owner Decision Needed |
|---|---|---|---|---|---|
| 18 merge-conflict files break backend compilation | Verified (tsc TS1185); no fix applied in Phase 12 | certain in current state | High | D4 repair-task creation approved; execution timing deferred; complete repair and green `typecheck` before Stage 2 | Timing of execution remains deferred |
| Audit/Notifications remain file-based → silent data loss / backup gap | Verified (`audit-log.repository.ts:7`, `notification.repository.ts:7`) | high in current shape | Medium–High | D6 migration task approved; verify mapping, runtime writer switch, and recovery under applicable stage gates | Execution remains gated by applicable stage gates |
| `.jwt-secret` in data dir alongside JSON files | Verified (path exists) | medium | High (session invalidation / secret sprawl) | D5 safe-plan preparation approved; verify production source and login impact before any movement/rotation | Actual changes and rotation timing deferred |
| HTTP adapter for new UI never built → mock-vs-real drift | Inferred from Phase 11 limitations; not a current runtime verification | high if unchanged | Medium | D7 task approved against current API; contract map and applicable stage gates precede implementation | Implementation not authorized to begin now |
| Prototype/contract mismatch produces invented report numbers | Verified in Phase 11 limitations | Unknown (depends on report consumer) | Medium | Complete the prototype-to-live-API contract map before adapter implementation; D3 defers the final namespace decision until then | Required before adapter implementation; no new namespace approved |
| Duplicate migrations (`11_` = `18_`, byte-identical) | Verified | low | Low | Keep as-is or dedupe at Stage 1 | Optional |
| Policy drift between old/new roles after any migration | Inferred | Low–Medium | Medium | Enforce identity mapping matrix, no auto-broaden | Emphasized in doc C §5 |
| Production environment facts (Postgres version, dataset size, applied migrations 19–21) unknown | Verified as Unknown in this repo | n/a | Medium | Stage 0 baseline step (read-only with owner access) | Required before execution |
| Prior reports ("migration was run", "backend broken", "dual-store active") used without re-verification | Verified as unsettled | — | Medium | This phase re-verified store behavior and typecheck from source; remaining items in Unknown list | — |

No invented numbers: this table avoids numeric scoring per prompt §14/§18 rules.

---

## 11. Architecture Analysis and Recorded Owner Decision

The source-based analysis found strong evidence for selective reuse and no proven trigger for a wholly independent system. Following that analysis, the Owner has **recorded D1 = Option B — logical separation with selective reuse — as the selected architecture direction**. This is a recorded direction, not permission to execute implementation. The expected outcomes remain conditional on the approved tasks, contract-map completion, Stage-0 facts, final D8 approval, and the applicable stage gates.

The Owner has also **recorded D2 = topology option 1: reuse the current PostgreSQL database**. This is the selected topology direction; it does not authorize schema changes, data movement, production operations, or automatic session invalidation. The Owner has **recorded D3 = defer the final API-namespace policy until the contract map is complete**; keep `/api/**` for the current work, and no new namespace is approved now.

**Analytical alternative (not selected): Option A — strict continuation.** It remains a comparison option, not the recorded decision. Its viability still depends on source repair, real-HTTP integration, and separately approved resolution of the audit/notification file-store inconsistency. The D4 task has been approved for creation but its execution timing remains deferred.

**Option C reconsideration trigger:** a finalized prototype ↔ real API contract map proving business rules that the current 31-key permission vocabulary or current tables cannot express. Until such evidence exists, the report has no proven trigger for C.

**Evidence and prerequisites still outstanding before execution:**
1. Complete D4 repair and obtain a green `npm run typecheck` before Stage 2; task timing remains deferred.
2. Finalize the prototype-to-live-API contract map and list proven deltas.
3. Complete Stage-0 production baseline: PostgreSQL version, dataset size, applied migrations, CORS configuration, actual secret-source identity (never the value), and relevant runtime dependencies.
4. Final D8 approval of the revised Doc D has been obtained (2026-10-29). Each stage-specific approval and its entry conditions must still be satisfied before its work starts; Stage 0 results require review and acceptance before advancing.

## 12. Recorded Owner Decisions and Remaining Gates

The current decision ledger is `phase-12-owner-decision-record.md` (doc E). The recorded status is:
1. **D1 — Recorded:** Option B, logical separation with selective reuse, is the selected architecture direction. No implementation is authorized by D1 alone.
2. **D2 — Recorded:** topology option 1, reuse the current PostgreSQL database. This does not authorize DDL, data movement, or production changes.
3. **D3 — Recorded:** defer the final API-namespace policy until the prototype-to-live-API contract map is complete. Keep `/api/**` for current work; no new namespace is approved now.
4. **D4 — Recorded:** creation of a separate, narrow conflict-marker repair task for 18 files is approved; execution timing is explicitly deferred. Stage 2 remains blocked until the repair is completed and `npm run typecheck` passes.
5. **D5 — Recorded:** preparing a safe `.jwt-secret` handling/rotation plan is approved; movement, configuration changes, and rotation remain deferred pending production-source verification and login/session-impact assessment.
6. **D6 — Recorded:** the JSON `audit_logs`/`notifications` → PostgreSQL migration is approved as a separate task. Execution remains blocked by final D8 approval and applicable stage gates.
7. **D7 — Recorded:** a standalone HTTP-adapter task against the current API is approved; implementation remains behind contract-map completion and applicable stage gates.
8. **D8 — Finally approved (2026-10-29):** final approval of Doc D — the validation, migration, and rollback plan and its stage gates (Stages 0–6). The requested amendments are incorporated. No stage may be executed without its specified prerequisites, entry conditions, and explicit approval at its gate; final D8 approval is not permission to skip any stage gate. Stage 0 results still require review and acceptance before advancing.

No stage execution, source repair, HTTP-adapter implementation, secret operation, database change, data migration, route change, deployment action, or Phase 13 work is authorized by this report. The individual approvals above are limited to the task or direction stated. D8 is finally approved (2026-10-29); final D8 approval is not permission to skip any stage gate. Current gate: **D8 FINALLY APPROVED (2026-10-29). Stage 0 in progress; Stage 0 results require review and acceptance before advancing. Phase 13 must not start.**

Phase 12 remains at the ownership gate. D8 is finally approved (2026-10-29); final D8 approval does not authorize skipping any stage gate. Phase 13 must not start.
