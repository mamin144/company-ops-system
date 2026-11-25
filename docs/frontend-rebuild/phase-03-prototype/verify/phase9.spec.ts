import { test, expect } from '@playwright/test';

/* Phase 9 live review — CR-01 / CR-02 / CR-03 against :5203/dist-phase9.
   Mock data only; run with PW_BASE_URL=http://localhost:5203 */
/* Simulator note: mock state lives inside the browser bundle — every full
   page load re-seeds it, so value round-trips are verified inside ONE SPA
   session, navigating through in-app links (same journey a user walks). */

const loginAs = async (page: any, role: string) => {
  await page.goto('/login');
  await page.getByRole('radio', { name: role }).click();
  await page.getByRole('button', { name: /دخول تجريبي/ }).click();
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
const openProjectEdit = async (page: any) => {
  await page.locator('.recRow', { hasText: 'برج النيل الإداري' }).first()
    .getByRole('button', { name: /تعديل/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
};

test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ page }) => {
  await loginAs(page, 'مدير (تجريبي)');
});

/* ---------- CR-02 + CR-03: direct amount journey, one SPA session ---------- */

test('CR-02+CR-03: enter → propagate → EN → clear (honest removal), one session', async ({ page }) => {
  await page.goto('/projects');
  await openProjectEdit(page);
  const dlg = page.getByRole('dialog');

  // seeded fresh: no stored contract value on p1 yet → empty field
  await expect(dlg.locator('input[type=number]')).toHaveValue('');

  // the amount cannot be made invalid through the UI: a native number field
  // (min=0, step=any) plus the onChange mask both refuse malformed decimals,
  // so the zod-equivalent error path is defense-in-depth unreachable by typing
  await dlg.locator('input[type=number]').fill('32500000');
  await expect(dlg.locator('.err')).toHaveCount(0);
  await expect(dlg.getByRole('button', { name: 'حفظ' })).toBeEnabled();

  await dlg.getByRole('button', { name: 'حفظ' }).click();
  await expect(dlg).toBeHidden();

  // persistence inside the session: reopening seeds the stored value
  await openProjectEdit(page);
  await expect(dlg.locator('input[type=number]')).toHaveValue('32500000');
  await dlg.getByRole('button', { name: 'إلغاء' }).click();

  /* CR-03: the comprehensive financial position shows the direct amount */
  await navTo(page, '/financials');
  const p1block = moneyCard(page, 'قيمة العقد').filter({ hasText: '32,500,000' });
  await expect(p1block.first()).toBeVisible();
  // projects that never received a value stay honest — absent, not zero
  const absBlocks = moneyCard(page, 'قيمة العقد').filter({ hasText: 'غير متاح' });
  await expect(absBlocks.first()).toBeVisible();

  /* CR-03: workspace tab mirrors the same value via the same store */
  await page.locator('a[href="/projects/p1/financials"]').first().click();
  await expect(page.getByRole('tab', { name: 'المقايسات' })).toBeVisible({ timeout: 8000 });
  await expect(moneyCard(page, 'قيمة العقد')).toContainText('32,500,000');

  /* EN labels swap and the amount keeps its numeric form */
  await turnLang(page);
  await expect(moneyCard(page, 'Contract value').first()).toBeVisible();
  await navTo(page, '/financials');
  await expect(moneyCard(page, 'Contract value').filter({ hasText: '32,500,000' }).first()).toBeVisible();
  await expect(moneyCard(page, 'Contract value').filter({ hasText: 'Not available' }).first()).toBeVisible();

  // back to Arabic before the cleanup round-trip (button names are i18n copy)
  await turnLang(page);

  /* cleanup round-trip CHANGED by the Phase 9 CR-01 remediation — disclosed:
     the audited PUT /projects/:id contract cannot clear a populated
     contractValue (absent key = column untouched, per the validator's own
     comment), so emptying a populated field is now a STATED validation error
     and save stays disabled. The honest fallback: the stored value remains —
     no phantom zero and no silent data drop. */
  await navTo(page, '/projects');
  await openProjectEdit(page);
  await dlg.locator('input[type=number]').fill('');
  await expect(dlg.locator('.err')).toContainText('لا يدعم تفريغ قيمة العقد');
  await expect(dlg.getByRole('button', { name: 'حفظ' })).toBeDisabled();
  await dlg.getByRole('button', { name: 'إلغاء' }).click();
  await navTo(page, '/financials');
  await expect(moneyCard(page, 'قيمة العقد').filter({ hasText: '32,500,000' }).first()).toBeVisible();
});

/* ---------- CR-03 absence display without any edit (seed state) ---------- */

test('CR-03 seed: every project without a value shows "غير متاح"', async ({ page }) => {
  await page.goto('/financials');
  const cvCards = moneyCard(page, 'قيمة العقد');
  await expect(cvCards).not.toHaveCount(0);
  // seeded mock carries no contract value on any project — all four blocks honest
  await expect(cvCards.filter({ hasText: /^[0-9]/ })).toHaveCount(0);
});

/* ---------- CR-01: unified form anatomy across modules ---------- */

test('CR-01: forms share the .field anatomy with role=alert errors', async ({ page }) => {
  // projects edit modal uses the shared Field anatomy
  await page.goto('/projects');
  await openProjectEdit(page);
  const projDlg = page.getByRole('dialog');
  await expect(projDlg.locator('label.field')).toHaveCount(14); // Phase 9 CR-01 remediation: the full audited 14-field project schema (was 4)
  await expect(projDlg.locator('label.field > span').first()).toBeVisible();
  await projDlg.getByRole('button', { name: 'إلغاء' }).click();

  // BOQ create form uses the very same anatomy
  await page.goto('/projects/p1/financials');
  await page.getByRole('button', { name: '+ بند جديد' }).click();
  const boqDlg = page.getByRole('dialog');
  await expect(boqDlg.locator('label.field')).not.toHaveCount(0);
  await expect(boqDlg.locator('label.field > span').first()).toBeVisible();
  await boqDlg.getByRole('button', { name: 'إلغاء' }).click();
});

/* ---------- Phase 9 extension (review steering 2026-10-26): (أ) IPC direct
   path + BOQ-line recompute, (ب) execution % / remaining indicators after
   approval, (د) the honest disbursement gap, (ج) CR-01 sweep on
   Admin/Archive/Items — all value journeys in ONE SPA session. ---------- */

const parseNum = (s: string) => Number((s.match(/[\d,]+(\.\d+)?/g) ?? ['0']).join('').replace(/,/g, ''));
const fmtMoney = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 });
const fmtPctLocal = (n: number) => `${n.toLocaleString('en-US', { maximumFractionDigits: 1 })}%`;
/* A .card whose label span matches the label EXACTLY — substring hasText cannot
   be used on 'قيمة العقد' (it also matches 'المتبقي من قيمة العقد'). Composed as
   ONE :has() selector because filter({ has }) re-roots the inner locator inside
   each .card, which breaks when the inner chain carries ancestor paths. */
const moneyCard = (scope: any, label: string) =>
  scope.locator(`.card:has(.l:text-is("${label}"))`);

test('CR-02+CR-03: IPC direct net → BOQ-line recompute → approval feeds indicators, one session', async ({ page }) => {
  /* step 1 — contract value (CR-02) must exist BEFORE the financial checks */
  await page.goto('/projects');
  await openProjectEdit(page);
  const dlg = page.getByRole('dialog');
  await dlg.locator('input[type=number]').fill('32500000');
  await dlg.getByRole('button', { name: 'حفظ' }).click();
  await expect(dlg).toBeHidden();

  /* step 2 — a known BOQ line arithmetic anchor (code/unit prefilled stays) */
  await navTo(page, '/financials'); // nav rows are buttons on /projects — walk via /financials like test 1
  await page.locator('a[href="/projects/p1/financials"]').first().click();
  await expect(page.getByRole('tab', { name: 'المقايسات' })).toBeVisible({ timeout: 8000 });
  await page.getByRole('button', { name: '+ بند جديد' }).click();
  const boqDlg = page.getByRole('dialog');
  await boqDlg.locator('[aria-label="رقم البند"]').fill('CX9');
  await boqDlg.locator('[aria-label="الوصف"]').fill('بند كراء تجريبي');
  await boqDlg.locator('[aria-label="الكمية"]').fill('10');
  await boqDlg.locator('[aria-label="الفئة"]').fill('1250');
  await boqDlg.getByRole('button', { name: 'حفظ' }).click();
  await expect(boqDlg).toBeHidden();

  /* step 3 — (أ) direct path: new IPC, no lines → net = gross − deductions */
  await page.getByRole('tab', { name: 'المستخلصات' }).click();
  await page.getByRole('button', { name: '+ مستخلص جديد' }).click();
  const ipcDlg = page.getByRole('dialog');
  await ipcDlg.locator('[aria-label="القيمة الإجمالية المباشرة"]').fill('10000000');
  await ipcDlg.locator('[aria-label="الاستقطاعات"]').fill('500000');
  await expect(ipcDlg.getByText('9,500,000')).toBeVisible(); // live preview net
  await ipcDlg.getByRole('button', { name: 'حفظ' }).click();
  await expect(ipcDlg).toBeHidden();

  /* (أ) line path: edit the draft IPC → add the CX9 line ×2 → preview flips
     from the direct formula to Σ qty×price; save carries it into the row */
  const row = page.locator('.recRow').filter({ hasText: '9,500,000' }).first();
  const ipcTag = (await row.locator('span.num strong').first().textContent())?.trim() ?? '';
  await row.getByRole('button', { name: 'تعديل' }).click();
  const editDlg = page.getByRole('dialog');
  await editDlg.getByRole('button', { name: '+ إضافة صنف' }).click();
  await editDlg.locator('[aria-label="بند المقايسة 1"]').selectOption({ label: 'CX9 — بند كراء تجريبي' });
  await editDlg.locator('[aria-label="الحالي 1"]').fill('2');
  await expect(editDlg.getByText('2,500')).toBeVisible(); // 2 × 1,250
  await editDlg.getByRole('button', { name: 'حفظ' }).click();
  await expect(editDlg).toBeHidden();
  const lineRow = page.locator('.recRow').filter({ hasText: ipcTag });
  await expect(lineRow).toContainText('2,500');
  await expect(lineRow).toContainText('1 بند');

  /* step 4 — submit then approve via the documented transition buttons */
  await lineRow.getByRole('button', { name: 'مقدمة' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'حفظ' }).click();
  await lineRow.getByRole('button', { name: 'معتمدة' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'حفظ' }).click();
  await expect(lineRow.locator('.badge--green')).toBeVisible({ timeout: 8000 });

  /* step 5 — (ب) indicators parse-and-verify on /financials (same session) */
  await navTo(page, '/financials');
  const sec = page.locator('section.panel').filter({ has: page.locator('a[href="/projects/p1/financials"]') });
  const cardText = async (label: string) => {
    const card = moneyCard(sec, label);
    return (await card.first().textContent()) ?? '';
  };
  const cvTxt = await cardText('قيمة العقد');
  const execTxt = await cardText('المنفّذ (المستخلصات المعتمدة)');
  const cv = parseNum(cvTxt); const exec = parseNum(execTxt);
  expect(cvTxt).toContain('32,500,000');
  expect(exec).toBeGreaterThan(0);
  const pctCard = sec.locator('.card', { hasText: 'نسبة التنفيذ (مالية)' });
  await expect(pctCard).toContainText(fmtPctLocal((exec / cv) * 100));
  const remCard = sec.locator('.card', { hasText: 'المتبقي من قيمة العقد' });
  await expect(remCard).toContainText(fmtMoney(cv - exec));

  /* (د) the disbursement card is honest: "غير متاح" + the gap note, never a number */
  await expect(sec.locator('.card', { hasText: 'المتبقي للصرف' }).first()).toContainText('غير متاح');
  await expect(sec.locator('.card', { hasText: 'المتبقي للصرف' }).filter({ hasText: /\d{3,}/ })).toHaveCount(0);
  await expect(sec.locator('p', { hasText: 'لا توجد بيانات صرف' }).first()).toBeVisible();
});

/* ---------- (ج) CR-01 sweep: Admin / Archive / Items share the validated-save anatomy ---------- */

test('CR-01 sweep: field errors + disabled save in Admin, Archive and Items', async ({ page }) => {
  /* Admin — email format error + required-name error + disabled save */
  await page.goto('/admin');
  await page.getByRole('button', { name: '+ مستخدم جديد' }).click();
  const adm = page.getByRole('dialog');
  await expect(adm.locator('label.field > .err[role="alert"]').first()).toContainText('الاسم مطلوب');
  await expect(adm.getByRole('button', { name: 'حفظ التعديلات' })).toBeDisabled();
  await adm.locator('[aria-label="البريد الإلكتروني"]').fill('not-an-email');
  await expect(adm.locator('.err[role="alert"]', { hasText: 'صيغة البريد' })).toHaveCount(1);
  await adm.locator('[aria-label="البريد الإلكتروني"]').fill('name@example.org');
  await adm.locator('label.field', { hasText: 'الاسم *' }).locator('input').fill('مستخدم فحص');
  await expect(adm.locator('label.field > .err')).toHaveCount(0);
  await expect(adm.getByRole('button', { name: 'حفظ التعديلات' })).toBeEnabled();
  await adm.getByRole('button', { name: 'إلغاء' }).click();

  /* Archive — empty title disables save (metadata modal) */
  await navTo(page, '/archive');
  await page.getByRole('button', { name: 'المزيد' }).first().click();
  await page.getByRole('menuitem', { name: 'تعديل' }).first().click();
  const arc = page.getByRole('dialog');
  const title = arc.getByLabel('عنوان المستند *');
  await title.fill('');
  await expect(arc.getByRole('button', { name: 'حفظ' })).toBeDisabled();
  await title.fill('مستند فحص التوثيق');
  await expect(arc.getByRole('button', { name: 'حفظ' })).toBeEnabled();
  await arc.getByRole('button', { name: 'إلغاء' }).click();

  /* Items — negative min-stock shows the field error and blocks save */
  // the sidebar links /inventory only; this leg carries no cross-page state,
  // so a fresh goto() (mock re-seed) is safe AND simpler than walking the hub
  await page.goto('/inventory/items');
  await page.getByRole('button', { name: 'تعديل' }).first().click();
  const itm = page.getByRole('dialog');
  await itm.getByLabel('حد الأمان').fill('-1');
  await expect(itm.locator('.err[role="alert"]', { hasText: 'أكبر من أو تساوي 0' })).toBeVisible();
  await expect(itm.getByRole('button', { name: 'حفظ' })).toBeDisabled();
  await itm.getByLabel('حد الأمان').fill('');
  await expect(itm.getByRole('button', { name: 'حفظ' })).toBeEnabled();
});

/* ---------- responsive probe (deferred-debt free zone) ---------- */

test('responsive smoke: financial position at 390px and 1920px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/financials');
  await expect(page.locator('.card', { hasText: 'قيمة العقد' }).first()).toBeVisible();
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.reload();
  await expect(page.locator('.card', { hasText: 'قيمة العقد' }).first()).toBeVisible();
});
