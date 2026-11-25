import { test, expect } from '@playwright/test';

/* Phase 10 — NEGATIVE CONTRACT VALUE FIX (owner mandate §4.A).
   Mandate: entering '-5' in the project contract-value field must NOT be
   silently converted to '5' (the Phase 9-reported input-mask defect).
   Every leg proves FOUR things:
     1. the FIELD keeps the entered negative (actual value, not an echo),
     2. an understandable error renders beside the field (role=alert),
     3. SAVE stays disabled while the value is invalid,
     4. no negative amount can reach the payload (button disabled = no submit).
   Zero stays a REAL zero. The edit modal keeps the approved
   `cvClearUnsupported` behaviour (value not deleted/zeroed, error + save
   disabled). The BOQ/IPC direct-total refusal is re-asserted untouched.
   Mock data re-seeds on every full page load; every state-dependent leg
   stays inside one session and CANCELS (never saves) so the seed recovers. */

// Role tiles: admin=0, manager=1, warehouse=2, viewer=3, technical=4
const loginAs = async (page: any, idx: number) => {
  await page.goto('/login');
  await page.locator('.rolePick label').nth(idx).click();
  await page.getByRole('button', { name: /دخول تجريبي|Demo login/ }).click();
  await page.locator('.shell').waitFor({ timeout: 10000 });
};
// In-app SPA navigation keeps the mock store alive
const navTo = async (page: any, path: string) => {
  await page.locator(`a[href="${path}"]`).first().click();
  await page.waitForURL(path, { timeout: 8000 });
};
const turnLang = async (page: any) => {
  await page.locator('[data-lang-toggle]').click();
};

const CV = () => '[aria-label="قيمة العقد"]';
const CASE_FIELD = 'label.field';
const CASE_LABEL_AR = 'قيمة العقد';
const RULE_AR = 'قيمة العقد يجب أن تكون أكبر من أو تساوي 0';
const RULE_EN = 'Contract value must be 0 or greater';
const CLEAR_AR_PREFIX = 'مسار التعديل الحالي لا يدعم تفريغ قيمة العقد';
const CLEAR_EN_PREFIX = 'The current edit path does not support clearing the contract value';

const openCreate = async (page: any) => {
  await page.locator('.cmdHead button', { hasText: 'المشاريع' }).click();
  return page.getByRole('dialog');
};
const seedInDialog = async (dlg: any) => {
  await dlg.locator('[aria-label="كود المشروع *"]').fill('PRJ-CV10');
  await dlg.locator('[aria-label="اسم المشروع *"]').fill('قيمة العقد السالبة (Phase 10)');
};

const openedEditOf = async (page: any) => {
  await page.locator('.recRow', { hasText: 'برج النيل الإداري' }).first()
    .getByRole('button', { name: /تعديل/ }).click();
  return page.getByRole('dialog');
};

test.describe('Phase 10 · negative contract value', () => {
  test('create: typed -5 stays -5, rule beside field, save disabled; correction is live', async ({ page }) => {
    await loginAs(page, 0);
    await navTo(page, '/projects');
    const dlg = await openCreate(page);
    await seedInDialog(dlg);

    // BEFORE damage can occur: the field must carry the minus, not '5'
    await dlg.locator(CV()).fill('-5');
    await expect(dlg.locator(CV())).toHaveValue('-5');
    // understandable refusal beside the field + save blocked
    await expect(dlg.locator(CASE_FIELD, { hasText: CASE_LABEL_AR }).locator('.err[role="alert"]')).toContainText(RULE_AR);
    await expect(dlg.getByRole('button', { name: 'حفظ' })).toBeDisabled();

    // an invalid value can never reach the payload: save stays blocked even
    // on focus/keydown within the invalid form
    await dlg.locator(CV()).press('Enter');
    await expect(dlg).toBeVisible();

    // correcting the entry live-clears the refusal and re-enables save
    await dlg.locator(CV()).fill('1500000');
    await expect(dlg.locator(CV())).toHaveValue('1500000');
    await expect(dlg.locator(CASE_FIELD, { hasText: CASE_LABEL_AR }).locator('.err[role="alert"]')).toHaveCount(0);
    await expect(dlg.getByRole('button', { name: 'حفظ' })).toBeEnabled();

    // zero is a real zero — accepted, never treated as missing
    await dlg.locator(CV()).fill('0');
    await expect(dlg.locator(CV())).toHaveValue('0');
    await expect(dlg.locator(CASE_FIELD, { hasText: CASE_LABEL_AR }).locator('.err[role="alert"]')).toHaveCount(0);
    await expect(dlg.getByRole('button', { name: 'حفظ' })).toBeEnabled();

    // cancel — nothing saved, seed intact
    await dlg.getByRole('button', { name: 'إلغاء' }).click();
    await expect(dlg).toHaveCount(0);
  });

  test('create: typed char-by-char and pasted-like fill both reach the validator', async ({ page }) => {
    await loginAs(page, 0);
    await navTo(page, '/projects');
    const dlg = await openCreate(page);
    await seedInDialog(dlg);
    const cv = dlg.locator(CV());

    // typed (keyboard events, char by char — no mask may eat the minus)
    await cv.fill('');
    await cv.pressSequentially('-5');
    await expect(cv).toHaveValue('-5');
    await expect(dlg.locator(CASE_FIELD, { hasText: CASE_LABEL_AR }).locator('.err[role="alert"]')).toContainText(RULE_AR);
    await expect(dlg.getByRole('button', { name: 'حفظ' })).toBeDisabled();

    // pasted-like (fill replaces wholesale — same onChange path)
    await cv.fill('-750');
    await expect(cv).toHaveValue('-750');
    await expect(dlg.locator(CASE_FIELD, { hasText: CASE_LABEL_AR }).locator('.err[role="alert"]')).toContainText(RULE_AR);
    await expect(dlg.getByRole('button', { name: 'حفظ' })).toBeDisabled();

    await dlg.getByRole('button', { name: 'إلغاء' }).click();
  });

  test('edit: unpopulated → populated → -1 refused; restore and cvClearUnsupported behave per contract', async ({ page }) => {
    await loginAs(page, 0);
    await navTo(page, '/projects');

    // the seed carries NO stored contract value on any project — populate it
    // in-session first (mock reseeds on full page load, so nothing persists)
    const dlg0 = await openedEditOf(page);
    await dlg0.locator(CV()).fill('4614000');
    await expect(dlg0.locator(CASE_FIELD, { hasText: CASE_LABEL_AR }).locator('.err[role="alert"]')).toHaveCount(0);
    await expect(dlg0.getByRole('button', { name: 'حفظ' })).toBeEnabled();
    await dlg0.getByRole('button', { name: 'حفظ' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // reopen: the populated value survives the in-session round-trip
    const ed = await openedEditOf(page);
    await expect(ed.locator(CV())).toHaveValue('4614000');

    // negative entry refuses with an error, save disabled — nothing silently changed
    await ed.locator(CV()).fill('-1');
    await expect(ed.locator(CV())).toHaveValue('-1');
    await expect(ed.locator(CASE_FIELD, { hasText: CASE_LABEL_AR }).locator('.err[role="alert"]')).toContainText(RULE_AR);
    await expect(ed.getByRole('button', { name: 'حفظ' })).toBeDisabled();

    // restoring a valid amount re-enables save with no error
    await ed.locator(CV()).fill('4614000');
    await expect(ed.locator(CASE_FIELD, { hasText: CASE_LABEL_AR }).locator('.err[role="alert"]')).toHaveCount(0);
    await expect(ed.getByRole('button', { name: 'حفظ' })).toBeEnabled();

    // approved cvClearUnsupported: clearing the POPULATED value is refused —
    // value not deleted/zeroed on payload, stated error beside the field
    await ed.locator(CV()).fill('');
    await expect(ed.locator(CASE_FIELD, { hasText: CASE_LABEL_AR }).locator('.err[role="alert"]')).toContainText(CLEAR_AR_PREFIX);
    await expect(ed.getByRole('button', { name: 'حفظ' })).toBeDisabled();

    // cancel — no save, seed intact
    await ed.getByRole('button', { name: 'إلغاء' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('English: the same refusal reads in English at LTR', async ({ page }) => {
    await loginAs(page, 0);
    await navTo(page, '/projects');
    await turnLang(page);
    await expect(page.locator('html[dir="ltr"]')).toHaveCount(1);
    // English chrome: the create button reads 'Projects', not 'المشاريع'
    await page.locator('.cmdHead button', { hasText: 'Projects' }).click();
    const dlg = page.getByRole('dialog');
    await dlg.locator('[aria-label="Project code *"]').fill('PRJ-CVEN');
    await dlg.locator('[aria-label="Project name *"]').fill('Negative contract value (Phase 10)');

    await dlg.locator('[aria-label="Contract value"]').fill('-5');
    await expect(dlg.locator('[aria-label="Contract value"]')).toHaveValue('-5');
    await expect(dlg.locator('label.field').filter({ hasText: /Contract value/ }).locator('.err[role="alert"]')).toContainText(RULE_EN);
    await expect(dlg.getByRole('button', { name: /Save|أضف|حفظ/ })).toBeDisabled();

    await dlg.getByRole('button', { name: /Cancel|إلغاء/ }).click();
    // back to RTL for the next worker/session
    await turnLang(page);
    await expect(page.locator('html[dir="rtl"]')).toHaveCount(1);
  });

  test('regression: the IPC direct-total still REFUSES a negative (BOQ untouched)', async ({ page }) => {
    await loginAs(page, 0);
    await navTo(page, '/projects');
    await page.goto('/projects/p1/financials');
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
});
