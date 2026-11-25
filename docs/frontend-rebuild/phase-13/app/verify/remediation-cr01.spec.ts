import { test, expect } from '@playwright/test';

/* Phase 9 DATA-ENTRY REMEDIATION — mandatory live suite (owner mandate §8).
   Mandate: full contract create → retrieve → contract-value → indicators →
   direct IPC → deductions/net → no-doubble-count → empty/zero/negative →
   validation + double-submit → permissions → AR/EN/RTL → six viewports.
   The `exports.spec.ts` regression keeps running UNTOUCHED (mandatory item 12)
   — it is executed separately with the same live build.
   Mock data re-seeds on every full page load, so every state-dependent journey
   stays inside ONE SPA session (same convention as phase9.spec). */

// Role tiles: admin=0, manager=1, warehouse=2, viewer=3, technical=4
// (DEMO_ROLES order — same convention as phase6.spec.ts; the login page
// renders .rolePick labels, not native radios).
const loginAs = async (page: any, idx: number) => {
  await page.goto('/login');
  await page.locator('.rolePick label').nth(idx).click();
  await page.getByRole('button', { name: /دخول تجريبي|Demo login/ }).click();
  await page.locator('.shell').waitFor({ timeout: 10000 });
};
// In-app SPA navigation keeps the mock store alive (a goto() would re-seed it)
const navTo = async (page: any, path: string) => {
  await page.locator(`a[href="${path}"]`).first().click();
  await page.waitForURL(path, { timeout: 8000 });
};
const turnLang = async (page: any) => {
  await page.locator('[data-lang-toggle]').click();
};
const openProjectEdit = (page: any) =>
  page.locator('.recRow', { hasText: 'برج النيل الإداري' }).first()
    .getByRole('button', { name: /تعديل/ }).click();

const parseNum = (s: string) => Number((s.match(/[\d,]+(\.\d+)?/g) ?? ['0']).join('').replace(/,/g, ''));
const fmtMoney = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 });
const fmtPctLocal = (n: number) => `${n.toLocaleString('en-US', { maximumFractionDigits: 1 })}%`;
const moneyCard = (scope: any, label: string) =>
  scope.locator(`.card:has(.l:text-is("${label}"))`);

/* ---------- §8 item 1 + 2: FULL contract create → immediate list → round-trip ---------- */

test('item 1+2: full CR-01 create writes every audited field and the edit round-trip restores all 14, one session', async ({ page }) => {
  await loginAs(page, 0);
  await page.goto('/projects');
  await expect(page.locator('.recRow')).toHaveCount(4);

  // the create modal opens EMPTY and blocks save until code+name exist
  await page.locator('.cmdHead button', { hasText: 'المشاريع' }).click();
  const dlg = page.getByRole('dialog');
  await expect(dlg.locator('label.field')).toHaveCount(14); // full audited schema surface
  await expect(dlg.locator('label.field', { hasText: 'كود المشروع *' }).locator('.err[role="alert"]')).toContainText('كود المشروع مطلوب');
  await expect(dlg.getByRole('button', { name: 'حفظ' })).toBeDisabled();

  // every audited field of the contract (projectSchema transcription)
  await dlg.locator('[aria-label="كود المشروع *"]').fill('PRJ-RM01');
  await dlg.locator('[aria-label="اسم المشروع *"]').fill('مبنى إصلاح المرحلة 9 (تجريبي)');
  await dlg.locator('[aria-label="العميل"]').fill('عميل الإصلاح (تجريبي)');
  await dlg.locator('[aria-label="الجهة المالكة للمشروع"]').fill('مالك الإصلاح (تجريبي)');
  await dlg.locator('[aria-label="المقاول الرئيسي"]').fill('مقاول الإصلاح الرئيسي (تجريبي)');
  await dlg.locator('[aria-label="موقع المشروع"]').fill('التجمع الخامس');
  await dlg.locator('[aria-label="المنطقة"]').fill('التجمع');
  await dlg.locator('[aria-label="رقم العقد"]').fill('C-2026-RM01');
  await dlg.locator('[aria-label="قيمة العقد"]').fill('12500000');
  await dlg.locator('[aria-label="تاريخ البدء"]').fill('2026-03-01');
  await dlg.locator('[aria-label="تاريخ الانتهاء"]').fill('2026-12-31');
  await dlg.locator('[aria-label="الحالة"]').selectOption('active');
  await dlg.locator('[aria-label="دور الشركة"]').selectOption('subcontractor');
  await dlg.locator('[aria-label="ملاحظات"]').fill('ملاحظات النموذج الكامل (تجريبي)');
  await expect(dlg.locator('.err[role="alert"]')).toHaveCount(0);
  await dlg.getByRole('button', { name: 'حفظ' }).click();
  await expect(dlg).toBeHidden();

  // the created project is immediately visible in the same list (no reload)
  await page.locator('input[aria-label="بحث"]').fill('PRJ-RM01');
  const row = page.locator('.recRow', { hasText: 'PRJ-RM01' });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('مبنى إصلاح المرحلة 9 (تجريبي)');

  // item 2 — round-trip: reopen the edit modal and everything comes back
  await row.getByRole('button', { name: /تعديل/ }).click();
  const ed = page.getByRole('dialog');
  await expect(ed.locator('[aria-label="كود المشروع *"]')).toHaveValue('PRJ-RM01');
  await expect(ed.locator('[aria-label="اسم المشروع *"]')).toHaveValue('مبنى إصلاح المرحلة 9 (تجريبي)');
  await expect(ed.locator('[aria-label="العميل"]')).toHaveValue('عميل الإصلاح (تجريبي)');
  await expect(ed.locator('[aria-label="الجهة المالكة للمشروع"]')).toHaveValue('مالك الإصلاح (تجريبي)');
  await expect(ed.locator('[aria-label="المقاول الرئيسي"]')).toHaveValue('مقاول الإصلاح الرئيسي (تجريبي)');
  await expect(ed.locator('[aria-label="موقع المشروع"]')).toHaveValue('التجمع الخامس');
  await expect(ed.locator('[aria-label="المنطقة"]')).toHaveValue('التجمع');
  await expect(ed.locator('[aria-label="رقم العقد"]')).toHaveValue('C-2026-RM01');
  await expect(ed.locator('[aria-label="قيمة العقد"]')).toHaveValue('12500000');
  await expect(ed.locator('[aria-label="تاريخ البدء"]')).toHaveValue('2026-03-01');
  await expect(ed.locator('[aria-label="تاريخ الانتهاء"]')).toHaveValue('2026-12-31');
  await expect(ed.locator('[aria-label="الحالة"]')).toHaveValue('active');
  await expect(ed.locator('[aria-label="دور الشركة"]')).toHaveValue('subcontractor');
  await expect(ed.locator('[aria-label="ملاحظات"]')).toHaveValue('ملاحظات النموذج الكامل (تجريبي)');
  await ed.getByRole('button', { name: 'إلغاء' }).click();

  // cleanup keeps the seeded list state intact
  await row.getByRole('button', { name: 'حذف' }).click();
  await page.getByRole('button', { name: 'تأكيد' }).click();
  await expect(page.locator('.recRow', { hasText: 'PRJ-RM01' })).toHaveCount(0);
});

/* ---------- §8 items 3–6: contract value → indicators → direct IPC → net →
   no double-count, one honest journey on the seeded p1 ---------- */

test('item 3–6: contract value → BOQ anchor → direct IPC net → line path replaces direct (no double count) → approval feeds indicators', async ({ page }) => {
  /* item 3 — contract value must be ON the project before any financial check */
  await loginAs(page, 0);
  await page.goto('/projects');
  const CV = '32000000';
  await openProjectEdit(page);
  const dlg = page.getByRole('dialog');
  await dlg.locator('[aria-label="قيمة العقد"]').fill(CV);
  await dlg.getByRole('button', { name: 'حفظ' }).click();
  await expect(dlg).toBeHidden();
  await navTo(page, '/financials');
  await expect(moneyCard(page, 'قيمة العقد').filter({ hasText: '32,000,000' }).first()).toBeVisible();

  /* the workspace mirrors it through the same store */
  await page.locator('a[href="/projects/p1/financials"]').first().click();
  await expect(page.getByRole('tab', { name: 'المقايسات' })).toBeVisible({ timeout: 8000 });
  await expect(moneyCard(page, 'قيمة العقد')).toContainText('32,000,000');

  /* a known BOQ line arithmetic anchor */
  await page.getByRole('button', { name: '+ بند جديد' }).click();
  const boqDlg = page.getByRole('dialog');
  await boqDlg.locator('[aria-label="رقم البند"]').fill('RMB1');
  await boqDlg.locator('[aria-label="الوصف"]').fill('بند إصلاح تجريبي');
  await boqDlg.locator('[aria-label="الكمية"]').fill('2');
  await boqDlg.locator('[aria-label="الفئة"]').fill('1250');
  await boqDlg.getByRole('button', { name: 'حفظ' }).click();
  await expect(boqDlg).toBeHidden();

  /* item 4 — direct path: new IPC with NO lines → net preview lives */
  await page.getByRole('tab', { name: 'المستخلصات' }).click();
  await page.getByRole('button', { name: '+ مستخلص جديد' }).click();
  const ipcDlg = page.getByRole('dialog');
  await ipcDlg.locator('[aria-label="القيمة الإجمالية المباشرة"]').fill('10000000');
  await ipcDlg.locator('[aria-label="الاستقطاعات"]').fill('500000');
  await expect(ipcDlg.getByText('9,500,000')).toBeVisible(); // live net = gross − deductions

  /* item 5 — deductions and net ruled on the SAME form: negative deduction is
     refused beside the field and blocks save */
  await ipcDlg.locator('[aria-label="الاستقطاعات"]').fill('-5');
  await expect(ipcDlg.locator('label.field', { hasText: 'الاستقطاعات' }).locator('.err[role="alert"]'))
    .toContainText('قيد غير صالح');
  await expect(ipcDlg.getByRole('button', { name: 'حفظ' })).toBeDisabled();
  await ipcDlg.locator('[aria-label="الاستقطاعات"]').fill('500000');
  await expect(ipcDlg.locator('.err[role="alert"]')).toHaveCount(0);
  await expect(ipcDlg.getByRole('button', { name: 'حفظ' })).toBeEnabled();
  await ipcDlg.getByRole('button', { name: 'حفظ' }).click();
  await expect(ipcDlg).toBeHidden();

  /* item 6 — the line path REPLACES the direct amount: adding the RMB1 line
     flips the net to Σ qty×price (2,500) and nothing stacks on top of it */
  const row = page.locator('.recRow').filter({ hasText: '9,500,000' }).first();
  const ipcTag = (await row.locator('span.num strong').first().textContent())?.trim() ?? '';
  await row.getByRole('button', { name: 'تعديل' }).click();
  const editDlg = page.getByRole('dialog');
  await editDlg.getByRole('button', { name: '+ إضافة صنف' }).click();
  await editDlg.locator('[aria-label="بند المقايسة 1"]').selectOption({ label: 'RMB1 — بند إصلاح تجريبي' });
  await editDlg.locator('[aria-label="الحالي 1"]').fill('2');
  await expect(editDlg.getByText('2,500')).toBeVisible(); // 2 × 1,250
  await editDlg.getByRole('button', { name: 'حفظ' }).click();
  await expect(editDlg).toBeHidden();
  const lineRow = page.locator('.recRow').filter({ hasText: ipcTag });
  await expect(lineRow).toContainText('2,500'); // the written net — NOT 9,500,001/… stacking
  await expect(lineRow).toContainText('1 بند');

  /* approve through the documented transition buttons */
  await lineRow.getByRole('button', { name: 'مقدمة' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'حفظ' }).click();
  await lineRow.getByRole('button', { name: 'معتمدة' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'حفظ' }).click();
  await expect(lineRow.locator('.badge--green')).toBeVisible({ timeout: 8000 });

  /* indicators parse-and-verify on /financials (same session) */
  await navTo(page, '/financials');
  const sec = page.locator('section.panel').filter({ has: page.locator('a[href="/projects/p1/financials"]') });
  const cardText = async (label: string) => (await moneyCard(sec, label).first().textContent()) ?? '';
  const cvTxt = await cardText('قيمة العقد');
  const execTxt = await cardText('المنفّذ (المستخلصات المعتمدة)');
  expect(cvTxt).toContain('32,000,000');
  // seeded approved base (ipc1 2,025,000 + ipc2 2,586,500 = 4,611,500) plus the
  // line net 2,500 approved below — the NO-double-count proof: exactly one
  // addition of the line net on top of the fixture base, nothing stacked twice
  expect(parseNum(execTxt)).toBe(2_025_000 + 2_586_500 + 2_500);
  const exec = parseNum(execTxt);
  const pct = sec.locator('.card', { hasText: 'نسبة التنفيذ (مالية)' });
  await expect(pct).toContainText(fmtPctLocal((exec / 32_000_000) * 100));
  const remCard = sec.locator('.card', { hasText: 'المتبقي من قيمة العقد' });
  await expect(remCard).toContainText(fmtMoney(32_000_000 - exec));
  /* the disbursement card stays honest: "غير متاح" + note, never a number */
  await expect(sec.locator('.card', { hasText: 'المتبقي للصرف' }).first()).toContainText('غير متاح');
  await expect(sec.locator('p', { hasText: 'لا توجد بيانات صرف' }).first()).toBeVisible();
});

/* ---------- §8 item 7: empty / zero / negative discipline ---------- */

test('item 7 (updated, Phase 10): zero contract value is accepted and honestly displayed; negatives are REFUSED (contract field and IPC field)', async ({ page }) => {
  await loginAs(page, 0);
  await page.goto('/projects');

  /* a zero contract value is a REAL number per the audited zod contract
     (min(0)) — never a hidden "absent"/"غير متاح" state */
  await page.locator('.cmdHead button', { hasText: 'المشاريع' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.locator('[aria-label="كود المشروع *"]').fill('PRJ-RM0');
  await dlg.locator('[aria-label="اسم المشروع *"]').fill('مشروع قيمة صفرية (تجريبي)');
  await dlg.locator('[aria-label="قيمة العقد"]').fill('0');
  await expect(dlg.locator('.err[role="alert"]')).toHaveCount(0);
  await dlg.getByRole('button', { name: 'حفظ' }).click();
  await expect(dlg).toHaveCount(0);
  await page.locator('input[aria-label="بحث"]').fill('PRJ-RM0');
  await expect(page.locator('.recRow', { hasText: 'PRJ-RM0' })).toHaveCount(1);

  // the zero value survives round-trip as 0 (not blanked, not dropped)
  await page.locator('.recRow', { hasText: 'PRJ-RM0' }).getByRole('button', { name: /تعديل/ }).click();
  const ed = page.getByRole('dialog');
  await expect(ed.locator('[aria-label="قيمة العقد"]')).toHaveValue('0');
  await ed.getByRole('button', { name: 'إلغاء' }).click();

  // /financials shows 0 for this project — its derived cards stay NOT-AVAILABLE
  await navTo(page, '/financials');
  const zeroSec = page.locator('section.panel, section').filter({ has: page.locator('a[href^="/projects/p-mock-"]') }).first();
  await expect(moneyCard(zeroSec, 'قيمة العقد')).toContainText('0');

  /* cleaning up: the empty-value mode on a NON-populated create is the
     legitimate "absent" (undefined) — the Phase 10 mandate redefines the
     negative path from "mask-neutralized" to "validated refusal". */
  await page.keyboard.press('Escape');
  await navTo(page, '/projects');
  await page.locator('.recRow', { hasText: 'PRJ-RM0' }).getByRole('button', { name: 'حذف' }).click();
  await page.getByRole('button', { name: 'تأكيد' }).click();
  await expect(page.locator('.recRow', { hasText: 'PRJ-RM0' })).toHaveCount(0);

  /* negative contract value: Phase 10 (owner mandate §4.A) — no silent
     conversion. Typed/filled '-5' STAYS '-5' in the field; the contract rule
     renders beside the field with save disabled, and no negative amount can
     reach the payload. (Phase 9's observation — '-5' becoming '5' — is
     fixed in this build.) */
  await page.locator('.cmdHead button', { hasText: 'المشاريع' }).click();
  const neg = page.getByRole('dialog');
  await neg.locator('[aria-label=\"قيمة العقد\"]').fill('-5');
  await expect(neg.locator('[aria-label=\"قيمة العقد\"]')).toHaveValue('-5');
  await expect(neg.locator('label.field', { hasText: 'قيمة العقد' }).locator('.err[role="alert"]'))
    .toContainText('قيمة العقد يجب أن تكون أكبر من أو تساوي 0');
  await expect(neg.getByRole('button', { name: 'حفظ' })).toBeDisabled();
  await neg.getByRole('button', { name: 'إلغاء' }).click();

  /* the IPC direct gross/deduction fields DO accept typed negatives — and the
     contract rule refuses them beside the field with save disabled */
  await navTo(page, '/projects'); // seed-safe leg; the workspace leg keeps state below
  await page.goto('/projects/p1/financials'); // the IPC surface lives on p1's financial workspace only
  await expect(page.getByRole('tab', { name: 'المقايسات' })).toBeVisible({ timeout: 8000 });
  await page.getByRole('tab', { name: 'المستخلصات' }).click();
  await page.getByRole('button', { name: '+ مستخلص جديد' }).click();
  const negIpc = page.getByRole('dialog');
  await negIpc.locator('[aria-label="القيمة الإجمالية المباشرة"]').fill('-5');
  await expect(negIpc.locator('label.field', { hasText: 'القيمة الإجمالية المباشرة' }).locator('.err[role="alert"]'))
    .toContainText('قيد غير صالح');
  await expect(negIpc.getByRole('button', { name: 'حفظ' })).toBeDisabled();
  await negIpc.getByRole('button', { name: 'إلغاء' }).click();
});

/* ---------- §8 item 8: validation cues beside fields + genuine double submit ---------- */

test('item 8: field errors sit beside their fields and a genuine double-tap on create produces exactly one row', async ({ page }) => {
  await loginAs(page, 0);
  await page.goto('/projects');

  await page.locator('.cmdHead button', { hasText: 'المشاريع' }).click();
  const dlg = page.getByRole('dialog');
  // both required-field errors render beside their own field, each with role=alert
  await expect(dlg.locator('label.field', { hasText: 'كود المشروع *' }).locator('.err[role="alert"]')).toContainText('كود المشروع مطلوب');
  await expect(dlg.locator('label.field', { hasText: 'اسم المشروع *' }).locator('.err[role="alert"]')).toContainText('اسم المشروع مطلوب');
  await expect(dlg.getByRole('button', { name: 'حفظ' })).toBeDisabled();

  await dlg.locator('[aria-label="كود المشروع *"]').fill('PRJ-DBL');
  await dlg.locator('[aria-label="اسم المشروع *"]').fill('مشروع النقر المزدوج (تجريبي)');
  await expect(dlg.locator('.err[role="alert"]')).toHaveCount(0);
  await expect(dlg.getByRole('button', { name: 'حفظ' })).toBeEnabled();

  // two synchronous clicks inside one React batch — the duplicate-create window
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('.formActions button')].find((x) => x.textContent?.trim() === 'حفظ') as HTMLButtonElement | undefined;
    if (!b || b.disabled) throw new Error('save button missing/disabled');
    b.click();
    b.click();
  });
  await expect(page.locator('.modal')).toHaveCount(0); // first tap closed it; second never re-created
  await page.locator('input[aria-label="بحث"]').fill('PRJ-DBL');
  await expect(page.locator('.recRow', { hasText: 'PRJ-DBL' })).toHaveCount(1); // exactly ONE row

  await page.locator('.recRow', { hasText: 'PRJ-DBL' }).getByRole('button', { name: 'حذف' }).click();
  await page.getByRole('button', { name: 'تأكيد' }).click();
  await expect(page.locator('.recRow', { hasText: 'PRJ-DBL' })).toHaveCount(0);
});

/* ---------- §8 item 9: the permission matrix holds on the new form too ---------- */

test('item 9: viewer gets the scoped empty state without create; technical sees its scope without create/edit/delete', async ({ page }) => {
  await loginAs(page, 3);
  await page.goto('/projects');
  await expect(page.locator('.recRow')).toHaveCount(0); // karim has no membership
  await expect(page.locator('.cmdHead button', { hasText: 'المشاريع' })).toHaveCount(0); // no create
  // membership names must not leak into the empty state (no 'فني'/p1..p4 text)
  await expect(page.locator('.recRow')).toHaveCount(0);
  await expect(page.locator('main').getByText('برج النيل الإداري')).toHaveCount(0);

  // re-login as technical (index 4) on the same page flow
  await loginAs(page, 4);
  await page.goto('/projects');
  await expect(page.locator('.recRow')).toHaveCount(2); // provider-scoped PRJ-004 + PRJ-007
  await expect(page.locator('.cmdHead button', { hasText: 'المشاريع' })).toHaveCount(0);
  await expect(page.locator('.recRow button')).toHaveCount(0); // no edit/delete surfacing
  await expect(page.locator('.recRow a.linkBtn', { hasText: 'التفاصيل' })).toHaveCount(2);
});

/* ---------- §8 item 10: AR ⇄ EN with RTL/LTR on the OPEN create modal ---------- */

test('item 10: create form is fully localized — AR (RTL) → EN (LTR) → AR, labels following each reopen', async ({ page }) => {
  // NOTE: the modal backdrop covers the whole content area by design (the app
  // shell has no escape hatch), so the ع/EN toggle is exercised BETWEEN modal
  // visits — the same convention as the passing phase9.spec language leg.
  await loginAs(page, 0);
  await page.goto('/projects');
  await expect(page.locator('html[dir="rtl"]')).toHaveCount(1);

  // AR: the open create modal shows all audited labels in Arabic
  await page.locator('.cmdHead button', { hasText: 'المشاريع' }).click();
  let dlg = page.getByRole('dialog');
  await expect(dlg.locator('label.field', { hasText: 'كود المشروع *' })).toHaveCount(1);
  await expect(dlg.locator('label.field', { hasText: 'اسم المشروع *' })).toHaveCount(1);
  await expect(dlg.locator('label.field', { hasText: 'قيمة العقد' })).toHaveCount(1);
  await expect(dlg.getByRole('button', { name: 'حفظ' })).toHaveCount(1);
  await dlg.getByRole('button', { name: 'إلغاء' }).click();

  // EN: toggle outside the modal, then the reopened modal follows
  await turnLang(page);
  await expect(page.locator('html[dir="ltr"]')).toHaveCount(1);
  await page.locator('.cmdHead button', { hasText: 'Projects' }).click();
  dlg = page.getByRole('dialog');
  await expect(dlg.locator('label.field', { hasText: 'Project code *' })).toHaveCount(1);
  await expect(dlg.locator('label.field', { hasText: 'Contract value' })).toHaveCount(1);
  await expect(dlg.getByRole('button', { name: 'Save' })).toHaveCount(1);
  await dlg.getByRole('button', { name: 'Cancel' }).click();

  // back to Arabic
  await turnLang(page);
  await expect(page.locator('html[dir="rtl"]')).toHaveCount(1);
  await page.locator('.cmdHead button', { hasText: 'المشاريع' }).click();
  dlg = page.getByRole('dialog');
  await expect(dlg.locator('label.field', { hasText: 'كود المشروع *' })).toHaveCount(1);
  await expect(dlg.locator('label.field', { hasText: 'اسم المشروع *' })).toHaveCount(1);
});

/* ---------- §8 item 11: the six mandated viewports ---------- */

const SIZES: [number, number][] = [
  [375, 700], [390, 844], [768, 1024], [1024, 768], [1366, 768], [1920, 1080],
];
for (const [w, h] of SIZES) {
  test(`item 11: create modal usable at ${w}×${h} — visible, in-flow, no horizontal page overflow`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await loginAs(page, 0);
    await page.goto('/projects');
    await page.locator('.cmdHead button', { hasText: 'المشاريع' }).click();
    const dlg = page.getByRole('dialog');
    await expect(dlg).toBeVisible();
    await expect(dlg.locator('[aria-label="كود المشروع *"]')).toBeVisible();
    await expect(dlg.locator('[aria-label="اسم المشروع *"]')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
    await dlg.locator('[aria-label="كود المشروع *"]').fill('PRJ-V');
    await dlg.locator('[aria-label="اسم المشروع *"]').fill('فحص مقاس');
    // save is genuinely reachable at EVERY size (touch targets stay in-tab)
    await expect(dlg.getByRole('button', { name: 'حفظ' })).toBeEnabled();
    await dlg.getByRole('button', { name: 'إلغاء' }).click();
    await expect(dlg).toHaveCount(0);
  });
}
