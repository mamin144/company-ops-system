# Phase 14B — الوثيقة 05: مصفوفة التخويل (Authorization Matrix)

> **قاعدة O13 (APPROVED — لا إعادة تصميم):**
> 1. أساس الدور `ROLE_BASE` كما هو حرفيًا.
> 2. تجاوزات المستخدم: `INHERIT / GRANT / DENY`.
> 3. **DENY يتقدم دائمًا**.
> 4. وصول المشاريع: `NONE / READ / WRITE / DELETE`.
> مصدر التحقق المزدوج [Confirmed]: `packages/shared/src/permissions.ts:ROLE_PERMISSIONS` مطابق حرفيًا لـ `mock/data.ts:ROLE_BASE` (L300–306).

---

## 1. مفتاح التصنيف

- **[Confirmed]** المفتاح موجود في ALL_PERMISSIONS (27) وتوزيعه في ROLE_PERMISSIONS.
- **[Prototype-only]** موجود في mock/MANAGED_GROUPS فقط — **ليس** في ROLE_BASE الخلفي؛ يتطلب قرار خلفي قبل الاعتماد.
- **[Proposed]** مفتاح جديد يقترحه 14B — **خارج O13** حتى يعتمده المالك (إضافته تغيير على نموذج الصلاحيات).

---

## 2. ROLE_BASE — النص الحرفي [Confirmed]

| الصلاحية | admin | management | warehouse | technical | viewer |
|---|:-:|:-:|:-:|:-:|:-:|
| archive.view | ✅ | ✅ | ✅ | ✅ | ✅ |
| archive.upload | ✅ | — | — | ✅ | — |
| archive.edit | ✅ | — | — | ✅ | — |
| archive.delete | ✅ | — | — | — | — |
| archive.download | ✅ | ✅ | ✅ | ✅ | ✅ |
| warehouse.* (view/create/edit/delete + stock_in/out/transfer/adjust/return) | ✅ الكل | view فقط | view/create/edit + العمليات، بلا delete | view فقط | view فقط |
| projects.view | ✅ | ✅ | ✅ | ✅ | ✅ |
| projects.create | ✅ | ✅ | — | — | — |
| projects.edit | ✅ | ✅ | — | — | — |
| projects.delete | ✅ | — | — | — | — |
| materialRequests.view | ✅ | ✅ | ✅ | ✅ | ✅ |
| materialRequests.create | ✅ | — | — | ✅ | — |
| materialRequests.approve | ✅ | ✅ | — | — | — |
| materialRequests.issue | ✅ | — | ✅ | — | — |
| reports.view | ✅ | ✅ | — | — | — |
| audit.view | ✅ | ✅ | — | — | — |
| settings.manage | ✅ | — | — | — | — |
| users.manage | ✅ | — | — | — | — |
| backup.manage | ✅ | — | — | — | — |

*(المخازن مذكورة مختصرة لكونها خارج نطاق الموديولات الستة — النص الحرفي الكامل في `permissions.ts` L33–61.)*
**Fallback [Confirmed]:** `permissionOf(role)` لأي دور غير معروف = صلاحيات `viewer` — قاعدة حفاظ أمنية.

---

## 3. المفاتيح prototype-only [Confirmed غيابها من ROLE_BASE]

| المفتاح | يظهر في mock | الاستخدام المصمم | الحالة |
|---|---|---|---|
| `users.resetPassword` | مجموعة «الإدارة» | إطلاق إعادة تعيين كلمة مرور لمستخدم (O10) | prototype-only — تحتاج إثباتًا خلفيًا أو إضافة معتمدة |
| `roles.manage` | مجموعة «الإدارة» | إنشاء/تعديل أدوار مخصصة | prototype-only |
| `projects.access` | مجموعة «الإدارة» | إدارة وصول المستخدمين للمشاريع | prototype-only |
| `sites.edit` | (mock) | إدارة المواقع | prototype-only |
| `email`/`dept`/`title` في mockUsers | نعم (بيانات) | email حقل هوية **قائم** (قرار المالك — تصحيح O1)؛ dept/title **الجديدان** في O1 | بيانات نموذجية لا صلاحيات |

**قاعدة التصميم:** الواجهة قد تعرض أزرارًا لهذه القدرات في وضع fixture؛ في الإنتاج **لا** تُعرض ولا تُنفذ إلا بعد تأسيسها خلفيًا معتمدًا [Proposed — قيد تكامل].

---

## 4. طبقات الاحتساب (Effective Permission Evaluation) [Proposed — توثيق دقيق للنموذج Confirmed]

```
effective(user, permission) =
  let base   = ROLE_BASE[user.roleName]                       // طبقة 1 [Confirmed]
      over   = user.overrides[permission]                     // طبقة 2 [Confirmed]
  in  if over == 'DENY'   then DENIED                         // DENY يقطع فورًا
      if over == 'GRANT'  then GRANTED
      if over == 'INHERIT' or absent then base ? GRANTED : DENIED
```

- **ترتيب الأولوية:** override DENY > override GRANT > role base. (لا تعارض بين مفتاحين: مفتاح واحد قيمة واحدة) [Confirmed النموذج].
- **تطبيق المشروع (طبقة 3):** بعد اجتياز الصلاحية العامة، العمليات المقيدة بمشروع تتحقق من `projectAccess(user, projectId)`:

| المستوى | يسمح بـ |
|---|---|
| NONE | لا شيء (يُخفى المشروع من القوائم والبحث) |
| READ | عرض القوائم/التفصيل/التنزيل/التدقيق المقيّد |
| WRITE | READ + إنشاء/تحرير/رفع/انتقالات حالة |
| DELETE | WRITE + حذف منطقي/استرجاع |

- **الخاصية الأعلى تحكم:** مستوى مشروع أعلى يشمل أسفله [Inferred من التسمية — يُثبت مصدريًا].
- **مسؤولية التنفيذ:** كل ذلك خلفي لكل طلب؛ الواجهة تخفي فقط للراحة [Confirmed بنيويًا من session.ts].

## 5. العمليات × (صلاحية + نطاق مشروع)

| العملية | الصلاحية العامة | شرط projectAccess | المصدر |
|---|---|---|---|
| عرض قائمة/تفصيل مشاريع | projects.view | ≥ READ للمشروع | [Confirmed] + [Proposed نطاق] |
| إنشاء مشروع | projects.create | — (عام) | [Confirmed] |
| تحرير مشروع/حالة/contractValue | projects.edit | ≥ WRITE | [Confirmed] + [Proposed] |
| حذف/استرجاع مشروع (O12) | projects.delete | = DELETE | [Confirmed] + [Proposed] |
| رؤية المشاريع المحذوفة | projects.delete | = DELETE | [Proposed O12 — يُعرض للاعتماد] |
| عرض مستندات | archive.view | ≥ READ (عند ربط بمشروع) | [Confirmed]+[Proposed] |
| رفع/مراجعة | archive.upload | ≥ WRITE | [Confirmed] |
| تحرير/انتقالات حالة | archive.edit | ≥ WRITE | [Confirmed] |
| حذف مستند | archive.delete | = DELETE | [Confirmed] |
| تنزيل | archive.download | ≥ READ | [Confirmed] |
| عرض BOQ/IPC/financials | projects.view | ≥ READ | [Proposed — الترجمة النطاقية] |
| تحرير BOQ/IPC (draft) | projects.edit | ≥ WRITE | [Proposed] |
| تقديم IPC | projects.edit | ≥ WRITE | [Proposed] |
| **اعتماد/رفض IPC** | **`ipcs.approve` [Proposed]** | ≥ WRITE | [Proposed O4] |
| **إعادة تقديم IPC** | **`ipcs.resubmit` [Proposed]** أو projects.edit | ≥ WRITE | [Proposed] |
| إدارة المستخدمين/التجاوزات/الوصول | users.manage (+ projects.access prototype-only للوصول) | — | [Confirmed]+[Prototype-only] |
| إعادة تعيين كلمة مرور (إداري) | users.resetPassword [Prototype-only] | — | [Prototype-only] |
| إدارة النسخ الاحتياطي | backup.manage | — | [Confirmed] |
| عرض التدقيق | audit.view | فلتر بمشروع يتطلب ≥ READ | [Confirmed]+[Proposed] |
| بحث عالمي | صلاحيات المصدر لكل نوع (projects.view/archive.view) | نطاق لكل عنصر | [Proposed O9] |
| لوحة القيادة | تظهر الأقسام وفق صلاحياتها | عدّادات مقيدة بالنطاق | [Proposed O7] |

## 6. صلاحيات دورة IPC المقترحة — جدول إسناد الأدوار (يُعتمد في 14C) [Proposed]

| الدور | ipcs.approve | ipcs.resubmit | المبرر |
|---|---|---|---|
| admin | ✅ | ✅ | مدير النظام |
| management | ✅ | — | جهة اعتماد طبيعية |
| warehouse | — | — | لا دور مالي |
| technical | — | ✅ | المحرر/المُقدِّم الفني |
| viewer | — | — | عرض فقط |

- **فصل المهام المفروَض:** المُقدِّم (submit) ≠ المعتمد (approve) — 403 `SELF_APPROVAL_DENIED` خلفيًا [O4]. أدوار النظام الحالية لا تخلق تعارضًا: technical (المُقدِّم) لا يملك ipcs.approve؛ management (المعتمِد) لا يملك submit ضمنية (يمتلك projects.edit فيمكنه تقديم — **تنبيه:** نفس المستخدم management قد يُقدِّم ثم يوافق — ممنوع بالقاعدة الشخصية لا بالدور) [Proposed].
- **إدراج في ALL_PERMISSIONS = تغيير نموذج صلاحيات** يتطلب قرار مالك (حماية O13) — مذكور في 07 كنقطة اعتماد.

## 7. صلاحيات انتقالات حالة المستندات [Confirmed + Proposed ترجمة]

- لا مفاتيح مخصصة للانتقالات — تُدار عبر `archive.edit` (+WRITE) للمصفوفة كاملة [01 §4.3]، و`archive.upload` للمراجعات الجديدة.
- فصل مهام المستندات (رافع آخر مراجعة ≠ معتمد النقل إلى approved) [Proposed — قابل للاعتماد/الإسقاط].

## 8. قواعد الرؤية الخاصة

| السياق | القاعدة | المصدر |
|---|---|---|
| البحث العالمي (O9) | يعيد فقط ما يجتاز الصلاحية+النطاق؛ لا أعداد/عناوين/مقتطفات لغير المرئي | [Proposed على قرار Confirmed O9] |
| عدّادات اللوحة (O7) | مقيدة برؤية المستخدم؛ عدّاد منفصل للمحذوف لأصحاب الرؤية | [Proposed] |
| التدقيق بمشروع محدد | audit.view + ≥ READ على المشروع؛ بلا فلتر: الكل المرئي | [Proposed] |
| بيانات مشروع محذوف (O12) | بوابة projects.delete+DELETE فقط (قوائم/تفصيل/تدقيق/بحث) | [Proposed] |
| oldValue/newValue الكاملة + ipAddress في التدقيق | admin فقط؛ البقية نسخة مقلمة | [Proposed] |
| تعطيل آخر admin | ممنوع (409 LAST_ADMIN) | [Proposed] |
| DENY على صلاحية لم يملكها أصلاً | تسجيلها مسموح إداريًا (توثيق النية) لكنها بلا أثر وظيفي | [Proposed] |

## 9. خلاصة التوافق مع O13

- ROLE_BASE: **مُعتمد حرفيًا** — لا تغيير في هذا التصميم.
- المفاتيح الجديدة (`ipcs.approve`, `ipcs.resubmit`) **أُقحمت كـ [Proposed] منفصلة** — لا تُدمج في ROLE_BASE قبل قرار مالك صريح؛ بديل مؤقت موثق (projects.edit يقوم بالأدوار جميعًا) يُعلَّم كوضع تجريبي غير آمن لفصل المهام [Proposed].
- طبقات الاحتساب الثلاث + DENY precedence: **محفوظة كما هي** مع توثيق دقيق للحساب.
