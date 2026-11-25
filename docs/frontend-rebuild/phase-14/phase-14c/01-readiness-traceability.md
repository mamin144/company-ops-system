# Phase 14C — الوثيقة 01: جدول التتبع لجاهزية التنفيذ (Implementation Readiness Traceability)

> **الأساس:** قرارات المالك O1–O13 المعتمدة (`phase-14a-owner-decisions.md`) + قرار المالك الجديد **B1 APPROVED** (`ipcs.approve` + `ipcs.resubmit` كإضافات معتمدة لمفردة الصلاحيات) + حزمة تصميم Phase 14B (الوثائق 01–07).
> **الغرض:** ربط كل متطلب 14A ↔ قرار مالك ↔ وثيقة 14B ↔ نتيجة جاهزية 14C، وتصنيف كل بند بوضوح: **ما هو موجود ومُدقق** مقابل **ما هو تصميم مقترح فقط** مقابل **ما هو محجوب بمصدر محمي**.
> **الطبيعة:** توثيق جاهزية فقط — لا تنفيذ. لا يُفتح أي ملف من الملفات الـ18 المحمية تحت `apps/api/src/**`.
> **التاريخ:** Tue Nov 17 2026

---

## 1. مفتاح الحالات (Readiness Status)

| الحالة | المعنى |
|---|---|
| `VERIFIED` | مدعوم بأدلة آمنة مُدققة ومقروءة مباشرة (شيفرة/مستند خارج `apps/api/src`) |
| `PARTIALLY VERIFIED` | جزء من البند مؤكد بادلة آمنة، وجزء آخر مفتوح/محجوب |
| `PROPOSED` | تصميم 14B فقط — لا وجود للتنفيذ؛ جاهز للتنفيذ بعد البوابات |
| `UNKNOWN` | لا دليل متاح؛ لا يُستنتج محتواه |
| `BLOCKED — OWNER AUTHORIZATION REQUIRED` | الإجابة تتطلب مراجعة أحد الملفات المحمية الـ18 أو مراجعة DB |
| `READY FOR IMPLEMENTATION` | سُدّت بوابة التصميم والقرار؛ التنفيذ ممكن بمجرد التفويض التشغيلي |

**قاعدة صارمة:** `PROPOSED` ≠ `VERIFIED`. الواجهة الجديدة تحدد الهدف؛ الخلفية تُقيَّم ضدها لا العكس.

## 2. الأدلة الآمنة المستخدمة في 14C (خارج الملفات المحمية)

| المصدر | ما تم أخذه منه في 14C |
|---|---|
| `packages/shared/src/permissions.ts` (L1–63) | ALL_PERMISSIONS = **27 مفتاحًا**؛ لا `ipcs.approve` ولا `ipcs.resubmit` ولا `users.resetPassword`/`roles.manage`/`projects.access` فيها؛ ROLE_PERMISSIONS مطابق لموك ROLE_BASE؛ fallback `permissionOf()` → viewer |
| `packages/shared/src/types.ts` | نموذج الكيانات المُدقق (User/SafeUser بلا dept/title/email ظاهرة) |
| `mock/data.ts` L279–328 | تعليق "prototype-only extension" الصريح؛ ROLE_BASE L300–306؛ MANAGED_GROUPS (مجموعة «الإدارة» بلا يمكن prototype-only)؛ mockUsers بـ email/dept/title (بيانات نموذجية) |
| `http/session.ts` (L1–92) | عقود auth الأربعة [Verified]؛ SafeUser { id, username, fullName, roleName, isActive, permissions } |
| `http/api.ts` (L1–225) | المسطح الموصَّل الوحيد: auth ×4 + `GET/POST/PUT /api/projects` (GET بـ pageSize=1000)؛ كل شيء آخر Proxy «not wired» فشل صريح بلا fallback صامت |
| `verify/archive.spec.ts` (اختبار CSV L157–208) | سلوك كشف التكرار في الواجهة: «رقم مكرر — سيُتخطى» + خيار «تضمين» + عدادات سيُضاف/سيُتخطى + إعادة التحقق عند تغيير المطابقة |
| قائمة أسماء ملفات `apps/api/src/database/migrations/*.sql` (وجود الملفات فقط — **لم تُقرأ**) | دليل دلالي على وجود سلسلة migrations (مثل `001_initial_schema.sql`، `17_core_uniqueness.sql`، `19_authz_rebuild.sql`، `21_direct_amounts.sql`) — **محتواها BLOCKED** (داخل `apps/api/src/**`) |

## 3. جدول التتبع الرئيسي (14A → O → 14B → 14C)

### 3.1 المستخدمون والإدارة (Administration)

| المتطلب 14A | القرار | 14B | حالة 14C | الملاحظة |
|---|---|---|---|---|
| U- dept/title في بطاقة/قائمة المستخدم | **O1** (الجديدان) | 01 §1.1، 02 §2 | **PROPOSED — READY FOR IMPLEMENTATION (schema)** | عمودان جديدان additive (nullable). لا migration يُنفذ قبل مراجعة مصدر DB مصوَّرة |
| U- email في المستخدم | **O1 مصحح** — email حقل هوية **قائم** | 02 §2/§12، 07 §4.2 | **PARTIALLY VERIFIED — BLOCKED جزئيًا** | القيود الفعلية (إلزامية/تفرّد/فهارس) داخل مخطط DB الفعلي → BLOCKED. التصميم **لا يضيف** عمودًا ولا قيدًا ولا backfill |
| U- تسجيل دخول username فقط | Confirmed | 01 §1.1 | **VERIFIED** (عقد login في session.ts) | مسار دخول بالإيميل غير مصمم — قرار مالك إن لزم (D4) |
| U- إدارة التجاوزات (INHERIT/GRANT/DENY) | **O13** | 05 §4 | **VERIFIED (النموذج) / PROPOSED (API)** | النموذج مُدقق؛ endpoints الإدارة كلها [Proposed] — لا وجود مُثبت |
| U- وصول المشاريع (NONE/READ/WRITE/DELETE) | **O13** | 05 §4 | **VERIFIED (النموذج) / PROPOSED (API)** | مفتاح `projects.access` prototype-only في mock — إثبات/اعتماد خلفي مطلوب |
| U- إعادة تعيين كلمة مرور | **O10** (تصميم فقط) | 06 §3 | **PROPOSED — جاهز تصميميًا؛ BLOCKED قناة التسليم** | hash-only + أحادي الاستخدام + إبطال؛ القناة (SMTP/إداري) قرار تشغيلي |
| U- مستخدمون مخصصون + إدارة أدوار | Prototype-only keys | 05 §3 | **BLOCKED — OWNER AUTHORIZATION REQUIRED** | `roles.manage` غير موجود في ALL_PERMISSIONS — قرار مالك مطلوب (D7) |

### 3.2 المشاريع (Projects)

| المتطلب | القرار | 14B | حالة 14C | الملاحظة |
|---|---|---|---|---|
| P- قائمة/إنشاء/تحرير مشاريع | Confirmed | 03 §4.1 | **VERIFIED (×3 endpoints)** + **PROPOSED (ListQuery** لإزالة pageSize=1000 hack) | النقاط الثلاث الموصَّلة الوحيدة خارج auth |
| P- تفصيل مشروع | [Proposed] | 03 §4.2 | **UNKNOWN (قد يكون موجودًا خلف المحميات)** | مراجعة `projects.routes.ts` مصرَّ بها |
| P- contractValue إدخال مباشر | **O2** | 01 §3.2، 02 §4 | **PARTIALLY VERIFIED** | العمود في الشكل المدقق لـ BackendProject [Verified في api.ts]؛ NULL≠0 قاعدة [Proposed] |
| P- حذف منطقي + استرجاع | **O12** | 01 §3.5، 03 §4.4–4.5 | **PROPOSED — بوابة قرار (D2)** | `deleted_at/deleted_by` الحقول غير مُثبتة في DB → BLOCKED التحقق |
| P- بوابات رؤية المحذوف | مقترح O12-تنفيذ | 05 §8 | **PROPOSED — قرار مالك (D2)** | |
| P- منع إعادة فتح completed/cancelled | قاعدة تصميم | 01 §3.6 | **PROPOSED — قرار مالك (D5)** | |

### 3.3 الأرشيف (Archive)

| المتطلب | القرار | 14B | حالة 14C | الملاحظة |
|---|---|---|---|---|
| A- انتقالات الحالات المتحكمة (7 حالات) | **O3** | 01 §4.3 (المرجع الوحيد) | **PROPOSED — READY FOR IMPLEMENTATION (قواعد)** | المصفوفة موحّدة؛ الانتقالات تُدار بـ `archive.edit` |
| A- رفع/مراجعة/تنزيل/حذف | Confirmed keys | 03 §5 | **PROPOSED — endpoints غير مُثبتة** | `documents.routes.ts`/`folders.routes.ts` محمية |
| A- ربط مستند بمشروع + نطاق ≥ READ | O13 ترجمة | 05 §5 | **PROPOSED** | |
| A- فصل مهام (رافع آخر مراجعة ≠ معتمد) | B3 مقترح | 05 §7 | **PROPOSED — قرار مالك (D3)** | |
| A- استيراد CSV ≤200 + كشف تكرار | **O11** | 01 §4.8 | **PARTIALLY VERIFIED** | الواجهة VERIFIED (spec+شيفرة)؛ الخلفية **BLOCKED** (import.routes.ts) — انظر الوثيقة 02 |
| A- حد حجم الملف + أنواع مسموحة | غير محسوم | 07 §5-B6 | **BLOCKED (fileType) + قرار مالك (D6)** | القائمة الفعلية خلف المحميات |

### 3.4 المالية والـ IPC (Finance)

| المتطلب | القرار | 14B | حالة 14C | الملاحظة |
|---|---|---|---|---|
| F- BOQ عرض/تحرير | [Proposed] | 03 §6.2 | **UNKNOWN (وجود endpoints) / PROPOSED (العقد)** | `boq.routes.ts` محمية |
| F- IPC دورة رسمية (draft→submitted→approved/rejected) | **O4** | 01 §5.3، 03 §6.3 | **PROPOSED — جاهز تصميميًا؛ B1 حسم إقحام المفاتيح** | `under-review` قيمة enum جديدة additive [Proposed] |
| F- **`ipcs.approve`/`ipcs.resubmit`** | **B1 APPROVED (جديد)** | 05 §6 | **READY FOR IMPLEMENTATION (المفردة) / قرار إسناد الأدوار معلق (D1)** | انظر الوثيقة 05 — إضافتهما لـ ALL_PERMISSIONS معتمدة؛ إسناد الأدوار **لم يُعتمد** |
| F- منع الاعتماد الذاتي | **O4** | 01 §5.3 | **PROPOSED — READY FOR IMPLEMENTATION (قاعدة)** | 403 `SELF_APPROVAL_DENIED` |
| F- الصرف (disbursements) | **O5 مؤجل** | 01 §1.2، 03 §6.1 | **VERIFIED (القرار) — عرض unavailable** | لا جداول ولا endpoints |
| F- ضريبة/استقطاع/مقدمات | **O6 مؤجل** | 01 §1.2، 02 §7.2 | **VERIFIED (القرار) — عرض unavailable** | لا جداول |

### 3.5 اللوحة الرئيسية (Home/Dashboard)

| المتطلب | القرار | 14B | حالة 14C | الملاحظة |
|---|---|---|---|---|
| H- لوحة تشغيلية فقط (بلا مؤشرات مالية) | **O7** | 01 §2.2، 03 §10 | **PROPOSED — READY FOR IMPLEMENTATION (القواعد)** | العدّادات مقيدة بنطاق المستخدم؛ لا تسرّب |
| H- عدّاد منفصل للمحذوف | مقترح O12-تنفيذ | 03 §10 | **PROPOSED — مرتبط بـ D2** | |
| H- بحث عالمي خلفي بلا تسريب | **O9** | 03 §9، 06 §5 | **PROPOSED — endpoints غير مُثبتة** | `global-search.service.ts` محمية |

### 3.6 التدقيق (Audit)

| المتطلب | القرار | 14B | حالة 14C | الملاحظة |
|---|---|---|---|---|
| X- سجل تدقيق قراءة-فقط + diff كامل | CONFIRMED في 14A | 01 §7 | **PROPOSED (API) — VERIFIED (النموذج AuditLog)** | لا endpoints مُثبتة |
| X- audit_logs.projectId اختياري | **O8** | 02 §8 | **PROPOSED — عمود إضافي additive** | العمود غير مُثبت في DB → BLOCKED التحقق |
| X- تدقيق بمشروع يتطلب ≥ READ | O13 ترجمة | 01 §7.3 | **PROPOSED — READY (قاعدة)** | |
| X- تسجيل تدقيق لكل كتابة | S12/INT-3 | 06 §4 | **PROPOSED — نفس المعاملة** | |

### 3.7 الاسترجاع والتشغيل (Cross-cutting O10)

| المتطلب | القرار | 14B | حالة 14C | الملاحظة |
|---|---|---|---|---|
| O10- نسخ احتياطي (تصميم) | **O10** | 06 §6 | **PROPOSED — جداول backups/restore_jobs جديدة** | مسارات OS وصلاحيات الخدمة BLOCKED |
| O10- استرجاع بخطوتين (dry-run→commit) | **O10** | 06 §7 | **PROPOSED — جاهز تصميميًا** | |

## 4. ملخص الأعداد حسب الحالة (للستة موديولات)

| الحالة | العدد التقريبي للبنود | ملاحظة |
|---|---|---|
| VERIFIED | الجلسة ×4، مشاريع ×3، نموذج الصلاحيات (27 مفتاحًا + ROLE_BASE + طبقات)، أنواع الكيانات، قرارات O5/O6/O7/O9/O11/O12/O13 كأحكام، سلوك CSV في الواجهة | كله من مصادر آمنة |
| PARTIALLY VERIFIED | email (حقل قائم؛ قيوده محجوبة)، CSV (واجهة مؤكدة؛ خلفية محجوبة)، contractValue (الشكل مدقق؛ NULL≠0 مقترح) | |
| PROPOSED | جوهر 14B: جميع endpoints عدا 7، جميع الجداول الجديدة الأربعة + أعمدة، قواعد الانتقالات، مصفوفة B1-إسناد الأدوار (معلّقة)، الاسترجاع بخطوتين | جاهز تصميميًا بعد البوابات |
| UNKNOWN | تفصيل مشروع، BOQ/IPC endpoints، موقف IPC القديم، بقية مسطح الخلفية | خلف المحميات — لا استنتاج |
| BLOCKED — OWNER AUTHORIZATION REQUIRED | مخطط DB الفعلي وقيوده (email/تفردات)، كشف التكرار الخلفي، جرد endpoints الكامل، مسارات الملفات، قائمة أنواع الملفات، محتوى migrations SQL | انظر الوثيقة 07 |

## 5. خلاصة

- **لا فجوة تتبع:** كل متطلب 14A له قرار/قاعدة/نموذج/عقد/خريطة تكامل — موروث من 14B §1 وتوسيعه في 14C بحالة جاهزية صريحة.
- **B1 المعتمد حسم سؤال 14B-§5-B1** (إقحام المفتاحين في المفردة)؛ ما تبقى فيه هو **إسناد الأدوار** (قرار مالك منفصل D1) والتنفيذ نفسه (بعد التفويض).
- **البوابة الأمامية للتنفيذ:** مراجعة مصدر مصرَّ بها للملفات الـ18 المحمية + التحقق من المخطط — انظر الوثيقة 07.
