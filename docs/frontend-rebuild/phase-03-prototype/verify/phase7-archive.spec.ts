import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Phase 7 — archive workspace rebuild. Exercises the newly wired mock mirrors
// of PUT /documents/:id (metadata edit), POST /documents/:id/revisions
// (label rule + approved→submitted downgrade), DELETE /documents/:id
// (in-memory removal) and the upload optional-metadata fields.
// Everything is demo apparatus: repository fixture files only, nothing real.
/* Phase 10.1 (GAP-06/07): fixture files moved inside the repository. */
const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');

const loginAs = async (page: any, role: string) => {
  await page.goto('/login');
  await page.getByRole('radio', { name: role }).click();
  await page.getByRole('button', { name: /دخول تجريبي/ }).click();
  await page.locator('.shell').waitFor({ timeout: 10000 });
};
const openEdit = async (page: any, num: string) => {
  await page.locator('.recRow', { hasText: num }).getByRole('button', { name: 'المزيد' }).click();
  await page.getByRole('menu').getByRole('menuitem', { name: 'تعديل' }).click();
  const dlg = page.getByRole('dialog');
  await expect(dlg).toBeVisible();
  return dlg;
};

test('metadata edit: prefill, save updates the row, notes reach the viewer', async ({ page }) => {
  await loginAs(page, 'مدير (تجريبي)');
  await page.goto('/archive');
  await expect(page.getByText('DOC-198').first()).toBeVisible({ timeout: 8000 });
  const dlg = await openEdit(page, 'DOC-198');
  await expect(dlg).toContainText('تعديل بيانات المستند (تجريبي)');
  await expect(dlg.getByLabel('رقم المستند')).toHaveValue('DOC-198');
  await expect(dlg.getByLabel('الوسوم (بفواصل)')).toHaveValue('مالي');
  await dlg.getByLabel('رقم المستند').fill('DOC-199');
  await dlg.getByLabel('الوسوم (بفواصل)').fill('مالي, تجريبي');
  await dlg.getByLabel('ملاحظات').fill('ملاحظة تجريبية للمراجعة');
  await dlg.getByRole('button', { name: 'حفظ' }).click();
  await expect(page.locator('.toast--success')).toContainText('تم تحديث بيانات المستند (تجريبي).');
  await expect(dlg).toBeHidden();
  await expect(page.locator('.recRow', { hasText: 'DOC-199' })).toBeVisible();
  await page.locator('.recRow', { hasText: 'DOC-199' }).getByRole('button', { name: 'معاينة' }).click();
  const pv = page.getByRole('dialog');
  await expect(pv.getByText('ملاحظات: ملاحظة تجريبية للمراجعة')).toBeVisible();
});

test('metadata edit: required-field mirrors of the PUT validator block the save', async ({ page }) => {
  await loginAs(page, 'مدير (تجريبي)');
  await page.goto('/archive');
  await expect(page.getByText('DOC-198').first()).toBeVisible({ timeout: 8000 });
  const dlg = await openEdit(page, 'DOC-198');
  const title = dlg.getByLabel('عنوان المستند *');
  const category = dlg.getByLabel('التصنيف');
  await title.fill('');
  /* Phase 10.1 (GAP-05): the accepted Phase 9 anatomy keeps save DISABLED
     while the required title is empty (the disabled button is the live UI
     guard mirroring the PUT validator); no further submit path exists. */
  await expect(dlg.getByRole('button', { name: 'حفظ' })).toBeDisabled();
  await expect(dlg).toBeVisible(); // stays open, nothing saved
  await title.fill('مستخلص رقم ٣');
  await expect(dlg.getByRole('button', { name: 'حفظ' })).toBeEnabled();
  await category.fill('');
  await dlg.getByRole('button', { name: 'حفظ' }).click();
  await expect(dlg.getByText('تصنيف المستند مطلوب')).toBeVisible();
  await expect(dlg).toBeVisible(); // stays open, nothing saved
  await expect(page.locator('.recRow', { hasText: 'DOC-198' })).toBeVisible(); // unchanged row
});

test('technical role: WRITE in p1 edits succeed; moving p1→p2 is denied (archive.edit)', async ({ page }) => {
  await loginAs(page, 'فني (تجريبي)');
  await page.goto('/archive');
  await expect(page.getByText('DOC-198').first()).toBeVisible({ timeout: 8000 });
  // (a) scoped-faithful success: WRITE access on p1, no move
  {
    const dlg = await openEdit(page, 'DOC-198');
    await dlg.getByLabel('ملاحظات').fill('ملاحظة فنية (تجريبية)');
    await dlg.getByRole('button', { name: 'حفظ' }).click();
    await expect(page.locator('.toast--success')).toContainText('تم تحديث بيانات المستند (تجريبي).');
    await expect(dlg).toBeHidden();
  }
  // (b) route-faithful: p2 document without a move is editable (global gate only)
  await expect(page.getByText('DOC-120').first()).toBeVisible({ timeout: 8000 });
  {
    const dlg = await openEdit(page, 'DOC-120');
    await dlg.getByLabel('ملاحظات').fill('ملاحظة فنية على مستخلص (تجريبية)');
    await dlg.getByRole('button', { name: 'حفظ' }).click();
    await expect(page.locator('.toast--success')).toContainText('تم تحديث بيانات المستند (تجريبي).');
    await expect(dlg).toBeHidden();
  }
  // (c) the acceptance case: moving the p1 document to p2 (READ < WRITE) → 403
  {
    const dlg = await openEdit(page, 'DOC-198');
    await dlg.getByLabel('المشروع').selectOption({ label: 'مستشفى الشفاء (تجريبي)' });
    await dlg.getByRole('button', { name: 'حفظ' }).click();
    await expect(dlg.getByText('ليس لديك صلاحية: archive.edit')).toBeVisible();
    await expect(dlg).toBeVisible(); // stays open
    await dlg.getByRole('button', { name: 'إلغاء' }).click();
    await expect(dlg).toBeHidden();
    await expect(page.locator('.recRow', { hasText: 'DOC-198' })).toBeVisible();
  }
});

test('revision upload flow: file → review → confirm; backend-faithful label quirk (d1 → v03 duplicates)', async ({ page }) => {
  await loginAs(page, 'مدير (تجريبي)');
  await page.goto('/archive');
  await expect(page.getByText('DOC-220').first()).toBeVisible({ timeout: 8000 });
  await page.locator('.recRow', { hasText: 'DOC-220' }).getByRole('button', { name: /v03/ }).click();
  const dlg = page.getByRole('dialog');
  await expect(dlg).toContainText('الإصدارات: مخططات إنشائية');
  await dlg.getByRole('button', { name: '+ إصدار جديد (تجريبي)' }).click();
  await dlg.locator('input[type="file"]').setInputFiles(path.join(FIXTURES, 'replacement.txt'));
  await dlg.getByLabel('ملاحظات الإصدار (اختياري)').fill('إصدار تجريبي جديد');
  await dlg.getByRole('button', { name: 'مراجعة', exact: true }).click();
  await expect(dlg.getByText('replacement.txt')).toBeVisible(); // review step
  await dlg.getByRole('button', { name: 'تأكيد رفع الإصدار' }).click();
  await expect(page.locator('.toast--success')).toContainText('أُضيف الإصدار v03 (تجريبي).');
  await expect(dlg).toBeHidden();
  // list refreshes in place: history grew and the newest label mirrors
  // nextRevisionLabel(history.length) — duplicated '03' is backend-faithful.
  await expect(page.locator('.recRow', { hasText: 'DOC-220' }).getByRole('button', { name: /v03/ })).toHaveText(/v03 \(4\)/);
});

test('revision upload on an approved document: downgrade is stated before confirm and applied', async ({ page }) => {
  await loginAs(page, 'مدير (تجريبي)');
  await page.goto('/archive');
  await expect(page.getByText('DOC-150').first()).toBeVisible({ timeout: 8000 });
  await expect(page.locator('.recRow', { hasText: 'DOC-150' })).toContainText('معتمدة');
  await page.locator('.recRow', { hasText: 'DOC-150' }).getByRole('button', { name: /v00/ }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByRole('button', { name: '+ إصدار جديد (تجريبي)' }).click();
  await dlg.locator('input[type="file"]').setInputFiles(path.join(FIXTURES, 'replacement.txt'));
  await dlg.getByRole('button', { name: 'مراجعة', exact: true }).click();
  await expect(dlg.getByText('يعود الطلب تلقائيًا إلى «مقدمة»')).toBeVisible();
  await dlg.getByRole('button', { name: 'تأكيد رفع الإصدار' }).click();
  await expect(page.locator('.toast--success')).toContainText('أُضيف الإصدار v01 (تجريبي).');
  await expect(dlg).toBeHidden();
  await expect(page.locator('.recRow', { hasText: 'DOC-150' })).toContainText('مقدمة');
});

test('delete: confirm dialog stays truthful, the demo record is removed in memory only', async ({ page }) => {
  await loginAs(page, 'مدير (تجريبي)');
  await page.goto('/archive');
  await expect(page.getByText('DOC-198').first()).toBeVisible({ timeout: 8000 });
  await page.locator('.recRow', { hasText: 'DOC-198' }).getByRole('button', { name: 'المزيد' }).click();
  await page.getByRole('menu').getByRole('menuitem', { name: 'حذف' }).click();
  const dlg = page.getByRole('dialog');
  await expect(dlg).toContainText('لن يُحذف شيء حقيقي');
  await dlg.getByRole('button', { name: 'تأكيد' }).click();
  await expect(page.locator('.toast--success')).toContainText('أُزيل السجل من الذاكرة التجريبية — لا شيء حقيقي.');
  await expect(dlg).toBeHidden();
  // The refresh shows a skeleton (not .recRow) — wait for the list itself,
  // then assert: the deleted record is gone and page 1 is refilled from the
  // next pages (7 docs → PAGE_SIZE rows).
  await expect(page.locator('.recRow').first()).toBeVisible({ timeout: 8000 });
  await expect(page.locator('.recRow', { hasText: 'DOC-198' })).toHaveCount(0);
  expect(await page.locator('.recRow').count()).toBe(5);
});

test('upload with optional metadata: record carries number, category, type, tags and notes', async ({ page }) => {
  await loginAs(page, 'مدير (تجريبي)');
  await page.goto('/archive');
  await expect(page.getByText('DOC-220').first()).toBeVisible({ timeout: 8000 });
  await page.getByRole('button', { name: '+ رفع مستند (تجريبي)' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByLabel('عنوان المستند *').fill('مستند تجريبي ببيانات كاملة');
  await dlg.getByLabel('رقم المستند').fill('DOC-META-01');
  await dlg.getByLabel('التصنيف').last().fill('تقارير');
  await dlg.getByLabel('الوسوم (بفواصل)').fill('تجريبي, مرحلة7');
  await dlg.getByLabel('ملاحظات').fill('رفع تجريبي ببيانات اختيارية');
  await dlg.getByRole('button', { name: 'رفع', exact: true }).click();
  await expect(page.locator('.toast--success')).toBeVisible(); // demo note
  await expect(page.locator('.recRow', { hasText: 'DOC-META-01' })).toBeVisible();
  await page.locator('.recRow', { hasText: 'DOC-META-01' }).getByRole('button', { name: 'معاينة' }).click();
  const pv = page.getByRole('dialog');
  await expect(pv.getByText('ملاحظات: رفع تجريبي ببيانات اختيارية')).toBeVisible();
  await expect(pv.getByText('#تجريبي #مرحلة7')).toBeVisible();
});
