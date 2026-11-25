# Phase 14B — الوثيقة 02: نموذج البيانات الهدف (Target Data Model)

> **الأساس:** الكيانات المُدققة في `packages/shared/src/types.ts` + قرارات المالك O1–O13.
> **قاعدة حاكمة:** لا إعادة تصميم مخطط قاعدة البيانات الحالي كأنه الهدف؛ **لا إتلاف ولا إعادة تسمية** دون استراتيجية توافق موثقة؛ **لا جداول ضريبة/استقطاع/مقدمات** (O6)؛ **لا بيانات تاريخية مُصطنعة**.
> **مفتاح التصنيف:** [Confirmed] مُدقق في مصدر آمن · [Inferred] استنتاج من مصدر آمن · [NEW] متطلب جديد (من قرارات المالك) · [Proposed] تفصيلة تنفيذ يقترحها 14B · [Unknown] يتطلب مراجعة مصدر محمية/لاحقة.

---

## 1. المبادئ العامة

1. **التوافق التصاعدي فقط (additive):** كل التغييرات إضافية (أعمدة/جداول/قيم enum جديدة) — لا rename ولا drop ولا تعديل معنى حقل موجود. الاستراتيجية الموحدة:
   - أعمدة جديدة nullable أو بقيم افتراضية null → لا كسر للقراءات الحالية.
   - قيم enum جديدة (مثل `under-review` لـ IpcStatus) → الكود القديم الذي يفحص قيمًا معروفة لا يُكسر؛ يجب تحديث كل switch/حالات الواجهة [Proposed — نقطة ترحيل].
2. **PK:** `id` نص/UUID لكل الكيانات [Confirmed بنية BaseEntity].
3. **الطوابع الزمنية:** `createdAt/updatedAt` (ISO 8601) لكل كيان، `createdBy?` [Confirmed BaseEntity].
4. **العملة والكميات:** `NUMERIC(18,2)` للمبالغ المالية، `NUMERIC(14,4)` للكميات [Proposed — الدقة تخمن تنفيذًا؛ النوع TS يسمح number] — بديل double لتجنب أخطاء التقريب المالية.
5. **الحذف المنطقي:** حقلان `deleted_at/deleted_by` للمشروع فقط (O12)؛ بقية الكيانات لا تُحذف فيزيائيًا (المستندات: حالة `archived`؛ المستخدمون: `isActive=false`) [Proposed كقاعدة].
6. **التدقيق:** كل جدول أعمال مرتبط بـ audit_logs عبر (entity, entityId) — لا FK صريح (السجل تاريخي مستقل) [Proposed].

---

## 2. الكيانات: users (موسّع — O1)

| الحقل | النوع | القيود | التصنيف |
|---|---|---|---|
| id | UUID PK | | [Confirmed] BaseEntity |
| username | varchar(50) | **UNIQUE**, NOT NULL | [Confirmed] بيانات الدخول — التفرّد [Inferred: مطلوب منطقيًا للدخول] |
| fullName | varchar(120) | NOT NULL | [Confirmed] |
| passwordHash | varchar | NOT NULL | [Confirmed] — **لا يُعرض أبدًا** (SafeUser يستبقنه) [Confirmed Omit] |
| roleName | varchar | NOT NULL, FK→roles.name | [Confirmed] أدوار النظام الخمسة + مخصص [Confirmed UserRoleName] |
| isActive | boolean | NOT NULL DEFAULT true | [Confirmed] |
| **department** | varchar(100) | NULL (اختياري) | **[NEW — O1]** |
| **title** | varchar(100) | NULL (اختياري) | **[NEW — O1]** |
| **email** | — | — | **حقل هوية قائم** (قرار المالك — تصحيح O1؛ **ليس جديدًا**). القيود الفعلية (النوع/الإلزامية/التفرّد/الفهارس) **[Unknown]** — غير قابلة للتحقق من مصدر آمن. التصميم **لا يضيف عمودًا ولا قيدًا** عليه ولا حقلًا مكررًا. السؤال المفتوح: هل تصبح وسيلة دخول؟ → §1.1 من 01 + 07 §4.2 |

**فهارس:** unique(username) [Proposed]؛ فهارس/قيود email **القائمة** (إن وجدت) [Unknown — تُثبت من المصدر المصوَّر]، لا فهارس جديدة مقترحة عليه.
**SafeUser [Confirmed]:** User بلا passwordHash + `permissions: string[]` (محلولة خلفيًا) — عقد التعرض للواجهة.
**ملاحظة توافق:** mock Phase 13 يعرض name/email/dept/title (نموذجية) — النموذج الهدف يعتمد fullName + الجديد في O1 (department/title)؛ email حقل هوية قائم وفق قرار المالك. لا إتلاف بيانات وهمية (هي بيانات تجريبية في الواجهة فقط).

---

## 3. الكيانات: roles [Confirmed]

`Role {id, name(UNIQUE), nameAr, permissions: string[], isSystem?}` [Confirmed types.ts].
- أدوار النظام الخمسة ثابتة [Confirmed] — ROLE_BASE يُحفظ **حرفيًا** (O13)؛ مصدره `permissions.ts:ROLE_PERMISSIONS` [Confirmed] بتنفيذ DB [Unknown — الجدول الفعلي يتطلب مراجعة مصدر].
- أي أدوار مخصصة: نفس البنية [Confirmed النوع] — إنشاؤها يحتاج `roles.manage` (prototype-only) [Confirmed غيابه من ROLE_BASE].

---

## 4. الكيانات: projects (موسّع — O12)

| الحقل | النوع | القيود | التصنيف |
|---|---|---|---|
| id | UUID PK | | [Confirmed] |
| projectCode | varchar(50) | UNIQUE, NOT NULL | [Confirmed] — التفرّد في DB [Unknown يُثبت عند المراجعة] |
| projectName | varchar(200) | NOT NULL | [Confirmed] |
| client / owner / mainContractor | varchar(200) | NOT NULL | [Confirmed] owner منفصل عن client [Confirmed تعليق] |
| siteLocation | varchar(200) | NOT NULL | [Confirmed] |
| region | varchar(100) | NULL | [Confirmed] |
| contractNumber | varchar(100) | NOT NULL | [Confirmed] |
| contractValue | NUMERIC(18,2) | NULL | [Confirmed نوع TS + O2] NULL = غير مدخل (لا 0) |
| startDate / endDate | date | NULL | [Confirmed] |
| status | varchar | NOT NULL, CHECK ∈ {planned,active,on-hold,completed,cancelled} | [Confirmed] |
| role | varchar | NULL, ∈ {main-contractor,subcontractor,direct-contractor} | [Confirmed] |
| notes | text | NULL | [Confirmed] |
| **deleted_at** | timestamptz | NULL | **[NEW — O12]** غير null = محذوف منطقيًا |
| **deleted_by** | UUID FK→users.id | NULL | **[NEW — O12]** |

**فهارس:** unique(projectCode); idx(status) حيث deleted_at IS NULL (فهرس جزئي) [Proposed]; idx(deleted_at) [Proposed].

---

## 5. الكيانات: sites, folders (مستقلة عن التغيير)

- **sites:** `id, projectId FK NOT NULL, code, name, location?, notes?` [Confirmed] — FK→projects (ON DELETE لا يُطبق إلغاء تتابع: المشروع يُحذف منطقيًا فلا سلسلة حذف) [Proposed].
- **folders:** `id, parentId? self-FK, name, color?, createdBy?` [Confirmed] — شجرة؛ حذف مجلد غير فارغ ممنوع تطبيقيًا [Proposed من 01 §4.6].

---

## 6. الكيانات: documents + المراجعات + الروابط

### 6.1 documents
| الحقل | التصنيف | ملاحظات |
|---|---|---|
| id, createdAt, updatedAt, createdBy? | [Confirmed] | |
| projectId?, siteId?, ipcId?, folderId? | [Confirmed] | اختيارية — FK منطقية (لا cascade) |
| title, category, documentType | [Confirmed] | category/documentType من CategoryOption |
| documentNumber? | [Confirmed] | **مفتاح كشف التكرار CSV (O11)** — تطبيق الخلفية [Unknown] |
| fileName, fileExtension, fileSize, filePath, revision | [Confirmed] | filePath يشير لمخزن ملفات [Unknown البنية] |
| documentDate?, uploadedBy?, notes? | [Confirmed] | |
| status ∈ 7 حالات | [Confirmed] | draft/submitted/under-review/approved/rejected/superseded/archived |
| revisions[], links?, tags[] | [Confirmed بنية TS] | تُخزن جداول فرعية (6.2/6.3) [Proposed — التطبيع؛ التخزين الفعلي [Unknown]] |

**فهارس:** (projectId), (status), (category), unique(documentNumber, projectId)? — **لا**: documentNumber اختياري وقد يتكرر عبر مشاريع [Inferred من اختياريته]؛ الفهرس (documentNumber) عادي للبحث [Proposed].

### 6.2 document_revisions [Confirmed بنية]
`id, documentId FK, revision, fileName, fileExtension, fileSize, filePath, uploadedBy?, uploadedAt, notes?` — سلسلة مراجعات محفوظة (لا استبدال) [Proposed قاعدة].

### 6.3 document_links [Confirmed بنية]
`id, documentId FK, entityType, entityId, createdAt` — polymorphic اختياري.

---

## 7. الكيانات: boq_items, ipc, ipc_items (+ NEW ipc_status_events — O4)

### 7.1 boq_items [Confirmed]
`id, projectId FK NOT NULL, itemCode, description, unit, quantity NUMERIC(14,4), unitPrice NUMERIC(18,2), totalPrice NUMERIC(18,2)` — totalPrice محسوب وقت الكتابة (quantity×unitPrice) [Inferred] مع تحقق خلفي [Proposed].

### 7.2 ipc [Confirmed + توسعة واحدة]
| الحقل | التصنيف |
|---|---|
| id, createdAt, updatedAt, createdBy? | [Confirmed] |
| projectId FK NOT NULL | [Confirmed] |
| ipcNumber int NOT NULL | [Confirmed] — التفرّد (projectId, ipcNumber) [Inferred — يُثبت عند المراجعة] |
| date | [Confirmed] |
| **status** | [Confirmed 4 حالات: draft/submitted/approved/rejected] + **قيمة جديدة `under-review` [Proposed — O4 مرحلة Review]** — إضافة قيمة enum، توافق: البيانات الحالية غير متأثرة |
| notes? | [Confirmed] |
| netAmount?, deductions?, grossAmount? | [Confirmed NUMERIC(18,2) NULL] — المساران (بنود/مباشر) [Confirmed تعليق types] |

### 7.3 ipc_items [Confirmed]
`id, ipcId FK NOT NULL, boqItemId FK NOT NULL, previousQuantity, currentQuantity, totalQuantity` — totalQuantity = previous + current [Confirmed تعليق/بنية].

### 7.4 **ipc_status_events [NEW — O4 قابلية تدقيق القرارات]**
| العمود | النوع | ملاحظات |
|---|---|---|
| id | UUID PK | |
| ipc_id | FK NOT NULL → ipc.id | |
| from_status | varchar NULL (للإنشاء) | |
| to_status | varchar NOT NULL | |
| actor_user_id | FK → users.id NOT NULL | من نفّذ الانتقال |
| actor_username | varchar NOT NULL | لقطة تاريخية (يبقى معنى السجل لو تغير الاسم) |
| decision | varchar NULL | 'approve'/'reject'/NULL |
| notes | text NULL | سبب الرفض إلزامي عند reject [Proposed 01 §5.3] |
| created_at | timestamptz NOT NULL | |

**append-only:** لا UPDATE/DELETE [Proposed]. فصل المهام مفروَض بقراءة آخر أحداث (المعتمد ≠ المُقدِّم) [Proposed].
**فهرس:** (ipc_id, created_at).
**لا جداول ضريبة/استقطاع/مقدمات (O6):** الحقول الثلاثة للـ IPC الحالية تكفي العرض؛ أي نموذج تخفيضات مؤجل حتى قرار مالك. deductions يدوي مباشر فقط [Confirmed حقل].

---

## 8. الكيانات: audit_logs (موسّع — O8)

| العمود | التصنيف |
|---|---|
| id | [Confirmed] |
| userId?, username? | [Confirmed] — لقطات |
| action | [Confirmed] (اصطلاح `entity.verb` [Proposed]) |
| entity, entityId? | [Confirmed] |
| oldValue?, newValue? | [Confirmed] JSONB — حقول حساسة مُخفاة [Proposed 01 §7.3] |
| timestamp | [Confirmed] timestamptz |
| ipAddress? | [Confirmed] |
| **projectId?** | **[NEW — O8]** FK منطقي → projects.id NULL |

**فهارس:** (timestamp DESC), (entity, entityId), (projectId) جزئي حيث projectId IS NOT NULL [Proposed], (userId).
**append-only** [Proposed]. سجلات تاريخية بلا projectId تبقى سليمة ومعروضة [O8].

---

## 9. الكيانات الجديدة (O10/O11)

### 9.1 password_reset_tokens [NEW — O10]
| العمود | النوع | القواعد |
|---|---|---|
| id | UUID PK | |
| user_id | FK NOT NULL → users.id | |
| token_hash | varchar NOT NULL | **hash فقط** (SHA-256) — لا تخزين الرمز الصريح [Proposed 06 §3] |
| expires_at | timestamptz NOT NULL | عمر قصير (60 دقيقة [Proposed]) |
| used_at | timestamptz NULL | أحادي الاستخدام |
| created_at, requested_ip? | | |

فهرس (user_id), (token_hash UNIQUE). استلام طلب جديد يُبطل الرموز السابقة للمستخدم [Proposed].

### 9.2 backups [NEW — O10]
`id, file_name UNIQUE, file_path, size_bytes, checksum_sha256, status ∈ {created, verified, failed}, created_by FK, created_at, verified_at?` — التصميم الكامل في 06 §5–6.
**لا تخزين النسخ داخل DB** — الجدول فهرس ميتاداتا فقط [Proposed].

### 9.3 restore_jobs [NEW — O10]
`id, backup_id FK, mode ∈ {dry_run, commit}, status ∈ {pending, validating, validated, running, completed, failed, cancelled}, requested_by FK, requested_at, validation_report? JSONB, completed_at?, notes?` — استرجاع من خطوتين: dry-run إلزامي ثم commit بعد تأكيد صريح [Proposed 06 §6].

### 9.4 import_batches [NEW — O11] (يوثّق ImportHistoryEntry [Confirmed بنية TS])
`id, entity, file_name, user_id?, username?, date, total_rows int, successful_rows int, failed_rows int, errors JSONB (سقف عرض), duplicate_rule varchar DEFAULT 'document_number' (لقطة قاعدة الأيام) [Proposed], status ∈ {completed, failed, cancelled}` — سجل تاريخي؛ لا مفاتيح صلبة لصفوف المستوردة.

---

## 10. الإشعارات والتصنيفات (تبعيات دعم)

- **AppNotification [Confirmed]:** `id, type∈{low-stock,document-status,system,material-request}, title, message, link?, entityId?, userId?, readBy[], createdAt` — **ليست موديولًا مستقلًا** في هذا النطاق؛ تخدم Dashboard/Archive.
- **CategoryOption / UnitOption [Confirmed]:** قوائم مرجعية (group: document-category/document-type/…) — تغذي تحقق المستندات.

---

## 11. خريطة العلاقات (ER مختصر)

```
users 1─* projects.createdBy / deleted_by
users 1─* audit_logs.userId?            (لقطات username)
users 1─* password_reset_tokens
roles 1─* users.roleName

projects 1─* sites
projects 1─* boq_items
projects 1─* ipc ──* ipc_items ──* boq_items
projects 1─* documents (اختياري FK)
projects 1─? audit_logs.projectId (اختياري O8)

documents 1─* document_revisions
documents 1─* document_links (polymorphic)
ipc 1─* ipc_status_events (O4)
folders self-tree

backups 1─* restore_jobs
import_batches (سجل مستقل)
```

**قواعد سلامة رئيسية [Proposed]:**
- INT-1: حذف المشروع منطقي — لا cascade فيزيائي لأي تابع (أرشيف/مالية/تدقيق تبقى) [O12].
- INT-2:ipc_number فريد داخل المشروع؛ documentNumber غير مفروض فريد [Inferred].
- INT-3: كل انتقال IPC/مستند بلا سجل تدقيق = فشل عملية (الحدث جزء من المعاملة) [Proposed].
- INT-4: password_reset_tokens/backups/restore_jobs لا تعرض عبر أي endpoint عام — admin فقط.
- INT-5: قيم مالية NULL ≠ 0 — العرض عبر unavailable [O2/O5/O6].

## 12. استراتيجية التوافق (ملخص)

| التغيير | الأثر على الموجود | الإجراء |
|---|---|---|
| أعمدة users الجديدة (department/title — O1) | لا — nullable/إضافة | migration إضافية واحدة (عمودان نصيان اختياريان)؛ **email خارج نطاق التغيير** — حقل قائم، **لا migration ولا backfill يُقترحان له** (لا دليل تحقق) |
| projects.deleted_at/by | لا | أعمدة nullable |
| IpcStatus + under-review | switch الواجهة/الخلفية يُحدَّث | قيمة جديدة — البيانات القديمة سليمة |
| audit_logs.projectId | لا | عمود nullable — سجلات تاريخية تظل صحيحة [O8] |
| جداول جديدة (ipc_status_events, tokens, backups, restore_jobs, import_batches) | لا | إنشاء جديد |
| **لا renames / no drops / no معنى-تغيير** | — | قاعدة ثابتة حتى قرار مالك صريح |

**[Unknown عام]:** المخطط الفعلي الحالي في PostgreSQL 17/18 غير قابل للفحص (ملفات محمية/لا صلاحيات DB) — هذا النموذج **منطقي هدف** موثق فوق الأنواع المدققة، ويتطابق التحقق النهائي عند مراجعة مصدر مصرح بها.
