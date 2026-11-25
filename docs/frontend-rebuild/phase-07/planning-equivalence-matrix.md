# Phase 7 — Archive Workspace: Equivalence Matrix (planning doc)

Written BEFORE any code edit, per phase discipline. Every row grounded in a file+line read
this phase (paths relative to repo root). Items marked ★ are Phase 7 build targets;
everything else is verification-only (already passing).

Sources of truth (read-only, untouched):
- `apps/api/src/modules/documents/documents.routes.ts` (GET /, GET /:id, GET /:id/revisions,
  GET /:id/preview|download|file, POST /upload, POST /:id/revisions, POST /:id/replace,
  PUT /:id, DELETE /:id, POST /:id/move)
- `apps/api/src/modules/documents/documents.validators.ts` (`documentSchema`, `documentStatusSchema`)
- `apps/api/src/services/authorization.service.ts` — `can()` (DENY > GRANT; project narrowing)
- Mock layer: `docs/frontend-rebuild/phase-03-prototype/src/services/api/adapters/mock/{api.ts,data.ts,errorKeys.ts}`

## Matrix

| # | Real contract | Mock mirror (★ = built this phase) | UI affordance | Demo honesty / limitations recorded |
|---|---|---|---|---|
| 1 | GET /documents (+q,status,project scope; applySearch fields incl. documentNumber/notes) | `mockApi.documents(filter, actorId)` — scopeRow before q-filter | list toolbar (existing, verified) | in-memory only; search matches title+number+tags (mock scope), notes not searched — recorded |
| 2 | GET /:id, GET /:id/revisions (reversed) | byId map / revisions modal timeline (existing) | ν vXX (n) link, DocViewer | synthetic content, labeled تجريبي |
| 3 | GET /:id/preview|download|file (MIME map, RFC5987) | DocViewer + toast only (existing) | preview/download toasts mockNote; no link/path/date invented |
| 4 | ★ POST /upload — multipart, file REQUIRED, `documentSchema` (title/category min1; documentNumber, category, documentType, revision, documentDate, notes, tags), status=draft, category-folder storage | `uploadDoc(title, meta?)` gains optional {number, category, type, tags, notes}; status stays 'draft'; defaults: number 'DOC-MOCK', category 'أخرى', type 'PDF', tags ['تجريبي'] | upload modal (+ new optional fields, title stays FIRST input) | file not stored at all — modal copy says memory-only; title-only submission preserved (i18n.spec:93, remediation CSV rule test) |
| 5 | ★ POST /:id/revisions — file required, `nextRevisionLabel(revisions.length)` = `String(count).padStart(2,'0')` (NO +1), fileSize/uploadedBy/notes, downgrade approved→submitted | `addRevision(id, fileName, notes?)`: label **changed from `padStart(length+1)` to `padStart(length)`** to mirror the backend exactly (addRevision currently unused by UI/specs, so the change is behavior-neutral), downgrade added, notes stored, `by` 'مستخدم تجريبي', `at` '2026-10-11' (established fixed mock date convention) | '+ إصدار جديد (تجريبي)' now opens: file → review (old v/new file/downgrade-note if approved) → confirm; busy-protected | QUIRK (backend-faithful): d1 has 3 revisions + counter '03' → next label duplicates '03'. Recorded as limitation, NOT smoothed over |
| 6 | ★ PUT /:id — `documentSchema.partial()`; title min1, category min1; documentNumber/documentType/documentDate/notes/tags/projectId; **cross-project move requires `can(ctx,'archive.edit', newProject)` → 403** | new `updateDoc(id, actorId, patch)`: global `archive.edit` gate; scoped gate ONLY when projectId changes (targets the NEW/first-assigned project), mirroring the route (no membership requirement on the current project); validation errors: 'عنوان المستند مطلوب' / 'تصنيف المستند مطلوب' (+ ERR_KEYS entries); permission denial → literal `ليس لديك صلاحية: archive.edit` (ERR_PERM_PREFIX contract) | menu item 'تعديل' (currently `toast('info', mockNote)` stub) → metadata edit modal (title, number, category, type, tags, notes, project) | label/number unchanged in-memory copy; updatedAt convention unchanged (precedent: setDocStatus) |
| 7 | ★ DELETE /:id — route gate `archive.delete`; DeleteSafety: admin bypasses block, non-admin → 409 (unreachable in mock: only admin holds archive.delete) | new `deleteDoc(id, actorId?)`: gate via `allowedFor(actor,'archive.delete')`, removes from db.docs | menu item 'حذف' → EXISTING ConfirmDialog (text `confirmDeleteDoc` unchanged — no spec asserts it beyond visibility), then in-memory removal + toast | toast copy: removed from demo memory, nothing real deleted |
| 8 | POST /:id/replace — swap current file, snapshot old into history, counter+1, downgrade | `replaceDoc` UNTOUCHED (established prototype semantics; spec-bound) | existing replace two-step flow | unchanged |
| 9 | PATCH /:id/move (folderId) | NOT represented — unified list workspace has no folders (`archiveScopeNote`), folder/move facets excluded by design | none | limitation recorded |
| 10 | `can(ctx, k)` project narrowing: SOURCE/SCOPED minimums — `archive.view`/`archive.download` READ, `archive.upload`/`archive.edit` WRITE, `archive.delete` DELETE | ★ `SCOPED_MIN` extended with the five archive.* keys exactly; DENY-beats-GRANT inherited via `allowedFor` | menu visibility already gates on `can()`; extension makes `canProject` answer correctly for archive.* (behavior-neutral: every existing caller uses projects.* only) | acceptance case: mu-3 (technical, p1 WRITE / p2 READ) moving a p1 doc to p2 → denial «ليس لديك صلاحية: archive.edit» |
| 11 | Duplicate-submission protection | ★ busy flags on: upload, edit, revision confirm, status confirm, delete confirm (buttons disabled + `busy` while awaiting mock) | all dialogs | prevents double rows/double deletes in demo memory |
| 12 | DocViewer shows document fields | ★ shows `doc.notes` when present (label reuses existing `notes` key) — no invented seed values; notes only exist if user typed them at runtime | preview modal | honest |

## Test-preservation ledger (verified by grep this phase, MUST NOT regress)

- `i18n.spec:93` — upload button `'+ رفع مستند (تجريبي)'` / 'Upload document (demo)'; modal label `'عنوان المستند *'`; submit button `'رفع'` works with title-only input (remediation 'formula-leading titles' test).
- `remediation-p2p3.spec` ~L29–45 — row: 'معاينة' + 'تنزيل' visible; 'الحالة'/'حذف' NOT on row surface; menu: 'الحالة', 'استبدال', /روابط/, 'تعديل', 'حذف' visible. Menu item labels unchanged (wiring only).
- `regression.spec` P2-01 — upload modal: first `.modal input` = title input, focus cycle intact → new fields must be appended AFTER the title input.
- `remediation-p2p3` CSV suite — fresh-page export has exactly 8 rows; upload-then-export flow must keep row + CSV formula-neutralization intact.
- `archive.spec` (12 tests) + `i18n.spec` archive pair — status modal copy, sort header labels, status sort keys unchanged.
- `coverage.spec` destructive-dialog test targets `/inventory/items`, not archive — archive ConfirmDialog behavior change (real in-memory removal) does not affect it.

## Deferred (NOT in scope — owner review 2026-10-25 11:00 Cairo)
recHead/recRow column alignment; 390px topbar clipping; Dashboard SplitText.
