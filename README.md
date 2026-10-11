# Company Operations System

Phase 1: Archive / Document Management and Warehouse Management.

## التشغيل (LAN / موظفين)

- السيستم شغال كـ Windows Service باسم `CompanyOpsAPI` (يعمل تلقائياً مع تشغيل الجهاز).
- رابط الدخول من أي جهاز على نفس الشبكة: `http://<IP-الجهاز>:4001`
- التشغيل/الإيقاف اليدوي: ملفا `تشغيل النظام.bat` و `إيقاف النظام.bat` على سطح المكتب.
- نسخة احتياطية يومية 02:00 في `backups/` (مهمة `CompanyOps-Backup`)، وتشغيل يدوي: `powershell -File scripts\backup-db-local.ps1`

## للمطورين

- وضع التطوير: `npm run dev:api` + `npm run dev:web` (أو `npm run dev:lan` للشبكة).
- بعد أي تعديل في الكود قبل التسليم للموظفين:
  1. `npm run build --workspace @cos/shared` ثم `@cos/api` ثم `@cos/web`
  2. إعادة تشغيل الخدمة: `net stop CompanyOpsAPI` ثم `net start CompanyOpsAPI` (كمدير)
- ملاحظة: كود الإنتاج يعمل بـ node مباشرة (بدون tsx)، لذلك كل الاستيرادات النسبية
  يجب أن تنتهي بـ `.js` — أمر الـ build يفحص ذلك تلقائياً (`check-esm-imports.cjs`).
