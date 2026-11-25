# Phase 14A — خريطة المتطلبات الوظيفية وواجهات المستخدم (Feature & UI Requirements Map)

> **الهدف:** توثيق المتطلبات الوظيفية الكاملة المستخلصة من واجهة Phase 13 (`docs/frontend-rebuild/phase-13/app/src/`) للموديولات الستة المطلوبة: الرئيسية/لوحة القيادة، المشاريع، الأرشيف، المالية، الإدارة، التدقيق.
>
> **منهجية التصنيف:** كل بند وُجد في الواجهة (سيناريوهات، حقول، أزرار، قواعد) مؤكد فقط إذا كان قابلًا للتحقق من الشيفرة مباشرة — أي أن الـ UI هو مصدر الحقيقة للأدلة، وسنبلّغ عن كل ميزة بكلاس تصنيف:
>
> | الوسم | المعنى |
> |---|---|
> | `CONFIRMED` | وُجد حرفيًا في الواجهة (شاشة/سطر شيفرة مُعتمد مسبقًا) |
> | `PARTIALLY IMPLEMENTED` | وُجد جزئيًا في الواجهة أو يعمل في وضع demo فقط |
> | `INFERRED` | استُنتج من تسمية/تصميم الواجهة أو من مواضع الاستدعاء، دون تنفيذ كامل |
> | `MISSING` | لم يوجد في الواجهة إطلاقًا (فجوة موثقة، غير مخترَع) |
> | `OWNER DECISION REQUIRED` | صراع أو غموض لا يمكننا حلّه دون قرار من المالك |
>
> **قاعدة الاتجاه (Phase 13/14):** New UI → Features → Business Requirements → Data Requirements → API Contracts → Database → Backend → Integration. لا نُعيد تشكيل الواجهة لتلائم الـ API القديم. الواجهة الجديدة هي مصدر الحقيقة.
>
> **نطاق إلزامي:** الموديولات الستة فقط. المخزن/الطلبات (Inventory/Stock/Requests) **خارج النطاق** وذُكرت فقط كتبعيات عابرة للموديولات (§9).
>
> **مصدر الحقيقة الأول:**
> - مكوّنات الواجهة: `phase-13/app/src/features/**`, `phase-13/app/src/app/**`
> - نموذج الكيانات: `phase-13/app/src/services/api/adapters/mock/data.ts` (L1–328)
> - مكيّف HTTP (الممولة فعليًا): `phase-13/app/src/services/api/adapters/http/api.ts` (L1–225)
> - شجرة المسارات والصلاحيات: `phase-13/app/src/app/router.tsx` (L28–80)، `AppShell.tsx` (L15–27)

---

## 1. الملخص التنفيذي

فُحص كامل شجرة الواجهة لـ Phase 13 (كل الملفات المذكورة أدناه قُرئت ملفًا-ملفًا) وأُستخرجت منها خريطة المتطلبات التالية للموديولات الستة. الخلاصة:

- **المشاريع (Projects):** قائمة منسوبة لمشاريع المستخدم عبر `mrApi.projects(user.id)` + بحث/فلتر حالة/ترتيب/ترقيم (5/صفحة) + نموذج إنشاء/تعديل من 14 حقلًا مطابقًا لـ `projectSchema` المدقق منها + مساحة عمل بـ 6 تبويبات + محرك مالي (BOQ + IPC). هذا الموديول هو **الوحيد الموصّل فعليًا** إلى الـ backend الحقيقي في `http` mode.
- **الأرشيف (Archive):** الأغنى وظيفيًا — 7 حالات، معاينة بحسب النوع، مراجعات (revisions) + نسخة جديدة، تغيير حالة (انتقال حر بلا قواعد — قرار مالك)، استبدال، مدير روابط، تعديل بيانات، معالج استيراد CSV من 4 خطوات، تحديد جماعي + ZIP، حذف، تصدير سياقي.
- **الإدارة (Administration):** CRUD مستخدمين كامل مع امتداد mock-only (قسم/منصب)، تجاوزات صلاحية لكل مستخدم (INHERIT/GRANT/DENY، deny-beats-grant)، وصول لكل مشروع (NONE/READ/WRITE/DELETE)، تعطيل/تفعيل مع حماية آخر مدير، منع حذف الذات، فحص الأدوار (read-only) عبر `userApi.effective`.
- **التدقيق (Audit):** سجل قراءة-فقط مع فلاتر q/مستخدم/إجراء/كيان/مدى زمني، نافذة تفاصيل مع diff (حقل/من/إلى)، وتصدير CSV/JSON محكوم بـ `reports.view`. **لا حقل مشروع في `AuditLog`** — فلتر المشروع مستبعد عمدًا.
- **الرئيسية (Home):** لافتات ترحيب + طوابير `needsReview` (طلبات مواد مُقدّمة، مخزون منخفض، مرفوضة) محكومة بالصلاحيات، بطاقات إحصائية محكومة بـ `can()`، أحدث مستندات/حركات. **لا مؤشرات مالية على اللوحة** (فجوة مرشحة).
- **المالية (Financials):** مؤشرات مشتقة لكل مشروع من BOQ/IPC فقط (boqTotal، منفّذ معتمد، استقطاعات، نسبة تنفيذ، المتبقي من العقد). **الصرف المتبقي "غير متاح" صراحةً** — لا مصدر بيانات دفع/صرف في النظام كله (فجوة موثقة بذاتها).
- **الحالة الفعلية للـ HTTP adapter:** موصّل في Phase 13 slice 1: جلسة + `GET/POST/PUT /api/projects` فقط؛ كل ما عدا ذلك (documents, BOQ, IPC, users, audit, reports, stock…) يفشل صراحةً بـ "not wired yet" عبر Proxy — لا fallback صامت. أي أن **الموديولات الأخرى تعمل بالكامل في وضع demo/fixture حاليًا**.

**المخرَج المطلوب من هذه المرحلة:** هذه الخريطة فقط (بدون تصميم عقود API نهائية وبدون أي تنفيذ). **يتوقف التقدم بعد تسليمها لمراجعة المالك.**

---

## 2. جرد الموديولات الستة

### 2.1 الرئيسية / لوحة القيادة (`/` — Home)

الملف: `phase-13/app/src/features/dashboard/components/Home.tsx` (L1–218، قراءة كاملة) · المسار: `router.tsx` L51 (بلا `perm` — متاح لأي مستخدم مسجّل).

| # | العنصر/الميزة | التصنيف | التفاصيل |
|---|---|---|---|
| H1 | تحية بحسب الوقت + اسم المستخدم | `CONFIRMED` | نص ترحيب في أعلى الصفحة |
| H2 | طابور "بانتظار المراجعة": طلبات مواد مُقدّمة → رابط `/inventory/requests` | `CONFIRMED` | محكوم بـ `materialRequests.view` (+الموافقة بـ `materialRequests.approve`) — خارج النطاق، تبعية فقط |
| H3 | طابور "مخزون منخفض" → `/inventory/stock` | `CONFIRMED` | محكوم بـ `warehouse.view` — خارج النطاق، تبعية فقط |
| H4 | طابور "المرفوضة" | `CONFIRMED` | من نفس مصدر الطلبات — خارج النطاق |
| H5 | بطاقات إحصائية (مشاريع/مستندات/…) محكومة بالصلاحيات | `CONFIRMED` | كل بطاقة تُرسم فقط إذا `can(<perm>)` |
| H6 | أحدث مستندات (recentDocs) | `CONFIRMED` | قصاصة من `mockApi.documents` |
| H7 | أحدث حركات (recentMoves) — آخر 4 | `CONFIRMED` | من حركات المخزن — خارج النطاق |
| H8 | بطاقات حالة طلبات المواد deep-link `?status=` | `CONFIRMED` | رابط يعيد المستخدم للـ Requests مع فلتر مسبق |
| H9 | مؤشرات مالية على اللوحة (قيمة عقود/تنفيذ/مستخلصات) | `MISSING` | لا يوجد أي KPI مالي في Home — مرشّح إضافة (قرار مالك §11-O7) |
| H10 | تنبيهات مطلوب مني اعتماد BOQ/IPC مباشرة من اللوحة | `MISSING` | اللوحة تغطي طلبات المواد فقط؛ لا إشارة للمستخلصات المقدمة |

### 2.2 المشاريع (Projects)

الملفات: `features/projects/components/Projects.tsx` (L1–350)، `ProjectWorkspace.tsx` (L1–655)، `Financials.tsx` (L1–134) · المسارات: `router.tsx` L52–62 (كلها بـ `projects.view`).

| # | العنصر/الميزة | التصنيف | التفاصيل |
|---|---|---|---|
| P1 | قائمة مشاريع منسوبة: `mrApi.projects(user.id)` — المستخدم يرى مشاريعه فقط | `CONFIRMED` | Projects.tsx L5 (استيراد mrApi) + التنفيذ؛ في http mode التنفيذ server-side (`http/api.ts` L119–128) |
| P2 | بحث نصي + فلتر حالة + ترتيب + ترقيم (5/صفحة) | `CONFIRMED` | Projects.tsx: `PAGE_SIZE = 5` (L11)، حالات L13 |
| P3 | حالات الحالة الخمس: planned / active / on-hold / completed / cancelled | `CONFIRMED` | Projects.tsx L13 |
| P4 | إنشاء/تعديل مشروع: نموذج 14 حقلًا مطابق لـ `projectSchema` | `CONFIRMED` | code*, name*, client, owner, mainContractor, siteLocation, region, contractNo, contractValue, startDate, endDate, status, role, notes — موثقة في تعليق `data.ts` L3–28 (Phase 9 CR-01) |
| P5 | `contractValue ≥ 0` مع تمرير raw (لا حسبة من بنود) | `CONFIRMED` | تعليق `data.ts` L4–7: مبلغ مباشر يطابق `Project.contractValue` في `packages/shared/src/types.ts` |
| P6 | قيمة العقد تبقى undefined عند غياب الإدخال — لا رقم وهمي | `CONFIRMED` | `data.ts` L6–7؛ و`http/api.ts` L80 يمررها فقط إذا عُرّفت |
| P7 | دور المقاول: main-contractor / subcontractor / direct-contractor | `CONFIRMED` | Projects.tsx L14–15 |
| P8 | قاعدة التحرير `cvClearUnsupported`: مسح قيمة العقد غير مدعوم عند التحرير | `CONFIRMED` | قاعدة ضمن نموذج التحرير (Projects.tsx) |
| P9 | الحذف demo-local فقط (لم يوصل لـ HTTP) | `PARTIALLY IMPLEMENTED` | `http/api.ts` L165: `mrApi.remove` = not-wired؛ في fixture يعمل محليًا |
| P10 | حالات فراغ مميزة: بلا عضوية ≠ بلا نتائج فلتر ≠ فراغ حقيقي | `CONFIRMED` | ثلاث حالات EmptyState مختلفة |
| P11 | مشروع مفقود أو ممنوع → EmptyState إخفاء-الوجود (existence hiding) | `CONFIRMED` | ProjectWorkspace: نفس الحالة لـ 404 و403 — لا تسريب وجود |
| P12 | تبويبات المساحة الست: Overview/Sites/Documents/Warehouses/Stock/Financials | `CONFIRMED` | `router.tsx` L54–60 |
| P13 | Overview: عدادات + روابط عميقة + إضافة موقع (mock) | `PARTIALLY IMPLEMENTED` | mockApi.project/العدادات حقيقية في fixture؛ addSite تجريبي |
| P14 | تبويبات Docs/Warehouses/Stock داخل المشروع = عناصر تحويل (stubs) للأرشيف/المخزن | `CONFIRMED` | ProjectWorkspace: روابط عميقة فقط |
| P15 | Financials tab داخل المشروع: BOQ CRUD + IPC (انظر §4.2–4.3) | `CONFIRMED` | ProjectWorkspace (Panels BoqForm/IpcForm/IpcDetail) |
| P16 | الصفحة المستقلة `/financials`: مؤشرات مشتقة لكل مشروع | `CONFIRMED` | Financials.tsx L13–19: كل الأرقام مشتقة؛ المصفوفة القديمة الثابتة أزيلت عمدًا |
| P17 | `remainingDisbursement` = "غير متاح" صراحة | `CONFIRMED` | Financials.tsx L17–18 + i18n `ar.ts` L109: لا بيانات صرف/دفعات في النظام |
| P18 | استقطاعات تعاقدية/ضريبة/دفعات مقدمة: بلا مصدر | `CONFIRMED` (كفجوة) | `ar.ts` L111 `retentionNA`؛ الحقول غير موجودة في النموذج |

### 2.3 الأرشيف (Archive)

الملف: `features/archive/components/Archive.tsx` (L1–827، قراءة كاملة) · المسار: `router.tsx` L63 (`archive.view`).

| # | العنصر/الميزة | التصنيف | التفاصيل |
|---|---|---|---|
| A1 | فلاتر: بحث q + حالة (7) + مشروع (deep-link `?project=`) | `CONFIRMED` | الحالات: draft/submitted/under-review/approved/rejected/superseded/archived (L16) |
| A2 | فحص عضوية المستخدم في المشروع **قبل** تطبيق الفلاتر → إنكار صلب | `CONFIRMED` | إن لم يكن للمستخدم وصول للمشروع: إنكار مباشر لا قائمة فارغة |
| A3 | ترتيب + ترقيم (5/صفحة) | `CONFIRMED` | L12–15 |
| A4 | معاينة: قابلة للرندر (pdf/png/jpg/jpeg/gif/webp)، جداول (xlsx/csv)، غير ذلك لا معاينة | `CONFIRMED` | `RENDERABLE` L17 |
| A5 | خط زمني للمراجعات (revisions) + رفع نسخة جديدة مع ملاحظة تخفيض إذا الحالة approved | `CONFIRMED` | تفاصيل المستند |
| A6 | تغيير حالة — **انتقال حر** (اختيار أي حالة بلا قواعد انتقال) مع تأكيد من خطوتين | `CONFIRMED` (بقواعد غائبة) | قواعد الانتقال غير موجودة → قرار مالك §11-O3 |
| A7 | استبدال الملف | `CONFIRMED` | ضمن تفاصيل المستند |
| A8 | مدير الروابط: تعطيل إضافة رابط مكرر + ملاحظة "خارج نطاق النموذج الحالي" | `CONFIRMED` | `DocLinks`管理 |
| A9 | تعديل البيانات الوصفية: العنوان مطلوب، منتقي مشروع مُسند بالعضوية، يعكس رفض العرض-المشاريع 403 | `CONFIRMED` | يشير إلى قاعدة `projects.access` خلفية |
| A10 | معالج استيراد CSV من 4 خطوات: أسماء عربية للأعمدة (aliases)، كشف تكرار على الرقم (قاعدة prototype)، حد ≤200 صف | `PARTIALLY IMPLEMENTED` | قواعد الكشف/الحد prototype — قرار مالك §11-O6 |
| A11 | تحديد جماعي + تصدير ZIP (mock) | `PARTIALLY IMPLEMENTED` | ZIP تجريبي في fixture |
| A12 | حذف مستند (موصل في fixture) | `CONFIRMED` | محكوم `archive.delete` |
| A13 | تصدير سياقي للقائمة `ContextualExport reportId="documents"` | `CONFIRMED` | CSV محكوم بالصلاحيات (لاحظ i18n `en.ts` L312: قدرة prototype وليست endpoint XLSX الإنتاجي) |
| A14 | صلاحيات عملية: `archive.upload/edit/delete/download` تُفصل أزرارها | `CONFIRMED` | عبر `can()` في الشاشة |
| A15 | رفع مستند جديد (مشروع/نوع/حالة/ملف) | `CONFIRMED` | نموذج إنشاء داخل الشاشة |

### 2.4 المالية (Finance — `/financials`)

الملف: `features/projects/components/Financials.tsx` (L1–134) · المسار: `router.tsx` L62 (`projects.view` — تُشارك صلاحية المشاريع).

| # | العنصر/الميزة | التصنيف | التفاصيل |
|---|---|---|---|
| F1 | بطاقة لكل مشروع مرئي: boqTotal، منفّذ معتمد، استقطاعات، قيمة العقد، نسبة تنفيذ، المتبقي من العقد | `CONFIRMED` | مشتقة من BOQ/IPC فقط (`computeIndicators`) |
| F2 | استقطاعات = مجموع خصومات المستخلصات المعتمدة | `CONFIRMED` | derivation من بنود IPC |
| F3 | الصرف المتبقي: صريح "غير متاح" — لا مصدر بيانات صرف/دفعات في النظام كله | `CONFIRMED` (كفجوة موثقة) | Financials.tsx L17–18 + `ar.ts` L109 |
| F4 | الضريبة/الاستقطاع التعاقدي/الدفعات المقدمة: بلا مصدر | `CONFIRMED` (كفجوة) | `ar.ts` L111 |
| F5 | ترتيب/فلترة صفحة المالية بمعيار مستقل | `INFERRED` | الشاشة تكرر نمط القوائم؛ لا خيار ترتيب مستقل واضح — يحتاج تأكيد |
| F6 | وحدة مالية موحدة (SAR) وتنسيق أرقام | `INFERRED` | تنسيق `en-US` حتى 2 كسر (L11)؛ لا اختيار عملة |

### 2.5 الإدارة (Administration — `/admin`)

الملفات: `features/administration/components/Admin.tsx` (L1–412)، `Audit.tsx` (L1–201) · المسار: `router.tsx` L69 (`users.manage`) — تبويب الأدوار عبر `roles.manage`؟ (داخل نفس الشاشة).

| # | العنصر/الميزة | التصنيف | التفاصيل |
|---|---|---|---|
| U1 | CRUD مستخدمين: name*, email (بمطابقة `EMAIL_RE`)، قسم، منصب، دور، حالة | `PARTIALLY IMPLEMENTED` | قسم/منصب/إيميل = **امتداد mock-only** غير موجود في نموذج backend المدقق — قرار مالك §11-O1 |
| U2 | خمسة أدوار: admin / management / warehouse / technical / viewer | `CONFIRMED` | Admin.tsx L10–15 + `ROLE_AR5` |
| U3 | تجاوزات صلاحية لكل مستخدم: INHERIT/GRANT/DENY (deny-beats-grant) | `CONFIRMED` | OverrideEffect + منظومة `userApi.effective` |
| U4 | وصول لكل مشروع: NONE/READ/WRITE/DELETE | `CONFIRMED` | AccessLevel × مشاريع المستخدم |
| U5 | تعطيل/تفعيل مستخدم مع حماية "آخر مدير فعّال" | `CONFIRMED` | تُمنع التعطيل إن كان آخر مدير |
| U6 | منع المستخدم من حذف نفسه | `CONFIRMED` | قاعدة صريحة |
| U7 | إعادة تعيين كلمة المرور (mock) | `PARTIALLY IMPLEMENTED` | زر تجريبي — مسار الإنتاج يحتاج قرار مالك §11-O10 |
| U8 | تبويب الأدوار: قراءة-فقط للـ `ROLE_BASE` + النتيجة الفعلية عبر `userApi.effective` | `CONFIRMED` | لا تحرير أدوار في prototype |
| U9 | تصدير/طبع قائمة المستخدمين | `MISSING` | لا تصدير في شاشة المستخدمين |

### 2.6 التدقيق (Audit — `/audit`)

الملف: `features/administration/components/Audit.tsx` (L1–201) · المسار: `router.tsx` L70 (`audit.view`).

| # | العنصر/الميزة | التصنيف | التفاصيل |
|---|---|---|---|
| X1 | سجل تدقيق قراءة-فقط | `CONFIRMED` | لا أي عملية كتابة |
| X2 | فلاتر: q / user / action / entity / from / to (المقارنة على جزء التاريخ من ISO) | `CONFIRMED` | Audit.tsx L13–15 |
| X3 | نافذة تفاصيل مع diff (حقل/من/إلى) | `CONFIRMED` | modal التفاصيل |
| X4 | تصدير CSV/JSON عبر `reportApi.export` محكوم بـ `can('reports.view')` | `CONFIRMED` | Audit.tsx L4–5 + الاستخدام |
| X5 | `AuditLog` **لا يحوي حقل مشروع** → لا فلتر مشروع (عمدًا) | `CONFIRMED` | تعليق Audit.tsx L11–12: "Only fields the audited AuditLog actually has — no project, no invented scope" |
| X6 | ترقيم 10/صفحة | `CONFIRMED` | `PAGE_SIZE = 10` (L10) |

---

## 3. الشاشات والمكوّنات

### 3.1 خريطة المسارات ↔ الصلاحيات (من `router.tsx` L47–80 + `AppShell.tsx` L15–27)

| المسار | الشاشة | الصلاحية (Guard) | الموديول |
|---|---|---|---|
| `/` | Home | (بلا — أي مستخدم مسجّل) | الرئيسية |
| `/projects` | Projects | `projects.view` | المشاريع |
| `/projects/:id` (+ overview/sites/documents/warehouses/stock/financials) | ProjectWorkspace (6 تبويبات) | `projects.view` | المشاريع |
| `/financials` | Financials | `projects.view` | المالية |
| `/archive` | Archive | `archive.view` | الأرشيف |
| `/admin` | Admin (مستخدمون + أدوار) | `users.manage` | الإدارة |
| `/audit` | Audit | `audit.view` | التدقيق |
| `/reports`, `/settings`, `/search`, `/notifications` | عابرة (خارج النطاق، تُذكر عند الحاجة) | — | — |

ملاحظات من الشجرة:
- Guard هو **حماية طبقة UX فقط**: `router.tsx` L24–27 — "real authorization is enforced by the backend".
- عدم `ready` قبل الجلسة → لا رندر (L34) — لا ارتداد لصفحة الدخول لإطار واحد.
- `/projects/:id/...` بلا `perm` إضافي داخلي؛ الفحص الفرعي للتبويبات يتم بـ `can()` داخل الشاشة.

### 3.2 مكوّنات الشل المشتركة (`AppShell.tsx` + `CommandPalette.tsx`)

| المكوّن | الوصف | التصنيف |
|---|---|---|
| قائمة تنقل بثلاث مجموعات (Work/Manage/System) مع إخفاء عناصر بلا صلاحية | `AppShell.tsx` L15–27 | `CONFIRMED` |
| Topbar: بحث (يفتح palette)، تنبيهات، عناصر مستخدم، لغة، كثافة، ثيم، تصغير الشريط | `AppShell.tsx` L29–64+ | `CONFIRMED` |
| CommandPalette: تنقل + ثيم + لغة + خروج، بحث داخل الأوامر، لوحة مفاتيح (↑/↓/Enter/Esc)، أعراف ARIA كاملة | `CommandPalette.tsx` L15–66 | `CONFIRMED` |
| Breadcrumbs حسب المسار | AppShell | `CONFIRMED` |
| Drawer للجوال + Tooltips للشريط المصغّر | AppShell L38–48 | `CONFIRMED` |
| ترقيم `Pager` مشترك (بحجم 5 للمشاريع/الأرشيف، 10 للتدقيق) | `shared/ui` | `CONFIRMED` |
| `RecShell/RecHead/RecRow/RecCell/SortHeader` — قائمة جداول موحدة قابلة للترتيب | `shared/ui` | `CONFIRMED` |
| `ConfirmDialog` (تأكيد بخطوتين)، `Modal`، `Tabs`، `Field`، `Select`، `TextInput/TextArea`، `SearchInput`، `Badge/StatusDot/statusLabel`، `EmptyState`، `useToast`/`errText` | `shared/ui` | `CONFIRMED` |
| `ContextualExport` — تصدير سياقي لقائمة محددة بـ reportId | `shared/ui/ContextualExport` | `CONFIRMED` |
| Toast عند كل كتابة في وضع fixture: إشعار `mockNote` (demo-only) | عبر `useToast` في كل شاشة | `CONFIRMED` |

### 3.3 مكوّنات خاصة بالموديول

- **Projects:** نموذج 14 حقلًا، حالات فراغ ثلاثية، Pager، Select حالات/أدوار.
- **ProjectWorkspace:** تبويبات NavLink داخلية، Panels: OverviewCards، SitesPanel (mock addSite)، BoqForm/IpcForm/IpcDetail (نموذج بنود + تحقق cap/allowance)، Deep-link stubs.
- **Archive:** FiltersBar، DocDetail (معاينة + مراجعات + روابط + بيانات وصفية + حالة + استبدال)، ImportWizard (4 خطوات)، BatchBar + ZIP، ContextualExport.
- **Admin:** UsersTable + UserForm (بإدخال قسم/منصب/دور/حالة) + OverridesEditor (INHERIT/GRANT/DENY) + ProjectAccessEditor (NONE/READ/WRITE/DELETE) + RolesReadonly.
- **Audit:** FiltersBar (نص/مستخدم/إجراء/كيان/مدى)، DetailsModal مع Diff، أزرار Export.
- **Home:** Greeting، NeedsReviewQueues، StatCards (محكومة)، RecentDocs/Moves.
- **Financials:** ProjectFinanceCards (مشتقة)، "غير متاح" placeholders.

---

## 4. مسارات العمل (Workflows)

### 4.1 المشاريع
- **W-P1 إنشاء مشروع:** انقر "جديد" → نموذج 14 حقلًا (code/name/status مطلوبة، contractValue ≥ 0 أو فارغ) → حفظ → يظهر في قائمة المستخدم فورًا (fixture) أو `POST /api/projects` (http). صلاحية: `projects.create`. [`CONFIRMED`]
- **W-P2 تحرير مشروع:** من صف القائمة/المساحة → نفس النموذج partial (`projectSchema.partial()` — `http/api.ts` L148–158) → قاعدة `cvClearUnsupported`. صلاحية: `projects.edit`. [`CONFIRMED`]
- **W-P3 حذف مشروع:** زر حذف مع تأكيد؛ demo-local فقط (`mrApi.remove` not-wired). صلاحية: `projects.delete`. [`PARTIALLY IMPLEMENTED`]
- **W-P4 دخول مساحة مشروع:** القائمة → `/projects/:id` → تبويب overview. ممنوع/مفقود → EmptyState إخفاء-الوجود. [`CONFIRMED`]

### 4.2 مقايسة الكميات (BOQ) داخل `/projects/:id/financials`
- **W-B1 إضافة بند:** new line → (وصف/وحدة/كمية/سعر) → الحفظ يحسب `total = quantity × unitPrice` (`boqTotal` — `http/api.ts` L181، نفس الحساب في fixture). [`CONFIRMED`]
- **W-B2 تحرير/حذف بند** مع تثبيت "إجمالي البنود المعروضة". [`CONFIRMED`]
- كل كتابة demo-local في fixture (toast "(تجريبي)").

### 4.3 المستخلصات (IPC)
- **W-I1 إنشاء مستخلص:** new IPC → رقم (≥1) → نوع مبني على البنود أو مبلغ مباشر:
  - **بندي:** خط لكل بند BOQ: `previousQty` + `currentQty` ≤ cap BOQ (منع تجاوز allowance)؛ المبلغ = الجديد × السعر. [`CONFIRMED`]
  - **مبلغ مباشر:** gross − deductions = net. [`CONFIRMED`]
- **W-I2 دورة الحالة:** draft → submitted → approved / rejected؛ الحذف مسموح للـ draft فقط. [`CONFIRMED`]
- **W-I3 لا إشعارات/موافقات مرتبطة داخل الشاشة** — الحالة تتغير يدويًا. [`MISSING` كإشعار] (قرار مالك §11-O4)

### 4.4 الأرشيف
- **W-A1 رفع مستند:** زر رفع → نموذج (عنوان*، مشروع، نوع، حالة، ملف) → حفظ. صلاحية `archive.upload`. [`CONFIRMED`]
- **W-A2 معاينة:** حسب نوع الملف (قابل للرندر/جداول/بلا). [`CONFIRMED`]
- **W-A3 مراجعة/نسخة جديدة:** رفع revision → ملاحظة "سيخفض الحالة" إذا كانت approved. [`CONFIRMED`]
- **W-A4 تغيير الحالة:** اختيار أي حالة (انتقال حر) + تأكيد من خطوتين. [`CONFIRMED` بقواعد غائبة]
- **W-A5 استبدال الملف:** نفس النموذج بلا نسخة جديدة. [`CONFIRMED`]
- **W-A6 إدارة الروابط:** إضافة/حذف روابط، منع التكرار، ملاحظة خارج النطاق. [`CONFIRMED`]
- **W-A7 تعديل البيانات الوصفية:** عنوان* + منتقي مشروع مُسند بالعضوية (يكرر رفض 403). [`CONFIRMED`]
- **W-A8 استيراد CSV (4 خطوات):** 1) اختيار ملف → 2) مطابقة الأعمدة بأسماء عربية (aliases) → 3) معاينة + كشف تكرار على `number` → 4) تنفيذ (≤200 صف). [`PARTIALLY IMPLEMENTED`]
- **W-A9 تحديد جماعي + ZIP:** اختيار متعدد → تصدير مضغوط (mock). [`PARTIALLY IMPLEMENTED`]
- **W-A10 حذف مستند:** تأكيد → حذف. صلاحية `archive.delete`. [`CONFIRMED`]
- **W-A11 تصدير سياقي:** `ContextualExport reportId="documents"` → CSV داخل نطاق الصلاحيات. [`CONFIRMED`]
- **W-A12 فلترة بمشروع عبر deep-link:** `?project=<id>` من مساحات المشاريع أو لوحة. [`CONFIRMED`]

### 4.5 المالية
- **W-F1 عرض المؤشرات:** لكل مشروع: boqTotal، منفّذ معتمد، استقطاعات، قيمة العقد، نسبة التنفيذ، المتبقي من العقد. [`CONFIRMED`]
- **W-F2 "غير متاح" للصرف المتبقي** + رسالة الفجوة (`disbursementGap`). [`CONFIRMED` كفجوة]

### 4.6 الإدارة
- **W-U1 إنشاء مستخدم:** نموذج (name*، email*، قسم، منصب، دور، حالة). [`PARTIALLY IMPLEMENTED`]
- **W-U2 تحرير مستخدم:** نفس الحقول + تغيير الدور/الحالة. [`PARTIALLY IMPLEMENTED`]
- **W-U3 تجاوزات الصلاحيات:** لكل صلاحية: INHERIT (من الدور) / GRANT / DENY؛ DENY يغلب GRANT. [`CONFIRMED`]
- **W-U4 وصول المشاريع:** لكل مشروع: NONE/READ/WRITE/DELETE. [`CONFIRMED`]
- **W-U5 تعطيل/تفعيل:** مع رفض تعطيل آخر مدير فعّال. [`CONFIRMED`]
- **W-U6 حذف مستخدم:** ممنوع على الذات. [`CONFIRMED`]
- **W-U7 إعادة تعيين كلمة مرور:** mock. [`PARTIALLY IMPLEMENTED`]
- **W-U8 فحص الأدوار:** قراءة ROLE_BASE + النتيجة الفعلية (effective) لكل مستخدم. [`CONFIRMED`]

### 4.7 التدقيق
- **W-X1 استعراض + فلترة:** q/user/action/entity/from/to. [`CONFIRMED`]
- **W-X2 تفاصيل + diff:** نافذة تُظهر تغيير كل حقل (from→to). [`CONFIRMED`]
- **W-X3 تصدير:** CSV/JSON محكوم `reports.view`؛ يمر عبر `reportApi.export` بنفس نطاق التصفية. [`CONFIRMED`]

---

## 5. متطلبات البيانات ونموذج الكيانات (ER)

مصدر الحقيقة: `phase-13/app/src/services/api/adapters/mock/data.ts` (L1–328) — الحقول الموثقة هنا هي التي **تستخدمها الواجهة فعليًا**.

### 5.1 الكيانات الجوهرية للموديولات الستة

| الكيان | الحقول (كما تعرضها الواجهة) | التصنيف |
|---|---|---|
| **Project** | id, code↔projectCode, name↔projectName, client, owner, mainContractor, siteLocation, region?, contractNo↔contractNumber, contractValue? (≥0), startDate?, endDate?, status (5), role? (main/sub/direct-contractor), notes? | `CONFIRMED` — مطابق `projectSchema` (تعليق `data.ts` L3–28: Phase 9 CR-01، مطابق حقلًا-حقلًا لـ `packages/shared/src/types.ts` + `apps/api`) |
| **Doc** (مستند أرشيف) | id, number, title, project (FK), type, status (7: draft/submitted/under-review/approved/rejected/superseded/archived), file (مستند/امتداد), revisions[] (خط زمني + ملاحظة تخفيض إذا approved), links[] (منع التكرار), metadata (عنوان*، مشروع) | `CONFIRMED` من Archive.tsx |
| **BoqItem** | id, projectId, وصف, وحدة, quantity, unitPrice → total = qty × unitPrice | `CONFIRMED` (`http/api.ts` L181 + BoqForm) |
| **Ipc** | id, projectId, number (≥1), kind (line-based أو direct-amount), lines[] (boqItem, previousQty, currentQty ≤ cap, amount), gross, deductions, net, status (draft/submitted/approved/rejected) | `CONFIRMED` (IpcForm/IpcDetail) |
| **MockUser** | id, name, email, role (5), status (فعّال/معطل), overrides per-permission (INHERIT/GRANT/DENY), projectAccess per-project (NONE/READ/WRITE/DELETE), dept/title (**mock-only**) | `CONFIRMED` عدا dept/title = `OWNER DECISION REQUIRED` |
| **AuditLog** | id, at (ISO), user, action, entity, details/diff (field/from/to) — **بلا حقل مشروع عمدًا** | `CONFIRMED` (Audit.tsx L11–13) |
| **Notification** | 4 أنواع mock (طلبات، مخزون، …) + read flag | `PARTIALLY IMPLEMENTED` (mock فقط) |
| Backup / ImportRecord | سجلات تجريبية في Settings | `PARTIALLY IMPLEMENTED` |
| Warehouse / Item / Transaction / MaterialRequest | خارج النطاق — تبعيات فقط (§9) | (out of scope) |

### 5.2 العلاقات (ER مختصر)

```
User ──(projectAccess N:M)── Project
Project 1──N BoqItem
Project 1──N Ipc ──N IpcLine ──1 BoqItem
Project 1──N Doc ──N Revision ; Doc ──N Link
User 1──N AuditLog (بلا ربط بمشروع)
User 1──N PermissionOverride (per key: INHERIT/GRANT/DENY)
Role (5 ثابتة) ──1 ROLE_BASE (مصفوفة صلاحيات ثابتة، data.ts L300–306)
```

### 5.3 قواعد بيانات مستخلصة من الواجهة

1. `contractValue` إدخال مباشر لا يُشتق من بنود المقايسة، ويظل `undefined` عند غيابه — لا رقم وهمي. [`CONFIRMED`]
2. `boqTotal = Σ(quantity × unitPrice)`. [`CONFIRMED`]
3. `ipc.currentQty ≤ boqItem.quantity − previousQty` (cap)؛ السماح بالتجاوز عبر allowance **يُمنع** في النموذج الحالي (over-BOQ block). [`CONFIRMED`]
4. IPC line-based: `net = Σ(amounts) − deductions`؛ direct: `net = gross − deductions`. [`CONFIRMED`]
5. IPC delete = draft فقط. Doc status change = انتقال حر. [`CONFIRMED`]
6. `AuditLog` لا يحمل مشروعًا — لا يمكن بناء تدقيق بمنظور مشروع دون قرار مالك. [`OWNER DECISION REQUIRED`]
7. لا مصدر بيانات لأي مما يلي: دفعات/صرف، ضريبة، استقطاع تعاقدي، دفعات مقدمة، حسابات بنكية. [`CONFIRMED` كفجوة]
8. الصلاحيات تُدار عبر: ROLE_BASE (دور) + overrides (مستخدم) + projectAccess (مستخدم×مشروع)؛ الحساب النهائي عبر `userApi.effective`. [`CONFIRMED`]
9. `MANAGED_GROUPS` = 8 مجموعات يديرها النظام (data.ts) — تُستخدم في شاشة الإدارة. [`CONFIRMED`]

---

## 6. مصفوفة الصلاحيات

### 6.1 الصلاحيات المستخدمة في الموديولات الستة (من `router.tsx` + الشاشات)

| الصلاحية | الموديول | الاستخدام في UI |
|---|---|---|
| `projects.view` | المشاريع + المالية | Guard للمسارين L52/62 + Nav |
| `projects.create` / `projects.edit` / `projects.delete` | المشاريع | أزرار النموذج/الحذف |
| `projects.access` | المشاريع/الأرشيف | وصول لكل مشروع (خلف العضوية) |
| `archive.view` | الأرشيف | Guard L63 + Nav |
| `archive.upload` / `archive.edit` / `archive.delete` / `archive.download` | الأرشيف | أزرار العمليات |
| `users.manage` | الإدارة | Guard L69 + Nav |
| `roles.manage` | الإدارة (تبويب الأدوار) | يُذكر في الخريطة؛ في prototype التبويب قراءة-فقط |
| `users.resetPassword` | الإدارة | زر mock |
| `audit.view` | التدقيق | Guard L70 + Nav |
| `reports.view` | التدقيق + التقارير | يحكم التصدير من Audit |
| `settings.manage` / `backup.manage` | الإعدادات (عابرة) | tab backups + restore mock |
| `sites.edit` | المشاريع (Overview) | زر addSite mock |
| `warehouse.view`, `materialRequests.*` | خارج النطاق (تبعيات §9) | Home deep links |

### 6.2 الأدوار الثابتة (ROLE_BASE — `data.ts` L300–306)

خمسة أدوار: `admin`, `management`, `warehouse`, `technical`, `viewer` — لكل دور مجموعة صلاحيات ثابتة في `ROLE_BASE`، والعرض في Admin و`ROLE_AR5`. المشاهد الفعلي للنموذج في وضع prototype:

- `admin` → الكل (Manage + System).
- `management` → عادةً المشاهدة للمشاريع/الأرشيف/المالية/التقارير/التدقيق.
- `warehouse` → المخزن (خارج النطاق) + قراءة عامة.
- `technical` → مشاريع/أرشيف بمستوى تشغيلي.
- `viewer` → قراءة فقط للموديولات المشاهَدة.

> ملاحظة أمانة: هذه المعاينة العالية-المستوى مستخلصة من بنية `ROLE_BASE` والمجموعات؛ **التوزيع الدقيق لكل صلاحية لكل دور موثق في `data.ts` L300–306** ويجب اعتماده كما هو عند بناء الـ RBAC الخلفي (لا تغيير).

### 6.3 طبقات الحساب الفعلية (`userApi.effective`)

1. صلاحيات الدور الأساس (ROLE_BASE).
2. تجاوز لكل مستخدم لكل صلاحية: INHERIT (الافتراضي) / GRANT / DENY — **DENY يغلب GRANT**.
3. وصول مشروع لكل مستخدم×مشروع: NONE/READ/WRITE/DELETE — يُقيد ما يظهر في القوائم المنسوبة (`mrApi.projects(user.id)`) وفحوص العضوية في الأرشيف (A2).
4. في http mode: `canProject` يفحص قائمة الصلاحيات من الجلسة فقط؛ **النطاق (scoping) يُفرض server-side** لكل طلب (`http/api.ts` L172–178).

---

## 7. قدرات API الحالية (wired vs not-wired)

مصدر: `phase-13/app/src/services/api/adapters/http/api.ts` (L1–225) — التقييم أدناه عن حالة Phase 13 slice 1.

### 7.1 موصّل فعليًا إلى الـ backend الحقيقي (http mode)

| القدرة | نقطة النهاية | المرجع |
|---|---|---|
| جلب المشاريع (نطاق المُستدعي، server-side) | `GET /api/projects?page=1&pageSize=1000` | `http/api.ts` L119–128 |
| إنشاء مشروع (يتطلب `projects.create` server-side) | `POST /api/projects` | L130–146 |
| تحرير مشروع (partial patch) | `PUT /api/projects/:id` | L148–158 |
| جلسة المستخدم | `./session.ts` (مباشر من auth provider) | L9، L25 |
| `boqTotal` | حساب عتيق محلي | L181 |
| name caches (`projName/whName/itemName`) | client-side (بذرة من ردود المشاريع) | L26، L168–170 |
| `canProject` | فحص صلاحيات من الجلسة (scoping server-side) | L172–178 |
| MR_STATUSES / EMAIL_RE | ثوابت عقد (re-export) | L27 |

### 7.2 صراحةً غير موصل (Proxy "not wired" — L219–225)

`mockApi`, `stockApi`, `boqApi`, `ipcApi`, `userApi`, `reportApi`, `lookups`, `mrApi.list/get/create/act/issue/remove` — كلها ترمي خطأً واضحًا: "not wired yet — Phase 13 slice 1 covers the real session and the Projects vertical only" (L32–36). **لا fallback صامت إلى fixtures في http mode** (L17–20).

### 7.3 التطبيقات التوضيحية في وضع fixture (demo)

كل ما سبق غير الموصل **يعمل محليًا في وضع fixture** مع بذور بيانات اصطناعية وتوست "(تجريبي)". هذا مقبول لمراجعة المالك لكنه **ليس قدرات إنتاج**.

### 7.4 خريطة "الشاشة → الحاجة الحقيقية من الـ API" (مُدخلات لتصميم العقود لاحقًا — ليس تصميمًا نهائيًا)

| الشاشة/الوظيفة | ما تحتاجه من backend (معمارياً) | الحالة |
|---|---|---|
| قائمة المشاريع | قائمة منسوبة + بحث/فلتر/ترتيب/ترقيم (server-side مفضّل عند الحجم) | GET موجود؛ الفلترة حالياً client-side |
| إنشاء/تحرير مشروع | POST/PUT بمخطط 14 حقلًا | موجود |
| حذف مشروع | DELETE `/api/projects/:id` | غير موصل |
| BOQ CRUD | GET/POST/PUT/DELETE بنود المقايسة لكل مشروع | غير موصل (fixture فقط) |
| IPC CRUD + دورة الحالة | GET/POST/PUT/DELETE مستخلصات + انتقال حالة (draft→submitted→approved/rejected) + قيد cap | غير موصل |
| الأرشيف (قائمة/تفاصيل) | GET مستندات منسوبة + فلترة + ترقيم | غير موصل |
| رفع/مراجعة/استبدال | POST ملفات + revisions | غير موصل |
| تغيير حالة مستند | PATCH حالة + **قواعد انتقال (غير موجودة — قرار مالك)** | غير موصل |
| استيراد CSV | POST batch مع قواعد (تكرار على number، حد صفوف) | غير موصل |
| حذف/تصدير | DELETE + export endpoint (CSV الآن، XLSX إنتاجي لاحقًا) | غير موصل |
| المستخدمون | CRUD + تجاوزات + وصول مشاريع + disable/enable + reset password | غير موصل |
| الأدوار (فحص) | GET ROLE_BASE + effective لكل مستخدم | غير موصل |
| التدقيق | GET سجل بفلاتر + تفاصيل diff | غير موصل |
| تصدير التقارير | export (CSV/JSON) بمعرّف reportId ونطاق صلاحيات | غير موصل |
| الإشعارات | GET قائمة + read | غير موصل (mock 4 أنواع) |
| الإعدادات/النسخ | backups + restore + سجل استيراد | غير موصل (mock) |

---

## 8. الموجود مقابل المفقود (Gaps)

### 8.1 موجود ويعمل (Prototype كامل)

- قوائم المشاريع + النموذج + المساحة (6 تبويبات) + BOQ + IPC بالكامل (fixture).
- الأرشيف بأكمله (رفع/معاينة/مراجعات/حالة/استبدال/روابط/بيانات وصفية/استيراد/دفعة/حذف/تصدير).
- الإدارة (مستخدمون + تجاوزات + وصول مشاريع + أدوار قراءة).
- التدقيق (فلاتر + diff + تصدير).
- المالية المشتقة لكل مشروع.
- الشل (تنقل/بحث/تنبيهات/إعدادات/إشعارات/أدوات) + i18n عربي/إنجليزي كامل.

### 8.2 فجوات موثقة (MISSING — ليست اختراعات)

| # | الفجوة | الأثر | المرجع |
|---|---|---|---|
| G1 | لا مصدر بيانات للصرف/الدفعات (disbursement/payments) | `remainingDisbursement` "غير متاح" دائمًا | Financials L17–18، `ar.ts` L109 |
| G2 | لا مصدر للضريبة/الاستقطاع التعاقدي/الدفعات المقدمة | الخانات لا تُحتسب | `ar.ts` L111 |
| G3 | لا قواعد انتقال لحالة المستند | أي حالة ← أي حالة | Archive (A6) |
| G4 | لا قواعد انتقال للحالة إلا draft-only deletion في IPC | السلسلة draft→submitted→approved/rejected يدوية بلا ضوابط | ProjectWorkspace (W-I2) |
| G5 | `AuditLog` بلا مشروع | لا تدقيق بمنظور مشروع | Audit.tsx L11–13 |
| G6 | إشعارات mock (4 أنواع، session) | لا إشعارات فعلية/قابلة للاشتراك | Notifications.tsx L1–33 |
| G7 | صفحة البحث تعمل على المصفوفات الخام بلا نطاق صلاحيات | تسريب محتمل للأسماء/العناوين لأي مستخدم | Search.tsx L4, L14–16 (فحص: قوائم `projects/documents/...` خام) |
| G8 | لا KPI مالي على لوحة الرئيسية | اللوحة تغطي طلبات المواد فقط | Home.tsx |
| G9 | حذف المشروع غير موصل (http) | إدارة دورة حياة كاملة غير مكتملة | `http/api.ts` L165 |
| G10 | sites CRUD = mock addSite فقط | إدارة مواقع حقيقية مفقودة | ProjectWorkspace (P13) |
| G11 | لا تصدير من شاشة المستخدمين | — | Admin (U9) |
| G12 | restore النسخ الاحتياطي mock | مسار إنتاج غير معرّف | Settings.tsx |
| G13 | reset password mock | مسار إنتاج غير معرّف | Admin (U7) |
| G14 | قسم/منصب/إيميل المستخدم امتداد mock-only | قد لا يقابل نموذج backend | Admin (U1) → قرار مالك §11-O1 |

### 8.3 جزئي (PARTIALLY IMPLEMENTED)

- كل namespace غير Projects في http mode (§7.2) — يعمل fixture فقط.
- ZIP الدفعي، استيراد CSV (قواعد prototype)، addSite، إشعارات، إعدادات النسخ، reset password، user dept/title.

---

## 9. التبعيات العابرة للموديولات

| التبعية | الاتجاه | التفصيل | التصنيف |
|---|---|---|---|
| الأرشيف ↔ المشاريع | Archive → Projects | منتقي مشروع مُسند بالعضوية + فحص عضوية قبل الفلاتر (A2، A9) + deep-link `?project=` | `CONFIRMED` |
| المالية ↔ المشاريع | Financials → Projects/BOQ/IPC | كل المؤشرات مشتقة من بيانات المشاريع | `CONFIRMED` |
| BOQ/IPC ↔ المخزن | IPC → (لا علاقة مباشرة) | لا ارتباط بيانات بين المستخلصات وطلبات المواد — **منفصلان كليًا في النموذج** | `CONFIRMED` |
| Home ↔ المخزن/الطلبات | Home → Inventory | طوابير needsReview تربط `/inventory/requests` و`/inventory/stock` — **خارج نطاقنا**، لكن تصميم الـ Home يعتمد على وجود هذه المسارات | `CONFIRMED` (تبعية) |
| التدقيق ↔ التقارير | Audit → Reports | تصدير السجل عبر `reportApi.export` + `reports.view` | `CONFIRMED` |
| البحث ↔ الكل | Search → كل الموديولات | صفحة بحث عالمية (بلا نطاق صلاحيات — G7) | `CONFIRMED` + `OWNER DECISION REQUIRED` |
| الإشعارات ↔ الطلبات/المخزن | Notifications → Inventory | 4 أنواع mock من نفس البيانات | `PARTIALLY IMPLEMENTED` |
| الإعدادات ↔ النظام | Settings → Backups/Imports | سجل الاستيراد يظهر مستندات الأرشيف المستوردة | `PARTIALLY IMPLEMENTED` |
| name caches ↔ الكل | projName/whName/itemName | بذرة من ردود المشاريع في http mode (L126)؛ لاحظ: بذرة whName/itemName غير موجودة في http → تُعرض IDs خام (`http/api.ts` L168–170 "honest placeholder") | `CONFIRMED` |

---

## 10. الأمان والتدقيق (من منظور الواجهة)

| # | المبدأ المستخلص | التصنيف | الأدلة |
|---|---|---|---|
| S1 | Guard في الواجهة **حماية UX فقط** — التخويل الحقيقي backend لكل طلب | `CONFIRMED` | `router.tsx` L24–27 + `http/api.ts` L12–13 |
| S2 | النطاق (scoping) يُفرض server-side دائمًا؛ العميل لا يزيّف | `CONFIRMED` | `http/api.ts` L12–13، L172–178 |
| S3 | إخفاء-الوجود: مشروع ممنوع = نفس حالة "غير موجود" | `CONFIRMED` | ProjectWorkspace (P11) |
| S4 | الأرشيف: فحص عضوية قبل الفلاتر → إنكار صلب (لا قائمة فارغة كاذبة) | `CONFIRMED` | Archive (A2) |
| S5 | DENY يغلب GRANT في تجاوزات الصلاحيات | `CONFIRMED` | Admin (U3) |
| S6 | حماية آخر مدير + منع حذف الذات | `CONFIRMED` | Admin (U5، U6) |
| S7 | سجل التدقيق: قراءة-فقط، diff كامل (field/from/to)، بلا حقل مشروع | `CONFIRMED` | Audit (X1–X5) |
| S8 | التصدير محكوم بصلاحية ونطاق — "يشمل نطاق صلاحياتك فقط" | `CONFIRMED` | i18n `en.ts` L119؛ Audit X4 |
| S9 | كل كتابة prototype توست demo-only — لا قيمة صامتة | `CONFIRMED` | toasts "(تجريبي)" في كل الشاشات |
| S10 | لا fallback صامت في http mode: فشل صريح "not wired" | `CONFIRMED` | `http/api.ts` L17–20, L32–42 |
| S11 | بيانات اصطناعية معلنة صراحة ("SYNTHETIC prototype data… nothing here is a company record") | `CONFIRMED` | `data.ts` L1–2 |
| S12 | متطلبات أمنية جديدة من الواجهة الجديدة: تسجيل تدقيق لكل عملية كتابة (مستندات/BOQ/IPC/مستخدمون)، وسياسة للاستيراد الجماعي (حد صفوف/كشف تكرار) | `INFERRED` | ضرورة خلفية لتغطية X1–X3 وW-A8 |

---

## 11. قرارات المالك المطلوبة (OWNER DECISIONS)

| # | القرار | الخلفية | الخيارات |
|---|---|---|---|
| O1 | حقول المستخدم: قسم + منصب (+ إيميل) | موجودة في UI (mock-only) وغير موجودة في نموذج backend المدقق | (أ) إضافتها للنموذج والـ API (ب) إسقاطها من UI |
| O2 | `contractValue`: إدخال مباشر مقابل احتساب من BOQ | الواجهة: إدخال مباشر raw، والقاعدة `cvClearUnsupported` تحريرًا | (أ) إبقاء المباشر (ب) مشتقة (ج) مزيج مع قاعدة صراع |
| O3 | قواعد انتقال حالة المستند (7 حالات) | الواجهة حالياً انتقال حر مع تأكيد من خطوتين | مصفوفة انتقال مسموحة (من→إلى) + من قيم مسموح لها بالتغيير |
| O4 | ضوابط دورة حياة IPC (submitted→approved/rejected) | الواجهة تغيير يدوي + draft-only delete | (أ) دورة موافقة بأدوار (ب) إبقاء اليدوي (ج) قواعد مالك أخرى |
| O5 | مصدر بيانات الصرف/الدفعات (disbursements) | `remainingDisbursement` غير متاح دائمًا (G1) | (أ) وحدة صرف جديدة (ب) تأجيل والبقاء على "غير متاح" |
| O6 | الضريبة/الاستقطاع التعاقدي/الدفعات المقدمة | G2 | إضافة حقول للمستخلص أو العقد أو تأجيل |
| O7 | KPI مالي على لوحة الرئيسية | G8 | (أ) إضافة بطاقات مالية (ب) إبقاء اللوحة تشغيلية فقط |
| O8 | تدقيق بمنظور المشروع | `AuditLog` بلا حقل مشروع (G5) | (أ) إضافة projectId للسجل (ب) البقاء عامًا |
| O9 | نطاق صلاحيات صفحة البحث العالمية | G7 — تعمل على بيانات خام بلا نطاق | (أ) نطاق بالصلاحيات (ب) استبعاد من الإنتاج (ج) بحث خلفي مُسند |
| O10 | مسار إنتاج لإعادة تعيين كلمة المرور + استرجاع النسخ الاحتياطي | G12/G13 mock | تعريف مسار إنتاج لكل منهما |
| O11 | قواعد استيراد CSV (تكرار على `number` = قاعدة prototype، حد 200 صف) | W-A8 | (أ) اعتماد كما هي (ب) قواعد مالك (مفتاح تكرار آخر/حجم أكبر) |
| O12 | سياسة حذف المشروع (والأثر على الأرشيف/BOQ/IPC) | G9 — غير موصل | تعريف DELETE + سياسة retain/archive للأبناء |
| O13 | توزيع ROLE_BASE الدقيق | يجب اعتماده كما هو (§6.2) | اعتماد/تعديل |

---

## 11-أ. Owner Decisions — Phase 14A (السجل المعتمد)

> **تحديث 2026-11-17:** جميع قرارات المالك الثلاثة عشر (O1–O13) **معتمدة**. قسم §11 أعلاه (جدول الخيارات) هو السجل التاريخي قبل الاعتماد؛ **السجل الرسمي الكامل** — بنصوص القرارات حرفيًا، والتصنيف (معتمدة / معتمدة-مؤجلة / مسندة لتصميم 14B)، ومصفوفة التبعيات، وأسئلة التصميم المتبقية، وتقييم الجاهزية — في الوثيقة المرافقة:
> **`docs/frontend-rebuild/phase-14/phase-14a-owner-decisions.md`**

| # | القرار | الحالة | التأثير المختصر |
|---|---|---|---|
| O1 | قسم + منصب المستخدم | ✅ APPROVED | يُضافان للنموذج والعقود؛ لا حقل إيميل مكرر (يغلق G14) |
| O2 | قيمة العقد إدخال مستقل | ✅ APPROVED | لا احتساب من BOQ ولا اشتقاق؛ undefined عند غياب الإدخال — لا أصفار مُصطنعة |
| O3 | سير حالة المستند مُتحكَّم به | ✅ APPROVED | انتقالات معرفة + صلاحيات + تحقق؛ التفاصيل (الحالات/المصفوفة/الأدوار) في 14B (يغلق G3) |
| O4 | سير موافقات IPC رسمي | ✅ APPROVED | تقديم/مراجعة/اعتماد/رفض/إعادة تقديم + قابلية تدقيق؛ التفاصيل في 14B؛ لا تحرير حر للحالة (يغلق G4) |
| O5 | الصرف/الدفعات | ✅ APPROVED — **DEFERRED** | مؤجلة؛ الواجهة تعرض "غير متاح" ولا تُصنع قيم (يحسم G1) |
| O6 | الضريبة/الاستقطاع/المقدمات | ✅ APPROVED — **DEFERRED** | مؤجلة؛ لا نسب/صيغ/قيم مُخترعة (يحسم G2) |
| O7 | اللوحة تشغيلية فقط | ✅ APPROVED | معلومات تشغيلية مدعومة فقط؛ لا KPI مالي ولا أرقام مُصطنعة (يحسم G8) |
| O8 | projectId اختياري بالتدقيق | ✅ APPROVED | أحداث المشروع تُربط، والأحداث العامة تبقى مدعومة؛ لا إجبار؛ السجل التاريخي يبقى ذا معنى (يغلق G5) |
| O9 | بحث خلفي مُسند بالصلاحيات | ✅ APPROVED | احترام الصلاحيات + نطاق المشاريع؛ لا تسريب عبر العناوين/المقتطفات/الأعداد/البيانات الوصفية/المعاينة؛ الفلترة العميلية وحدها غير كافية (يغلق G7) |
| O10 | reset password + backup/restore | ✅ APPROVED | **تصميم** المسارين في 14B (لا تنفيذ؛ لا تنفيذ نسخ/استرجاع؛ لا تغيير إعدادات الإنتاج) (يغلق G12/G13) |
| O11 | استيراد CSV: 200 صف + قاعدة التكرار الحالية | ✅ APPROVED | اعتماد مؤقت للقاعدة الواجهة-الموثقة (`number` كمفتاح، ≤200 صف)؛ توثيق دقيق؛ لا استبدال صامت؛ مطابقة مصدر الخلفية مطلوبة في 14B |
| O12 | حذف المشروع = حذف منطقي | ✅ APPROVED | soft delete: حفظ التابعين (أرشيف/مالية/تدقيق)، استبعاد من القوائم النشطة، تعريف وصول المؤرشفة، لا hard-delete (يغلق G9) |
| O13 | ROLE_BASE كما هو | ✅ APPROVED | اعتماد حرفي + طبقات الاحتساب الثلاث + أولوية DENY؛ لا تبسيط دون قرار منفصل |

**قرارات مؤجلة (Deferred):** O5، O6 فقط — بنية "غير متاح" الحالية تظل السلوك المعتمد.
**تفاصيل مسندة لتصميم Phase 14B:** O3 (مصفوفة الانتقال/الأدوار)، O4 (المراحل/الأدوار/قواعد الانتقال)، O10 (المساران الإنتاجيان) — بلا موافقة مالك إضافية من Phase 14A، وفي حدود نصوص القرارات.
**الأسئلة المتبقية لـ 14B** (كلها ضمن حدود القرارات): مصفوفة الانتقالات O3؛ مراحل/أدوار موافقات IPC O4؛ تدفق reset ومعمارية النسخ O10؛ ربط/عرض projectId التاريخي O8؛ عقد البحث الخلفي O9؛ الحقل التقني للحذف المنطقي O12؛ قيود department/title O1؛ مطابقة مصدر قاعدة الكشف O11؛ صياغة رسائل "غير متاح" O2/O5/O6.

---

## 12. الأولويات (إطار product-manager — تقييم خفيف)

> استخدمنا مهارة `product-manager` (مثبتة ومحمّلة) بمستوى خفيف: تصنيف الأولويات P0/P1/P2 على أساس (أثر المستخدم × خطر الأمان/البيانات × جهد بناء العقود). لا استخدمنا مصفوفاتها الكاملة.

### P0 — يجب حسمها قبل تصميم عقود API
1. قرارات المالك O1–O4، O6، O9 (تؤثر مباشرة على مخططات البيانات والعقود).
2. نموذج الصلاحيات (§6): اعتماد ROLE_BASE + طبقات effective كما هي — أساس كل نطاق.
3. مصدر الحقيقة للبيانات المالية المشتقة (BOQ/IPC) وقواعد cap/allowance.

### P1 — الموديولات حسب ترتيب التوصيل المقترح
1. **Projects (مكمل):** DELETE + الفلترة server-side (القائمة قد تتجاوز 1000 عند الحجم — `pageSize=1000` حل مؤقت، `http/api.ts` L124).
2. **Archive:** نقاط نهاية CRUD + revisions + حالة (بعد O3) + استيراد (بعد O11) + تصدير.
3. **Finance:** بعد G1/O5/O6 — إما وحدة صرف أو تأجيل موثق.
4. **Administration:** CRUD مستخدمين + تجاوزات + وصول مشاريع + reset password (بعد O10).
5. **Audit:** GET بفلاتر + diff (بعد O8) + تصدير.

### P2 — لاحقًا
- إشعارات حقيقية (G6)، بحث مُسند (بعد O9)، KPI لوحة (بعد O7)، sites CRUD (G10)، تصدير المستخدمين (G11).

### تسلسل القاعدة العامة
UI (منتهي prototype) → **Features (هذه الخريطة)** → Business Rules (قرارات المالك) → Data Model → API Contracts → DB → Backend → Integration.

---

## 13. مراجع الأدلة (Evidence Index)

| الملف (نسبي إلى `docs/frontend-rebuild/phase-13/app/src/`) | الأسطر | ما يثبته |
|---|---|---|
| `app/router.tsx` | L24–38 | Guard UX-only، عدم رندر قبل الجلسة، إخفاء-الوجود |
| `app/router.tsx` | L47–80 | شجرة المسارات + صلاحيات كل مسار |
| `app/layouts/AppShell.tsx` | L15–27 | NAV + مجموعات + إخفاء بلا صلاحية |
| `app/layouts/AppShell.tsx` | L29–64 | الشل: prefs محلية (cos-proto-*)، drawer، tooltips |
| `app/layouts/CommandPalette.tsx` | L15–66 | palette: تنقل/ثيم/لغة/خروج + لوحة مفاتيح + ARIA |
| `features/dashboard/components/Home.tsx` | L1–218 (كامل) | H1–H10 (طوابير، بطاقات محكومة، أحدث) |
| `features/projects/components/Projects.tsx` | L1–350 (كامل؛ L10–15 ثوابت) | P1–P10 (قائمة/نموذج/حالات/أدوار/فراغ) |
| `features/projects/components/ProjectWorkspace.tsx` | L1–655 (كامل) | P11–P15 + W-B/W-I (BOQ/IPC) |
| `features/projects/components/Financials.tsx` | L13–19، L1–134 | F1–F4 (مؤشرات مشتقة + "غير متاح") |
| `features/archive/components/Archive.tsx` | L1–827 (كامل؛ L12–17 ثوابت) | A1–A15 (كل مسارات الأرشيف) |
| `features/administration/components/Admin.tsx` | L1–412 (كامل؛ L10–15 ثوابت) | U1–U9 |
| `features/administration/components/Audit.tsx` | L10–17 | X1–X6 (فلاتر، بلا مشروع، تصدير) |
| `features/reports/components/Reports.tsx` | L1–124 | تصدير بالأعداد الفعلية من نطاق الصلاحيات |
| `app/pages/Search.tsx` | L4, L10–16 | G7 (بحث خام بلا نطاق) |
| `app/pages/Notifications.tsx` | L1–33 | G6 (إشعارات session/mock) |
| `app/pages/Settings.tsx` | L1–79 | الإعدادات (backups/imports/مظهر/حساب) |
| `services/api/adapters/mock/data.ts` | L1–28 | نموذج Project مطابق للـ schema المدقق + contractValue |
| `services/api/adapters/mock/data.ts` | L300–306 | ROLE_BASE + الأدوار الخمسة |
| `services/api/adapters/mock/data.ts` | L1–328 (كامل) | كل الكيانات + MANAGED_GROUPS (8) + بذور |
| `services/api/adapters/http/api.ts` | L5–20, L32–42 | wired vs not-wired + لا fallback صامت |
| `services/api/adapters/http/api.ts` | L119–158 | GET/POST/PUT /api/projects (نطاق server-side) |
| `services/api/adapters/http/api.ts` | L160–178 | not-wired stubs + canProject (scoping server-side) |
| `services/api/adapters/http/api.ts` | L181, L219–225 | boqTotal + Proxy full-surface |
| `i18n/locales/ar.ts` | L82–125, L284, L312–316 | مفاتيح الميزات (BOQ/IPC/تقارير/تصدير/فجوات) — عربي |
| `i18n/locales/en.ts` | L113–125, L284, L312–314 | نفس المفاتيح — إنجليزي (تأكيد الاتساق) |
| `i18n/direction.ts` | L5–11 | ثنائية اللغة + RTL/LTR + مفتاح التخزين |

### ملاحظة الأمانة حول المهارات
- المهارة المستخدمة: `product-manager` (مثبتة عالميًا ومحمّلة) — استخدام خفيف لإطار الأولويات فقط (§12). لا مهارات أخرى استُدعيت.
- لم يُستخدم أي مصدر غير شيفرة Phase 13 في هذا التقرير؛ لا توجد "ميزات مخترَعة" — كل MISSING/GAP موثق من غيابه في الشيفرة نفسها.

### حدود هذا التقرير
- لا يحوي تصميم عقود API نهائية (§7.4 مدخلات فقط) — حسب النطاق المعتمد.
- لا تغييرات شيفرة؛ الملفات المرجعية قُرئت فقط. أي تعديل لاحق يحتاج موافقة مالك.
- المخزن/الطلبات خارج النطاق: ذُكرت فقط في §9 كتبعيات يجب أخذها بالحسبان عند بناء موديولات الستة (مسارات الـ Home وصفحة البحث والإشعارات).
- ملفات `apps/api/src/**` (18 ملفًا بوسوم تعارض دمج سابقة) **لم تُقرأ ولم تُلمس** — خارجة عن النطاق.

---

## 14. تقييم جاهزية Phase 14B (Readiness)

- ✅ **قرارات Phase 14A مكتملة:** 13/13 معتمدة (O5/O6 معتمدتان كمؤجلتين) — السجل الرسمي في `phase-14a-owner-decisions.md` §6.
- ✅ **مصدر الحقيقة ثابت:** هذا التقرير (النتائج التاريخية) + السجل المعتمد (القرارات).
- ✅ **نطاق 14B:** الموديولات الستة فقط — حزمة التصميم: Business Rules، Target Data Model، API Contracts، Frontend Integration Mapping.
- ⚠️ **قيود معلنة:** O11 يطلب مطابقة مصدر خلفية لاحقًا؛ O10 تصميم دون تنفيذ؛ O5/O6 مؤجلة حتى طلب المالك.
- **الحكم:** يمكن البدء بتصميم Phase 14B **بعد مراجعة المالك للسجل المعتمد**.

---

**توقف هنا (STOP):** خريطة Phase 14A مكتملة بقراراتها الـ 13 المعتمدة (سجل رسمي: `phase-14a-owner-decisions.md`). لا تنفيذ — لا شيفرة، لا قواعد بيانات، لا migrations، لا تشغيل خدمات — قبل مراجعة المالك للسجل المعتمد؛ بعدها يبدأ **تصميم** Phase 14B (لا تنفيذ) ضمن الموديولات الستة.


