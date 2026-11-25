# Phase 14B — الوثيقة 03: عقود الـ API الهدف (API Contracts)

> **قاعدة صارمة:** لا يُدَّعى وجود endpoint لمجرد تصميمه. كل نقطة مصنفة:
> **[Verified]** موجودة ومُدققة من مصدر آمن · **[Adapt]** موجودة وتحتاج تكييفًا · **[Proposed]** جديدة — تقدير تصميمي يحتاج تنفيذًا لاحقًا (لا وجود لها اليوم).
> **القيود:** عقود auth [Verified من `session.ts`]؛ 3 نقاط مشاريع [Verified من `api.ts`]؛ كل ما عدا ذلك في الخلفية **غير قابل للفحص** (ملفات `apps/api/src/**` محمية) — تفصيلات خلفية غير موثقة تُعلَّم [Unknown].

---

## 1. الاصطلاحات العامة [Proposed — إلا ما يُذكر]

- **Base path:** `/api` [Confirmed من الواجهة].
- **المصادقة:** Bearer JWT قصير العمر (ذاكرة + sessionStorage) + cookie `cos_refresh` (HttpOnly, path=/api/auth) [Verified].
- **التخويل:** permissions تُحل خلفيًا لكل طلب (role + overrides + projectAccess)؛ العميل لا يفترضها [Verified].
- **النجاح للقوائم:** `PagedResult<T>` = `{ items, total, page, pageSize }` [Confirmed النوع].
- **النجاح للعنصر:** الكيان مباشرة [Inferred من الأنواع — غير مثبت عبر endpoint].
- **الخطأ الموحد:** `HTTP status + { error: { code, message, details?: string[] } }` [Proposed].
- **الترميز:** `{ data, meta }` اختياري مستقبلاً — لا يُفرض الآن (توافق مع PagedResult).
- **Idempotency:** عمليات الإنشاء غير idempotent؛ الاسترجاع/التحقق/الاسترجاع-النسخ idempotent؛ أدوات مثل `DELETE` منطقي قابل للتكرار (بدون خطأ إن سبق) [Proposed].
- **Concurrency:** تعديلات العناصر تقبل `If-Match: <updatedAt>` أو `expectedUpdatedAt` → 409 `CONFLICT` عند تعارض [Proposed].
- **Auditing:** كل عملية كتابة تولّد حدث تدقيق ضمن المعاملة [Proposed — INT-3 من 02].

**أكواد الأخطاء الموحدة [Proposed]:** `VALIDATION_ERROR`(400), `UNAUTHENTICATED`(401), `FORBIDDEN`(403), `NOT_FOUND`(404), `CONFLICT`(409), `INVALID_TRANSITION`(409), `SELF_APPROVAL_DENIED`(403), `PROJECT_DELETED`(409), `DUPLICATE_PROJECT_CODE`(409), `DUPLICATE_IPC_NUMBER`(409), `FOLDER_NOT_EMPTY`(409), `IMPORT_TOO_LARGE`(413), `UNSUPPORTED_TYPE`(415), `LAST_ADMIN`(409), `RATE_LIMITED`(429), `INTERNAL`(500).

---

## 2. جرد السطح (Endpoint Inventory)

| # | Endpoint | الحالة | الوحدة |
|---|---|---|---|
| 1 | `POST /api/auth/login` | **[Verified]** | Auth |
| 2 | `POST /api/auth/refresh` | **[Verified]** | Auth |
| 3 | `GET /api/auth/me` | **[Verified]** | Auth |
| 4 | `POST /api/auth/logout` | **[Verified]** | Auth |
| 5 | `GET /api/projects` | **[Adapt]** — يعمل (pageSize=1000 hack) | Projects |
| 6 | `POST /api/projects` | **[Verified]** | Projects |
| 7 | `PUT /api/projects/:id` | **[Verified]** | Projects |
| 8–11 | Projects delete/restore/boq/ipc... | **[Proposed]** | Projects/Finance |
| 12+ | documents / search / dashboard / audit / users / backups / import / password-reset | **[Proposed]** | — |

---

## 3. المصادقة والجلسة

### 3.1 [Verified] `POST /api/auth/login`
- طلب: `{ username: string, password: string, rememberMe?: boolean }`
- نجاح 200: `{ sessionId, accessToken, expiresIn, user: SafeUser & { permissions } }`
- أخطاء: 401 `UNAUTHENTICATED` (بيانات خاطئة — رسالة عامة لا تكشف وجود الاسم) [Verified السلوك بنيويًا؛ نص الرسالة [Unknown]].
- تدقيق: `auth.login` (نجاح/فشل) [Proposed].

### 3.2 [Verified] `POST /api/auth/refresh`
- عبر cookie `cos_refresh` فقط (لا Bearer). نجاح: نفس بنية login. فشل: 401 → الخروج للواجهة.
- تدقيق: `auth.refresh` عند نجاح [Proposed].

### 3.3 [Verified] `GET /api/auth/me` → `SafeUser & { permissions }` — Bearer أو `cos_access` cookie.

### 3.4 [Verified] `POST /api/auth/logout` → `{ ok: true }` — يلغي جلسة **الجهاز الحالي** فقط [Verified].

### 3.5 [Proposed] `POST /api/auth/password-reset/request`
- طلب: `{ identifier: string }` (username أو email [Proposed]).
- سلوك: استجابة عامة دائمًا 202 (لا تكشف وجود الحساب)؛ يولّد رمزًا أحاديًا (06 §3) — قناة التسليم [Unknown: SMTP/إداري].
- rate limit صارم (429) [Proposed].

### 3.6 [Proposed] `POST /api/auth/password-reset/confirm`
- طلب: `{ token: string, newPassword: string }` — سياسة كلمة المرور [Unknown → تُعتمد في 06 §4 كتصميم: ≥8 أحرف...].
- سلوك: يتحقق من hash+expiry+غير مستعمل → يهش ويحدث → يبطئ الرمز + يلغي كل جلسات المستخدم [Proposed].
- أخطاء: 400 `INVALID_TOKEN` / `TOKEN_EXPIRED` / `TOKEN_USED`.

### 3.7 [Proposed] `POST /api/admin/users/:id/reset-password` — إداري (§8)؛ **لا يُعيد كلمة المرور للإداري**، يولّد تدفق رمز للمستخدم.

---

## 4. المشاريع (Projects)

### 4.1 [Adapt] `GET /api/projects` — قائمة paged حقيقية
- حاليًا: يعمل بـ `page=1&pageSize=1000` [Verified من api.ts] — **التكييف:** دعم `ListQuery {q, sortBy, sortDir, page, pageSize}` + فلاتر `status`, `includeDeleted=false` افتراضيًا [Proposed].
- **نطاق:** يعيد فقط المشاريع المرئية (projectAccess ≥ READ) + الاستثناء: حامل `projects.delete` يستطيع `includeDeleted=true` [Proposed O12].
- استجابة: `PagedResult<Project>` [Confirmed النوع] + Project موسّع حقول deleted_at/by عند التضمين.
- 200/401/403/500.

### 4.2 [Verified] `POST /api/projects` — إنشاء (صلاحية `projects.create` [Inferred من الواجهة — يُفترض مفروَضًا خلفيًا [Unknown]]).

### 4.3 [Verified] `PUT /api/projects/:id` — تحرير (`projects.edit` + WRITE). يدعم قفل تفاؤلي [Proposed]. تغيير الحالة عبر نفس النقطة بقيد مصفوفة §3.3 من 01.

### 4.4 [Proposed] `DELETE /api/projects/:id` — **حذف منطقي** (O12)
- صلاحية: `projects.delete` + projectAccess = DELETE.
- سلوك: يضبط `deleted_at/deleted_by`؛ لا يمس التابعين؛ idempotent (ثاني استدعاء → 409 `PROJECT_DELETED` أو 200 حسب السياسة — نعتمد 409 للوضوح).
- استجابة 200: `{ id, deletedAt }`. تدقيق: `project.soft_delete` (oldValue: status…).

### 4.5 [Proposed] `POST /api/projects/:id/restore` — `projects.delete`؛ يزيل deleted_at/by. تدقيق: `project.restore`.

### 4.6 [Proposed] `GET /api/projects/:id` — تفصيل (لا يعمل اليوم ضمن wired [Verified غيابه عن api.ts]).

### 4.7 [Proposed] BOQ: `GET /api/projects/:id/boq` · `POST` · `PUT /api/boq/:itemId` · `DELETE /api/boq/:itemId`
- صلاحية: `projects.edit` + WRITE (قراءة بـ projects.view+READ).
- ملاحظة: نقاط BOQ قد تكون موجودة خلفيًا غير قابلة للفحص [Unknown] — **يُنشر كتصميم حتى التثبيت**.
- حفظ الدفعة: استبدال كامل بمعاملة واحدة (invariant: مجموع prices متسق) [Proposed].

---

## 5. الأرشيف (Documents)

> كل النقاط **[Proposed]** ما لم يُذكر — الملفات الخلفية غير قابلة للفحص [Unknown]، والواجهة الحالية تعمل بـ fixture [Verified].

| Endpoint | صلاحية | ملاحظات |
|---|---|---|
| `GET /api/documents?ListQuery&projectId&status&category&folderId` | `archive.view` (+READ للمشروع عند projectId) | PagedResult<Document>؛ فلترة نطاق خلفية |
| `GET /api/documents/:id` | `archive.view` | + revisions وlinks |
| `POST /api/documents` (multipart أو metadata+fileRef) | `archive.upload` + WRITE | status أولي = draft |
| `PUT /api/documents/:id` | `archive.edit` + WRITE | حقول وصفية فقط (الحالة عبر 5.4) |
| `DELETE /api/documents/:id` | `archive.delete` + DELETE | حذف منطقي؟ [Unknown نمط الخلفية — التصميم: soft/إزالة من القوائم مع أرشفة السجل] |
| `GET /api/documents/:id/download` | `archive.download` + READ | stream/URL موقّع قصير العمر [Proposed] |
| `POST /api/documents/:id/revisions` | `archive.upload` + WRITE | مراجعة جديدة (سلسلة محفوظة) |
| `GET /api/folders` · POST/PUT/DELETE | `archive.edit` | حذف غير فارغ → 409 FOLDER_NOT_EMPTY |
| `POST /api/documents/import` | `archive.upload` | انظر 5.5 |
| `GET /api/imports` | `archive.upload` أو users? | سجل ImportHistoryEntry [Confirmed النوع] |

### 5.4 [Proposed] انتقال الحالة — نقطة مخصصة
`POST /api/documents/:id/status { to: DocumentStatus, notes?: string, reason?: string }`
- تنفّذ مصفوفة 01 §4.3 حرفيًا؛ غير المسموح → 409 `INVALID_TRANSITION {from,to}`.
- فصل المهام: رافع آخر مراجعة لا يوافق [Proposed] → 403 `SELF_APPROVAL_DENIED`.
- تدقيق: `document.status_change` (old/new + notes) [O3].

### 5.5 [Proposed] `POST /api/documents/import` (CSV ≤ 200 صف — O11)
- طلب: multipart CSV + `{ entity: 'documents' }`.
- سلوك: يتحقق من الحد (تجاوز → 413 `IMPORT_TOO_LARGE`)؛ كشف التكرار **بالمفتاح `documentNumber` (= `number` في الواجهة الحالية [Confirmed من Archive.tsx])** — يعيد تقرير تكرارات قبل الاعتماد؛ لا استبدال صامت [O11].
- خيار التنفيذ: مرحلتان (dry summary → confirm) أو مرحلة واحدة بتقرير أخطاء لكل صف — **نقطة نار: تطبيق الخلفية الحالي [Unknown]** → التصميم مرحلتان [Proposed] ويُسقط إذا أثبتت المراجعة المصدرية السلوك الحالي بمرحلة واحدة (تثبيت لاحق، لا تخمين).
- استجابة: `ImportResult { totalRows, successfulRows, failedRows, errors[], duplicates[] }` + سجل import_batches.

---

## 6. المالية والـ IPC (O2/O4)

### 6.1 [Proposed] `GET /api/projects/:id/financials`
- صلاحية: `projects.view` + READ.
- استجابة (مبينة على Confirmed فقط + unavailable):

```jsonc
{
  "project": { "id": "...", "contractValue": 1234.5 },        // أو unavailable NOT_ENTERED (O2)
  "boqTotal": 9876.5,                                          // Σ totalPrice [Confirmed مصدر الحقل]
  "approvedIpcTotal": 5000,                                    // Σ approved IPC فقط (O4)
  "payments": { "value": null, "unavailable": true, "reason": "PAYMENTS_DEFERRED" },        // O5
  "tax":      { "value": null, "unavailable": true, "reason": "TAX_RULES_UNDEFINED" },      // O6
  "retention":{ "value": null, "unavailable": true, "reason": "RETENTION_RULES_UNDEFINED" },// O6
  "advance":  { "value": null, "unavailable": true, "reason": "ADVANCE_RULES_UNDEFINED" }   // O6
}
```
- لا إجمالي "متبقي للصرف" مُصطنَع [O5].

### 6.2 [Proposed] IPC CRUD
- `GET /api/projects/:id/ipcs?status` (view+READ) · `GET /api/ipcs/:id` (+statusEvents)
- `POST /api/projects/:id/ipcs` (projects.edit + WRITE) — draft أولي؛ تحقق تفرّد ipcNumber/المشروع.
- `PUT /api/ipcs/:id` (projects.edit + WRITE) — **فقط في draft** وإلا 409 `IPC_LOCKED`.
- `DELETE /api/ipcs/:id` (projects.edit + WRITE) — draft فقط [Proposed].
- القيم: ببنود (IpcItem[]) أو grossAmount مباشر — لا تُخلط في نفس التحديث بدون تصريح [Proposed].

### 6.3 [Proposed] دورة الموافقات — نقاط صريحة
| Endpoint | صلاحية | قاعدة |
|---|---|---|
| `POST /api/ipcs/:id/submit` | `projects.edit` + WRITE | draft→submitted؛ يسجل submitter |
| `POST /api/ipcs/:id/start-review` | `projects.edit` | submitted→under-review |
| `POST /api/ipcs/:id/approve` { notes? } | **`ipcs.approve` [Proposed مفتاح]** + WRITE | under-review→approved؛ **المعتمد ≠ المُقدِّم** (403 `SELF_APPROVAL_DENIED`)؛ المعتمد ≠ آخر محرر محتوى [Proposed] |
| `POST /api/ipcs/:id/reject` { reason! } | `ipcs.approve` + WRITE | under-review→rejected؛ السبب إلزامي (400 بدونه) |
| `POST /api/ipcs/:id/resubmit` { notes? } | `ipcs.resubmit` **[Proposed]** أو projects.edit | rejected→draft ثم submit؛ لا قفزة rejected→approved |
| `GET /api/ipcs/:id/status-events` | view+READ | سجل القرارات (ipc_status_events) |

- كل نقطة تولّد حدث `ipc_status_change` + صف ipc_status_events [O4].
- **[Confirmed قيد]**: `ipcs.approve`/`ipcs.resubmit` ليست في ALL_PERMISSIONS [Confirmed] — إضافتها تغيير نموذج صلاحيات يتطلب اعتماد مالك (05 §6). حتى الاعتماد: الوضع البديل المعلَم = فصل المهام غير مضمون بـ projects.edit وحده [Proposed — يُعلَم في الواجهة].
- معالجة `under-review` كقيمة جديدة: عقود تستقبل IpcStatus الموسع [Proposed — توافق additive].

---

## 7. الإدارة (Users/Overrides/Access)

> كلها **[Proposed]** (غير قابلة للفحص) — صلاحية البوابة: `users.manage` [Confirmed المفتاح] (+ `projects.access`/`users.resetPassword` prototype-only [Confirmed غيابهما من ROLE_BASE]).

| Endpoint | الغرض |
|---|---|
| `GET /api/users?q` | قائمة SafeUser[] (لا passwordHash أبدًا) |
| `POST /api/users` | إنشاء {username, fullName, email (حقل هوية قائم)، department?, title? (الجديدان — O1), roleName, tempCredentials} |
| `GET /api/users/:id` | تفصيل + overrides + projectAccess |
| `PUT /api/users/:id` | تعديل الحقول (الجديدان O1: department/title؛ email يُعدَّل كحقول قائمة دون تصنيفه جديدًا) |
| `PUT /api/users/:id/status {isActive}` | تعطيل/تفعيل؛ آخر admin نشط → 409 LAST_ADMIN |
| `PUT /api/users/:id/role {roleName}` | تدقيق عالي الحساسية |
| `PUT /api/users/:id/overrides {permission: INHERIT|GRANT|DENY}` | O13 طبقة 2 |
| `PUT /api/users/:id/project-access {projectId: NONE|READ|WRITE|DELETE}` | O13 طبقة 3 |
| `GET /api/users/:id/effective-permissions` | المخرج النهائي بعد الطبقات الثلاث (تشخيص إداري) |
| `GET /api/roles` | قائمة الأدوار + توزيعها [Confirmed النوع] |
| `POST /api/admin/users/:id/reset-password` | يولّد رمزًا — لا يعيد كلمة مرور للإداري |

- استثناء: `GET /api/users/me-self-fields`؟ لا — `GET /api/auth/me` يكفي (يُوسّع SafeUser بـ department/title [Proposed] + يعرض email كحقل قائم). ملاحظة أمانة: أنواع SafeUser المُدققة لا تعرض email — إظهاره في العقد [Proposed] يفترض قراءة الحقل القائم من الخلفية (قيوده [Unknown]).

---

## 8. التدقيق (Audit — O8)

### 8.1 [Proposed] `GET /api/audit`
- صلاحية: `audit.view` [Confirmed].
- فلاتر: `q`, `entity`, `entityId`, `action`, `userId`, `from/to (timestamp)`, `projectId?` (اختياري — O8), `hasProject: true|false`, `ListQuery`.
- **قاعدة رؤية:** فلترة projectId محددة تتطلب projectAccess ≥ READ على ذاك المشروع [Proposed 01 §7.3]؛ بدون فلتر: كل السجلات المرئية (بما فيها بلا projectId).
- استجابة: PagedResult<AuditLog> (AuditLog الموصل بـ projectId بعد O8).
- ip_address + oldValue/newValue الكاملة: admin فقط؛ بقية الأدوار نسخة مُقلَّمة [Proposed].

---

## 9. البحث العالمي (O9) [Proposed]

### 9.1 `GET /api/search?q=...&types=projects,documents`
- صلاحية: مصادقة؛ النتائج **مرتبة خلفيًا** بالصلاحيات ونطاق المشاريع (projects.view/archive.view وفق النوع).
- **ممنوع التسريب [O9]:** لا أعداد لنتائج غير مصرح، لا عناوين/مقتطفات/بيانات وصفية لسجلات غير مرئية؛ استجابة لكل نوع `{ type, id, title, snippet?, projectId? }` فقط بعد اجتياز الفحص.
- استجابة: `{ groups: [{ type, items: [...], total }], tookMs }` — total لكل مجموعة **بعد** الفلترة.

---

## 10. لوحة القيادة (O7) [Proposed]

### 10.1 `GET /api/dashboard/summary`
- استجابة:
```jsonc
{
  "projectsByStatus": { "planned": 3, "active": 8, "on-hold": 1, "completed": 12, "cancelled": 2, "deleted": 0 },
  "documentsByStatus": { "draft": 5, "submitted": 2, "under-review": 1, "approved": 20, "rejected": 1, "superseded": 4, "archived": 30 },
  "recentActivity": [ AuditLog مقتطع ], "notificationsUnread": 3
}
```
- كل مجموعة تُعاد **فقط** لو يملك المستخدم صلاحية مصدرها (projects.view / archive.view / audit.view) [O7] — والعدّادات مقيدة بنطاق رؤيته.
- لا حقول مالية إطلاقًا [O5/O6/O7].
- "deleted" عدّاد يظهر فقط لمجموعة ذات حق رؤية المحذوف [Proposed].

---

## 11. النسخ الاحتياطي/الاسترجاع (O10) [Proposed — تصميم؛ التنفيذ غير مصرح به في 14B]

| Endpoint | الغرض |
|---|---|
| `GET /api/backups` | قائمة backups (metadata فقط) — `backup.manage` |
| `POST /api/backups` | إنشاء نسخة (مهمة خلفية؛ تسجل status) |
| `GET /api/backups/:id` | تفصيل + checksum + verifiedAt |
| `POST /api/backups/:id/verify` | تحقق سلامة (checksum + بنية) → verified/failed |
| `POST /api/backups/:id/restore {mode:'dry-run'}` | خطوة 1 إلزامية: تقرير تحقق/تعارضات |
| `POST /api/backups/:id/restore {mode:'commit', confirmToken}` | خطوة 2: يتطلب مرور dry-run ناجح حديث + توكن تأكيد صريح (06 §6) |
| `GET /api/restore-jobs/:id` | متابعة حالة restore_job |

- كلها `backup.manage` [Confirmed المفتاح]؛ تدقيق لكل عملية؛ **الاسترجاع يقفل الكتابة مؤقتًا** [Proposed 06 §6].

---

## 12. تزامن وعزل (خلاصة) [Proposed]
- كتابات العناصر: قفل تفاؤلي بـ updatedAt/If-Match.
- انتقالات الحالة: قاعدة DB شرطية (update ... where status=expected) → تحديث صفر صف = CONFLICT/INVALID_TRANSITION.
- import: معاملة واحدة للدفعة أو تسجيل أخطاء صف-بصف (لا نصف استيراد) [Proposed].
- idempotency-key اختياري للـ POST الحساسة (backups, imports) [Proposed — لاحقًا].

---

## 13. خريطة "موجود مقابل مقترح" (الخلاصة الصادقة)

- **[Verified] فعليًا يعمل اليوم:** auth ×4، GET/POST/PUT /api/projects (بحد 1000).
- **[Adapt] يحتاج تكييفًا:** GET /api/projects (ترقيم حقيقي + فلاتر + includeDeleted).
- **[Proposed] كل ما عدا ذلك** — بما فيه كل نقاط documents/IPC/users/audit/search/dashboard/backups/import — **لا وجود لها بشكل مُثبت**، والواجهة الحالية تغطيها بـ fixture. أي ادعاء تنفيذ لهذه القائمة يجب أن يُثبت بمراجعة مصدر مصرح بها.
- **[Unknown عالٍ]:** قد توجد نقاط إضافية خلف ملفات `apps/api/src/**` المحمية (مثال: BOQ/IPC/إدارة) — التثبيت يحتاج مراجعة مصرح بها قبل التنفيذ.
