# Phase 14A — سجل قرارات المالك المعتمدة (Owner Decisions — Phase 14A)

> **وثيقة مرافقة لـ:** `docs/frontend-rebuild/phase-14/phase-14a-requirements-map.md`
> **التاريخ:** Tue Nov 17 2026
> **الحالة:** ✅ **جميع قرارات المالك الثلاثة عشر (O1–O13) معتمدة** — هذه الوثيقة هي السجل الرسمي. قسم §11 في التقرير الرئيسي (جدول الخيارات) أصبح سجلًا تاريخيًا قبل الاعتماد؛ هذا السجل هو الذي يحسم الخيارات.
> **الطبيعة:** توثيق فقط — لا تنفيذ (لا شيفرة، لا قواعد بيانات، لا migrations، لا تشغيل خدمات).

---

## 1. تصنيف القرارات الثلاثة عشر

| النوع | القرارات | المعنى |
|---|---|---|
| **معتمدة (Approved)** | O1, O2, O3, O4, O7, O8, O9, O10, O11, O12, O13 | اتجاه نهائي معتمد؛ تفاصيل تصميمية (حيث ذُكر) تُحسم في Phase 14B دون موافقة مالك جديدة من Phase 14A |
| **معتمدة — مؤجلة (Approved — Deferred)** | O5, O6 | وحدة/قواعد مؤجلة حتى تعريف مصادر البيانات والقواعد؛ الواجهة تعرض "غير متاح" ولا تُصنع قيم |
| **تفاصيل مسندة لتصميم Phase 14B** | O3, O4, O10 | أسماء الحالات/مصفوفة الانتقال/الأدوار المسؤولة (O3)، مراحل الموافقة/الأدوار/قواعد الانتقال (O4)، مسار إعادة تعيين كلمة المرور ومعمارية النسخ الاحتياطي (O10) — تُصمم وتُوثق في 14B |

---

## 2. السجل الرسمي — O1 إلى O13

> النص الإنجليزي بين علامات الاستشهاد هو نص القرار المعتمد حرفيًا (authoritative). الشرح العربي تحته توثيق مساند.

### O1 — User Department and Title — ✅ APPROVED
> *"Add both `department` and `title` to the user model and relevant API contracts. Email is already the user's identity field. Do not create a duplicate email field."*

- يُضاف `department` و`title` إلى نموذج المستخدم وعقود الـ API المعنية.
- الإيميل حقل الهوية القائم — **يُحظر إنشاء حقل إيميل مكرر**.
- يلغي فجوة G14 وقرار §11-O1 (كانت الحقول mock-only).
- يُغني عن قرار صلاحية `users.resetPassword`؟ لا — مسار إعادة التعيين مستقل (O10).

### O2 — Contract Value — ✅ APPROVED
> *"`contractValue` is an independently entered value supplied by the user. It must NOT be calculated from BOQ. It must NOT be automatically derived from other financial figures. If not entered, it remains unavailable/undefined. Do not fabricate zero values."*

- قيمة العقد إدخال مستقل من المستخدم — لا احتساب من BOQ ولا اشتقاق من أرقام مالية أخرى.
- عند عدم الإدخال تبقى غير متاحة/`undefined` — **لا أصفار مُصطنعة**.
- يطابق سلوك الواجهة الحالي (P5–P6, `cvClearUnsupported`) — يعتمد القرار §11-O2 الخيار (أ) المباشر.

### O3 — Document Status Workflow — ✅ APPROVED
> *"Document status changes must use a controlled workflow with: explicitly defined allowed transitions; permission-controlled actions; validation of every transition. The exact status names, transition matrix, and responsible roles must be designed and documented in Phase 14B. Do not invent owner-approved rules that have not yet been specified."*

- نهاية "الانتقال الحر" (فجوة G3 / A6): كل انتقال حالة مستند يصبح مُتحكمًا به، محكومًا بصلاحية، ومُتحققًا منه.
- **تفاصيل تصميم 14B:** أسماء الحالات (السبع الحالية أساس)، مصفوفة الانتقالات المسموحة، الأدوار المسؤولة عن كل انتقال.
- **حظر:** اختراع قواعد "معتمدة من المالك" لم تُحدد بعد.

### O4 — IPC Approval Workflow — ✅ APPROVED
> *"IPC must use a formal approval workflow with permissions, accounting for: Submission; Review; Approval; Rejection; Resubmission where applicable; Auditability of decisions. Exact approval stages, approver roles, and transition rules remain design details to be resolved in Phase 14B. Do not treat IPC as freely editable manual status fields."*

- المستخلصات تنتقل من التغيير اليدوي الحر (فجوة G4) إلى **سير موافقات رسمي بصلاحيات**.
- التصميم يجب أن يغطي: التقديم، المراجعة، الاعتماد، الرفض، إعادة التقديم حيث ينطبق، وقابلية تدقيق القرارات.
- **تفاصيل 14B:** المراحل والأدوار المعتمدة وقواعد الانتقال.
- **حظر:** عدم التعامل مع حالة IPC كحقول نصية/حالة قابلة للتحرير الحر.

### O5 — Disbursements and Payments — ✅ APPROVED — DEFERRED
> *"Defer the disbursements/payments module. Until its requirements and data sources are approved: display the feature as unavailable/not available; do not fabricate disbursement figures; do not create misleading financial calculations."*

- وحدة الصرف/الدفعات **مؤجلة** (تحسم فجوة G1) — لا بناء قبل اعتماد متطلباتها ومصادر بياناتها.
- حتى ذلك الحين: عرض "غير متاح" كما هو (`remainingDisbursement`)، لا أرقام صرف مُصطنعة، لا حسبات مالية مضللة.
- يقود إلى قرار 14B لاحق حين يطلبها المالك (ليس ضمن النطاق الحالي).

### O6 — Tax, Retention, and Advance Payments — ✅ APPROVED — DEFERRED
> *"Defer tax, contractual retention, and advance-payment rules until the owner defines the applicable business rules. Do not: invent percentages; invent formulas; add speculative financial calculations; display fabricated values."*

- قواعد الضريبة/الاستقطاع التعاقدي/الدفعات المقدمة **مؤجلة** (تحسم فجوة G2).
- حظر صريح: لا نسب مُخترعة، لا صيغ مُخترعة، لا حسبات تخمينية، لا قيم مُصطنعة معروضة.
- المحتوى الحالي ("غير متاح" + `retentionNA`) يبقى السلوك المعتمد مؤقتًا.

### O7 — Dashboard Scope — ✅ APPROVED
> *"Dashboard is operational-only for the current scope. It may show supported operational information such as project and document status. It must not display unsupported financial KPIs or fabricated payment, tax, or retention figures."*

- لوحة الرئيسية **تشغيلية فقط** (يحسم فجوة G8 بخيار الإبقاء التشغيلي، لا KPI مالي).
- مسموح: معلومات تشغيلية مدعومة (حالة مشاريع/مستندات…).
- محظور: KPI مالية غير مدعومة أو أرقام صرف/ضريبة/استقطاع مُصطنعة.

### O8 — Audit Project Association — ✅ APPROVED
> *"Audit records support an optional `projectId`. Project-related events may be associated with a project. Global events without a project must remain supported. Do not force every audit event to belong to a project. Historical audit records must remain meaningful."*

- `AuditLog` يدعم `projectId` **اختياريًا** (يحسم فجوة G5 بغير إجبار).
- أحداث المشروع تُربط بمشروع؛ الأحداث العامة بلا مشروع تبقى مدعومة.
- **حظر:** إجبار كل حدث تدقيق على الانتماء لمشروع.
- سجلات التدقيق التاريخية تبقى ذات معنى (التوافق الخلفي مطلوب في التصميم).

### O9 — Global Search — ✅ APPROVED
> *"Global search must be implemented on the backend with permission-aware results. Search results must respect the current user's permissions. Search must respect project access scope. Unauthorized records must not leak through titles, snippets, counts, metadata, or result previews. Client-side filtering alone is insufficient."*

- البحث العالمي **خلفي** (backend) بنتائج واعية بالصلاحيات (يحسم فجوة G7).
- يحترم صلاحيات المستخدم الحالي + نطاق وصوله للمشاريع.
- **حظر تسريب:** عبر العناوين، المقتطفات، الأعداد، البيانات الوصفية، أو معاينة النتائج — لأي سجل غير مصرح.
- الفلترة على العميل وحدها **غير كافية** (تُستبعد كضمانة).

### O10 — Password Reset and Backup/Restore — ✅ APPROVED
> *"Design both production paths: 1) Password reset. 2) Backup and restore. Both must be included in the Phase 14B design package. For password reset, define a secure production flow. For backup/restore, define the architecture, security, backup integrity validation, and recovery requirements. Approval to design these paths does NOT authorize their implementation. Do not execute backups or restores. Do not change production configuration."*

- **تصميم مسارين إنتاجيين** ضمن حزمة 14B: (1) إعادة تعيين كلمة المرور — تدفق إنتاجي آمن؛ (2) النسخ الاحتياطي/الاسترجاع — المعمارية، الأمان، التحقق من سلامة النسخ، ومتطلبات الاسترجاع.
- يحسم فجوتي G12/G13 (كانتا mock).
- **حدود مهمة:** الموافقة على **التصميم** لا تُخوّل **التنفيذ** — لا تنفيذ نسخ/استرجاع، لا تغيير إعدادات الإنتاج.

### O11 — CSV Import — ✅ APPROVED
> *"Adopt: maximum 200 rows per import; the current prototype duplicate-detection key/rule provisionally. Document the current duplicate-detection behavior accurately. Do not silently replace the existing rule. If its exact implementation cannot be verified without entering prohibited files, mark it as requiring source verification rather than guessing."*

- اعتماد: **حد 200 صف** لكل استيراد + **قاعدة كشف التكرار الحالية (prototype) مؤقتًا**.
- توثيق سلوك الكشف الحالي بدقة (انظر §4 أدناه — ملاحظة التحقق من المصدر).
- **حظر:** استبدال القاعدة صمتًا؛ أي تغيير لاحق = قرار مالك صريح.

### O12 — Project Deletion — ✅ APPROVED
> *"Use logical deletion (soft delete). Requirements: preserve dependent archive records; preserve dependent financial records; preserve historical audit records; exclude deleted projects from normal active-project listings; define authorized access to archived/deleted project data; do not hard-delete dependent data."*

- حذف المشروع = **حذف منطقي (soft delete)**، لا حذف فيزيائي.
- الحفاظ على: سجلات الأرشيف التابعة، السجلات المالية التابعة، سجلات التدقيق التاريخية.
- استبعاد المشاريع المحذوفة من قوائم المشاريع النشطة الاعتيادية.
- تعريف الوصول المصرح به لبيانات المشاريع المؤرشفة/المحذوفة (تفصيل 14B).
- **حظر:** hard-delete لأي بيانات تابعة.
- يحسم فجوة G9 (الحذف غير الموصل) وقرار §11-O12.

### O13 — Permission Distribution — ✅ APPROVED
> *"Adopt the current exact `ROLE_BASE` distribution as-is. Preserve the effective permission layers: 1) Role base permissions; 2) User-level overrides (`INHERIT` / `GRANT` / `DENY`); 3) Project-level access (`NONE` / `READ` / `WRITE` / `DELETE`). Preserve DENY precedence. Do not redesign or simplify the existing permission model without a separate owner decision."*

- اعتماد توزيع `ROLE_BASE` الحالي **كما هو حرفيًا** (`data.ts` L300–306 — §6.2 في التقرير الرئيسي).
- الحفاظ على طبقات الاحتساب الثلاث: أساس الدور → تجاوزات المستخدم (INHERIT/GRANT/DENY) → وصول المشاريع (NONE/READ/WRITE/DELETE).
- الحفاظ على أولوية **DENY** (deny-beats-grant — U3).
- **حظر:** إعادة تصميم/تبسيط نموذج الصلاحيات دون قرار مالك منفصل.

---

## 3. مصفوفة تبعيات القرارات (Decision Dependency Matrix)

| القرار | Home | Projects | Archive | Finance | Administration | Audit | مساحات التصميم المتأثرة في 14B |
|---|---|---|---|---|---|---|---|
| O1 (قسم/منصب المستخدم) | — | — | — | — | ✅ نموذج المستخدم + عقود API | — | Target Data Model؛ API Contracts (users) |
| O2 (contractValue مباشر) | — | ✅ نموذج المشروع | — | ✅ قيمة العقد بالبطاقات | — | — | Data Model؛ Business Rules (لا اشتقاق) |
| O3 (سير حالة المستند) | — | — | ✅ تغيير الحالة | — | — | ✅ تدقيق انتقالات الحالة | Business Rules؛ API Contracts (documents) |
| O4 (سير موافقات IPC) | — | ✅ Financials tab | — | ✅ "منفّذ معتمد" يتبع الدورة | — | ✅ تدقيق قرارات الموافقة | Business Rules؛ Data Model (IPC lifecycle)؛ API Contracts |
| O5 (الصرف مؤجل) | ✅ لا KPI صرف | — | — | ✅ "غير متاح" دائمًا | — | — | Business Rules (نطاق مؤقت) |
| O6 (ضريبة/استقطاع مؤجل) | — | — | — | ✅ "غير متاح" | — | — | Business Rules (نطاق مؤقت) |
| O7 (لوحة تشغيلية) | ✅ النطاق | — | ✅ حالة المستندات معروضة | ✅ ممنوع KPI مالي | — | — | Business Rules (نطاق اللوحة) |
| O8 (projectId اختياري بالتدقيق) | — | — | — | — | — | ✅ نموذج AuditLog + فلاتر | Data Model؛ API Contracts (audit)؛ توافق تاريخي |
| O9 (بحث خلفي مُسند) | ✅ (topbar search) | ✅ نتائج المشاريع | ✅ نتائج المستندات | — | — | — | API Contracts (search)؛ Security (anti-leak) |
| O10 (reset/backup design) | — | — | — | — | ✅ زر reset + تبويب backups | — | Business Rules؛ API Contracts (auth/backup) |
| O11 (CSV 200 صف + قاعدة التكرار) | — | — | ✅ معالج الاستيراد | — | ✅ (سجل imports) | — | API Contracts (import batch) |
| O12 (soft delete للمشاريع) | — | ✅ قوائم/مساحة | ✅ سجلات تابعة | ✅ سجلات مالية تابعة | ✅ وصول بيانات المؤرشفة | ✅ سجلات تاريخية | Data Model (deletedAt/الحالة)؛ API Contracts؛ Business Rules |
| O13 (ROLE_BASE كما هو) | ✅ | ✅ | ✅ | ✅ | ✅ (overrides + projectAccess) | ✅ | Security/RBAC (ثابت — لا إعادة تصميم) |

---

## 4. ملاحظة تحقق O11 (توثيق سلوك كشف التكرار الحالي بدقة)

- **ما تم التحقق منه من الملفات المسموحة (واجهة Phase 13):** معالج الاستيراد في `features/archive/components/Archive.tsx` (L1–827، قراءة كاملة في Phase 14A) يعمل على 4 خطوات، بحد **≤ 200 صف**، وكشف التكرار يعتمد على حقل **`number`** (رقم المستند) — قاعدة موصوفة في التقرير الرئيسي (A10/W-A8).
- **ما لا يمكن التحقق منه دون دخول ملفات محظورة:** أي تطبيق مطابق لقاعدة الكشف في الخلفية (`apps/api/src/**` — 18 ملفًا بوسوم تعارض دمج محمية، لم تُقرأ ولم تُلمس).
- **الحالة المعلنة:** القاعدة الواجهة-الموثقة معتمدة **مؤقتًا**؛ **مطابقة/تحقق مصدر الخلفية مطلوبة في Phase 14B** عند تصميم عقد الاستيراد — لا تخمين.

---

## 5. أسئلة التصميم المتبقية (لا تحتاج موافقة مالك جديدة من Phase 14A)

كلها مسندة إلى حزمة تصميم Phase 14B، ضمن حدود القرارات المعتمدة:

1. **O3:** أسماء الحالات النهائية، مصفوفة الانتقالات المسموحة (من→إلى)، الأدوار المصرح لها بكل انتقال، ورسائل التحقق.
2. **O4:** مراحل الموافقة (تقديم/مراجعة/اعتماد/رفض/إعادة تقديم)، الأدوار المعتمدة، قواعد الانتقال، وربط القرارات بالتدقيق.
3. **O10:** تدفق إعادة تعيين كلمة المرور الآمن؛ معمارية النسخ الاحتياطي/الاسترجاع، الأمان، التحقق من سلامة النسخ، متطلبات الاسترجاع.
4. **O8:** كيفية ربط الأحداث بالمشروع للأحداث الجديدة، وكيف تبقى السجلات التاريخية بلا `projectId` ذات معنى (عرض/فلترة).
5. **O9:** شكل عقد البحث الخلفي، أنواع السجلات المشمولة، وسلوك اللقطة/العدادات دون تسريب.
6. **O12:** الحقل/الحالة التقنية للحذف المنطقي، سلوك القوائم والفلاتر، ومن يقوَم بالوصول لبيانات المؤرشفة.
7. **O1:** القيود (قيم اختيارية/مطلوبة، حدود طول، عربية/لاتينية) — دون حقل إيميل مكرر.
8. **O11:** التحقق من مصدر قاعدة الكشف في الخلفية (بعد فتح النطاق بشكل مشروع) قبل تثبيت عقد الاستيراد.
9. **O2/O5/O6:** صياغة رسائل "غير متاح" النهائية وحدود المؤشرات المشتقة (تظل BOQ/IPC مصادرها الوحيدة).

> **ليست ضمن أسئلة 14B:** أي توسيع لنطاق الصرف/الضريبة (O5/O6) — يحتاج طلب مالك لاحقًا؛ وأي تبسيط لنموذج الصلاحيات (O13) — يحتاج قرار مالك منفصلًا.

---

## 6. تقييم جاهزية Phase 14B (Readiness Assessment)

- ✅ **قرارات Phase 14A مكتملة:** 13/13 معتمدة (منها 2 مؤجلة بنيةً واضحة) — لا قرار معلق يتطلب موافقة Phase 14A إضافية.
- ✅ **مصدر الحقيقة ثابت:** التقرير الرئيسي (`phase-14a-requirements-map.md`) + هذا السجل.
- ✅ **النطاق محدد:** الموديولات الستة فقط (Home/Dashboard، Projects، Archive، Finance، Administration، Audit) — المخزن/الطلبات تبعيات فقط.
- ✅ **حزمة التصميم محددة:** Business Rules، Target Data Model، API Contracts، Frontend Integration Mapping.
- ⚠️ **قيود جاهزية معلنة:** (1) O11 يحتاج تحقق مصدر خلفية لاحقًا؛ (2) O10 تصميم فقط دون تنفيذ؛ (3) O5/O6 مؤجلة حتى طلب المالك.
- **الحكم:** ✅ **يمكن البدء بتصميم Phase 14B** بعد مراجعة المالك لهذا السجل.

---

**STOP:** لا تنفيذ لـ Phase 14B (لا شيفرة/قواعد بيانات/migrations/تشغيل خدمات) قبل مراجعة المالك لهذا السجل المعتمد.
