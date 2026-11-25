# تقرير المرحلة 4 — أساس الواجهة (Frontend Foundation)

**التاريخ:** 2026-10-20
**الحالة:** مكتملة — بانتظار مراجعة المالك (نفس نمط المراحل السابقة: لا commit، لا push، لا deploy).
**مساحة العمل:** `docs/frontend-rebuild/phase-03-prototype/` (النموذج المعتمد من المرحلة 3) — لم يُمس `apps/web` إطلاقًا.

---

## 1. الملخص التنفيذي

تم تحويل النموذج المعتمد من المرحلة 3 إلى **بنية معيارية موجّهة بالميزات (Feature-Oriented Modular Architecture)** دون أي تغيير سلوكي أو بصري معتمد:

- **typecheck: نجاح** (`npx tsc --noEmit` — EXIT=0، صارم).
- **builds: نجاح** (`npx vite build` بمتغير `VITE_PROTOTYPE='1'` → `dist` و `dist317c`).
- **الاختبارات: نجاح كامل** — **264/264 اختبارًا** (15 ملفًا، ~10.4 دقيقة، EXIT=0)، منها 5 اختبارات أساس جديدة للمرحلة 4.
- **التوثيق:** البنية موثقة في هذا التقرير + `docs/frontend-rebuild/phase-04/ARCHITECTURE-MAP.md` + تحديث مسارات `phase-03-prototype/README.md`.
- **Backend:** لم يُعدّل أي ملف في `apps/api/*` أو قاعدة البيانات أو `package.json` الجذري.
- **المرحلة 5 لم تبدأ.**

---

## 2. خريطة قبل/بعد

الخريطة التفصيلية (قبل) موثقة في `docs/frontend-rebuild/phase-04/ARCHITECTURE-MAP.md`. الملخص:

| قبل (مرحلة 3) | بعد (مرحلة 4) |
|---|---|
| `src/main.tsx` (routes + guards + providers معًا) | `src/main.tsx` (تركيب فقط) + `src/app/router.tsx` (شجرة المسارات + Guard) + `src/app/bootstrap.tsx` (تركيب Providers + ErrorBoundary) |
| `src/pages/` (شاشات 18 مختلطة) | `src/app/pages/` (Login/Settings/Search/Notifications) + `src/features/<module>/` للشاشات التسع التجارية |
| `src/components/` (Shell/palette/ui مختلطة) | `src/app/layouts/` (AppShell/CommandPalette) + `src/shared/ui/` (نظام التصميم + icons + ContextualExport + barrel) |
| `src/auth.tsx` | `src/app/providers/auth.tsx` |
| `src/i18n.tsx` (ملف واحد) | `src/i18n/` (المعجم ar/en منفصلان حرفيًا، + `direction.ts`، + `setup/`، + `index.ts`) |
| `src/mock/` (بيانات + محوّل مباشر) | `src/services/api/` (facade + configuration + client + errors + types + `adapters/mock/*`) |
| `src/styles.css` + `src/lib/` | `src/shared/styles/` + `src/shared/lib/` (motion/files) |

**الوحدات السبع:** `dashboard` · `projects` (وتحت مشروع "المالية/Financials" — انظر §3) · `archive` · `inventory` · `requests` · `reports` · `administration`. لكل وحدة `index.ts` عام (السطح العام الوحيد) وملفاتها داخل `components/`.

### الأصلان المعمول بهما (مُختبران آليًا في `verify/phase4.spec.ts`)

1. features لا تستورد features (إلا فهرسها الخاص بالوحدة نفسها).
2. shared لا تستورد features؛ services لا تستورد `@/shared/ui` ولا تُصدر ملفات `.tsx` (أما `@/shared/lib/files` فمسموح لأنه خالٍ من React).

---

## 3. قرارات معمارية موثقة

- **Financials تحت `features/projects`:** شاشات المستخلصات/المقايسة/السندات تعمل حصريًا داخل مساحة عمل مشروع معين (`/projects/:id/financials`) وبياناتها مشتقة من بنود المشروع نفسه، ففصلها لوحدة مستقلة كان سينتج اقترانًا مقلوبًا (نقل الحالة والـ loaders بين الوحدتين) دون أي فائدة عزل. التوثيق هنا قرار معتمد لا حل مؤقت.
- **عدم نسخ منطق الأعمال إلى الواجهة:** القاعدة "الشاشة = مكوّن عرض فقط" هي ما يلزم (متطلب صريح في الخطة)؛ كل الحسابات المالية المشتقة تبقى في نواة بيانات mock (`adapters/mock/`) كما ثبتت في اختبارات "لا توجد أرقام مشتقّة يدويًا".
- **State strategy (أصغر حل):** بدون مكتبة state جديد — state محلية بالـ `useState/useEffect`، و server-state داخل `adapters/mock`، وauth/lang في Provider واحد لكلٍّ. (توثيق: حالة العرض = `useState`؛ جلسة/ثيم = Providers؛ بيانات وهمية = mock adapter؛ لا حاجة موثقة لأكثر من ذلك في هذه المرحلة).
- **routing:** شجرة المسارات منقولة **حرفيًا** من `main.tsx` القديم إلى `app/router.tsx` + `Guard` لكل مسار حسب الصلاحيات (غير مصرح ← `/login`؛ ممنوع ← صفحة 403 معتمدة). مُسار تجريبي جديد `/_test/crash` محمي بـ `IS_PROTOTYPE` لاختبار حدود الأخطاء.
- **loading/error/empty:** تُعاد استخدام الأنماط المعتمدة المرئيًا (skeletons، حالات الفارغ، 404/403) عبر `app/boundaries/states.tsx` (منقول حرفيًا) لا باختراع جديد.

---

## 4. طبقة الـ API والمحوّل

### التصميم

- `src/services/api/index.ts` = **facade (حد المحوّل الوحيد)**؛ التصدير `ApiAdapter = typeof mockAdapter` — أي أن حمولة الأنواع مشتقة من المحوّل الفعلي بلا تعميم مخطّئ.
- `configuration.ts` يكشف `IS_PROTOTYPE` / `API_MODE` / `API_BASE_URL` (غير مستهلك بعد — جاهز للمرحلة 5).
- **لا يوجد محوّل HTTP حقيقي مسجَل:** الأولوية كانت عدم اختراع عقود API (انظر §5). الخدمات تستهلك facade فقط، وسلوك الأخطاء/الحالات يُغطى عبر `errors.ts` وأنماط الـ mock الحالية.

### عزل الـ mock في production (نقطة أمان أساسية)

- `adapters/mock/api.ts` يرمي عند الاستيراد في بيئة إنتاج بلا `VITE_PROTOTYPE=1` (حارس زمن الاستيراد).
- مُختبر آليًا من Node (`verify/probe-mock-isolation.mjs` — تجميع esbuild بدون VITE + رمي متوقع) وضمن `phase4.spec.ts`.

### الحفاظ على شكل تعاقدات اختبارات 3.2–3.7

مُخرجات mock `result.error` ما زالت بحرفيها العربي (العقود من 3.2–3.7 تعتمد عليه)، مع التعريب عبر `errorKeys.ts` داخل طبقة العرض — بلا تغيير شكل.

---

## 5. ملاحظة صريحة — خريطة عقود المرحلة 1

خريطة عقود API للمرحلة 1 **لم تُنتَج مطلقًا** ولم تُلتزم ضمن أي commit (بنود وثيقة المراجعة الأولى الأخرى غطّت أولويات أُنجزت بدلًا منها). تبعًا لمنع اختراع نقاط نهاية/أشكال استجابة، تمت قراءة سطح العقود **قراءةً فقط** من `apps/api/src/routes` كسياق، ولم يُسجَّل **أي محوّل HTTP حقيقي**، لتبقى المرحلة 5 هي نقطة تعريف الخدمة الحقيقية بلا مساس بالعقود من هذه المرحلة.

---

## 6. i18n وRTL/LTR والنصوص المختلطة

- المعجم منقسم: `src/i18n/locales/ar.ts` (337 سطرًا حرفيًا) و `locales/en.ts` (335 سطرًا حرفيًا) — صفر فجوات EN لأن `TKey` مشتق من معجم AR (نقص مفتاح = خطأ ترجمة compile-time).
- `direction.ts`: تطبيق `dir`/`lang` على `<html>` (rtl/ltr) مرتبط بـ Provider، والاستمرارية عبر `cos-proto-lang`.
- النصوص المختلطة محفوظة (اختبار آلي + تحقق حي): `data-i18n-skip` على حاويات الأسماء، والـ IDs/الأكواد/الإيميلات الإنجليزية داخل النص العربي (B-14) بلا قلب اتجاه.
- **تحقق حي (خادم المالك :5199):** تسجيل دخول حقيقي من واجهة المستخدم + تحقق `dir/lang/h1` عربي؟ RTL ✓ ثم تغيير اللغة → `en` + LTR ✓ مع بقاء اسم المستخدم عربيًا، و**صفر أخطاء console** في كامل الجولة.

---

## 7. حدود الأخطاء (Error Boundaries) وحالات الصفحات

- `app/boundaries/ErrorBoundary.tsx`: مكوّن فئة، مغلق ثنائي اللغة، أزرار "حاول مجددًا / Try again" (إعادة حالة المكون — إثبات: إعادة الرمي من مسار `/_test/crash` تنجح) و"العودة للرئيسية / Back home" (`window.location.assign('/')`). سلوك ثبتته `phase4.spec.ts` (يكشف `[ErrorBoundary]` في console ولا يُعيد إلقاء عند معالجته).
- 404 ("الصفحة غير موجودة") و403 (الـ `Forbidden`) منقولة حرفيًا ومُختبرةً.

---

## 8. حادثة اختبار الأعمال (financials) — كشف السبب الجذري وإصلاحه

**التفصيل:** في أول تشغيل كامل ظهر اختبار واحد فاشل من أصل 264 (وهو خلل أرشِفة معروف من المرحلة 3 نفسها — أُغلق حينها على مستوى الاختبار بانتظار الإصلاح الجذري، ولم يُعالَج الكودي). إعادة تشغيل ملف الـ financials كاملًا أظهرت فشلين من 130 = **نسبة ارتجال ~20% تحت حِمل الملف الكامل**.

**العلامة الحتمية (خطأ ×3 بالتزامن):** عند فتح حوار "تعديل بند"، بعد `fill('600')` على حقل الفئة: (أ) الفئة عادت إلى 520، (ب) حقل رقم البند أصبح `07-01600` (أي `07-01` ثم إلحاق `600`)، (ج) الإجمالي بقي 1,664,000.

**السبب الجذري (موثق الآن في الكود):** `Modal` في `src/shared/ui/ui.tsx` كان يؤجّل تركيز أول حقل على **مؤقّت 30ms** (setTimeout). تسلسل `fill()` في Playwright = focus(العنصر الهدف) ثم إدخال النص؛ إذا أمس المؤقّت الفجوة بين الخطوتين، انتقل التركيز إلى أول حقل (رقم البند) فسقطت الأحرف الثلاثة فيها كإلحاق، فيما لم يُلمس حقل الفئة إطلاقًا — وهو أيضًا **خلل UX حقيقي** (مستخدم بشري سريع الكتابة بعد انفتاح الحوار مباشرة قد تخطف نافذةٌ خفية أول أحرفه إلى حقل آخر).

**الإصلاح (نفس السلوك، توقيت محسوم):** تحويل التأخير إلى **تركيز متزامن داخل الـ effect** بعد اكتمال الالتزام (`useEffect` بعد تحول `open` إلى true). آمن: لا `visibility:hidden` أولي في CSS للمودال (الأنيميشن opacity/transform فقط)، وترتيب تأثيرات React يسبق أي `fill` لاحق من Playwright.

**الإثبات:**
1. نفس profile الفاشل `npx playwright test -c verify/pw.config.ts financials --repeat-each=10`: **150/150 نجاح** (بعد الإصلاح) مقابل 2×فشل من 130 قبله.
2. Typecheck + rebuild ✓ ثم **full suite: 264/264 برفع EXIT=0**.

**ملفات الكود الوحيدة ذات تغيير منطقي في هذه المرحلة:** إصلاح مؤقّت التركيز أعلاه في `ui.tsx`، والإصلاح اللازم بعد الفصل في `mock/api.ts` (استيراد `@/shared/lib/files` لمعười CSV/التصدير — ملف خالٍ من React يسمح به قواعد الاعتماد). كل ما عدا ذلك = إعادة تنظيم ملفات + إعادة توجيه مسارات `@/` فقط.

---

## 9. إدارة الاعتماديات (Dependency Ledger)

| الحاجة | التقدير | النتيجة |
|---|---|---|
| روتر/إدارة state/جدولة/اختبارات/تحليل التبعيات | — | **صفر اعتماديات جديدة** — كل ما تحتاجه المرحلة 4 متوفر من node_modules المثبتة مسبقًا (react, react-router-dom, vite, tsc, playwright). بلا تغيير `package.json`/lockfile. |

---

## 10. ما لم يُمس (تأكيدات)

- `apps/api/*` — لم يُقرأ إلا `src/routes` قراءةً فقط. **صفر تعديلات.**
- قاعدة البيانات — صفر مساس.
- `apps/web/*` — لم يُفتح للتعديل.
- `package.json` الجذري + lockfile — صفر مساس.
- الـ تصميم المعتمد (Motion/Design tokens/SplitText/الترحيب) — صفر تغييرات مرئية (اختبارات motion317c/317d + i18n + coverage كلها تنجح، والتحقق الحي: boot/greeting/404/حركة الحدود منقولة حرفيًا وتصمد).
- تغييرات المالك في المستودع (بما فيها `:5199` PID 26812، وملفات `docs/` غير النظيفة) — لم تُمس.
- لا commits / لا pushes / لا merges، سياسة كل المراحل.

---

## 11. كيف تُراجع (للمالك)

من `docs/frontend-rebuild/phase-03-prototype/`:

```powershell
npx tsc --noEmit                       # EXIT=0
$env:VITE_PROTOTYPE='1'
npx vite build --outDir dist --emptyOutDir   # نفس الأمر لـ dist317c
npx playwright test -c verify/pw.config.ts   # 264/264, ~10.4min, EXIT=0
```

خادم `:5199` الخاص بالمالك مشتغل ويخدم `dist` من القرص — جولة حية تمت (تسجيل دخول → dashboard → greeting AR/RTL → تبديل EN/LTR → صفر أخطاء console).

**الاختبار الأساسي الجديد** (`verify/phase4.spec.ts` — 5 اختبارات): إقلاع من الطبقة الجديدة، 404 حرفي، ErrorBoundary صمم/التقط/استعاد عبر `/_test/crash`، عزل mock في production، audit قواعد الاعتماد. كما إضيف `verify/probe-mock-isolation.mjs` (تجارب Node-side).

---

## 12. ما لم يبدأ

**المرحلة 5 (App Shell حقيقي، تجربة الدخول، الإتاحة) لم تبدأ.** كل ما سبق هو أساس المرحلة 4 بحدودها: foundation + smoke tests فقط.

---

## 13. ملخص القبول (معيار الخطة §198)

| البند | الحالة |
|---|---|
| بنية مجلدات/modules وحدود مسؤوليات | ✅ (§2–§3، مُختبرة آليًا) |
| فصل presentation عن API/data-access بعن domain view models بلا نسخ منطق الأعمال | ✅ (§3/§4 — الحسابات المشتقة داخل نواة mock، بلا نسخ) |
| routing + error boundaries + loading/error/empty + layout components | ✅ (§7، مُختبر: 404/403/حدود/حيوية البروتوكول) |
| استراتيجية state واضحة حسب النوع (بلا مكتبة state بلا حاجة موثقة) | ✅ (§3) |
| i18n + RTL/LTR + أنماط النصوص المختلطة | ✅ (§6، تحقق آلي + حي) |
| API client آمن متوافق مع السلوك الحالي (أخطاء/timeout/انقطاع) | ✅ بالحد الممكن (§4/§5 — بلا اختراع عقود؛ facade + errors + أنماط mock الثابتة) |
| حماية الجلسة + لا أسرار + لا اختراع auth flows | ✅ (mock فقط، بلا fetch/XHR في الواجهة، الجلسة سبق أن ثبتها المرحلة 3 بالكامل) |
| اختبارات أساسية + CI-friendly scripts | ✅ 264/264 + 5 أساس جديد + probe Node-side (§8/§11) |
| مراجعة dependencies قبل التثبيت | ✅ صفر اعتماديات (§9) |
| **معيار القبول:** typecheck/build/اختبارات + توثيق البنية وتدفق API + عدم تعديل Backend/DB | ✅ كليًا (§1/§8/§10) |
