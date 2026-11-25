# Phase 9 — مصفوفة التكافؤ (Parity Matrix)

**التاريخ:** 2026-10-26
**النطاق:** CR-01 (توحيد النماذج) + CR-02 (الإجماليات المباشرة) + CR-03 (الموقف المالي) على بناء الواجهة الحالي (mock adapter) — الخيار A.
**قاعدة التعبئة:** كل عمود من الكود الفعلي المقروء كاملاً؛ الأعمدة بلا مصدر تُعلَّم `—` ولا تُحشى.

## 1. Project

| Route | Module | Role/Permission | Current Component | Current API/Adapter | Fields | Validation | Success/Cancel/Side Effects | Existing Test | Planned Change | Acceptance Test | Result |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `/projects` | Projects list | view: membership-scope عبر `mrApi.projects(actor)`؛ زر إنشاء `projects.create`؛ تعديل `projects.edit`؛ حذف `projects.delete` | `Projects` (`features/projects/components/Projects.tsx`) | `mrApi.projects` (قراءة)؛ الإنشاء/التعديل/الحذف محلي في المصفوفة الواجهية (mock note) | narrowing: code+name+client؛ create: name فقط؛ edit: name/client/status | create/edit: required name+client(للتعديل)؛ حارس `createBusy` ref للنقر المزدوج | save: toast + تحديث/إدخال صف؛ cancel: إغلاق مودال؛ delete: ConfirmDialog | `phase4.spec.ts`, `coverage.spec.ts` | **CR-01:** لا تغيير وظيفي؛ توحيد الوسوم/errors على النظام المشترك. **CR-02:** إدخال `contractValue` (رقم ≥ 0 اختياري) في المودال **تعديل فقط** | المراجعة الحية: تعديل قيمة → عرضها في بطاقات الموقف المالي؛ AR/EN | pending |
| `/projects/:id` | Project workspace tabs | `mockApi.project(id, actor)` — `projects.view` per-membership | `ProjectWorkspace` + `ProjOverview/Sites/Warehouses/Stock` | `mockApi.project`, `mockApi.sites`, عدّادات عبر `mrApi`/`stockApi` | — | حالة missing/error/loading متميزة | — | `phase5.spec.ts` | لا تغيير (خارج CR الثلاثة) | — | pending |
| `/projects/:id/financials` (tab) | BOQ + IPC | `canEdit = projects.edit ∥ projects.create` (write) / `projects.view` (read) | `ProjFinancials` + `BoqPanel/BoqForm/IpcPanel/IpcForm` | `boqApi.*`, `ipcApi.*` (mock) — قواعد مصغّرة من `apps/api/modules/projects/{boq,ipc}.routes.ts` | BOQ: itemCode/description/unit/quantity/unitPrice؛ IPC: ipcNumber/date/status/notes/deductions/grossAmount/lines | zod-equivalent: min1 strings، ≥0 أرقام، رقم IPC فريد 409، بيع البنود من نفس المشروع، كمية تراكمية ≤ BOQ، net = بنود ∃؟ Σ qty×price : max(0, gross−ded) | save/delete/toast؛ blockIpc (المسودة فقط)؛ blockBoqItem (بنود مُستخلص) 409 | `financials.spec.ts`, `phase5.spec.ts` | **CR-03:** عرض `contractValue` الحقيقي في بطاقة القيمة بدل `notAvailable` الثابتة. لا تعديل نماذج أدخلها كذلك من قبل | لقطة مقارنة + tsc | pending |
| `/financials` | Financial position (شامل) | `mrApi.projects(actor)` — المشاريع الظاهرة فقط | `Financials` (`features/projects/components/Financials.tsx`) | `ipcApi.summary`, `ipcApi.list`, `boqApi.list`, `mrApi.projects` | boqTotal / executed / deductions / contractValue | boqCount=0→notAvailable؛ approvedCount=0→notAvailable | — | `financials.spec.ts` | **CR-03:** بطاقة contractValue من `p.contractValue ?? notAvailable`؛ القاموس: صفر مصدري ≠ بلا مصدر | المراجعة الحية AR/EN | pending |

## 2. Administration

| Route | Module | Role/Permission | Current Component | Current API/Adapter | Fields | Validation | Success/Cancel/Side Effects | Existing Test | Planned Change | Acceptance Test | Result |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `/admin` (users tab) | Users CRUD | `users.manage` (بوابة المسار في `router.tsx`) + حارس ذاتي | `Admin` (`features/administration/components/Admin.tsx`) — RecShell جداول | `mockApi` users CRUD | name/email/dept/title/role/active | `EMAIL_RE`؛ حارس ذاتي `selfDisableBlocked`؛ deny-of-self | modal + ConfirmDialog + toast | `admin.spec.ts`, `phase4.spec.ts` | **CR-01:** مراجعة توحيد الحقول/الأخطاء — لا وظيفي جديد | لقطة AR/EN | pending |
| `/admin` (roles tab) | Roles & permissions view | `users.manage` | نفس `Admin` | mockApi roles | عرض فقط (RoleInspectBody) | — | — | `admin.spec.ts` | **CR-01:** نفس التوحيد السلوكي | لقطة | pending |
| `/admin` (إدارة الوصول) | project access modal | `users.manage` | نفس `Admin` | `setAccess` mock | GRANT/DENY + سطح (DELETE/WRITE/READ) | لا وصول لأنفسه | modal/toast | `admin.spec.ts` | **CR-01:** منطق متسق | — | pending |
| `/admin/audit` | Audit log | `audit.view` (router) | `Audit` (`features/administration/components/Audit.tsx`) | `reportApi` (mock) | أقسام: q/user/action/entity/from/to | فترة مقارنة على ISO (`day()` slice) | تنزيل export عبر `downloadFile` | `phase8.spec.ts` | خارج CRs — إيقاف | — | pending |

## 3. Requests

| Route | Module | Role/Permission | Current Component | Current API/Adapter | Fields | Validation | Success/Cancel/Side Effects | Existing Test | Planned Change | Acceptance Test | Result |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `/inventory/requests` (`?projectId`) | MR lifecycle | خريطة `actionsFor` — draft→submit (creator)؛ submit→approve/reject؛ approve→issue؛ issue→close؛ delete للمسودة فقط | `Requests` (`features/requests/components/Requests.tsx`) | `mockApi` MR ops + `mrApi.list` | عرض صفوف MR وخطوطها؛ لا نموذج إدخال جديد من المستخدم (قرارات أزرار) | الصلاحيات يحرسها mock نفسه (مصفوفة الأدوار) | modal تفاصيل + ConfirmDialog + toast + إغلاق صفحة | `phase6.spec.ts`, `phase7-archive.spec.ts` | **CR-01:** توحيد أزرار الحالات مع المشترك. لا معقوليات جديدة | لقطة + أزرار تعطيل/تشغيل مرئي | pending |

## 4. Archive (الجزء من CR-01)

| Route | Module | Role/Permission | Current Component | Current API/Adapter | Fields | Validation | Success/Cancel/Side Effects | Existing Test | Planned Change | Acceptance Test | Result |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `/archive` | Documents | `archive.view/read/download/upload/edit/delete` (scoped عبر `canProject`) | Archive feature (المراحل 7) | `mockApi.documents`, رفع/تنزيل | رفع ملف + ميتاداتا (من المرجّع) | ملف مطلوب + حقول نصية | toast + refresh | `phase7-archive.spec.ts`, `exports.spec.ts` | **CR-01:** مراجعة توحيد نموذج الرفع | لقطة | pending |

## 5. Inventory (CR-01 العنف)

| Route | Module | Role/Permission | Current Component | Current API/Adapter | Fields | Validation | Success/Cancel/Side Effects | Existing Test | Planned Change | Acceptance Test | Result |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `/inventory/items` | Items | inventory scopes | Item modal (من المراجع) | `mockApi` items | item code/name/unit/… | required/unique | modal/toast | `phase6.spec.ts` | **CR-01:** توحيد شكل النموذج | لقطة | pending |
| `/inventory/warehouses` | Warehouses | — | Warehouse modal | `mockApi.warehouses` | code/name/type/location/status | نوع enum | modal/toast | `phase6.spec.ts` | **CR-01:** توحيد شكل النموذج | لقطة | pending |
| `/inventory/stock` | Stock movements | — | Movement modal (narrowed by project) | `stockApi` | type/qty/from/to/reference | num ≥ 0, from≠to | modal/toast | `phase6.spec.ts` | **CR-01:** توحيد شكل النموذج | لقطة | pending |

## 6. بطاقة الفجوات

لا `api-schema-gap-report.md` مطلوب: حقول `ContractValue` و `grossAmount` في العقد الخادم
مع بقية البابه المقابل في mock/UI. النقاط الحرجة أُفسردت في القاموس.

## 7. الأدلة التالية من هذه المصفوفة (أسبقية التنفيذ)

1. **CR-02** (أصغر نطاق): data.ts حقل + Projects.tsx حقل تعديل + بطاقتا contractValue في
   `ProjectWorkspace` و`Financials`.
2. **CR-03**: القاموس (كُتب مسبقاً) + stocking تنفيذ، اختبار المراجعة الحية بـ Chrome.
3. **CR-01**: استعراض جميع النماذج ولدو PYTHON وبقدر الاتفاق السلوكي المجاز مُقدم، بلا
   تغيير في الـ payloads؛ تسجيل الملاحظات في تقرير الحياة.

## 8. نتائج المراجعة الحية (تحديث ختامي — 2026-10-26، بعد توسعة الأدلة)

التنفيذ اكتمل على نموذج mock suite على :5203/dist-phase9 (الخيار A — لا عمليات
خادم حقيقية). أدلة التنفيذ النهائية:

| الصف | التحديث | دليل |
|---|---|---|
| `/projects` (CR-01 + CR-02) | verified | مودال التعديل: إدخال/حفظ/إعادة بذر/مسح عبر مسار SPA واحد (رحلة واحدة بلا إعادة بذر)؛ بنية `.field` موحدة (4 حقول) |
| `/projects/:id/financials` (CR-03) | verified | بطاقة contractValue تعرض 32,500,000 بعد الإدخال (تبويب «المقايسات»)؛ عند *ProjFinancials* الأبطال الخمسة \(§9.1\) عبر `computeIndicators()` + ملاحظة الفجوة |
| `/financials` (CR-03) | verified | برج النيل: قيمة 32,500,000، منفّذ 4,614,000 (المعتمد فقط: 2,025,000 + 2,586,500 + 2,500)، نسبة تنفيذ 14.2%، متبقٍ من العقد 27,886,000؛ **المتبقي للصرف «غير متاح» بالأرقام محظور الاختبار والحفظ** — بقية المشاريع «غير متاح» في المؤشرات المشتقة (لا وهم صفر)؛ EN: «Contract value/Not available» واصلًا |
| IPC — إدخال مباشر (CR-02/§9.3) | verified | مستخلص جديد بلا بنود: إجمالي 10,000,000 − استقطاعات 500,000 → معاينة صافي حي 9,500,000؛ ثم نقل إلى مسار البنود (CX9 ×2 = 2,500) فتنقلب المعاينة إلى Σ qty×price — لا جمع مزدوج فوق netAmount |
| IPC — انتقال الحالات (CR-03) | verified | «مقدمة» ثم «معتمدة» عبر أزرار الانتقالات الموثقة؛ المؤشرات على /financials أعيدت فوريًا بعد الاعتماد |
| `/admin` (CR-01) | verified | خطأ الاسم الإلزامي + خطأ صيغة البريد عبر `EMAIL_RE` + حفظ معطّل حتى صحة الحقلين |
| `/archive` (CR-01) | verified | عنوان فارغ → «حفظ» معطّل؛ بالعنوان → متاح |
| `/inventory/items` (CR-01) | verified | حد أمان سالب → خطأ الحقل + حفظ معطّل؛ الفراغ مقبول (الحد اختياري) |
| `/inventory/requests` (CR-01) | verified | رسالة حاجز الصرف عبر `role=alert` |
| seed absence (CR-03) | verified | الحالة الابتدائية: كل بطاقات «قيمة العقد» تقرأ «غير متاح» (لا رقم مشتق) |
| مقاسات | verified | 390px + 1920px: بطاقات الموقف المالي كاملة |

الأدلة الصاعدة: `verify/phase9.spec.ts` — **6/6 passed (21.7s)** على chromium
باستخدام PW_BASE_URL=http://localhost:5203؛ `npx tsc --noEmit` = 0 أخطاء.

**درس أداة موثق في الاختبار نفسه:** اختيار بطاقة المال **لا** يستخدم
`hasText: 'قيمة العقد'` (يطابق أيضًا «المتبقي من قيمة العقد» — قاموس §9.1 أضافت
بطاقة سابقة اسمها ذلك فكشفت matches-2 في strict mode). المحدد المعتمد:
`.card:has(.l:text-is("<label>"))` — مطابقة تسمية السطر بالضبط بمحدد واحد مركّب؛
`filter({ has: scope.locator(...) })` يُرفض لأنه يعيد تأصيل السلسلة الداخلية
داخل كل بطاقة عند كون المحدد الداخلي مقيدًا بأسلافٍ (فشل انتظار 5 دقائق مرة واحدة قبل الإصلاح).

### الانحدار المعلوم (إعادة تحقق، :5202 — انحدار المرحلة 8 بلا تغيير)

`verify/exports.spec.ts` — **18 passed / 1 failed (5.5m)**، فشل سطر `431:62`
(نقر زر «معاينة» في `/reports` عند عرض 375px يتقاطعه شريط `bottombar`)، مطابق
لتقرير المرحلة 8 بنتيجته وسببه. لا إصلاح — خارج التفويض؛ لم يُلمس أي مصدر.

---

## 9. ملحق المعالجة (2026-10-27) — ملحق، لا اعتماد للمحتوى السابق

لاحقًا لتوثيق قسم 8 أعلاه، طلب المالك معالجة CR-01: إعادة بناء نموذج إنشاء/تعديل
المشروع بكامل حقول العقد المدققة (14 حقلًا بدل الحقول المخصصة للمرحلة)، مع الحقول المالية على النموذج نفسه ومجموعة اختبار §8 إلزامية. التوثيق الكامل في `phase-09-data-entry-remediation-report.md`. الأثر على هذه المصفوفة:

| صف المصفوفة | التحديث | دليل المعالجة |
|---|---|---|
| `/projects` (CR-01 + CR-02) | **verified** | هُدم القيد «create: name فقط؛ edit: name/client/status» — مودالا الإنشاء والتعديل الآن بالحقول الـ 14 المدققة (`projectSchema`): كود*، اسم*، العميل، المالك، المقاول، الموقع، المنطقة، رقم العقد، **قيمة العقد** (≥ 0، أيضًا في الإنشاء)، البدء، الانتهاء، الحالة، دور الشركة، ملاحظات؛ `aria-label` على كل الحقول + أخطاء الحقول بجوار حقولها (`.err[role=alert]`) + حفظ معطل على أخطها + «absent key ≠ 0» + خطأ التفريغ `cvClearUnsupported` (تفريغ قيمة ممتلئة غير مدعوم بعقد PUT — الحقل يعرض الخطأ + الحفظ معطل + القيمة تبقى) |
| `/projects` — mock create/update | **verified** | نقل قواعد `projectSchema` حقلًا-حقلًا في mock `createProject`/`updateProject` + محاكاة منح المنشئ `access[created.id] = 'DELETE'` (مطابقة `apps/api/.../projects.routes.ts:115–123` — Phase 5 §6)؛ صفر تعديل على `packages/*` و`apps/api/*` |
| `/financials` + `/projects/:id/financials` (CR-03) | **verified** | فوق مسار النموذج الجديد: قيمة عقد 32,000,000، **المنفّذ 4,614,000** (2,025,000 + 2,586,500 + 2,500)، نسبة التنفيذ **14.4%**، **المتبقي من العقد 27,386,000** — «المتبقي للصرف» يظل «غير متاح» (لا بيانات صرف)؛ صفر مصدري يُعرض 0 لا «غير متاح» (السالب مضمر لا إدخال — قناع الحقل ينزعه) |
| `/admin` — CR-01 (من المرحلة 9 الأولى) | **verified (بلا مساس)** | نُظمها سلفًا على `:5203`؛ اختبار الانحدار الحي (`CR-01 sweep` في phase9) أثبت بقاء سلوكها بعد المعالجة — صفر تعديل |
| AR/EN/RTL | **verified** | تسلسل AR(RTL) → EN(LTR) → AR على النموذج الكامل (تطابق المفاتيح الـ 15 الجديدة في اللغتين) |
| مقاسات | **verified** | 375×700، 390×844، 768×1024، 1024×768، 1366×768، 1920×1080 — مودال الإنشاء كامل وسيّد بلا فائض أفقي |

دليل اختبار المعالجة: `verify/remediation-cr01.spec.ts` — **12/12 passed (28.4s)**
على `:5204`/`dist-phase9-remediation` (بناء بـ `VITE_PROTOTYPE=1` — إلزامي،
بناء بلا العلم لا يعمل). الانحدارات على نفس البناء النهائي: `phase6` **11/11 (9.5s)**،
`phase9` **6/6 (21.1s)**، و`exports` **18/1** (فشل 431:62 الموروث بلا إصلاح
ولا تعديل كما فُرض). `npx tsc --noEmit` = 0 أخطاء.

