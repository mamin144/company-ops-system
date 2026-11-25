# Phase 14B — الوثيقة 04: خريطة تكامل الواجهة (Frontend Integration Map)

> **الهدف:** ربط كل صفحة/مكوّن من الموديولات الستة (Phase 13) بالقدرة الخلفية المطلوبة، وتعريف حالات العرض الخمس (loading/empty/error/forbidden/unavailable)، والكشف الصريح عن الفجوة بين الوضع الحالي (fixture) والهدف (تكامل إنتاجي).
> **الإقرار الصادق:** اختبارات fixture-mode **لا تثبت** تكاملاً إنتاجيًا. في `http/api.ts` [Verified] ما يعمل فعليًا: الجلسة ×4 + `GET/POST /api/projects` + `PUT /api/projects/:id`؛ كل ما عدا ذلك Proxy "not wired" يفشل صراحةً (لا fallback صامت).
> **مفتاح الحالة المصدرية لكل صفحة:** `[Fixture]` = تعمل على بيانات وهمية اليوم · `[Wired]` = متصلة فعليًا.

---

## 1. مصفوفة الحالات الموحدة (تُطبَّق على كل شاشة)

| الحالة | التعريف | العرض |
|---|---|---|
| loading | جلب جاري | skeleton/spinner |
| empty | نجاح بلا نتائج | رسالة فارغة + CTA إن وجد |
| error | فشل شبكة/خادم | رسالة + إعادة محاولة؛ تفصيل code |
| forbidden | 403 / صلاحية غائبة | "ليس لديك صلاحية" + لا محاولة ثانية |
| unavailable | حالة غير متاح الموحدة (`unavailable:true` + reason) | "غير متاح" + سبب (O2/O5/O6) — **لا تُخطأ كـ error** |

**قاعدة فصل [Proposed]:** الواجهة تميّز forbidden عن unavailable عن error — لا دمجها في رسالة عامة (متطلب قبول للتكامل).

---

## 2. Home / Dashboard (`/`)

| البند | الحالي | الهدف |
|---|---|---|
| المصدر | `[Fixture]` ملخص من mock | `[Proposed]` `GET /api/dashboard/summary` (03 §10) |
| الأقسام | بطاقات مشاريع/مستندات + أنشطة | نفس الأقسام تشغيلية فقط [O7]؛ لا قسم مالي |
| loading | skeleton | نفسه |
| empty | "لا بيانات" | "لا أقسام متاحة لصلاحياتك" عند صلاحيات معدومة |
| forbidden | أقسام مخفية بالصلاحية [Wired سلوك] | القسم الذي لا صلاحية له **لا يُعاد أصلاً** من الخادم — يخفى |
| unavailable | — | لا ينطبق (لا مالي في اللوحة) |
| الفجوة | ملخص ثابت وهمي | نقطة تجميع حقيقية مقيدة بالنطاق [Proposed] |

## 3. Projects — القائمة (`/projects`)

| البند | الحالي | الهدف |
|---|---|---|
| المصدر | `[Wired]` GET /api/projects?page=1&pageSize=1000 [Verified] | `[Adapt]` ترقيم حقيقي + فلاتر (q/status/sort) — إزالة hack الـ1000 |
| إنشاء | `[Wired]` POST /api/projects [Verified] | نفسه + تحقق الحقول (projectCode فريد 409) |
| تحرير/حالة | `[Wired]` PUT /api/projects/:id [Verified] | + قفل تفاؤلي (CONFLICT) |
| الحذف | `[Fixture]` حذف من القائمة mock | `[Proposed]` DELETE منطقي (O12) + تأكيد يحذر من التابعين المفتوحين |
| المشروع المحذوف | غير موجود | صفوف بلا بوابة المحذوف لا تظهر؛ `includeDeleted` لـ projects.delete [Proposed] |
| loading/empty/error | موجودة | نفسه + حالة "مشاريع محذوفة" منفصلة |
| الفجوة | حذف غير موصول (G9)، حالة lifecycle حرة | دورة حياة مقيدة + soft delete |

## 4. Projects — مساحة المشروع (`/projects/:id/...`)

| البند | الحالي | الهدف |
|---|---|---|
| تفصيل المشروع | `[Fixture]` | `[Proposed]` GET /api/projects/:id |
| المواقع | `[Fixture]` | `[Proposed]` sites CRUD ضمن المشروع |
| **BOQ** (تبويب financials) | `[Fixture]` محرر كامل | `[Proposed]` GET/POST/PUT/DELETE boq (03 §4.7) — حفظ دفعة بمعاملة |
| **IPC** | `[Fixture]` تغيير حالة يدوي | `[Proposed]` CRUD + submit/start-review/approve/reject/resubmit (03 §6.3) + عرض status-events |
| فصل المهام IPC | غير موجود | منع ذاتي-اعتماد؛ رسالة 403 SELF_APPROVAL_DENIED [O4] |
| contractValue | إدخال مباشر + cvClearUnsupported [Wired سلوك] | [Confirmed O2] نفس السلوك — لا اشتقاق من BOQ؛ undefined يُعرض "غير متاح NOT_ENTERED" |
| بطاقة المالية | "غير متاح" للصرف/الضريبة/الاستقطاع | نفس العرض عبر `unavailable` + reason (03 §6.1) — O5/O6 |
| loading/empty/error | جزئي | موحد عبر الحالات الخمس |
| الفجوة | دورة IPC وهمية (G4)، مالي mock | دورة موافقات حقيقية + unavailable صريح |

## 5. Archive (`/archive`)

| البند | الحالي | الهدف |
|---|---|---|
| القائمة/البحث/التصفية | `[Fixture]` | `[Proposed]` GET /api/documents (ListQuery + projectId/status/category/folder) |
| رفع/مراجعات | `[Fixture]` | `[Proposed]` POST documents + revisions |
| **تغيير الحالة** | `[Fixture]` انتقال حر مع تأكيد من خطوتين | `[Proposed]` POST /status بمصفوفة O3 (01 §4.3) — INVALID_TRANSITION عند مخالفة |
| تنزيل | `[Fixture]` | `[Proposed]` GET download (archive.download) |
| مجلدات | `[Fixture]` | `[Proposed]` folders CRUD (409 FOLDER_NOT_EMPTY) |
| **استيراد CSV** | `[Fixture]` معالج 4 خطوات، ≤200 صف، تكرار على `number` [Verified من Archive.tsx] | `[Proposed]` POST /api/documents/import (03 §5.5) — **[Unknown] مطابقة مفتاح كشف التكرار في الخلفية — مراجعة مصدر مطلوبة قبل التثبيت (O11)** |
| forbidden | إخفاء أزرار بالصلاحية | نفسه + رفض خلفي مطابق |
| الفجوة | كل الأرشيف mock (G3: انتقال حر) | دورة حالة مُتحكَّمة + استيراد بعقد مُثبت |

## 6. Finance (`/financials`)

| البند | الحالي | الهدف |
|---|---|---|
| مصدر البيانات | `[Fixture]` أرقام من mock | `[Proposed]` GET /api/projects/:id/financials (03 §6.1) |
| قيمة العقد | إدخال مستقل | [Confirmed O2] من Project.contractValue |
| المنفّذ المعتمد | يدوي/مشتق محليًا | Σ approved IPC **بعد** الدورة [O4] — لا حالة يدوية |
| صرف/ضريبة/استقطاع/مقدمات | "غير متاح" ثابت | نفس العرض الصريح عبر unavailable+reason [O5/O6] — لن تُملأ حتى قرار مالك |
| لا إجمالي مُصطنَع | ملتزم | ملتزم [O7] |
| الفجوة | mock كامل | عقد واحد لكل مشروع |

## 7. Administration (`/admin`)

| البند | الحالي | الهدف |
|---|---|---|
| المستخدمون | `[Fixture]` mockUsers (بها dept/title/email نموذجية) | `[Proposed]` users CRUD (03 §7) — O1: department/title **الجديدان**؛ email حقل هوية **قائم** (يُعرض كما هو، لا إضافة جديدة) |
| الأدوار | `[Fixture]` عرض + توزيع MANAGED_GROUPS | `[Proposed]` GET /api/roles؛ إنشاء أدوار مخصصة يحتاج `roles.manage` (prototype-only — يُعلَّم) |
| **التجاوزات** | `[Fixture]` GRANT/DENY وصول | `[Proposed]` PUT overrides + effective-permissions (تشخيص) — O13 |
| وصول المشاريع | `[Fixture]` NONE/READ/WRITE/DELETE | `[Proposed]` PUT project-access — O13 |
| إعادة تعيين كلمة مرور | `[Fixture]` زر reset (mock) | `[Proposed]` POST admin/users/:id/reset-password + مسار ذاتي (auth/password-reset) — O10؛ **الإداري لا يرى كلمة المرور** |
| تبويب النسخ الاحتياطي | `[Fixture]` قائمة/أزرار mock | `[Proposed]` backups list/create/verify/restore-2-step (03 §11) — **تصميم فقط؛ لا تنفيذ في 14B (O10)** |
| فجوة النطاق | users.resetPassword/roles.manage/projects.access غير موجودة في ROLE_BASE [Confirmed] | تُعلَّم "prototype-only — تحتاج قرار خلفي" في 05 |

## 8. Audit (`/audit`)

| البند | الحالي | الهدف |
|---|---|---|
| المصدر | `[Fixture]` سجل mock | `[Proposed]` GET /api/audit (03 §8) |
| الفلاتر | بحث + كيان + مستخدم + تاريخ | نفسها + `projectId?` و`hasProject` (O8) |
| الرؤية | كامل mock لكل حامل audit.view | + قيد: فلتر مشروع محدد يتطلب READ على المشروع [Proposed]؛ ip/newValue الكاملة لـ admin فقط |
| مشروع محذوف في السجل | — | يظهر بعلامة "محذوف" دون رابط ميت [Proposed] |
| الفجوة | mock (G5: بلا projectId) | عمود اختياري + فلاتر مطابقة |

## 9. البحث العالمي (CommandPalette/topbar)

| البند | الحالي | الهدف |
|---|---|---|
| المصدر | `[Fixture]` بحث محلي في mock (client-side) | `[Proposed]` GET /api/search (03 §9) — **فلترة العميل وحدها غير كافية [O9]** |
| السرية | قد يعرض عناوين غير مصرح (mock عام) | لا تسريب عبر عناوين/مقتطفات/عدّادات [O9] — الاختبار: مستخدم بلا وصول لا يرى أثرًا للسجل |
| الفجوة | بحث عميل (G7) | بحث خلفي مُسند |

## 10. الإشعارات (Drawer — تبعية دعم)

| البند | الحالي | الهدف |
|---|---|---|
| المصدر | `[Fixture]` | `[Proposed]` قائمة إشعارات (AppNotification [Confirmed بنية]) — قراءة/تعليم مقروء |
| النطاق | ليست موديولًا مستقلًا | تبعية دعم لـ Dashboard/Archive فقط |

## 11. ملخص الفجوات (Gaps) vs Phase 13

| # | الفجوة | الشدة | المرجع |
|---|---|---|---|
| FG-1 | 3 نقاط مشاريع فقط موصولة؛ الباقي Proxy-not-wired | عالية | 03 §13 |
| FG-2 | كل الأرشيف/IPC/المالي/الإدارة/التدقيق/الإشعارات fixture | عالية | §5–8 |
| FG-3 | انتقالات حالة حرة (مستندات + IPC) | عالية | O3/O4 |
| FG-4 | بحث عميل غير مُسند | عالية | O9 |
| FG-5 | حذف مشروع غير موصول + لا soft delete | متوسطة | O12 |
| FG-6 | لا projectId في التدقيق | متوسطة | O8 |
| FG-7 | مصادقة تعمل لكن إدارة المستخدمين/الأدوار mock | متوسطة | §7 |
| FG-8 | لا reset/backup حقيقيان | عالية (أمان) | O10 |
| FG-9 | hack pageSize=1000 | منخفضة (تكييف) | §3 |
| FG-10 | مفاتيح prototype-only بلا أساس خلفي | متوسطة | 05 §3 |

## 12. أولوية التكامل (Integration Priority)

1. **P0:** auth (موجود) + GET/POST/PUT projects (تكييف) + dashboard/summary — أساس قابل للإثبات.
2. **P1:** documents (CRUD+status) + audit query + IPC CRUD/دورة (مع المفتاحين المقترحين) + search خلفي.
3. **P2:** users/overrides/access + import CSV + financials endpoint.
4. **P3:** backups/restore + password reset ذاتي (بعد حسم قناة التسليم [Unknown]).

## 13. قاعدة إثبات التكامل [Proposed — معيار قبول]
لكل صفحة: يُعد التكامل "منتجًا" فقط عندما (1) الـ endpoint خلفي حقيقي مُثبت، (2) الحالات الخمس مغطاة، (3) الاختبار على بيانات حقيقية غير fixture، (4) fixture-mode معطل. وجود مسار fixture يبقى مفيدًا للتطوير لكنه **يُعلَّم صراحةً في الواجهة** ("وضع تجريبي") لا يختلط بالإنتاج.
