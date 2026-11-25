# برومبتات تنفيذ خطة Full Frontend Rebuild — COS

**الاستخدام:** أرسل برومبت مرحلة واحدة فقط إلى الـ Agent في كل مرة. لا ترسل المراحل كلها دفعة واحدة. بعد كل تقرير، راجع النتائج ووافق صراحةً على الانتقال للمرحلة التالية.

> إذا كانت أي مهارة مذكورة غير موجودة على الجهاز، يجب على الـ Agent الإفصاح عن ذلك واستخدام المهارات المتاحة فقط. ممنوع الادعاء بقراءة أو تطبيق Skill لم تتم قراءة تعليماتها فعليًا.

---

# Prompt — Phase 0: Safety, Git Checkpoint & Baseline

```text
مهمة: Phase 0 فقط من خطة COS Full Frontend Rebuild — Safety, Git Checkpoint & Baseline.

السياق والقرارات الثابتة:
- المطلوب إعادة بناء Frontend بالكامل، وليس Polish للواجهات الحالية.
- التقنيات الأساسية ستظل React + TypeScript + Vite.
- الـ Backend وExpress API وعقودها وPostgreSQL schema/data ومنطق العمليات والصلاحيات خارج النطاق وممنوع تعديلها.
- النسخة الحالية يجب أن تظل نقطة رجوع، والمستخدم قال إنه سيرفع حالتها الحالية إلى GitHub بنفسه.
- لا git push، ولا deployment، ولا DNS changes، ولا database changes، ولا commits تلقائية دون إذن صريح.
- نفّذ Phase 0 فقط، ثم توقف بتقرير. لا تبدأ audit أو design أو implementation.

الأهداف:
1. التحقق من الـ repository الصحيح ومن نقطة الأساس التي رفعها المستخدم.
2. التأكد من سلامة النسخة الحالية قبل إنشاء مساحة العمل الجديدة.
3. إنشاء branch/worktree منفصل لإعادة البناء دون المساس بمجلد النسخة الأصلية.
4. تسجيل baseline commands ونتائجها الفعلية.

خطوات إلزامية:
A. ابدأ باستعراض git status والفرع الحالي وHEAD والـ upstream والـ worktrees الموجودة. لا تعدل أو تنظف أي ملف تلقائيًا.
B. تحقق أن التعديلات التي يريد المستخدم حفظها (بما فيها تغييرات Phase 3/4 والملفات الجديدة) محفوظة في نقطة الأساس المرفوعة. إن لم تستطع إثبات ذلك، أو وُجدت تعديلات محلية غير محفوظة، STOP واذكر المطلوب من المستخدم. لا تستخدم reset/clean/stash ولا تحذف الملفات.
C. راجع الملفات المرشحة في Git بحثًا عن .env وsecrets ومفاتيح وتصديرات قواعد البيانات وملفات أرشيف حقيقية أو بيانات شخصية. لا تطبع قيم الأسرار في التقرير. إذا وجدت خطرًا، أبلغ عنه دون نسخ المحتوى إلى أي مكان.
D. أنشئ فرعًا محليًا جديدًا باسم rebuild/frontend-v2. الأفضل استخدام git worktree في مجلد مجاور يحافظ على مجلد النسخة الحالية كما هو. إذا كان الفرع أو مجلد worktree موجودًا، لا تستبدله ولا تحذفه؛ افحصه ثم توقف لقرار المستخدم إذا كان هناك تعارض.
E. لا تنفذ git push أو commit أو merge أو deployment.
F. افحص scripts الفعلية في package.json وملفات workspace. استخرج أوامر install/typecheck/lint/test/build/dev الموجودة فعلًا. لا تخترع scripts.
G. شغّل baseline checks الممكنة فقط، وسجل الأمر الدقيق والـ exit code وعدد الاختبارات إن ظهر. لا تصلح أي عيب في Phase 0.
H. تحقّق هل فشل authz.spec.ts:22 المذكور سابقًا ما زال يظهر (locator قد يطابق admin وm.amin). لا تفترض أنه موجود أو محلول. سجّل النتيجة فقط.
I. أنشئ توثيقًا فقط، مثل docs/frontend-rebuild/phase-00-baseline.md، في مساحة العمل الجديدة إذا أمكن، ويشمل branch/worktree/HEAD، أوامر التشغيل، النتائج، والمخاطر. لا تعدل ملفات التطبيق.

المهارات:
تحقق من المهارات المتاحة واقرأ فقط المهارات المناسبة لسلامة Git أو تدقيق المشروع إذا كانت موجودة. لا تعتبر المهارات العامة بديلًا عن أوامر التحقق الفعلية.

معايير التوقف:
- إذا كانت نقطة الأساس غير مؤكدة، أو البيانات المحلية غير المحفوظة معرضة للخطر، توقف دون إنشاء branch/worktree.
- إذا اكتمل التحقق، قدم تقرير PASS/PARTIAL/BLOCKED مع أدلة.
- لا تبدأ Phase 1 تلقائيًا. توقف وانتظر موافقة المستخدم.
```

---

# Prompt — Phase 1: Full Frontend Audit (Read-Only)

```text
مهمة: Phase 1 فقط — Full Frontend Audit لنظام COS، بعد اعتماد تقرير Phase 0.

القواعد الثابتة:
- الهدف إعادة بناء الـ Frontend بالكامل، لا تحسين الصفحات الحالية.
- React + TypeScript + Vite تبقى التقنيات الأساسية.
- لا تعدّل Backend أو API contracts أو PostgreSQL أو business logic أو RBAC أو بيانات الإنتاج.
- هذه المرحلة Read-only للتطبيق. المسموح فقط إضافة ملفات توثيق Audit داخل مساحة إعادة البناء.
- لا تبدأ التصميم أو النموذج التفاعلي أو البرمجة في هذه المرحلة.
- لا push ولا deployment ولا commits تلقائية.

المهمة:
نفّذ جردًا شاملًا للـ Frontend الحالي من مصادر المشروع نفسه، ولا تعتمد على التقرير القديم وحده.

افحص ووثّق:
1. جميع routes/pages/layouts، الصفحات المخفية حسب الصلاحية، dialogs/drawers، والحالات الفارغة أو غير المعتادة.
2. كل الإجراءات التي يقدر المستخدم تنفيذها: أزرار وروابط ونماذج وحذف/تعديل/إنشاء/رفع/تنزيل/معاينة/تصدير/ZIP/revisions/إعدادات وغيرها مما يوجد فعليًا.
3. كل API call وmethod/route/request/response/error behavior المستخدم داخل apps/web؛ اقرأ API client وauth/session flow، لكن لا تغيّرها.
4. مصفوفة الأدوار والصلاحيات والوصول للمشروعات: ما الذي يظهر لكل دور وما الذي يسمح به الخادم. لا تعتبر إخفاء العنصر صلاحية أمنية.
5. حالات loading/success/empty/error/offline/session-expired/permission-denied، والتحقق من الحقول والأخطاء القادمة من API.
6. search/filter/sort/pagination/state persistence/local storage/theme/density/notifications/PWA/service worker، بقدر ما هو موجود فعليًا.
7. Upload/download/preview/ZIP/revisions وسلوك أسماء الملفات وcontent type والتعامل مع الفشل، إن وجدت.
8. جميع المكتبات الحالية والـ package scripts وقيود المتصفح والأدوات والاختبارات الفعلية.
9. responsive breakpoints والـ RTL/Cairo والثيم الحاليين، باعتبارها معلومات عن baseline لا قيودًا تصميمية.
10. أي نقص أو تناقض أو وظيفة لا يمكن إثباتها. ميّز بين defect حقيقي واختبار غير دقيق وفرضية.

أنشئ الملفات التالية قدر الإمكان:
- docs/frontend-rebuild/phase-01/routes-and-pages.md
- docs/frontend-rebuild/phase-01/functional-inventory.md
- docs/frontend-rebuild/phase-01/api-contract-map.md
- docs/frontend-rebuild/phase-01/permissions-matrix.md
- docs/frontend-rebuild/phase-01/test-baseline-and-gaps.md
- docs/frontend-rebuild/phase-01/dependencies-and-platform.md
- docs/frontend-rebuild/phase-01/module-migration-order.md

جدول parity الأساسي يجب أن يتضمن الأعمدة:
Page/Route | Role/Permission | User Action | Existing API | Input/Output | States | Side Effects | Existing Test | Migration Priority.

Skills:
- افحص واقرأ فعليًا إن كانت متاحة: redesign-existing-projects، react-patterns، frontend-dev-guidelines، frontend-security-coder، brooks-review، e2e-testing-patterns.
- يمكن استخدام مهارات أخرى إذا كانت مرتبطة مباشرة، بشرط قراءة محتواها فعلًا.
- في التقرير، اذكر التطبيق الملموس لكل skill تمت قراءتها، واستبعد أي skill لم تُقرأ.

معايير القبول:
- يجب أن تكون قائمة جميع الصفحات والمسارات مبنية على بحث فعلي في الكود.
- يجب ذكر الصفحات التي تعذر فحصها والسبب.
- لا تدّعِ اكتمال الحصر إذا وجدت ملفات أو حالات غير مفهومة.
- لا تغيّر أي سلوك أو كود تطبيق أو اختبار.

في نهاية التقرير، قدّم ملخصًا للتدقيق والأسئلة أو التعارضات التي تحتاج قرارًا من المستخدم. STOP بعد Phase 1؛ لا تبدأ Phase 2 دون موافقة صريحة.
```

---

# Prompt — Phase 2: Product UX, Information Architecture & Design Proposal

```text
مهمة: Phase 2 فقط — إعداد واعتماد تصور تجربة الاستخدام والتصميم لنظام COS بعد مراجعة مخرجات Phase 1.

الهدف:
التصميم يجب أن يحدد منتجًا جديدًا مبنيًا على مهام الشركة؛ لا تعِد رسم الواجهة القديمة، ولا تجعل Command Deck أو shell السابق قيودًا. استخدم نتائج Audit كمرجع للوظائف والصلاحيات فقط.

قيود ثابتة:
- React + TypeScript + Vite.
- Backend وAPI contracts وPostgreSQL ومنطق الأعمال والصلاحيات لا تتغير.
- العربية default + RTL والإنجليزية + LTR.
- لا production implementation ولا توصيل لأي عملية حقيقية في هذه المرحلة.
- لا push/deployment/commit تلقائي.
- لا تنتقل إلى prototype حتى يوافق المستخدم صراحة على الاتجاه المقترح.

المطلوب:
1. اقرأ كل وثائق Phase 1 وحدد أهم user jobs والتدفقات التشغيلية الحقيقية.
2. اقترح Information Architecture جديدة وخريطة تنقل كاملة، بما في ذلك كل الوحدات التي ثبت وجودها في التدقيق.
3. اقترح اتجاهًا بصريًا مميزًا يلائم COS. لا تختَر قالب Admin عامًا ولا تنطلق من الألوان/الـ shell الحالي تلقائيًا.
4. عند وجود اتجاهات متباينة فعلًا، اعرض بحد أقصى 2–3 اتجاهات مختصرة مع trade-offs ثم رشّح واحدًا مبررًا. لا تطلب من المستخدم قرارات صغيرة لا تؤثر؛ اجمع القرارات المترابطة في عرض واحد مفهوم.
5. صمم UX لكل شاشة: هدف المستخدم، ترتيب المعلومات، العمليات الأساسية والثانوية، حالات البيانات، رسائل التأكيد، responsive behavior، keyboard/accessibility.
6. اقترح نظام تصميم متكامل: design tokens، typography، spacing، layout/grid، surface/border/elevation، states، motion/reduced-motion، icon approach، component inventory، chart/table/form/dialog/drawer patterns عند الحاجة.
7. حدّد استراتيجية عربية/إنجليزية: ترجمة جميع النصوص والرسائل، إدارة RTL/LTR، mixed-direction strings، numbers/dates/currency، حفظ اللغة، وعدم تغيير القيم المخزنة من الخادم.
8. حدد كيف ستختلف تجربة الموبايل عن الديسكتوب حسب العمل الفعلي، وليس بمجرد تصغير أعمدة.
9. راجع dependencies المحتمل إضافتها. لكل واحدة: ما المشكلة التي تحلها، حجم/أثر تقريبي إذا أمكن التحقق، الصيانة والتوافق والأمان، والبدائل. لا تثبّت أي مكتبة في هذه المرحلة.
10. حدد أي ميزة لا تستطيع الواجهة تنفيذها بعقد API حالي. لا تفترض وجود endpoint. اذكر الخيارات وانتظر قرارًا إذا كان النقص جوهريًا.
11. استخدم أمثلة بيانات موصوفة بأنها illustrative فقط عند الحاجة إلى تصور بصري؛ لا تعرض أرقامًا توحي بأنها بيانات الشركة الحقيقية.

مخرجات التوثيق:
- docs/frontend-rebuild/phase-02/design-brief.md
- docs/frontend-rebuild/phase-02/information-architecture.md
- docs/frontend-rebuild/phase-02/navigation-map.md
- docs/frontend-rebuild/phase-02/screen-specifications.md
- docs/frontend-rebuild/phase-02/design-system-proposal.md
- docs/frontend-rebuild/phase-02/dependency-decisions.md
- docs/frontend-rebuild/phase-02/api-gaps-and-assumptions.md

اعرض للمستخدم عرضًا يسهل مراجعته: الاتجاه المقترح، نماذج/صور تصميم إن كانت الأدوات تتيح ذلك، خريطة التنقل، واختلافات UX الجوهرية عن القديم. لا تعتبر كتابة ملفات Markdown وحدها بديلًا عن العرض البصري متى كانت أدوات العرض متاحة.

Skills المطلوب فحصها وقراءتها فعلًا إذا توفرت:
- design-ux
- frontend-design
- design-system
- deterministic-design
- mobile-design
- fixing-accessibility
- redesign-existing-projects
اذكر فقط ما قرأته فعلًا وكيف انعكس على القرارات.

بوابة الاعتماد:
لا تبدأ بناء النموذج حتى يقول المستخدم صراحة إنه موافق على اتجاه التصميم/التصور. إذا طلب تعديلًا، عدّل وثائق/تصورات Phase 2 فقط ثم اعرضها مجددًا.
STOP عند نهاية Phase 2 وانتظر الموافقة.
```

---

# Prompt — Phase 3: Interactive Prototype (Mock Data, Reusable Foundation)

```text
مهمة: Phase 3 فقط — بناء نموذج تفاعلي عالي الدقة وفق التصميم الذي اعتمده المستخدم في Phase 2.

هذه هي أول مرحلة تسمح بكود Frontend، لكنها Prototype فقط وليست ربطًا إنتاجيًا.

القواعد الثابتة:
- React + TypeScript + Vite.
- Backend وAPI contracts وPostgreSQL وبيانات الإنتاج لا تُمس.
- لا عمليات حقيقية على ملفات أو بيانات الشركة.
- لا تبدأ بناء الإنتاج أو ربط API قبل موافقة المستخدم على النموذج التفاعلي.
- لا ترمِ prototype بعد الموافقة: مكوناته وحدودها المعمارية يجب أن تكون قابلة لإعادة الاستخدام في المنتج النهائي.
- لا push ولا deployment ولا commits تلقائية.

نفّذ:
1. أنشئ نقطة دخول/مساحة prototype معزولة عن مسار العمليات الإنتاجية، حسب البنية التي اعتمدتها في Phase 2.
2. ابنِ النموذج على اتجاه التصميم المعتمد، لا على التصميم القديم.
3. أنشئ UI components/tokens/layouts حقيقية قابلة لإعادة الاستخدام. افصل مصدر البيانات عن العرض عبر repository/adapter واضح، بحيث يمكن استبدال Mock adapter بـ API adapter لاحقًا دون إعادة كتابة كل المكونات.
4. استخدم fixtures خيالية وواضحة، ولا تستخدم بيانات حقيقية أو نسخًا من قاعدة البيانات أو ملفات أرشيف الشركة.
5. لا تنفذ network requests إلى الـ API الحقيقي ولا mutations خارج الذاكرة. إن احتاج النموذج إلى upload/approval/delete، اجعل السلوك simulation واضحًا ولا تنشئ أثرًا حقيقيًا.
6. أضف guard قويًا يمنع تشغيل mock data في production build أو يمنع دخول prototype إلى مسار production افتراضيًا. وثّق طريقة التشغيل التجريبية.
7. وفّر تدفقات قابلة للتجربة للوحدات الأساسية التي اكتشفها الـ Audit: navigation، Dashboard، Projects، Archive، Inventory/Materials، وعينة مناسبة من الإدارة والإعدادات. إذا اتضح أن وحدة أقل أولوية، اشرح السبب ولا تتجاهلها بصمت.
8. اجعل الأزرار التي تظهر قابلة للتفاعل أو موسومة بوضوح على أنها غير مفعلة في النموذج؛ لا تعرض تحكمات كأنها تعمل وهي inert بلا توضيح.
9. نفّذ تغيير العربية/الإنجليزية والاتجاه RTL/LTR، وحفظ الاختيار. اختبر النص المختلط والـ labels والحقول والجداول والـ icons.
10. اختبر أحجام 375/768/1024/1366/1920 px، والكيبورد، والتركيز، والـ reduced-motion حسب المواصفات.
11. أضف اختبارات أساسية لتدفقات prototype والتبديل اللغوي والاستجابة، باستخدام أدوات المشروع المتاحة.
12. لا تثبت dependency جديدة دون أن تكون ضمن المقترح المعتمد أو مع تبرير واضح ومحدود.

Skills: افحص واقرأ ما يتوفر فعليًا من frontend-design، design-system، react-patterns، react-ui-patterns، mobile-design، fixing-accessibility، progressive-web-app وe2e-testing-patterns. لا تدّعِ استخدام ما لم تقرأه.

التقرير يجب أن يوضح:
- مسار تشغيل النموذج وخطوات تجربته.
- المسارات/الشاشات التي يمكن تجربتها.
- ما هو fake/simulated وما هو خارج النطاق.
- اختبارات ونتائج فعلية.
- الملفات والتبعيات المتغيرة.
- تأكيد عدم الاتصال ببيانات الإنتاج وعدم تغيير Backend/DB.

بوابة توقف إلزامية:
بعد تسليم النموذج، لا تنتقل إلى Phase 4 ولا تبدأ API integration حتى يجرب المستخدم النموذج ويعطي موافقة صريحة. إذا طلب تعديلات، نفّذ فقط التعديلات على prototype ثم أعد عرضه.
```

---

# Prompt — Phase 4: Frontend Foundation & Architecture

```text
مهمة: Phase 4 فقط — تجهيز البنية الأساسية للـ Frontend الجديد بعد موافقة المستخدم الصريحة على النموذج التفاعلي.

السياق:
- النموذج الموافق عليه هو نقطة انطلاق حقيقية ويجب تطويره، لا إعادة كتابته من الصفر دون سبب موثق.
- React + TypeScript + Vite ثابتة.
- Backend وAPI contracts وPostgreSQL/business logic لا تتغير.
- لا deployment أو push أو commits تلقائية.

قبل التنفيذ:
راجع ملاحظات اعتماد prototype وحدد الملفات/المكونات التي ستُحتفظ بها والمكونات التي تحتاج إعادة تنظيم. لا تلغِ أي جزء من التصميم الموافق عليه بصمت.

نفّذ الأساس التالي فقط:
1. بنية ملفات واضحة حسب مسؤوليات feature/modules وshared UI وservices/api وi18n وrouting وtest utilities، متوافقة مع حجم النظام ولا تتحول إلى تعقيد معماري غير مبرر.
2. Type-safe API client/adapter مطابق لعقود الخادم التي وثّقها Phase 1. لا تخترع endpoints أو response shapes. لا تغيّر semantics أو payloads.
3. استراتيجية موثقة لإدارة server state وclient state؛ اختر أقل حل يلبّي الحاجة. لا تضف state library دون مبرر.
4. إعداد routing، route-level loading/error handling، not-found/access-denied، error boundaries، والتعامل مع HTTP/network failures.
5. إعداد i18n مركزي للعربية والإنجليزية. العربية default؛ عند تغيير اللغة يتم تحديث `lang` و`dir` وتخزين اختيار اللغة. اختبر الانتقال في الاتجاهين.
6. ضع قواعد للتعامل مع العناصر ذات الاتجاه الخاص مثل email/IDs/filenames/serials ضمن RTL/LTR.
7. إعداد form validation والتعامل مع server validation errors، مع الحفاظ على رسائل الخادم والمنطق الحالي وعدم تكرار business rules داخل الواجهة بلا داعٍ.
8. مراجعة أمان تخزين الجلسة والـ tokens اعتمادًا على السلوك الحالي. لا تخفف مستوى الأمان ولا تعدّل backend auth flow.
9. ضع أساس test setup وscripts المناسبة بحسب الموجود فعليًا.
10. انقل fixture/mock adapter إلى حدود معزولة لا يمكن أن تختلط مع API production adapter. production build لا يتصل بmock data.
11. لا تنفذ كل الصفحات في هذه المرحلة؛ اكتفِ بالتأسيس واختبارات smoke بسيطة تؤكد أن التطبيق يقلع.
12. تحقق من build، typecheck، tests، وعدم وجود تغييرات في apps/api أو schema/migrations.

Skills المطلوب قراءتها إن توفرت: react-patterns، frontend-dev-guidelines، frontend-security-coder، design-system، e2e-testing-patterns. طبّق المناسب فقط ووثق الأدلة.

معايير القبول:
- بنية معمارية موثقة ومبررة.
- build/typecheck والاختبارات الأساسية ناجحة.
- API adapter مطابق للخادم الحقيقي، دون تشغيل عمليات إنتاجية من الـ prototype.
- العربية/الإنجليزية وRTL/LTR تعملان على الأساس الجديد.
- لا Backend/DB changes.

قدّم تقريرًا وتوقف. لا تبدأ Phase 5 دون موافقة المستخدم.
```

---

# Prompt — Phase 5: App Shell, Auth UX & Localization

```text
مهمة: Phase 5 فقط — بناء الـ App Shell وتجربة الجلسة/الدخول والتنقل واللغات على الـ Frontend الجديد.

ممنوع الالتزام بالـ Shell القديم لمجرد وجوده؛ نفّذ التصميم المعتمد. في المقابل، يجب أن يبقى سلوك الخادم والصلاحيات كما هما.

قيود ثابتة:
- React + TypeScript + Vite.
- لا تعديل على Backend/AuthContext server behavior/API contracts/DB/RBAC.
- لا push/deployment/commit تلقائي.
- لا تبدأ الوحدات التفصيلية Dashboard/Projects/Archive/Inventory إلا عناصر التنقل/placeholder states اللازمة للـ Shell.

نفّذ وفق نتائج Audit والتصميم المعتمد:
1. layout العام، navigation، header/side navigation/mobile navigation، user menu، notifications entry إن كانت موجودة، breadcrumb/search/command palette إن تم اعتمادها، وليس مطلوبًا نسخ عناصر غير موجودة أو غير مبررة.
2. Login/session restoration/session expired/logout/unauthorized/access-denied/not-found حسب السلوك الحقيقي للـ Backend.
3. اربط المسارات والصلاحيات المرئية بمصدر الصلاحيات الحالي. لا تعتبر route guard بديلًا عن authorization في الخادم.
4. ترجم كل strings الخاصة بهذا النطاق بالعربية والإنجليزية، مع العربية افتراضيًا وحفظ اللغة وتغيير RTL/LTR فورًا وبشكل صحيح.
5. نفّذ theme/preferences/offline indicators فقط حسب الميزات الفعلية والتصميم المعتمد؛ لا تغيّر معنى offline behavior أو تخلق claims غير صحيحة.
6. راع keyboard navigation وfocus management والـ accessible names وEscape في overlays وreduced-motion و44px touch targets حيث ينطبق.
7. اكتب اختبارات session/nav/permission/locale/responsive. استخدم بيانات اختبار معزولة، ولا تعدّل حسابات المستخدمين أو الأدوار.
8. افحص console/network failures. ضجيج 401 القديم لا يُعالج بتغيير backend أو session semantics؛ وثّقه إن ظل موجودًا، ويمكن تحسين طريقة عرض الخطأ في الواجهة فقط إن كان ذلك آمنًا ومتوافقًا.

Skills: اقرأ فعليًا ما يتوفر من design-system، frontend-design، react-patterns، fixing-accessibility، mobile-design، frontend-security-coder، e2e-testing-patterns.

التقرير يشمل جميع المسارات والاختبارات والصلاحيات المرئية. لا تبدأ Phase 6 حتى موافقة المستخدم.
```

---

# Prompt — Phase 6: Dashboard & Projects

```text
مهمة: Phase 6 فقط — إعادة بناء Dashboard وProjects بالكامل بالتصميم المعتمد وبنية Frontend v2.

هذا ليس Polish للشاشات القديمة. ابتكر تنظيمًا وتجربة مختلفين وفق screen specifications المعتمدة، مع الحفاظ على كل السلوكيات الصحيحة.

الحدود الثابتة:
- لا Backend/DB/API contract/business logic/RBAC changes.
- React + TypeScript + Vite.
- لا بيانات أو KPIs أو charts أو project progress أو deadlines مختلقة.
- لا push/deployment/commits تلقائية.

قبل الكود:
راجع parity matrix الخاصة بالوحدتين، اربط كل action بـ API الحالي والصلاحية وحالاته المتوقعة، وحدد أي عنصر لا يمكن نقله قبل كتابة كود واسع.

نفّذ:
1. Dashboard جديدة تستخدم البيانات الحقيقية التي يوفرها النظام فقط. إذا لا تتوفر بيانات لمعلومة، لا تخترعها ولا تعرضها على أنها حقيقية؛ صمم empty/unavailable state مناسبًا.
2. Projects: list/detail/forms/actions الموجودة في الـ baseline، مع البحث والفلاتر والفرز والترقيم والتنقل والحالات والـ validation كما هي وظيفيًا.
3. اجعل التسلسل البصري مبنيًا على الأولوية التشغيلية، لا على صفوف KPIs متطابقة دون قيمة.
4. حافظ على loading/empty/error/partial data/permission denied والسلوك بعد عمليات الإنشاء/التعديل/الحذف الموجود فعليًا.
5. اختبر كل الأدوار ذات الصلة وحدود الوصول للمشروعات. لا تعتمد على إخفاء الواجهة وحده.
6. اختبر 375/768/1024/1366/1920px بالعربية والإنجليزية. لا horizontal overflow غير مقصود.
7. اكتب/حدّث اختبارات وحدات وتكامل وE2E لهذه الوحدات. لا تغيّر بيانات أو test assertions لتجاوز فشل حقيقي.
8. تحقق typecheck/lint/build والاختبارات المتعلقة بالوحدتين.

Skills: اقرأ فعليًا المناسب من redesign-existing-projects، design-ux، frontend-design، react-patterns، react-ui-patterns، frontend-dev-guidelines، mobile-design، fixing-accessibility، e2e-testing-patterns. وثّق التطبيق العملي.

في نهاية Phase 6 قدّم جدولًا يربط كل وظيفة baseline بنتيجة النقل والاختبار. توقف؛ لا تبدأ Phase 7 دون إذن.
```

---

# Prompt — Phase 7: Archive Workspace

```text
مهمة: Phase 7 فقط — إعادة بناء Archive Workspace بالكامل.

المبدأ:
الأرشيف مساحة عمل للوثائق والبحث والعمليات، وليس مجرد جدول تجميلي. اعتمد على الوظائف المثبتة في Audit، لا على افتراضات.

الحدود الثابتة:
- ممنوع تعديل archive backend/storage/database/API contract/audit/revisions logic.
- لا نقل أو حذف أو تغيير ملفات الإنتاج.
- لا بيانات حقيقية داخل fixtures أو snapshots.
- لا push/deployment/commit تلقائي.

قبل التنفيذ:
راجع جميع Archive routes/actions/API requests/permissions/states في parity matrix. إذا وجدت عملية لم تفهم سلوكها أو استجابتها، افحصها من الكود والتوثيق واختبارات baseline؛ لا تخمّن.

نفّذ كل ما هو موجود فعليًا من:
- browsing/search/filter/sort/pagination والـ metadata.
- upload مع progress/errors/cancellation إذا كان مدعومًا فعليًا.
- download/preview/content-type/filename handling.
- ZIP download.
- revisions/version history.
- metadata forms والتصنيفات وربط الملفات بالمشروعات.
- empty/loading/error/offline/permission states.
- confirmation/disabled/retry flows حسب النظام الحالي.

ضوابط الأمان والجودة:
1. استخدم API contracts الحالية بلا تغيير payloads/endpoints.
2. لا تسمح بتسرب ملفات بين المشروعات أو عبر تبديل route/query/filter.
3. لا تعرض links/URLs أو بيانات ملف لا يملك المستخدم صلاحية رؤيتها.
4. لا تثق بأسماء الملفات أو metadata القادمة من المستخدم، ولا تتعامل مع النصوص كـ HTML موثوق.
5. لا تخترع preview formats أو تعلن نجاح upload/download قبل استجابة حقيقية.
6. حافظ على أسماء الملفات وتدفق البيانات الحقيقي كما يحدده الخادم.
7. صمم تجربة desktop للبحث والفرز والmetadata، وتجربة mobile قابلة للاستخدام.
8. اختبر الملفات الفاشلة، الامتدادات غير المدعومة، انقطاع الشبكة، انتهاء الجلسة، وأخطاء الصلاحيات باستخدام test fixtures آمنة.
9. اكتب E2E يغطي المسار كاملًا باستخدام بيئة اختبار معتمدة، ولا تنفذ عمليات على أرشيف الإنتاج.

Skills: اقرأ فعليًا ما يتوفر من frontend-security-coder، frontend-dev-guidelines، react-patterns، design-system، mobile-design، fixing-accessibility، e2e-testing-patterns، accesslint-scan.

معايير القبول: كل عمليات Archive بالـ baseline لها اختبار أو تفسير صريح لعدم إمكانية اختبارها. لا تبدأ Phase 8 قبل التقرير وموافقة المستخدم.
```

---

# Prompt — Phase 8: Inventory & Materials Operations

```text
مهمة: Phase 8 فقط — إعادة بناء Inventory وطلبات المواد والوظائف التشغيلية المرتبطة بها التي أثبتها Phase 1.

القواعد:
- لا تغيّر مخطط قاعدة البيانات أو API أو الحسابات/الحدود أو business rules أو المخزون الفعلي.
- لا تنشئ بيانات حقيقية أو thresholds أو quantities أو alerts غير موجودة.
- لا push/deployment/commits تلقائية.

قبل التنفيذ:
راجع inventory/material requests parity matrix، قواعد الحالة والانتقالات المسموحة، endpoints والـ roles ذات العلاقة. لا تفترض أن كل الأسماء المحتملة لوحدات الشراء موجودة؛ اتبع الـ Audit فقط.

نفّذ:
1. واجهة جديدة للمخزون حسب التصميم المعتمد، تظهر الحقول والعمليات الحالية بوضوح.
2. بحث وفلاتر وفرز وترقيم وقوائم/تفاصيل/نماذج العمليات الفعلية التي يقدمها النظام.
3. طلبات المواد وكل الحالات/الموافقات والإجراءات المتاحة حسب roles وAPI الحالي.
4. low-stock/exception states فقط بناءً على values/thresholds حقيقية راجعة من النظام؛ لا تعتبر البيانات الفارغة مخزونًا منخفضًا.
5. رسائل نجاح وفشل دقيقة، ومنع النقر المتكرر أو duplicate submit قدر الإمكان دون تغيير semantics الخادم.
6. التعامل مع API/network errors والـ validation وloading/empty/permission states.
7. RTL/LTR وموبايل وديسكتوب، مع تصميم جداول/نماذج قابلة للاستخدام في العروض الضيقة.
8. اختبارات للتدفقات والحالات والـ permissions والحدود. اختبر transitions غير المسموحة وتأكد أن الواجهة لا تتيحها، مع بقاء تحقق الخادم كما هو.
9. لا تغيّر حسابات أو قيم لتناسب العرض؛ التنسيق لا يغيّر القيم الأصلية.

Skills: اقرأ فعليًا المناسب من react-patterns، frontend-dev-guidelines، design-system، design-ux، frontend-security-coder، mobile-design، fixing-accessibility، e2e-testing-patterns.

تحقق من typecheck/lint/build واختبارات الوحدة. أرفق جدول parity للوحدات. STOP بعد Phase 8 حتى الموافقة.
```

---

# Prompt — Phase 9: Administration & All Remaining Audited Modules

```text
مهمة: Phase 9 فقط — إعادة بناء كل الصفحات/الوحدات المتبقية في Phase 1 audit، دون إعادة تنفيذ ما اجتاز Phase 5–8 إلا لإصلاح تكامل واضح.

من أمثلة الوحدات التي قد تكون موجودة فعليًا: إدارة المستخدمين، الأدوار والصلاحيات، project access، settings، notifications، preferences، أي وحدات داخلية أخرى كشفها الـ Audit. هذه أمثلة وليست إذنًا باختراع صفحات.

قيود ثابتة:
- لا تعديل على Backend/Auth/RBAC/database/business logic/API contracts.
- لا تعدّل بيانات المستخدمين/الأدوار أو seed data لعلاج واجهة أو اختبار.
- لا push/deployment/commit تلقائي.
- لا تنشئ صفحة placeholder تُحسب كترحيل لوظيفة حقيقية.

نفّذ لكل وحدة متبقية:
1. أعد قراءة screen spec وfunctional inventory ومصفوفة الصلاحيات.
2. صمم التجربة وفق الاتجاه المعتمد وبأسلوب خاص بطبيعة الوحدة، لا copy/paste لنفس layout.
3. احتفظ بجميع الحقول والتحقق ورسائل الخادم والإجراءات والحالات الموجودة.
4. احترم أدوار Admin/Manager/Employee وغيرها كما اكتشفها Audit؛ لا توسع الصلاحيات ولا تستنتجها.
5. اختبر unauthorized/forbidden/empty/error/loading حالات، واللغة والـ RTL/LTR والاستجابة.
6. لا تغير منطق session/permissions بالخادم لتسهيل الصفحة.
7. حدّث parity matrix بكل وظيفة تم نقلها وكيف اختُبرت.
8. إذا كان عدد الوحدات كبيرًا، قسم Phase 9 إلى دفعات فرعية ضمن نفس المرحلة، وقدم تقريرًا بعد كل دفعة؛ لا تنتقل لمهمة غير معلنة.
9. إذا وجدت وحدة تعتمد على endpoint غير موجود، وثق blocker وتوقف عن هذه الوظيفة دون إنشاء endpoint أو تغيير الخادم.

Skills: اختر المهارات طبقًا لموضوع كل وحدة، وتحقق من قراءة Skill.md فعلًا. أمثلة: react-patterns، react-ui-patterns، frontend-security-coder، design-system، design-ux، fixing-accessibility، accesslint-scan، e2e-testing-patterns. لا تستخدم قائمة أسماء كبديل عن التطبيق الحقيقي.

معيار القبول: جميع الوظائف المتبقية من Audit تم ترحيلها أو يوجد استثناء موثق ومعتمد. توقف بعد تقرير Phase 9، ولا تنتقل لـ Phase 10 دون موافقة المستخدم.
```

---

# Prompt — Phase 10: Cross-App QA, Accessibility, Security & Functional Parity

```text
مهمة: Phase 10 فقط — اختبار شامل للـ Frontend v2 وإثبات التكافؤ الوظيفي قبل الجاهزية للإصدار.

هذه مرحلة تحقق وإصلاح عيوب Frontend داخل النطاق فقط، وليست فرصة لإعادة التصميم أو توسيع الميزات أو تعديل الـ Backend.

ثوابت:
- لا تغيير في Backend/API contracts/DB/schema/data/business logic/RBAC.
- لا push/deployment/commits تلقائية.
- لا تخفِ اختبارات فاشلة ولا تستخدم skip/weak assertions لإعلان النجاح.
- يمكن تعديل test-only locator إذا كان سبب الفشل مثبتًا أنه selector غير دقيق، لكن اذكر التغيير منفصلًا.

نفّذ:
1. شغّل scripts الفعلية الخاصة install/typecheck/lint/unit/integration/e2e/build، واذكر الأوامر وexit codes وأعداد الاختبارات.
2. أكمل functional parity matrix: كل route/action/form/API/permission/state يجب أن يكون له نتيجة اختبار أو استثناء مبرر وموافق عليه.
3. اختبر أدوار المستخدمين والوصول للمشروعات والـ unauthorized/forbidden. لا تستخدم role data حقيقية في بيئة خارج الاختبار.
4. اختبر viewport widths 375/768/1024/1366/1920 وRTL/LTR، مع نص عربي طويل وemail/file names/IDs/large values.
5. اختبر keyboard-only navigation وfocus-visible وlabels/icon buttons وdialog focus/Escape/reduced-motion/touch targets والتباين باستخدام الأدوات الموجودة.
6. اختبر loading/error/empty/offline/session-expired/network-timeout/retry حالات.
7. اختبر عمليات Archive: upload/download/preview/ZIP/revisions؛ وInventory/Materials: الحالات والانتقالات؛ وDashboard/Projects: search/filter/sort/pagination/actions حسب baseline.
8. اختبر PWA/service worker/install/update/offline إذا كانت تلك الميزات موجودة في baseline؛ لا تكسرها أو تغيرها بصمت.
9. راجع browser console/network وReact warnings وfailed requests وأخطاء الإنتاج.
10. أعد اختبار authz.spec.ts:22 المذكور سابقًا. إن ظهر أنه يفشل لأن `tr hasText 'admin'` يطابق `admin` و`m.amin`، أصلح locator في الاختبار فقط ليطابق اسم المستخدم المقصود بدقة، ثم أعد الاختبار واختبارات authz. لا تغير صفوف قاعدة البيانات أو صلاحيات المستخدمين.
11. اعمل diff review للملفات المتغيرة للتأكد من عدم وجود تغييرات خارج Frontend/tests/docs، وتأكد من عدم وجود أسرار أو بيانات أرشيف داخل fixtures/screenshots/test artifacts.
12. أصلح عيوب Frontend داخل النطاق فقط؛ إذا احتاج الحل API/backend change، وثق blocker ولا تنفذه.

Skills: اقرأ فعليًا المتاح من e2e-testing-patterns، fixing-accessibility، accesslint-scan، frontend-security-coder، brooks-review، frontend-dev-guidelines، progressive-web-app. وضّح أي skill غير متاحة.

التقرير يجب أن يحتوي:
- Summary PASS/PARTIAL/BLOCKED.
- جدول لكل check مع الأمر والنتيجة والعدد.
- جدول parity المتبقي.
- العيوب التي أصلحت والملفات المتغيرة.
- الاختبارات التي لم يمكن تشغيلها وأسباب ذلك.
- تأكيد عدم تغير Backend/DB.
- أي استثناءات تستلزم موافقة المستخدم.

لا تعلن PASS كاملًا لو ظل اختبار حرج فاشلًا أو لم يُختبر تدفق أساسي. توقف بعد التقرير ولا تبدأ Phase 11 دون الموافقة.
```

---

# Prompt — Phase 11: Release Readiness & Handover (No Deployment)

```text
مهمة: Phase 11 فقط — إعداد تسليم Release Readiness للـ COS Frontend v2 بعد اعتماد نتائج Phase 10.

مهم: هذه ليست موافقة على النشر. ممنوع deployment أو git push أو merge أو DNS changes أو تغيير قاعدة البيانات.

ثوابت النظام:
- React + TypeScript + Vite.
- Backend/API contracts/PostgreSQL/business rules/RBAC كما هي.
- عدم احتواء bundle أو docs أو fixtures على secrets أو بيانات أرشيف حقيقية.

المطلوب:
1. راجع كل تقارير Phase 0–10 وملف functional parity matrix النهائي.
2. نفذ آخر typecheck/build والاختبارات المطلوبة مجددًا على الحالة الحالية، وسجل الأمر والـ exit code والعدادات.
3. أنشئ docs/frontend-rebuild/release-readiness.md يتضمن:
   - بنية Frontend v2 والقرارات المعمارية.
   - قائمة routes/modules المنجزة.
   - كل التبعيات الجديدة وأسبابها.
   - قائمة الملفات/المجلدات المهمة للتشغيل.
   - خطوات إعداد بيئة التطوير وتشغيل الواجهة وبناء نسخة production، استنادًا إلى scripts الموجودة فعليًا.
   - env var NAMES المطلوبة فقط دون قيم أسرار.
   - نتائج الاختبارات والتغطية والقيود المعروفة.
   - parity matrix النهائية وأي استثناء وافق عليه المستخدم.
   - مقارنة Frontend القديم والجديد ونقاط الرجوع.
4. اكتب rollback/cutover runbook كوثيقة: كيف يتم الرجوع للنسخة القديمة، وما التغييرات التي قد تتطلب تنسيقًا إذا تقرر النشر مستقبلًا. لا تنفذ التحويل.
5. راجع Git status/diff للتأكد من أن العمل في الفرع/worktree الجديد فقط، وأن الفرع الأساسي لم يُعدل. لا تعمل commit أو push أو merge.
6. لا تكتب ادعاء أن التطبيق تم نشره أو اختباره على production إذا لم يحدث ذلك.

Skills: اقرأ المناسب فعلًا من progressive-web-app، frontend-security-coder، e2e-testing-patterns، frontend-dev-guidelines، brooks-review، إذا كانت متوفرة.

أخرج التقرير النهائي بالعربية، واذكر بوضوح:
- هل الإصدار جاهز للمراجعة أم لا؟
- ما الذي ثبت نجاحه؟
- ما الذي لم يُختبر أو ما زال مخاطرة؟
- هل بقيت فجوات parity؟
- ما قرار المستخدم المطلوب قبل merge/deployment؟

ثم توقف تمامًا. لا تدمج إلى الفرع الأساسي ولا تنشر دون أمر صريح جديد.
```

---

## تسلسل التشغيل المختصر

1. Phase 0: تأمين نسخة Git والـ baseline.
2. Phase 1: تدقيق كامل بلا تغييرات تطبيق.
3. Phase 2: عرض UX/design proposal وانتظار الموافقة.
4. Phase 3: بناء interactive prototype وانتظار تجربة المستخدم وموافقته الصريحة.
5. Phase 4: تأسيس البنية الجديدة.
6. Phase 5: Shell/auth/localization.
7. Phase 6: Dashboard + Projects.
8. Phase 7: Archive.
9. Phase 8: Inventory + Materials.
10. Phase 9: الإدارة وباقي الوحدات المكتشفة.
11. Phase 10: QA/parity/accessibility/security.
12. Phase 11: release-readiness والتسليم دون نشر.

**لا تسمح للـ Agent بتجاوز أي بوابة موافقة.** إذا قال إنه انتهى من مرحلة، راجع التقرير والأدلة أولًا، ثم أرسل Prompt المرحلة التالية فقط.
