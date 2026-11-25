# Phase 14C — الوثيقة 04: جاهزية عقود الـ API (API Readiness)

> **الأساس:** عقود 14B-03 مقارنةً بالأدلة الآمنة (`session.ts`، `http/api.ts`، أنواع shared) — دون ادعاء وجود endpoint بلا دليل، ودون فتح الملفات المحمية.
> **مفتاح التصنيف:** `EXISTING-VERIFIED` موجود ومُدقق · `EXISTING-ADAPT` موجود ويحتاج تكييفًا · `PROPOSED-READY` مقترح جاهز للتنفيذ · `PROPOSED-BLOCKED-BUSINESS` مقترح ينقصه قرار · `UNKNOWN-PROTECTED` وجوده/غيابه لا يُثبت إلا بمصدر محمي.
> **التاريخ:** Tue Nov 17 2026

---

## 1. المسطح الموصَّل الوحيد اليوم [EXISTING-VERIFIED]

| Endpoint | دليل | ملاحظة |
|---|---|---|
| `POST /api/auth/login` {username, password, rememberMe?} | `session.ts` L43–50 | 401 برسالة عربية؛ يعيد accessToken + user(permissions) |
| `POST /api/auth/refresh` (cookie `cos_refresh` HttpOnly path=/api/auth) | `client.ts` عبر session | تجديد صامت |
| `GET /api/auth/me` | `session.ts` L53–56 | 401 self-heals |
| `POST /api/auth/logout` | `session.ts` L78–86 | يلغي جهاز الجلسة الحالي فقط |
| `GET /api/projects?page=1&pageSize=1000` | `http/api.ts` L123–128 | **hack** يُعالج في P0 (قائمة حقيقية ListQuery) |
| `POST /api/projects` | `http/api.ts` L134–146 | يتطلب projects.create خلفيًا؛ zod errors تُسطح كما هي |
| `PUT /api/projects/:id` | `http/api.ts` L150–158 | patch جزئي؛ الحقول الغائبة تُترك |
| كل ما عداها | Proxy `not wired` — فشل صريح بلا fallback صامت | `http/api.ts` L17–42, L219–225 |

## 2. جرد النقاط حسب الموديول

### 2.1 المصادقة/الجلسة
| النقطة | الحالة | ملاحظة |
|---|---|---|
| login/refresh/me/logout | **EXISTING-VERIFIED** | التعزيزات (تدوير refresh، قفل الحساب N/نافذة) [Proposed-READY] خلفية |
| مسار دخول بالإيميل | — | **غير مصمم** — قرار مالك D4 إن طُلب |

### 2.2 المشاريع
| النقطة | الحالة |
|---|---|
| GET/POST/PUT /api/projects | **EXISTING-VERIFIED** + **EXISTING-ADAPT** (GET → ListQuery؛ POST/PUT إضافة fields الجديدة عند اعتماد schema) |
| GET /api/projects/:id (تفصيل) | **UNKNOWN-PROTECTED** (قد يكون موجودًا في projects.routes.ts) |
| DELETE/restore (O12) + بوابة المحذوف | **PROPOSED-READY** (بقرار D2 لبوابة الرؤية) |
| list المحذوفين | **PROPOSED-READY** (D2) |

### 2.3 الأرشيف/المستندات
| النقطة | الحالة |
|---|---|
| قوائم/تفصيل مستندات + مجلدات | **UNKNOWN-PROTECTED** (documents/folders routes) |
| رفع/مراجعة/انتقالات الحالة (O3) | **PROPOSED-READY** (المصفوفة موحدة 01 §4.3) |
| ربط مستند-مشروع + نطاق ≥ READ | **PROPOSED-READY** |
| حذف مستند (منطقي) | **PROPOSED-READY** |
| استيراد CSV | **PROPOSED-BLOCKED-BUSINESS** — عائق الخلفية (الوثيقة 02) |
| حد حجم/أنواع الملفات | **UNKNOWN-PROTECTED** (allowlist) + قرار D6 |

### 2.4 المالية + IPC
| النقطة | الحالة |
|---|---|
| BOQ قائمة/تفصيل/تحرير | **UNKNOWN-PROTECTED** (وجود boq.routes.ts مؤكد بالاسم فقط) |
| IPC دورة رسمية (نقل حالة بـ ipc_status_events) | **PROPOSED-READY** — مشروط P0-Schema + مفاتيح B1 |
| اعتماد/رفض IPC (`ipcs.approve`) + منع الذاتي | **PROPOSED-READY** (B1 معتمد للمفردة؛ إسناد الأدوار D1؛ بديل مؤقت projects.edit **غير آمن** — يُعلَّم) |
| إعادة تقديم (`ipcs.resubmit` أو projects.edit) | **PROPOSED-READY** |
| الصرف/الضريبة/الاستقطاع/المقدمات | **لا endpoints** — قرارات O5/O6 (عرض unavailable) [Final] |

### 2.5 الإدارة/المستخدمون/الصلاحيات
| النقطة | الحالة |
|---|---|
| CRUD مستخدمين + dept/title | **PROPOSED-READY** (بعد P0-Schema) |
| التجاوزات INHERIT/GRANT/DENY | **PROPOSED-READY** (O13) |
| إدارة وصول المشاريع | **PROPOSED-BLOCKED-BUSINESS** — مفتاح `projects.access` prototype-only (D7) |
| إعادة تعيين كلمة المرور (إداري/self) | **PROPOSED-READY** (تصميم) — قناة التسليم قرار تشغيلي |
| إدارة أدوار مخصصة | **PROPOSED-BLOCKED-BUSINESS** — `roles.manage` غير موجود في المفردة (D7) |
| تعطيل آخر admin (409 LAST_ADMIN) | **PROPOSED-READY** |

### 2.6 التدقيق
| النقطة | الحالة |
|---|---|
| قائمة تدقيق + فلاتر (مستخدم/نوع/فترة/مشروع) | **PROPOSED-READY** |
| فلتر projectId يتطلب ≥ READ | **PROPOSED-READY** |
| oldValue/newValue/ipAddress مقلمة لغير admin | **PROPOSED-READY** |

### 2.7 اللوحة + البحث
| النقطة | الحالة |
|---|---|
| عدادات اللوحة (بلا مالي؛ مقيدة بنطاق) | **PROPOSED-READY** (O7) |
| البحث العالمي (O9) | **PROPOSED-READY** — لا أعداد/عناوين لغير المرئي؛ الفلترة العميلية غير معتمدة |
| جرد ما قد يكون موجودًا خلف المحميات | **UNKNOWN-PROTECTED** (global-search.service.ts) |

### 2.8 الاسترجاع/النسخ
| النقطة | الحالة |
|---|---|
| backup create/list/verify | **PROPOSED-READY** (تصميم؛ تنفيذ تشغيلي P2/P3) |
| restore dry-run → commit(confirmToken) | **PROPOSED-READY** — استرجاع الحالة عبر poll على restore_jobs (توافق مع استجابات مهمة خلفية) |

## 3. عقد الموحد [Proposed مع المطابقة الحية]

- Base `/api` [Confirmed]؛ Bearer قصير + cookie refresh [Verified].
- النجاح للقوائم: `PagedResult<T>` [Confirmed النوع].
- **الخطأ الموحد:** `HTTP status + { error: { code, message, details? } }` — قائمة الأكواد كما في 14B-03 §1 (SELF_APPROVAL_DENIED, LAST_ADMIN, PROJECT_DELETED, RING/الاتساق, unavailable envelope...). **الوحيد المؤكد حيًّا من اتجاه آخر:** رسائل الخطأ العربية تُسطح verbatim من الخلفية (api.ts L130–133).
- **المظروف `unavailable`:** `{ unavailable: true, reason }` بالأسباب الموحدة (NOT_ENTERED/PAYMENTS_DEFERRED/TAX_RULES_UNDEFINED/RETENTION_RULES_UNDEFINED/ADVANCE_RULES_UNDEFINED) [Proposed-READY].
- IDOR: كل وصول بعنصر يمر ببوابة النطاق؛ لا استثناء للتفصيلي [Proposed-READY].

## 4. التناقضات والتبعيات المكتشفة

1. **pageSize=1000 hack** — يُلغى ضمن P0 (Adapt GET) قبل أي شاشة قائمة جديدة؛ تبعية صريحة.
2. **عقد الاستيراد غير قابل للتثبيت** — يبقى [Proposed] حتى إزالة العائق (R1).
3. **failing-fast Proxy** — كل شاشة جديدة يجب أن تستهدف endpoints مقترحة حصرًا معلنة، وإلا فشل صريح — يمنع الادعاء الزائف بالتكامل.
4. **استجابات مهمة خلفية** (استرجاع/استيراد كبير) → عقد poll موحد على restore_jobs/import_batches — يمنع الواجهة من افتراض استجابة فورية.
5. **B1 + بديل مؤقت:** حتى إضافة المفتاحين، أي تنفيذ IPC يجب أن يرفض الاعتماد الذاتي بغض النظر عن الأدوار — القاعدة الشخصية لا الدورية.
6. **جرد ما هو موجود:** قبل بناء أي endpoint مقترح، جرد مصرَّ به للمحميات يمنع إعادة بناء ما وُجد (07 §4.4).

## 5. خلاصة

| الحالة | عدد النقاط |
|---|---|
| EXISTING-VERIFIED | 7 (auth×4 + projects×3) |
| EXISTING-ADAPT | 1 (GET projects → ListQuery) |
| PROPOSED-READY | ~20 (قواعد/عقود محددة داخل 14B) |
| PROPOSED-BLOCKED-BUSINESS | 3 (استيراد CSV، إدارة أدوار، وصول مشاريع) |
| UNKNOWN-PROTECTED | 4 (تفصيل مشروع، قوائم/تفصيل مستندات، BOQ/IPC موجود، بحث/جرد) |
