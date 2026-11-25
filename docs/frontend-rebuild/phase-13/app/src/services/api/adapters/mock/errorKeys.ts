/* ===================================================================
   Arabic error string → i18n key (Phase 3.8)
   -------------------------------------------------------------------
   The mock layer keeps returning the ORIGINAL Arabic message in
   `result.error`, because that literal is the transcription of the
   audited backend contract and the Phase 3.2–3.7 suites assert on it.
   This map lets the UI render the same message in whichever language is
   selected WITHOUT touching the mock's return shape:

       errText(t, res)  →  t('eDateRequired')   in English
                            res.error            (falls back to Arabic)

   Messages whose text varies (a permission name, a BOQ code, a status
   pair) are NOT listed here — the mock returns an explicit `errorKey`
   plus `errorVars` for those, and `errText` prefers that.
   No imports: this module is data only.
   =================================================================== */

export const ERR_KEYS: Record<string, string> = {
  'مستند غير صالح (تجريبي).': 'eInvalidDoc',
  'لا يمكن ربط المستند بنفسه.': 'eLinkSelf',
  'هذه العلاقة موجودة بالفعل.': 'eRelExists',
  // Phase 7 (PUT /documents/:id validator parity — title/category min(1))
  'عنوان المستند مطلوب': 'eDocTitleReq',
  'تصنيف المستند مطلوب': 'eDocCatReq',
  'التاريخ مطلوب': 'eDateRequired',
  'أضف صنفًا واحدًا على الأقل': 'eNeedLine',
  'الكمية مطلوبة': 'eQtyRequired',
  'الكمية السالبة مسموحة في التسوية فقط': 'eNegativeAdjOnly',
  'الكمية يجب ألا تكون صفرًا': 'eQtyZero',
  'المخزن غير موجود': 'eWhMissing',
  'حدد المخزن الوجهة للتحويل': 'eTransferDest',
  'لا يمكن التحويل لنفس المخزن': 'eTransferSame',
  'المخزن الوجهة غير موجود': 'eDestMissing',
  'المشروع غير موجود': 'eProjectMissing',
  'ليس لديك صلاحية إنشاء بنود المقايسة في هذا المشروع': 'eNoBoqCreate',
  'ليس لديك صلاحية تعديل بنود المقايسة في هذا المشروع': 'eNoBoqEdit',
  'البند غير موجود': 'eBoqMissing',
  'ليس لديك صلاحية حذف بنود المقايسة في هذا المشروع': 'eNoBoqDelete',
  'لا يمكن حذف البند لوجود مستخلصات مرتبطة به.': 'eBoqHasIpc',
  'ليس لديك صلاحية إنشاء المستخلصات في هذا المشروع': 'eNoIpcCreate',
  'رقم المستخلص مستخدم بالفعل في هذا المشروع': 'eIpcDup',
  'ليس لديك صلاحية تعديل المستخلصات في هذا المشروع': 'eNoIpcEdit',
  'المستخلص غير موجود': 'eIpcMissing',
  'أحد البنود لا ينتمي لمشروع المستخلص': 'eIpcLineProject',
  'ليس لديك صلاحية حذف المستخلصات في هذا المشروع': 'eNoIpcDelete',
  'لا يمكن حذف المستخلص بعد خروجه من حالة المسودة.': 'eIpcNotDraft',
  'المخزن مطلوب': 'eWhRequired',
  'الموقع غير موجود': 'eSiteMissing',
  'أحد الأصناف غير موجود': 'eItemMissing',
  'الكمية المطلوبة يجب أن تكون أكبر من صفر': 'eQtyPositive',
  'طلب المواد غير موجود': 'eMrMissing',
  'يمكن إرسال المسودة فقط': 'eSubmitDraftOnly',
  'يمكن اعتماد الطلبات المقدمة فقط': 'eApproveSubmittedOnly',
  'يحتاج الإغلاق صلاحية اعتماد (قاعدة تجريبية غير موثقة)': 'eCloseNeedsApprove',
  'يمكن إغلاق الطلبات المصروفة بالكامل فقط (قاعدة تجريبية غير موثقة)': 'eCloseFullyIssued',
  'يمكن الصرف من الطلبات المعتمدة فقط': 'eIssueApprovedOnly',
  'حدد الكميات المصروفة': 'eIssueQty',
  'صنف خارج نطاق الطلب': 'eItemOutOfScope',
  'لا يمكن حذف طلب المواد بعد خروجه من حالة المسودة.': 'eMrNotDraft',
  'المستخدم غير موجود (بيانات تجريبية).': 'eUserMissingDemo',
  'لا يمكنك سحب صلاحية إدارتك بنفسك. عيّن مديرًا آخر أولًا ثم كرر الإجراء.': 'eSelfDemote',
  'مرفوض: سيترك هذا الإجراء النظام بلا أي حساب إداري نشط. أنشئ مديرًا بديلًا أولًا.': 'eLastAdmin',
  'الاسم مطلوب.': 'eNameRequired',
  'صيغة البريد الإلكتروني غير صالحة (يُقبل أي نطاق صالح).': 'eEmailBadFmtLong',
  'هذا البريد مسجل بالفعل لمستخدم آخر.': 'eEmailTaken',
  'المستخدم غير موجود.': 'eUserMissing',
  'صيغة البريد الإلكتروني غير صالحة.': 'eEmailBadFmt',
  'لا يمكنك حذف حسابك بنفسك.': 'eSelfDelete',
  'التقرير غير موجود': 'eReportMissing',
  'ليس لديك صلاحية عرض التقارير أو تصديرها': 'eNoReportPerm',
  'تعذّر التحميل': 'eLoadFailed',
  // validators (their Arabic text is identical to the field-level i18n copy)
  'رقم البند مطلوب': 'eBoqCodeRequired',
  'وصف البند مطلوب': 'eBoqDescRequired',
  'الوحدة مطلوبة': 'eBoqUnitRequired',
  'الكمية يجب أن تكون أكبر من أو تساوي 0': 'eBoqQtyRule',
  'الفئة يجب أن تكون أكبر من أو تساوي 0': 'eBoqPriceRule',
  'رقم المستخلص يجب أن يكون 1 أو أكثر': 'eIpcNumberRule',
  'التاريخ غير صالح': 'eDateInvalid',
  'حالة المستخلص غير صالحة': 'eIpcStatusInvalid',
  'القيمة الإجمالية يجب أن تكون أكبر من أو تساوي 0': 'eGrossRule',
  'أعد تحميل الصفحة لاستعادة البيانات الوهمية الأولية.': 'eResetHint',
};

/** The literal used where the mock injects the permission name into the text. */
export const ERR_PERM_PREFIX = 'ليس لديك صلاحية: ';