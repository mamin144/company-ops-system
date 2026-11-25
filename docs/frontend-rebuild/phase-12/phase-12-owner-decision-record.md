# Phase 12 — Owner Decision Record (doc E)

Status: **Owner decisions D1–D8 recorded; D1–D7 and D8 are finally approved as of 2026-10-29. Nothing has been implemented under these decisions.** This record is the authoritative decision ledger and gate record; Phase 13 and migration execution remain blocked until their applicable prerequisites and stage-specific approvals are satisfied. D8's final approval does not authorize skipping any stage gate.
Baseline: branch `main`, HEAD `f91ed2f9`, October 2026. Companion docs: A (`phase-12-separation-migration-architecture-report.md`), B (`phase-12-data-migration-matrix.md`), C (`phase-12-api-auth-permissions-map.md`), D (`phase-12-migration-validation-rollback-plan.md`).

**Language note:** technical body in English (see doc A header); the Arabic chat report delivered alongside this record covers the same content.

**Format:** each decision lists the options neutrally (no default preselected where none is proven), the verified evidence behind each option, the impact, and what is blocked without the decision.

---

## Decision 1 — Architecture option (A / B / C)

| Option | Description | Evidence basis (labels) | Impact if chosen |
|---|---|---|---|
| A | Preserving the current system architecture (backend, DB, permissions) **while permitting independently approved maintenance or data-consistency remediation** — selecting Option A does not bundle or automatically approve any such fix; each maintenance item (including JSON→Postgres audit/notification remediation) requires its own separate Owner approval. | Matches phase-10/11 decision history (Verified as history); contradicted in part by today's verified conflict-marker defect and missing HTTP adapter (Verified/Inferred respectively) | Lowest new work now, but leaves the defect blocking all verification; the audit/notifications store gap remains unresolved **unless the separate remediation is approved and completed** |
| B | Logical separation with selective reuse: current backend; PG `users`/`roles`/`sessions` identity chain schema available; the standalone HTTP-adapter task is approved but not implemented; contract deltas become explicit extension points when proven. Option B does not itself choose database topology: D2 separately records the Owner's selection to reuse the current PostgreSQL database. | 14/16 PG repos verified; reuse surface small-to-medium (Inferred); no proven semantic divergence (Verified as unproven) | Conditional outcome if the paired work is completed: address code health and real-HTTP integration without duplicating the system. Selecting B alone does not achieve these — the adapter remains unimplemented, the D6 audit/notifications migration task is approved but not executed and remains gated by D8, and backend repair is a separate task whose timing is deferred (D4) |
| C | Fully independent system: second backend, second DB, second identity chain | No evidence found supporting divergent permissions or data model (Verified as unproven); trigger condition documented in doc A §11 | Highest cost/maintenance; only justified if a finalized contract map proves rules the current system cannot express |

**Owner decision recorded:** Option B — logical separation with selective reuse — is selected as the architecture direction. It is not an execution authorization and does not itself approve source repair execution, database changes, data migration, HTTP adapter implementation, API namespace changes, or Phase 13.

The conditional outcomes described for Option B remain conditional: the backend repair has not been executed; the HTTP adapter has not been implemented; D6 migration has not been executed; and production baseline/contract facts remain incomplete.

**Still blocked:** Stage 2 and later stages until the D4 repair is completed and `npm run typecheck` passes, and until the applicable design, validation, rollback, and owner gates are approved. Phase 13 remains blocked.

---

## Decision 2 — Database topology (three options, isolation classes kept distinct)

Per prompt §9, three isolation classes are maintained separately: **logical** (data boundary), **operational** (failure/upgrade/resource domains), **security** (credential/GRANT/network domains). Qualitative matrix in doc A §5 — no invented pricing.

| Topology option | Logical isolation | Operational isolation | Security isolation |
|---|---|---|---|
| 1. Reuse the current PostgreSQL database | Shared tables | One PostgreSQL instance failure domain | One credential domain; shared role surface |
| 2. Create a separate database on the same PostgreSQL instance | Separate database/schema boundary | Same instance → same failure domain | Tighter per-DB roles/GRANTs possible; network layer unchanged |
| 3. Use a separate PostgreSQL server/instance | Full | True isolation | Full (incl. network) |

**Owner decision recorded:** topology option 1 — reuse the current PostgreSQL database — is selected. This establishes the intended topology only; it does not authorize DDL, database modifications, data migration, or production changes.

- Evidence for the selected direction: runtime store is verified as PostgreSQL (docs A/B); `DATABASE_URL` is required by `connection.ts`.
- Options 2 and 3 are not selected. They may be reconsidered only if new evidence and a separate owner decision justify changing topology.
- **Stage-0 facts still required before implementation:** production PostgreSQL version, dataset size, and whether migrations 19–21 are applied. The selected topology does not make those facts known.

**Session-migration policy (not yet selected):** D2 reuses the current database and does not itself require moving or resetting session rows. If an independently approved change later affects session rows or signing-secret compatibility, options must be evaluated explicitly: (a) preserve/migrate applicable rows after testing; (b) deliberately invalidate sessions if technically required and expressly approved; or (c) another evidenced policy. Do not infer a global session reset or one re-login per user as a default from D2 or D5. **JWT signature validity vs application validity:** a token may remain cryptographically verifiable while being rejected by application session/user checks (`middleware/auth.ts:74-83`); conversely, changing the signing secret causes tokens signed with the previous secret to fail signature verification. The actual production secret source and deployment rotation behavior are **Unknown**. Before any session-affecting transition, verify the active source without recording the secret value, assess refresh/session behavior, and document the login impact for Owner approval. Backend `typecheck` green remains a precondition for executing migration-code changes (see Decision 4).

---

## Decision 3 — API namespace (`/api/v2/**` or not)

**Owner decision recorded:** defer the final API namespace policy until the prototype-to-live-API contract map is complete. No new namespace is approved now; keep the existing `/api/` namespace for the current work unless a later owner decision explicitly changes this.

- If the adapter can use the current API without proven semantic deltas, a new namespace may not be needed.
- If the finalized contract map proves semantic deltas, present the naming, mounting, and versioning choices for a fresh Owner decision.
- Permission vocabulary remains shared (`packages/shared/src/permissions.ts`); server-side enforcement is not changed by D3.

**Boundary:** D3 authorizes no route edits, API implementation, permission change, or Phase 13 work.

---

## Decision 4 — Conflict-marker repair task (pre-existing defect)

**Verified:** 18 files under `apps/api/src/**` carry active git merge-conflict markers in source; `npm run typecheck` fails (TS1185). The markers are source text, not comments. Nothing was decided or implied about `dist/**`.

Phase 12 discovery itself did not fix them. **Owner decision recorded:** creation of a separate, narrowly scoped repair task is approved. The task scope is to restore compilable source while preserving intended logic, re-run `npm run typecheck` to exit 0, and bundle no unrelated changes. **Execution timing is explicitly deferred**; no source repair has yet been authorized to start at a particular time or performed by this documentation update.

**Execution status (2026-10-29):** owner authorized the repair to begin within its original narrow scope. All 18 files were inspected; 21 conflict blocks were resolved by keeping the ESM-correct `.js` import suffix (HEAD side) and, in `modules/auth/auth.routes.ts`, the `z.preprocess` normalization of uppercase GRANT/DENY to canonical lowercase. No conflict markers remain in `apps/api/src/**`. `npm run typecheck` exited 0 (see Stage 2 report). D4's prerequisite for Stage 2 is satisfied. This execution does not approve D6 migration, D7 adapter implementation, or Phase 13.

The repair must be completed before any Stage 2 migration script is run. Until it is completed and `typecheck` is green, Stage 2 and later migration stages remain blocked. This task approval does not approve D6 migration execution or Phase 13.

---

## Decision 5 — `.jwt-secret` handling

**Verified:** secret material resolution order in source (`auth.service.ts:15-23`): the `JWT_SECRET` env variable takes priority; the `data/.jwt-secret` file is used only as a fallback (auto-created when the env variable is absent). So the file is a candidate signing secret, not necessarily the active one — the actual production source is Unknown. Propagation/rotation behavior beyond this is not verifiable from source alone.

**Owner decision recorded:** approve preparing a safe plan for secret handling/movement and documented rotation. Actual movement, configuration changes, and the rotation window are **deferred** until the active production secret source is verified and session/login impact is assessed. Never copy the secret value into these documents or reports.

The decision does not authorize any current secret-file operation, environment change, rotation, session invalidation, or production change. The plan must describe rollback/compatibility implications and obtain the required approval before execution.

---

## Decision 6 — Audit-log / notification store migration (JSON → Postgres)

**Verified:** `audit-log.repository.ts` and `notification.repository.ts` are file-backed exceptions in an otherwise PG-backed runtime. This is a store-consistency defect independent of the architecture question (it applies under A, B, and C alike).

**Proposed:** Transform per doc B §3, mapping precedent at `data-migration.ts:122-131`, into the existing PG tables — **verified to exist in schema** (`001_initial_schema.sql:287` audit_logs, `:304` notifications), while the runtime repositories currently write to JSON files (`audit-log.repository.ts:7`, `notification.repository.ts:7`). Design caveats before execution: (a) the generic one-shot loader's mapping precedent does **not** prove that audit-log/notification migration is lossless or semantically unchanged — field mapping, timestamp preservation, actor identities, actor/username mapping, read_by membership and historical record preservation require an explicit validated design; (b) whether existing audit entries actually populate enough before/after state (old/new values) for any future reconciliation is Unknown. Server-side enforcement remains unchanged. Default synchronization claims between stores were re-classified **Unknown** rather than "Dual-Store active".

**Owner decision recorded:** approve JSON `audit_logs` and `notifications` → PostgreSQL migration as a separate task, using the existing PostgreSQL database selected in D2. Actual execution is not immediate; it is subject to the final D8 plan and the explicit approval/validation gates at the applicable stage.

Before execution, validate field mapping, timestamps, actor identities, notification `read_by` membership, historical-record preservation, and the recovery/rollback procedure. This decision authorizes neither an immediate database change nor deletion of JSON files. Other JSON files are outside this task unless separately assessed and approved.

---

## Decision 7 — HTTP adapter for the new UI

**Verified indirectly:** the prototype is mock-only; Phase 11 flagged the missing adapter as a limitation. Without it, report-vs-real drift and parity remain unverifiable against live endpoints.

**Proposed (Doc A §6, Doc C §7):** build the adapter against the current API as-is first (cookie/session contract per doc C), before any boundary changes.

**Owner decision recorded:** approve the HTTP adapter as a standalone task against the current API, following the auth/transport contract boundaries in doc C. Actual implementation is not authorized to begin immediately; timing and execution remain subject to the finalized contract map and D8 gates.

The adapter task does not approve a new API namespace, permission changes, backend source repair bundling, or Phase 13. Server-side enforcement remains unchanged.

---

## Decision 8 — Migration plan and gate order (doc D)

Doc D defines Stage 0 → Stage 6, separates application rollback from data rollback, prohibits unmanaged dual writes, and specifies approval gates.

**Owner decision recorded:** final approval of Doc D — the validation, migration, rollback plan, and its stage gates (Stages 0–6) — given on 2026-10-29. The amendments requested by the Owner are incorporated in this revision. No stage may be executed without its specified prerequisites, entry conditions, and explicit approval at its gate; final D8 approval is not permission to skip any stage gate. Stage 0 results still require review and acceptance before advancing.

This revision addresses: (1) recording the selected current-PostgreSQL topology; (2) distinguishing isolated dry runs from production execution; (3) limiting Stage 5 to explicitly scoped transitions instead of assuming a wholesale database/app cutover; (4) removing automatic global re-login/session invalidation; (5) requiring proven idempotency and controlled-failure tests; (6) requiring a tested post-transition write recovery/reconciliation policy; (7) checking only the two converted JSON stores rather than all JSON files; and (8) validating constraints against the actual schema and applied migration set after Stage 0.

---

## Sequencing Recommendation (Proposed; reflects decisions now recorded)

1. **D4 repair task:** task creation approved and **execution completed (2026-10-29)** within its narrow scope; `npm run typecheck` exited 0. D4's prerequisite for Stage 2 is satisfied. Confirm any further repair timing as a separate operational choice.
2. Complete the prototype-to-live-API contract map. D3's final namespace decision remains deferred until this map is complete.
3. Complete Stage 0 read-only baseline facts: production PostgreSQL version, dataset size, applied migrations, relevant environment setting presence (never secret values), CORS configuration, JSON file/runtime dependencies, and the current contract gaps.
4. Treat D1 Option B and D2 reuse of the current PostgreSQL database as the current owner-selected direction; do not reopen them absent new evidence and a fresh Owner decision.
5. Prepare D5's safe secret plan. Execute no movement/rotation until the production source and login/session impact have been verified and separately approved.
6. Prepare D6 and D7 as scoped independent tasks. Their execution remains subject to final D8 approval and the applicable stage gates; no immediate migration or adapter implementation is authorized by the task approvals alone.
7. Doc D has received final D8 approval (2026-10-29). No migration stage or Phase 13 may start until Stage 0 results are reviewed and accepted and each stage's entry conditions and approvals are satisfied.

This ordering is proposed except where an explicit prerequisite or recorded owner decision is stated. It does not authorize execution by itself.

---

## Unresolved Evidence Gaps (honest state)

| Item | Why it stays open | Cheap fact that would close it |
|---|---|---|
| Production Postgres state | Not discovered in this phase; no production access | Owner provides version + basic size stats (no data contents) |
| Migrations 19–21 applied? | Same as above; runner logs not available here | `SELECT * FROM _migrations;` read by owner or a Stage-0 read-only session |
| Actual prod dataset size | No access; no invented numbers permitted | Basic size/stat query output |
| Synchronization semantics between JSON files and PG store beyond bootstrap | Repository code shows bootstrap; runtime sync behavior beyond that was not proven | Confirmation from owner of intended legacy-file state |
| Contract deltas between prototype and live API | Contract map not finalized | Completion of the delta list task |
| `.env` production values and active JWT signing-secret source | Never read (rule); never record secret values | Owner-verified presence/absence of relevant setting names and confirmation of active source, without disclosure of any value |

---

## Stage 1 Approval Addendum (2026-10-29)

- **Stage 1 — OWNER APPROVED (DESIGN ONLY, 2026-10-29).** The target design document `docs/frontend-rebuild/phase-12/phase-12-stage-1-target-design.md` is approved as a design document only.
- This approval does not establish unverified production facts, finalize unverified production-schema assumptions, or grant unrestricted implementation or production-change authorization.
- D1–D8 are preserved with their existing meanings. D8 final approval (2026-10-29) is recorded; final D8 approval is not permission to skip any stage gate.
- The owner authorized the previously approved D4 conflict-marker repair task to begin within its original narrow scope (repair 18 files, restore compilable source, re-run `npm run typecheck` to exit 0, bundle no unrelated changes). This authorization does not expand D4 into unrelated refactoring or feature development.
- D6 and D7 implementation remain gated by their existing requirements and approvals (contract map, stage gates, owner approvals).
- Stage 2 remains conditional on its actual entry gates (D4 complete + typecheck green, isolated DB/data copy, inspected runner, documented test scope, no production connection).
- No production deployment, DDL, data migration, secret rotation, permission change, or Phase 13 work is authorized by this approval.

---

## Sign-off / Current Owner Gate

**Recorded decisions:** D1 = Option B; D2 = reuse the current PostgreSQL database; D3 = defer the final namespace policy until the contract map is complete, with no new namespace approved now; D4 = separate repair-task creation approved, timing deferred; D5 = safe plan preparation approved, actual secret movement/rotation deferred; D6 = separate audit/notification migration task approved, execution subject to the applicable stage gates; D7 = separate HTTP adapter task approved, implementation subject to the contract map and applicable stage gates; D8 = final approval of Doc D (validation, migration, and rollback plan and its stage gates) recorded on 2026-10-29.

**D8 status:** finally approved on 2026-10-29. Doc D — the validation, migration, and rollback plan and its stage gates — is approved as the governing plan. The requested amendments are incorporated in this revision. No stage may be executed without its specified prerequisites, entry conditions, and explicit approval at its gate; final D8 approval is not permission to skip any stage gate. Stage 0 results still require review and acceptance before advancing.

**No implementation authorization:** no migration, source repair, adapter implementation, secret operation, database change, route change, deployment action, or Phase 13 work may be inferred from these recorded decisions alone. The specific task approvals and prerequisites stated above remain controlling; all operational changes require their applicable explicit gate approval.

**Current gate: D8 FINALLY APPROVED (2026-10-29). Stage 0 in progress; Stage 0 results require review and acceptance before advancing. Phase 13 must not start.** No implementation, migration, or Phase 13 work is authorized beyond Stage 0.
