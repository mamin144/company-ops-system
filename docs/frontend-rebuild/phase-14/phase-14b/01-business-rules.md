# Phase 14B — الوثيقة 01: قواعد الأعمال (Business Rules)

> **المشروع:** Company Operations System (COS) — Frontend Rebuild
> **النطاق:** الموديولات الستة فقط: Home/Dashboard، Projects، Archive، Finance، Administration، Audit
> **المرجع الأعلى:** قرارات المالك O1–O13 المعتمدة (`phase-14a-owner-decisions.md`) — نهائية ولا تُعاد مناقشتها هنا.
> **الطبيعة:** تصميم فقط — لا تنفيذ.
> **التاريخ:** Tue Nov 17 2026

---

## 0. مصادر الأدلة ومفتاح التصنيف

### 0.1 مصادر الأدلة المستخدمة (كلها آمنة — خارج `apps/api/src/**` المحمية)

| المصدر | ما تم أخذه منه |
|---|---|
| `packages/shared/src/types.ts` (L1–299) | نموذج الكيانات المُدقق: BaseEntity، Project، Site، DocumentStatus (7 حالات)، DocumentRevision، DocumentLink، Folder، Document، User/SafeUser، AuditLog، AppNotification، ImportHistoryEntry، PagedResult، ListQuery، BoqItem، IpcStatus (4 حالات)، Ipc، IpcItem |
| `packages/shared/src/permissions.ts` (L1–63) | ALL_PERMISSIONS (27 مفتاحًا) + ROLE_PERMISSIONS لكل دور + `permissionOf()` fallback إلى viewer |
| `docs/frontend-rebuild/phase-13/.../mock/data.ts` (L290–328) | AccessLevel/OverrideEffect، ROLE_BASE (مطابق حرفيًا لـ ROLE_PERMISSIONS)، MANAGED_GROUPS (8 مجموعات)، mockUsers (dept/title/email نموذجية فقط) |
| `docs/frontend-rebuild/phase-13/.../http/session.ts` (L1–92) | عقود auth المُدققة: login/refresh/me/logout + permissions من المحلل الخلفي |
| `docs/frontend-rebuild/phase-13/.../http/api.ts` | السطح wired: جلسة + 3 نقاط مشاريع فقط؛ الباقي Proxy "not wired" |
| Phase 13 screens (Home, Projects, Archive L1–827, ProjectWorkspace, Financials, Admin, Audit, Reports, Search, Notifications, Settings) | سلوك الواجهة الحالي، معالج الاستيراد (≤200 صف)، كشف التكرار على `number` |
| `phase-14a-requirements-map.md` + `phase-14a-owner-decisions.md` | الفجوات G1–G14، القرارات المعتمدة |

**قيود التحقق معلنة:** جميع ملفات `apps/api/src/**` (18 ملفًا بوسوم تعارض دمج محمية) لم تُفتح ولم تُلمس؛ أي تفصيلة خلفية (schema فعلي، endpoints إضافية، تنفيذ كشف التكرار) **لا يمكن التحقق منها** في هذه المرحلة.

### 0.2 مفتاح التصنيف (يُطبَّق على كل قاعدة)

| الوسم | المعنى |
|---|---|
| **[Confirmed]** | موجود ومُدقق في مصدر آمن مقروء |
| **[Inferred]** | استنتاج معقول من مصدر آمن — ليس حقيقة تنفيذية |
| **[Proposed]** | تصميم جديد يقترحه 14B — يحتاج اعتماد المالك في 14C قبل التنفيذ |
| **[Unknown]** | لا يمكن التحقق دون مصدر محمي/لاحق — يتطلب مراجعة مصدر مصرح بها |

---

## 1. الاصطلاحات العامة (تسري على الموديولات الستة)

### 1.1 الهوية والمصادقة [Confirmed]
- تسجيل الدخول بـ `username` + `password` (عقد auth مُدقق: `POST /api/auth/login {username,password,rememberMe?}`).
- `permissions` تُحل **خلفيًا دائمًا** (role + overrides) — لا ادعاءات من العميل [Confirmed].
- **O1 (المصحح — قرار المالك):** الإيميل **حقل هوية قائم** للمستخدم — **لا يُصنَّف حقلًا جديدًا**، ولا يُقترح إضافة حقل هوية مكرر. الجديد في O1 هو `department` و`title` فقط. قيود الحقل الفعلية في DB (النوع/الإلزامية/التفرّد) **غير قابلة للتحقق من مصدر آمن** (أنواع TS المُدققة لا تعرضه، والملفات الخلفية محمية) → [Unknown]. `username` يبقى **بيانات اعتماد الدخول** [Confirmed]. *السؤال المفتوح:* هل يصبح الإيميل وسيلة دخول بديلة؟ → غير محسوم، مسجل في `07-risks-and-open-questions.md` §4.2 — **لا يُفترض ولا يُفعل** في هذا التصميم [Unknown].

### 1.2 حالة «غير متاح» الموحدة (O5/O6/O2) [Proposed — صياغة موحدة]
أي قيمة مالية مؤجلة أو غير مدخلة تُعرض عبر بنية صريحة — **لا أصفار ولا قيم مُصطنعة أبدًا**:

```ts
interface UnavailableField {
  value: null;
  unavailable: true;
  reason: UnavailableReason; // see below
}
type UnavailableReason =
  | 'NOT_ENTERED'            // O2: contractValue لم يُدخل
  | 'PAYMENTS_DEFERRED'      // O5
  | 'TAX_RULES_UNDEFINED'    // O6
  | 'RETENTION_RULES_UNDEFINED' // O6
  | 'ADVANCE_RULES_UNDEFINED';  // O6
```

- الواجهة تعرض "غير متاح" مع سبب قابل للعرض؛ لا حسابات مشتقة من قيم `unavailable`.
- أي تجميع يلتقي قيمة unavailable يتعامل معها كغياب (لا يُحتسب 0).

### 1.3 المغلف الموحد للـ API [Proposed — مبني على أنواع مُدققة]
- القوائم: `PagedResult<T> {items,total,page,pageSize}` [Confirmed — النوع موجود في types.ts].
- الخطأ: `{ error: { code, message, details?: string[] } }` [Proposed — توحيد].
- الحالات الموحدة: `loading / empty / error / forbidden / unavailable` — موثقة بالكامل في `04-frontend-integration-map.md`.

---

## 2. الموديول 1: Home / Dashboard

### 2.1 الغرض والنطاق [Confirmed + O7]
- غرض: نظرة عامة **تشغيلية فقط** على حالة النظام للمستخدم الحالي.
- **O7 (APPROVED):** ممنوع عرض أي KPI مالي غير مدعوم؛ ممنوع أرقام صرف/ضريبة/استقطاع مُصطنعة.
- ما **يجوز** عرضه (تشغيلي): أعداد المشاريع بحسب الحالة، أعداد المستندات بحسب الحالة، آخر الأنشطة، إشعارات.

### 2.2 مصادر البيانات الدقيقة لكل قسم [Proposed]

| قسم اللوحة | المصدر | شرط العرض | ملاحظات |
|---|---|---|---|
| بطاقات المشاريع بحسب الحالة (planned/active/on-hold/completed/cancelled) | `GET /api/dashboard/summary` → `projectsByStatus` | `projects.view` [Confirmed] | المحلل الخلفي يحتسب **فقط** المشاريع المرئية للمستخدم (نطاق projectAccess) — لا تسريب أعداد |
| المستندات بحسب الحالة (7 حالات) | `documentsByStatus` | `archive.view` | بلا مالي |
| آخر الأنشطة (audit) | `recentActivity` | `audit.view` | 5–10 عناصر أخيرة المرئية |
| إشعارات | `GET /api/notifications?...` (قائمة موجودة في أنواع AppNotification) | مسجّل دخول | الإشعارات ليست موديولًا مستقلًا — تبعية دعم فقط |
| **مالي (صرف/ضريبة/استقطاع)** | — | — | **محظور (O5/O6/O7)** — لا قسم مالي في اللوحة |

### 2.3 رحلة المستخدم [Inferred من Home.tsx — Phase 13]
1. المستخدم يفتح `/` → يُجلب ملخص اللوحة (استدعاء واحد).
2. الأقسام التي لا يملك المستخدم صلاحيتها **لا تُعرض** إطلاقًا (الخلفي لا يعيد حقول غير مصرح، والواجهة تخفي بناءً على `permissions`).
3. من اللوحة: تنقل مباشر إلى المشاريع/الأرشيف/التدقيق.

### 2.4 الثوابت (Invariants) [Proposed]
- INV-D1: لا قسم مالي في اللوحة إلا بناءً على قرار مالك لاحق.
- INV-D2: كل عدّاد يعكس ما يستطيع المستخدم رؤيته فعلًا (عدّاد ≠ إجمالي النظام إذا كان النطاق أضيق).
- INV-D3: فشل جلب قسم لا يفشل اللوحة كلها — القسم يعرض حالة خطأ جزئية.

### 2.5 حالات الحافة [Proposed]
- مستخدم بلا أي صلاحيات عرض: اللوحة تعرض empty state موجهة ("لا أقسام متاحة لصلاحياتك").
- مشروع محذوف منطقيًا (O12): **لا يُحتسب** في عدّادات الحالة النشطة؛ يُعرض ضمن عدّاد منفصل "مؤرشف/محذوف" **فقط** لمن لديه حق رؤية المحذوف (§6.7).

---

## 3. الموديول 2: Projects

### 3.1 الغرض والنطاق [Confirmed]
- إدارة دورة حياة المشاريع (إنشاء/تحرير/عرض/حالة/حذف منطقي) + قيمة العقد + الموقع/المواقع، وقاعدة BOQ/IPC (التابعة المالية داخل مساحة المشروع).

### 3.2 الكيانات والحقول [Confirmed — من types.ts]

**Project** (BaseEntity: id, createdAt, updatedAt, createdBy?):
| الحقل | النوع | إلزامية | قاعدة |
|---|---|---|---|
| projectCode | string | مطلوب | فريد — **[Inferred]** التفرّد متوقع من الواجهة، التحقق الخلفي للفهرس الفريد [Unknown] |
| projectName | string | مطلوب | غير فارغ بعد trim، 1–200 حرف [Proposed] |
| client | string | مطلوب | العميل — منفصل عن owner [Confirmed: تعليق types.ts] |
| owner | string | مطلوب | الجهة المالكة [Confirmed] |
| mainContractor | string | مطلوب | [Confirmed] |
| siteLocation | string | مطلوب | [Confirmed] |
| region | string | اختياري | [Confirmed] |
| contractNumber | string | مطلوب | [Confirmed] |
| contractValue | number? | اختياري | **O2 [Confirmed+APPROVED]:** إدخال مستقل؛ لا اشتقاق من BOQ؛ غيابه = غير متاح (`NOT_ENTERED`) وليس 0 |
| startDate / endDate | string? | اختياري | ISO date؛ endDate ≥ startDate عند توفر الاثنين [Proposed] |
| status | ProjectStatus | مطلوب | `planned / active / on-hold / completed / cancelled` [Confirmed] |
| role | CompanyRole? | اختياري | `main-contractor / subcontractor / direct-contractor` [Confirmed] |
| notes | string? | اختياري | [Confirmed] |

### 3.3 انتقالات حالة المشروع [Proposed — دورة حياة]
- **من يقوَم بتغيير الحالة:** حامل `projects.edit` [Confirmed: المفتاح موجود] — لا مفتاح حالة-مخصص موجود في ROLE_BASE.
- **المصفوفة المقترحة** (تحتاج اعتمادًا في 14C):

| من → إلى | مسموح؟ | شرط إضافي |
|---|---|---|
| planned → active | نعم | — |
| active → on-hold | نعم | — |
| on-hold → active | نعم | — |
| active/completed → completed | نعم | — |
| أي (عدا completed) → cancelled | نعم | تسجيل سبب في notes [Proposed] |
| completed/cancelled → planned | لا | إعادة فتح مشروع منتهٍ = عملية جديدة (قرار مالك لاحقًا إن لزم) |

- الحذف **ليس** حالة status — إنه حقل منفصل (O12، §3.5).

### 3.4 الصلاحيات [Confirmed من ROLE_PERMISSIONS + نطاق مشروع O13]
| العملية | الصلاحية | نطاق |
|---|---|---|
| عرض قائمة/تفصيل | `projects.view` | + projectAccess ≥ READ للمشروع |
| إنشاء | `projects.create` | عمومي |
| تحرير (حقول/حالة/contractValue) | `projects.edit` | + projectAccess ≥ WRITE |
| حذف (منطقي) | `projects.delete` | + projectAccess = DELETE |

### 3.5 الحذف المنطقي (O12) [Proposed — تصميم]
- قاعدة: حذف المشروع = تعليم `deletedAt/deletedBy` — **لا** إزالة بيانات، لا حذف تابعين (أرشيف/مالية/تدقيق/مواقع/BOQ/IPC تبقى).
- القوائم النشطة (`GET /api/projects`) تستبعد المحذوف افتراضيًا؛ الوصول لبيانات المحذوف: `includeDeleted=true` يتطلب حامل `projects.delete` **[Proposed — يُعرّض للاعتماد]**؛ جميع عمليات القراءة/الفلترة فوق بيانات المشروع المحذوف تحترم نفس البوابة.
- الاسترجاع: `POST /api/projects/:id/restore` بحامل `projects.delete` [Proposed].
- لا hard-delete إطلاقًا حتى تعرّف قواعد الاحتفاظ [O12 صراحة].

### 3.6 حالات الخطأ والحافة [Proposed]
- تكرار projectCode → 409 `DUPLICATE_PROJECT_CODE` (بعد تأكيد التفرّد الخلفي [Unknown]).
- حذف مشروع له مستندات/IPC مفتوحة (ليست archived/approved): **تحذير** يعرض العدد، ولا تمنع الحذف (البيانات التابعة محفوظة) [Proposed].
- تناقض حالة: تعديل مشروع محذوف → 409 `PROJECT_DELETED`.
- تعديل متزامن: `If-Match`/`updatedAt` كقفل تفاؤلي → 409 `CONFLICT` [Proposed — منع الفقد].

---

## 4. الموديول 3: Archive (المستندات)

### 4.1 الغرض والنطاق [Confirmed]
- إدارة المستندات ودورة حياتها: رفع، مراجعات، تصنيف، ربط، تغيير حالة **مُتحكَّم به (O3)**، مجلدات، استيراد CSV، روابط كيانات.

### 4.2 الكيانات والحقول [Confirmed — Document]
| الحقل | إلزامية | ملاحظات |
|---|---|---|
| title | مطلوب | 1–200 [Proposed] |
| documentNumber | اختياري | **مفتاح كشف التكرار للـ CSV (O11)** — انظر §4.8 |
| category, documentType | مطلوبان | قيم من CategoryOption (group: document-category/document-type) [Confirmed النوع] |
| fileName, fileExtension, fileSize, filePath, revision | مطلوبة | ملف فعلي؛ fileSize ≤ حد مُعرَّف خلفيًا [Unknown الحد] |
| documentDate, notes | اختيارية | |
| projectId?, siteId?, ipcId?, folderId? | اختيارية | ربط اختياري؛ لا إجبار انتماء لمشروع [Confirmed تعليق types] |
| status | مطلوب | 7 حالات [Confirmed]: `draft, submitted, under-review, approved, rejected, superseded, archived` |
| revisions[], links[], tags[] | مرفقة | |

### 4.3 مصفوفة انتقالات حالة المستند (O3 — التفاصيل التصميمية) [Proposed]

**القاعدة العامة:** كل انتقال: (1) مسموح فقط وفق الجدول، (2) بصلاحية محددة، (3) مُتحقق منه خلفيًا، (4) مسجَّل تدقيقيًا (action=`document.status_change` مع old/new).
**الصلاحيات المستخدمة هي الموجودة فقط** (لا حقن مفاتيح جديدة في ROLE_BASE — O13): `archive.edit` لانتقالات الحالة، `archive.upload` لمراجعة جديدة، `archive.delete` للحذف.

| من → إلى | مسموح؟ | الصلاحية | شرط |
|---|---|---|---|
| draft → submitted | نعم | `archive.edit` + projectAccess ≥ WRITE | ملف + تصنيف مكتملان |
| submitted → under-review | نعم | `archive.edit` | بدء مراجعة |
| submitted → rejected | نعم | `archive.edit` | سبب الرفض إلزامي في notes [Proposed] |
| submitted → approved | نعم | `archive.edit` | مسار مختصر (مستندات منخفضة الحساسية) [Proposed] |
| under-review → approved | نعم | `archive.edit` | |
| under-review → rejected | نعم | `archive.edit` | سبب إلزامي |
| under-review → draft | نعم | `archive.edit` | إعادة للتدقيق قبل التقديم |
| rejected → draft | نعم | `archive.edit` | للتحسين وإعادة التقديم |
| rejected → submitted | نعم | `archive.edit` | إعادة تقديم مباشرة |
| approved → superseded | تلقائي | النظام | عند اعتماد مراجعة أحدث (revision أحدث) — يسجَّل كحدث نظام |
| approved → archived | نعم | `archive.edit` | أرشفة نهائية |
| superseded → archived | نعم | `archive.edit` | |
| archived → أي | **لا** | — | أرشيف محتدم؛ الخروج الوحيد: رفع مراجعة جديدة تصبح `draft` (`archive.upload` + `archive.edit`) [Proposed] |

- **فصل المهام للمستندات [Proposed]:** مَن رفع آخر مراجعة (`uploadedBy`) لا يوافق على نفس المراجعة (لا ينتقل submitted→approved لنفس الشخص) — يقارَب بمبدأ O4 (فصل المهام) تطبيقًا على المستندات؛ يُعرَض للاعتماد.
- الانتقال غير المسموح → 409 `INVALID_TRANSITION` مع من→إلى في details.

### 4.4 المراجعات والملفات [Confirmed + Proposed]
- كل مراجعة: `revision` (نص قابل للفرز), fileName/extension/size/path, uploadedBy/At, notes [Confirmed].
- رفع مراجعة جديدة = `archive.upload` + projectAccess ≥ WRITE؛ لا يستبدل السابقة (سلسلة مراجعات محفوظة) [Confirmed بالبنية].
- التنزيل: `archive.download` + projectAccess ≥ READ.

### 4.5 الربط (links) والوسوم [Confirmed]
- `DocumentLink {documentId, entityType, entityId}` — ربط اختياري بأي كيان؛ يُستخدم للبحث والسياق.
- tags: مصفوفة نصية حرة [Confirmed]؛ اقتراح قائمة مقترحة من الإعدادات لاحقًا [Proposed — خارج النطاق الآن].

### 4.6 المجلدات [Confirmed]
- شجرة مجلدات (parentId اختياري)؛ حذف مجلد غير فارغ: منع أو نقل تلقائي؟ → منع بـ 409 `FOLDER_NOT_EMPTY` [Proposed — سلوك الواجهة الحالي يحتاج تحقق مصدر: Inferred].

### 4.7 الصلاحيات [Confirmed من ROLE_PERMISSIONS]
`archive.view / upload / edit / delete / download` + نطاق projectAccess لكل مستند مرتبط بمشروع. مستند بلا مشروع = رؤية عامة وفق الصلاحية على مستوى النظام (لا projectAccess) [Proposed].

### 4.8 الاستيراد CSV (O11) [Confirmed جزئيًا + Unknown]
- **الحد الأقصى 200 صف لكل استيراد** — معتمد [O11].
- **كشف التكرار:** المفتاح = حقل `number` (رقم المستند) — **[Confirmed من الواجهة: Archive.tsx المعالج يفحص `number` مقابل المستندات الموجودة]**.
- **[Unknown]:** ما إذا كان الخلفية يطبق نفس المفتاح — الملفات المحمية لا تُفتح؛ **مطلوب مراجعة مصدر مصرح بها** قبل تثبيت العقد (معلَم في 03/07).
- التكرار → يعرض قائمة التكرارات قبل الاعتماد؛ لا استبدال صامت [O11].
- نتيجة الاستيراد تسجل: totalRows/successfulRows/failedRows/errors[] [Confirmed: ImportHistoryEntry] وترتبط بـ import_batches (02 §8).

### 4.9 حالات الحافة [Proposed]
- مستند مرتبط بمشروع محذوف (O12): يظهر فقط في سياق "بيانات المحذوف" (بوابة §3.5) — لا يُفقد.
- رفع ملف بنوع غير مسموح → 415 `UNSUPPORTED_TYPE` (قائمة الأنواع: [Unknown — مصدر لاحق]).
- إعادة رفع نفس الملف على نفس المراجعة → تحذير تكرار hash؟ [Unknown — يُقترح لاحقًا، ليس الآن].

---

## 5. الموديول 4: Finance

### 5.1 الغرض والنطاق [Confirmed + O2/O5/O6]
- عرض المعلومات المالية **المُتحقق منها فقط**: قيمة العقد (O2)، المستخلصات IPC بدورة موافقات رسمية (O4)، ومؤشرات مشتقة من BOQ/IPC فقط.
- **محظور (لا استثناءات):** أرقام صرف/دفعات (O5)، حسابات ضريبة/استقطاع/مقدمات (O6)، أي إجمالي مُصطنَع.

### 5.2 مصادر القيم المالية [Confirmed]
| المؤشر | المصدر الوحيد | ملاحظة |
|---|---|---|
| contractValue | إدخال مباشر (Project.contractValue) | O2 — لا BOQ، لا اشتقاق |
| BOQ الإجمالي | مجموع `BoqItem.totalPrice` للمشروع | [Confirmed بنية الحقول] |
| IPC المُنفَّذ المعتمد | مجموع Ipc.approved (netAmount أو grossAmount المعتمد) | "المنفّذ" يتبع **الدورة المعتمدة** — لا حالة يدوية [O4] |
| remainingDisbursement | — | **دائمًا "غير متاح"** `PAYMENTS_DEFERRED` [O5] |
| ضريبة/استقطاع/مقدمات | — | **دائمًا "غير متاح"** بأسباب O6 |

- الوضعان المقبولان لـ IPC [Confirmed]: (أ) بنود: IpcItem (previous+current=totalQuantity) يُشتق منه المبلغ، (ب) مباشر: grossAmount يدخل يدويًا (تعليق types.ts يثبت المسارين).

### 5.3 دورة موافقات IPC (O4) [Proposed — التصميم التفصيلي]

**الحالات:** الحالية `draft, submitted, approved, rejected` [Confirmed] + إضافة حالة `under-review` [Proposed — مراجعة وسيطة كالمستندات] لتغطية مرحلة Review في O4.

**المصفوفة والصلاحيات:**

| من → إلى | الفعل | الصلاحية | قاعدة فصل المهام |
|---|---|---|---|
| draft → submitted | تقديم | `projects.edit` + projectAccess ≥ WRITE | المسجِّل = submitter |
| submitted → under-review | بدء مراجعة | `projects.edit` | لا يقيد البادئ هنا، لكنه لا يستطيع الاعتماد |
| under-review → approved | اعتماد | `ipcs.approve` **[Proposed — مفتاح جديد خارج ROLE_BASE؛ يُعرض للاعتماد مع جدول أدوار في 05 §6]** | **المعتمد ≠ المُقدِّم** (قاعدة صارمة)؛ المعتمد ≠ محرر آخر تعديل للمحتوى [Proposed] |
| under-review → rejected | رفض | `ipcs.approve` (نفس صلاحية قرار المراجعة) | نفس القيود + سبب الرفض إلزامي |
| rejected → draft | إعادة للتحرير | `projects.edit` | ثم إعادة التقديم عبر submitted (قاعدة إعادة التقديم: مراجعة مرفوضة تعود draft وتُقدم من جديد — لا قفزة rejected→approved) |
| rejected → submitted | إعادة تقديم سريعة | `ipcs.resubmit` **[Proposed]** | المُعيد = نفس المُقدِّم الأصلي أو حامل projects.edit بنفس المشروع |
| draft: تحرير المحتوى | — | `projects.edit` + WRITE | مقفل بعد submitted (التعديل يعيد للحالة draft) |

- **قابلية تدقيق القرارات [O4]:** كل انتقال IPC يسجل في `ipc_status_events` (02 §7): from/to/actor/decision/notes/timestamp + سجل تدقيق نظامي موازٍ (audit_logs).
- **إجابات صريحة على أسئلة O4:**
  - من يوافق؟ حامل `ipcs.approve` (العرض: admin + management) — جدول العرض الكامل في 05 §6، يُعتمد في 14C.
  - هل يوافق الشخص على مستخلصه؟ **لا، ممنوع قاطعًا** (المعتمد ≠ المُقدِّم؛ خلفيًا 403 `SELF_APPROVAL_DENIED`).
  - هل توجد مراجعة وسيطة؟ نعم — `under-review` (وإلا تبقى submitted→approved قفزة واحدة، وهي مسموحة للمستندات لا للمستخلصات).
- **[Confirmed قيد]:** حاليًا لا توجد صلاحيات IPC مخصصة في ALL_PERMISSIONS — إضافتها تغيير على نموذج الصلاحيات يجب أن يمر عبر اعتماد مالك منفصل (O13 حماية). يبقى التصميم صالحًا تشغيليًا بديلًا مؤقتًا؟ لا — **بدون `ipcs.approve` تعجز فصل المهام عن حامل projects.edit الوحيد (admin)**؛ لذا حالة التصميم: مفتاح مقترح إلزامي لهذا العملاء، مع تسجيل البديل المؤقت (كل من projects.edit+WRITE يقوم بكل الأدوار) كوضع تجريبي مُعلَم [Proposed].

### 5.4 قواعد المبالغ [Confirmed + Proposed]
- netAmount/deductions/grossAmount اختيارية [Confirmed] — لا تُحتسب أصفار.
- عند بنود: المبلغ المشترك = Σ(currentQuantity × boq.unitPrice) للبنود [Proposed كحساب واجهة؛ يُتحقق منه خلفيًا عند الحفظ].
- تقارن دائمًا totalQuantity ≤ boq.quantity? [Inferred من الواجهة] — تحقق خلفي: تجاوز كمية BOQ يحتاج سببًا مُسجلًا [Proposed — لا منع صارم حتى قرار].

### 5.5 حالات الخطأ [Proposed]
`SELF_APPROVAL_DENIED` (403)، `IPC_LOCKED` (409 — تعديل في غير draft)، `DUPLICATE_IPC_NUMBER` (409 — تفرّد ipcNumber لكل مشروع [Inferred])، `CONFLICT` (تزامن).

---

## 6. الموديول 5: Administration

### 6.1 الغرض والنطاق [Confirmed]
- إدارة المستخدمين والأدوار الصلبة والتجاوزات والوصول للمشاريع وإعادة تعيين كلمة المرور وإدارة النسخ الاحتياطي.

### 6.2 دورة حياة المستخدم [Confirmed بنية + Proposed قواعد]
- الحقول [Confirmed User — من types.ts]: username, fullName, passwordHash, roleName, isActive. **الجديد في O1: department, title فقط**؛ `email` حقل هوية **قائم** (قرار المالك المصحح — قيوده الفعلية [Unknown] — انظر §1.1).
- إنشاء: `users.manage`؛ اسم مستخدم فريد [Inferred]؛ كلمة مرور أولية آلية أو مؤقتة تُغيَّر عند أول دخول [Proposed — مع O10].
- تعطيل/تفعيل: isActive فقط — **لا حذف فيزيائي للمستخدمين** (حفظ سجل التدقيق والأثر) [Proposed].
- **O1:** `department` و`title` اختياريان عند الإنشاء، نصان بحد 100 حرف [Proposed]؛ `email` حقل هوية **قائم** — التصميم **لا يفرض** عليه إلزامية أو تفرّدًا أو backfill جديدة (قيوده الفعلية [Unknown] — انظر §1.1)؛ **لا حقل إيميل مكرر**.
- تعديل دور مستخدم: `users.manage`؛ تغيير دور منفذ النظام لنفسه يحتاج مستخدم إدارة ثاني [Proposed — حماية قفل النظام].

### 6.3 التجاوزات (overrides) [Confirmed O13]
- `INHERIT/GRANT/DENY` لكل مفتاح صلاحية؛ **DENY يتقدم دائمًا**؛ يُحدَّث عبر `users.manage` فقط [Confirmed: التعديل عبر واجهة الإدارة].
- الوصول للمشاريع `NONE/READ/WRITE/DELETE` لكل مستخدم/مشروع [Confirmed O13].

### 6.4 الأدوار [Confirmed]
- أدوار النظام الخمسة: admin/management/warehouse/technical/viewer [Confirmed UserRoleName] + أدوار مخصصة ممكنة (Role type) [Confirmed النوع] — إنشاء أدوار مخصصة يحتاج `roles.manage` **prototype-only** [Confirmed: غير موجود في ROLE_BASE؛ موجود في MANAGED_GROUPS mock فقط] → مفتاح يتطلب قرار خلفي لاحق.
- تعديل ROLE_BASE نفسه: **ممنوع في هذا التصميم** (O13: اعتماد حرفي).

### 6.5 إعادة تعيين كلمة المرور (O10 — تصميم) [Proposed]
مساران:
1. **إداري:** حامل `users.resetPassword` (prototype-only حاليًا) يطلق إعادة تعيين لمستخدم → يولَّد رمز أحادي الاستخدام (06 §3) → المستخدم يُكمل عبر صفحة إكمال. الإداري **لا يرى ولا يضبط** كلمة المرور الجديدة أبدًا.
2. **ذاتي:** `POST /api/auth/password-reset/request` (برمز عبر الإيميل أو قناة إدارة) → `POST /api/auth/password-reset/confirm` برمز + كلمة جديدة. **[Unknown]:** قناة إرسال الرمز (SMTP/إشعار داخلي) — يُحدَّد لاحقًا؛ التصميم لا يفترض بنية إرسال موجودة.

### 6.6 حدود إدارة النسخ الاحتياطي (O10) [Proposed]
- الصلاحية: `backup.manage` [Confirmed المفتاح]؛ عمليات: قائمة/إنشاء/تحقق/استرجاع من خطوتين (06 §6) — **تنفيذها غير مصرح به في 14B** (تصميم فقط).
- ممنوع على المشغّل: تشغيل نسخ/استرجاع، تعديل إعدادات الإنتاج.

### 6.7 حالات الحافة [Proposed]
- تعطيل آخر admin نشط → منع 409 `LAST_ADMIN`.
- منح self-GRANT عبر تجاوز لصلاحية لم يملكها؟ مسموح تقنيًا لـ users.manage لكن يُسجَّل تدقيقيًا بنبه عالٍ [Proposed — قرار سياسة لاحق].
- وصول بيانات مشروع محذوف: أقسام الإدارة تعرض مستخدمًا له projectAccess على مشروع محذوف كمعلومة (المشروع معلَّم deleted).

---

## 7. الموديول 6: Audit (التدقيق)

### 7.1 الغرض والنطاق [Confirmed + O8]
- سجل غير قابل للتعديل لكل الأحداث المهمة؛ استعلام وفلترة؛ ربط اختياري بالمشاريع.

### 7.2 بنية الحدث [Confirmed — AuditLog]
`id, userId?, username?, action, entity, entityId?, oldValue?, newValue?, timestamp, ipAddress?` + **NEW:** `projectId?` [O8].

### 7.3 القواعد [Proposed فوق بنية Confirmed]
- **عدم قابلية التعديل:** لا endpoints تحديث/حذف؛ الكتابة نظامية فقط؛ أي تعديل يُكشف كحدث برمجي غير مشروع.
- **الأحداث المطلوبة (قائمة الحد الأدنى):** إنشاء/تحديث/حذف منطقي/استرجاع مشروع؛ تغيير حالة مستند (old/new)؛ انتقالات IPC (old/new + قرار)؛ إنشاء/تحديث/تعطيل/تغيير دور/تجاوزات/وصول مشروع/إعادة تعيين مستخدم؛ طلب/إنشاء/تحقق/استرجاع نسخة؛ تسجيل دخول/فشل/خروج؛ فشل صلاحيات حرج (نموذجياً 403 على عمليات كتابة) [Proposed].
- **oldValue/newValue:** للكيانات المالية والمستندية؛ حقول حساسة (passwordHash, tokens) **تُخفى** [Proposed — أمان].
- **O8 القواعد:** ربط `projectId` اختياري لأحداث الكيانات ذات مشروع (مستند، IPC، مستخدم-مشروع، نسخة مرتبطة)؛ الأحداث العامة (auth, settings, users) بلا projectId تبقى سليمة؛ **لا إجبار**؛ السجلات التاريخية بلا projectId تبقى معروضة وذات معنى (فلتر projectId = "بدون مشروع" متاح) [Proposed].
- **من يرى ماذا:** `audit.view` [Confirmed] أساس الرؤية؛ **فلترة بمشروع محدد** تتطلب أيضًا projectAccess ≥ READ على ذاك المشروع [Proposed — منع رؤية أحداث مشروع غير مصرح عبر باب التدقيق]؛ الأحداث بلا مشروع ترى لكل حامل audit.view. الحقول القابلة للبحث (ipAddress, oldValue الكامل) لا تُعرض لغير admin [Proposed].
- البحث الدقيق داخل السجل: عبر واجهة التدقيق نفسها (فلاتر)؛ بحث "السجل في البحث العالمي" يتبع قواعد O9 (05 §8).

### 7.4 حالات الحافة [Proposed]
- حدث مرتبط بكيان حُذف منطقيًا: يبقى معروضًا ( projectId يوفر السياق)؛ معرف الكيان قد يشير لعنصر مؤرشف — الواجهة تعرض "محذوف" دون رابط ميت.
- حجم oldValue/newValue كبير (مصفوفة بنود) → تُقتطع أو تُخزن كمرجع [Proposed — سقف حجم].

---

## 8. مصفوفة التبعيات بين الموديولات

| الموديول | يعتمد على | طبيعة |
|---|---|---|
| Dashboard | Projects, Archive, Audit, Notifications | تجميع مقيد بالصلاحيات (O7) |
| Projects | — (جذر) | |
| Archive | Projects (ربط اختياري), Settings (تصنيفات) | لا إجبار انتماء |
| Finance | Projects (BOQ/IPC/contractValue), Archive (ipcId ربط) | O2/O4/O5/O6 |
| Administration | — (جذر) + Backups (O10) | |
| Audit | جميع الموديولات | مستهلك للسجل — لا يقيدهم |

**خارج النطاق (تبعيات دعم فقط):** Warehouse، MaterialRequests، Reports — تُذكر فقط حيث تلمس الموديولات الستة (مثل عدد أسطر ROLE_BASE) ولا تُوسَّع.
