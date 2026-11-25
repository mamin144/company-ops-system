import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Phase 3.4 archive verification (kept). Temp output only; mock data only.
/* Phase 10.1 (GAP-02/03): upload/import fixtures now live in the repository
   instead of a developer-session Temp path, so the specs run standalone. */
const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
const loginAs = async (page: any, role: string) => {
  await page.goto('/login');
  await page.getByRole('radio', { name: role }).click();
  await page.getByRole('button', { name: /دخول تجريبي/ }).click();
  await page.locator('.shell').waitFor({ timeout: 10000 });
};
const openViewerFor = async (page: any, num: string) => {
  const trigger = page.locator('.recRow', { hasText: num }).getByRole('button', { name: 'معاينة' });
  await trigger.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  return trigger;
};
// Phase 3.12: secondary row actions live in the accessible row menu now.
const rowMenuItem = async (page: any, num: string, item: string | RegExp) => {
  await page.locator('.recRow', { hasText: num }).getByRole('button', { name: 'المزيد' }).click();
  await page.getByRole('menu').getByRole('menuitem', { name: item }).click();
};

test.beforeEach(async ({ page }) => {
  await loginAs(page, 'مدير (تجريبي)');
  await page.goto('/archive');
  await expect(page.getByText('DOC-220').first()).toBeVisible({ timeout: 8000 });
});

test('viewer: valid pdf, unsupported type fallback, empty-content variant, keyboard', async ({ page }) => {
  // valid pdf with revisions
  let trigger = await openViewerFor(page, 'DOC-220');
  await expect(page.getByText('محتوى تجريبي — ليس الملف الأصلي').first()).toBeVisible();
  await expect(page.locator('.modal').getByText('مخططات إنشائية — الدور الأرضي').first()).toBeVisible();
  // linked docs shown; open linked navigates viewer to d3
  await page.getByRole('button', { name: /فتح المرتبط/ }).first().click();
  await expect(page.locator('.modal').getByText('عقد المقاول الرئيسي').first()).toBeVisible();
  // focus inside dialog, Escape closes, focus restores (to a control inside modal context)
  const inside = await page.evaluate(() => !!document.querySelector('.modal')?.contains(document.activeElement));
  expect(inside).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  // fallback: dwg lives on page two under the default newest-first sort
  await page.getByRole('button', { name: 'التالي' }).click();
  trigger = await openViewerFor(page, 'DOC-090');
  await expect(page.getByText('لا تتوافر معاينة لهذا النوع في النموذج')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await page.getByRole('button', { name: 'السابق' }).click();
  // empty: pdf with no revisions
  trigger = await openViewerFor(page, 'DOC-301');
  await expect(page.getByText('لا يوجد محتوى معاينة مسجل لهذا المستند')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
});

test('status change reflects in list; no enforced transition matrix (documented)', async ({ page }) => {
  await page.locator('.recRow', { hasText: 'DOC-220' }).getByRole('button', { name: 'المزيد' }).click();
  await page.getByRole('menu').getByRole('menuitem', { name: 'الحالة' }).click();
  const modal = page.getByRole('dialog');
  await modal.locator('select').selectOption('superseded');
  await modal.getByRole('button', { name: 'حفظ التعديلات' }).click();
  // Phase 3.12: saving opens an explicit confirm step — nothing mutates yet
  await modal.getByRole('button', { name: 'تأكيد' }).click();
  await expect(modal).toBeHidden();
  await expect(page.locator('.recRow', { hasText: 'DOC-220' }).getByText('مُستبدلة')).toBeVisible();
});

test('replace flow: review, history keeps old version, list updates, approved downgrades', async ({ page }) => {
  const row = page.locator('.recRow', { hasText: 'DOC-198' });
  await rowMenuItem(page, 'DOC-198', 'استبدال');
  const modal = page.getByRole('dialog');
  await modal.locator('input[type="file"]').setInputFiles(path.join(FIXTURES, 'replacement.txt'));
  await modal.getByRole('button', { name: 'مراجعة الاستبدال' }).click();
  await expect(modal.getByText('replacement.txt')).toBeVisible();
  await modal.getByRole('button', { name: 'تأكيد الاستبدال' }).click();
  await expect(modal).toBeHidden();
  await expect(page.locator('.recRow', { hasText: 'DOC-198' }).getByText('v01 (2)')).toBeVisible();
  // history contains the previous version (seeded v00 entry + the snapshot)
  await page.locator('.recRow', { hasText: 'DOC-198' }).getByRole('button', { name: /^v01 \(2\)$/ }).click();
  await expect(page.getByRole('dialog').getByText('IPC-03.pdf').first()).toBeVisible();
  await page.keyboard.press('Escape');
  // approved -> submitted downgrade on replace
  await rowMenuItem(page, 'DOC-150', 'استبدال');
  const modal2 = page.getByRole('dialog');
  await modal2.locator('input[type="file"]').setInputFiles(path.join(FIXTURES, 'replacement.txt'));
  await modal2.getByRole('button', { name: 'مراجعة الاستبدال' }).click();
  await modal2.getByRole('button', { name: 'تأكيد الاستبدال' }).click();
  await expect(page.locator('.recRow', { hasText: 'DOC-150' }).getByText('مقدمة')).toBeVisible();
});

test('links: add, duplicate disabled, confirm-remove, in-place refresh', async ({ page }) => {
  const row = page.locator('.recRow', { hasText: 'DOC-198' });
  await rowMenuItem(page, 'DOC-198', /^روابط \(1\)$/);
  const modal = page.getByRole('dialog');
  // seeded relationship is listed (exact: the picker option repeats the title)
  await expect(modal.getByText('مخططات إنشائية — الدور الأرضي', { exact: true })).toBeVisible();

  // duplicate prevention is visible: self is never offered, already-linked
  // documents stay in the list but are disabled + labelled.
  const readOptions = () => modal.locator('select').first().locator('option').evaluateAll(
    (els) => els.map((e) => ({ v: (e as HTMLOptionElement).value, d: (e as HTMLOptionElement).disabled, t: (e as HTMLOptionElement).textContent ?? '' })).filter((o) => o.v),
  );
  let offered = await readOptions();
  expect(offered.map((o) => o.v)).not.toContain('d2'); // self
  const linkedOpt = offered.find((o) => o.v === 'd1');
  expect(linkedOpt?.d).toBe(true);
  expect(linkedOpt?.t).toContain('مرتبط مسبقًا');
  const target = offered.find((o) => !o.d)!.v;
  expect(target).toBeTruthy();

  await modal.locator('select').first().selectOption(target);
  await modal.getByRole('button', { name: 'إضافة ارتباط', exact: true }).click();
  // new entry appears, and the target is now disabled (no duplicate possible)
  await expect(modal.getByRole('button', { name: 'إزالة', exact: true })).toHaveCount(2);
  offered = await readOptions();
  expect(offered.find((o) => o.v === target)?.d).toBe(true);
  // list row count refreshed in place (no full reload) — close the dialog,
  // reopen the row menu and read the live count there. The toast fires only
  // after the parent reload settles, so the menu reads the fresh count.
  await expect(page.locator('.toast--success', { hasText: 'تمت الإضافة' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(modal).toBeHidden();
  await row.getByRole('button', { name: 'المزيد' }).click();
  await expect(page.getByRole('menu').getByRole('menuitem', { name: /^روابط \(2\)$/ })).toBeVisible();
  await page.keyboard.press('Escape');

  // remove with an explicit confirm step (reopen the dialog from the menu)
  await rowMenuItem(page, 'DOC-198', /^روابط \(2\)$/);
  await modal.getByRole('button', { name: 'إزالة', exact: true }).first().click();
  await expect(modal.getByRole('button', { name: 'تأكيد الإزالة', exact: true })).toBeVisible();
  await modal.getByRole('button', { name: 'تأكيد الإزالة', exact: true }).click();
  await expect(modal.getByRole('button', { name: 'إزالة', exact: true })).toHaveCount(1);
  await expect(page.locator('.toast--success', { hasText: 'تمت الإزالة' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(modal).toBeHidden();
  await row.getByRole('button', { name: 'المزيد' }).click();
  await expect(page.getByRole('menu').getByRole('menuitem', { name: /^روابط \(1\)$/ })).toBeVisible();
  await page.keyboard.press('Escape');

  // remove the last one -> explicit empty state, keyboard close, row count 0
  await rowMenuItem(page, 'DOC-198', /^روابط \(1\)$/);
  await modal.getByRole('button', { name: 'إزالة', exact: true }).first().click();
  await modal.getByRole('button', { name: 'تأكيد الإزالة', exact: true }).click();
  await expect(modal.getByText('لا روابط مسجلة')).toBeVisible();
  await expect(page.locator('.toast--success', { hasText: 'تمت الإزالة' }).last()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(modal).toBeHidden();
  await row.getByRole('button', { name: 'المزيد' }).click();
  await expect(page.getByRole('menu').getByRole('menuitem', { name: /^روابط \(0\)$/ })).toBeVisible();
  await page.keyboard.press('Escape');
});

test('CSV import: valid/invalid/dup rows, cancel-no-change, partial counts', async ({ page }) => {
  const before = await page.locator('.recRow').count();
  await page.getByRole('button', { name: /استيراد CSV/ }).click();
  const modal = page.getByRole('dialog');
  await modal.locator('input[type="file"]').setInputFiles(path.join(FIXTURES, 'import-mixed.csv'));
  // mapping step auto-filled from Arabic headers
  await expect(modal.getByText('مراجعة الصفوف')).toBeVisible();
  await modal.getByRole('button', { name: /مراجعة الصفوف/ }).last().click();
  await expect(modal.getByText('العنوان مطلوب')).toBeVisible();
  await expect(modal.getByText('رقم مكرر — سيُتخطى')).toBeVisible();
  await expect(modal.getByText('حالة غير معروفة: nonsense')).toBeVisible();
  await modal.getByRole('button', { name: /الملخص والتأكيد/ }).last().click();
  await expect(modal).toContainText(/سيُضاف:\s*1/);
  const summary = await modal.innerText();
  expect(summary).toMatch(/سيُضاف:\s*1/);
  expect(summary).toMatch(/سيُتخطى:\s*3/);
  // opt into the duplicate row -> counts become 2 added / 2 skipped; then opt out again
  await modal.getByRole('tab', { name: /مراجعة الصفوف/ }).click();
  await modal.getByRole('checkbox', { name: /تضمين/ }).check();
  await modal.getByRole('button', { name: /الملخص والتأكيد/ }).last().click();
  expect(await modal.innerText()).toMatch(/سيُضاف:\s*2/);
  await modal.getByRole('tab', { name: /مراجعة الصفوف/ }).click();
  await modal.getByRole('checkbox', { name: /تضمين/ }).uncheck();
  // editing the mapping re-validates rows instead of doing nothing
  await modal.getByRole('tab', { name: /مطابقة الأعمدة/ }).click();
  await expect(modal).toContainText('مطابقة تلقائية أولية');
  await modal.getByRole('combobox').first().selectOption('');
  await modal.getByRole('button', { name: /مراجعة الصفوف/ }).last().click();
  const afterRemap = await modal.innerText();
  // every row now fails the required-title rule
  expect((afterRemap.match(/العنوان مطلوب/g) ?? []).length).toBe(4);
  expect(afterRemap).not.toMatch(/رقم مكرر/);
  // restore the correct mapping
  await modal.getByRole('tab', { name: /مطابقة الأعمدة/ }).click();
  await modal.getByRole('combobox').first().selectOption('title');
  await modal.getByRole('button', { name: /مراجعة الصفوف/ }).last().click();
  await expect(modal.getByText('رقم مكرر — سيُتخطى')).toBeVisible();
  // cancel path: no data change
  await modal.getByRole('button', { name: 'إلغاء الاستيراد' }).click();
  await expect(modal).toBeHidden();
  expect(await page.locator('.recRow').count()).toBe(before);
  // confirm path
  await page.getByRole('button', { name: /استيراد CSV/ }).click();
  const modal2 = page.getByRole('dialog');
  await modal2.locator('input[type="file"]').setInputFiles(path.join(FIXTURES, 'import-mixed.csv'));
  await modal2.getByRole('button', { name: /مراجعة الصفوف/ }).last().click();
  await modal2.getByRole('button', { name: /الملخص والتأكيد/ }).last().click();
  await modal2.getByRole('button', { name: 'تأكيد الاستيراد' }).click();
  await expect(modal2).toBeHidden();
  await expect(page.locator('.toast--success')).toContainText('+1');
  await expect(page.getByText('مستند مستورد صالح').first()).toBeVisible();
});

test('viewer role: preview-only, no management actions; EN spot; overflow; console', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message.split('\n')[0]));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) errors.push(m.text().slice(0, 120)); });
  await page.getByRole('button', { name: 'خروج' }).click();
  await page.goto('/login');
  await page.getByRole('radio', { name: 'مشاهد (تجريبي)' }).click();
  await page.getByRole('button', { name: /دخول تجريبي/ }).click();
  await page.goto('/archive');
  // project documents are outside a viewer identity's scope: only the two
  // project-less documents exist for this role, per the audited list rule
  await expect(page.locator('.recRow', { hasText: 'DOC-301' })).toBeVisible();
  await expect(page.locator('.recRow', { hasText: 'DOC-001' })).toBeVisible();
  await expect(page.locator('.recRow', { hasText: 'DOC-220' })).toHaveCount(0);
  await expect(page.locator('.recRow', { hasText: 'DOC-090' })).toHaveCount(0);
  const row = page.locator('.recRow', { hasText: 'DOC-301' });
  await expect(row.getByRole('button', { name: 'معاينة' })).toBeVisible();
  await expect(row.getByRole('button', { name: 'الحالة' })).toHaveCount(0);
  await expect(row.getByRole('button', { name: /استبدال/ })).toHaveCount(0);
  await expect(row.getByRole('button', { name: /روابط/ })).toHaveCount(0);
  await expect(row.getByRole('button', { name: 'حذف' })).toHaveCount(0);
  await expect(row.getByRole('button', { name: 'المزيد' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /استيراد CSV/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /رفع مستند/ })).toHaveCount(0);
  // EN spot on the viewer (the only archive action a viewer role may take):
  // the empty-content variant. The unsupported-type fallback has no fixture
  // inside a viewer identity's scope (both project-less documents lack
  // revisions, and revisions-empty wins over the type check) — it stays
  // covered by the admin flow above.
  await page.getByRole('button', { name: 'ع/EN' }).click();
  await expect(page.locator('html[dir="ltr"]')).toHaveCount(1);
  await row.getByRole('button', { name: 'Preview' }).click();
  await expect(page.getByText('No preview content recorded for this document').first()).toBeVisible();
  await expect(page.getByText('Linked documents').first()).toBeVisible();
  await page.keyboard.press('Escape');
  // back to Arabic: RTL restored
  await page.getByRole('button', { name: 'ع/EN' }).click();
  await expect(page.locator('html[dir="rtl"]')).toHaveCount(1);
  // overflow matrix on archive incl. open viewer at 375
  for (const w of [320, 375, 390, 430, 768, 1024, 1366, 1920]) {
    await page.setViewportSize({ width: w, height: 800 });
    await page.goto('/archive');
    const over = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(over, `overflow ${w}px`).toBe(false);
  }
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/archive');
  await page.locator('.recRow', { hasText: 'DOC-301' }).getByRole('button', { name: 'معاينة' }).click();
  const over375 = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(over375).toBe(false);
  expect(errors).toHaveLength(0);
});

test('EN/LTR sweep across every new archive dialog (admin)', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message.split('\n')[0]));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) errors.push(m.text().slice(0, 120)); });
  await page.getByRole('button', { name: 'ع/EN' }).click();
  await expect(page.locator('html[dir="ltr"]')).toHaveCount(1);
  const row = page.locator('.recRow', { hasText: 'DOC-220' });
  const rowMenuEn = async (item: string | RegExp) => {
    await row.getByRole('button', { name: 'More' }).click();
    await page.getByRole('menu').getByRole('menuitem', { name: item }).click();
  };

  await rowMenuEn('Status');
  await expect(page.getByText('No documented transition rules').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save changes' })).toBeVisible();
  await page.keyboard.press('Escape');

  await rowMenuEn(/^Links \(\d+\)$/);
  await expect(page.getByRole('option', { name: /Already linked — duplicate/ })).toBeDisabled();
  await page.keyboard.press('Escape');

  await rowMenuEn('Replace');
  await expect(page.getByText('Current version', { exact: false }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Review replacement' })).toBeDisabled();
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Import CSV (demo)' }).click();
  await expect(page.getByText('Read in the browser only', { exact: false }).first()).toBeVisible();
  await expect(page.getByRole('tab', { name: /Review rows/ })).toBeVisible();
  await page.keyboard.press('Escape');

  // no overflow in English at the narrowest supported width
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/archive');
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  expect(errors).toHaveLength(0);
});

test('sorting changes the real rows; toggling reverses them', async ({ page }) => {
  const firstRow = () => page.locator('.recRow').first().innerText();
  const initial = await firstRow();
  // title ascending: the first row must actually change
  await page.getByRole('button', { name: 'المستند — ترتيب', exact: true }).click();
  const asc = await firstRow();
  expect(asc).not.toBe(initial);
  await expect(page.locator('.recRow', { hasText: 'أرشيف ٢٠٢٤' }).first()).toBeVisible();
  // same header again: descending, first row changes again
  await page.getByRole('button', { name: 'المستند — ترتيب', exact: true }).click();
  const desc = await firstRow();
  expect(desc).not.toBe(asc);
  // status sort also reorders for real
  await page.getByRole('button', { name: 'الإصدار/الحالة — ترتيب', exact: true }).click();
  expect(await firstRow()).not.toBe(desc);
});

test('pagination slices the list; pages hold disjoint rows', async ({ page }) => {
  await expect(page.getByText('صفحة 1 من 2')).toBeVisible();
  const pageOne = await page.locator('.recRow').allInnerTexts();
  expect(pageOne).toHaveLength(5);
  await page.getByRole('button', { name: 'التالي' }).click();
  await expect(page.getByText('صفحة 2 من 2')).toBeVisible();
  const pageTwo = await page.locator('.recRow').allInnerTexts();
  expect(pageTwo.length).toBeGreaterThan(0);
  for (const r of pageTwo) expect(pageOne).not.toContain(r);
  await page.getByRole('button', { name: 'السابق' }).click();
  await expect(page.getByText('صفحة 1 من 2')).toBeVisible();
  expect(await page.locator('.recRow').allInnerTexts()).toEqual(pageOne);
});

test('filtering resets to page one and narrows for real', async ({ page }) => {
  await page.getByRole('button', { name: 'التالي' }).click();
  await expect(page.getByText('صفحة 2 من 2')).toBeVisible();
  // exact: the new status sort header ("الإصدار/الحالة — ترتيب") also contains
  // the word, but the filter control is the select itself
  await page.getByLabel('الحالة', { exact: true }).selectOption('rejected');
  await page.getByRole('search').getByRole('button', { name: 'بحث', exact: true }).click();
  // back on page one, a single row, no pager at all
  await expect(page.locator('.recRow')).toHaveCount(1);
  await expect(page.locator('.recRow', { hasText: 'DOC-090' })).toBeVisible();
  await expect(page.locator('.pager')).toHaveCount(0);
  // clearing restores the full scoped list
  await page.getByRole('button', { name: 'مسح الفلاتر' }).click();
  await expect(page.getByText('صفحة 1 من 2')).toBeVisible();
});

test('management sees only in-scope documents; others are absent, not hidden', async ({ page }) => {
  await page.getByRole('button', { name: 'خروج' }).click();
  await loginAs(page, 'إدارة (تجريبي)');
  await page.goto('/archive');
  await expect(page.locator('.recRow', { hasText: 'DOC-220' })).toBeVisible();
  await expect(page.locator('.recRow', { hasText: 'DOC-150' })).toBeVisible();
  await expect(page.locator('.recRow', { hasText: 'DOC-090' })).toHaveCount(0);
  await expect(page.locator('.recRow', { hasText: 'DOC-120' })).toHaveCount(0);
  await expect(page.locator('.recRow', { hasText: 'DOC-310' })).toHaveCount(0);
  // the search box cannot reach past the scope either
  await page.getByRole('searchbox', { name: 'بحث' }).fill('DOC-090');
  await page.getByRole('search').getByRole('button', { name: 'بحث', exact: true }).click();
  await expect(page.getByText('لا نتائج مطابقة')).toBeVisible();
});

test('out-of-scope link targets are never offered; the gap is stated', async ({ page }) => {
  // DOC-301 (project-less) links to DOC-120 (p2-only) in the seed.
  const row = page.locator('.recRow', { hasText: 'DOC-301' });
  await rowMenuItem(page, 'DOC-301', /^روابط \(1\)$/);
  const modal = page.getByRole('dialog');
  // the picker loads asynchronously: wait for a real option, otherwise the
  // read below races the fetch and proves nothing (<option> is never
  // "visible", so wait for attachment, not visibility)
  await modal.locator('select').first().locator('option[value="d4"]').waitFor({ state: 'attached' });
  // admin: every link is in scope, so no gap note is shown
  await expect(modal.getByText('روابط خارج نطاق صلاحياتك غير معروضة.')).toHaveCount(0);
  const adminOffered = await modal.locator('select').first().locator('option').evaluateAll(
    (els) => els.map((e) => (e as HTMLOptionElement).value),
  );
  expect(adminOffered).toContain('d4');
  await page.keyboard.press('Escape');

  // Narrow this identity to p1 and re-run the list WITHOUT a page load
  // (a full navigation would re-seed the in-memory mock and discard the
  // narrowing). The search button re-invokes the scoped reader in place.
  await page.evaluate(() => {
    const api = (window as any).__protoApi;
    api.userApi.setAccess('mu-1', { p1: 'READ' });
  });
  await page.getByRole('search').getByRole('button', { name: 'بحث', exact: true }).click();
  const rowM = page.locator('.recRow', { hasText: 'DOC-301' });
  await expect(rowM).toBeVisible();
  await rowMenuItem(page, 'DOC-301', /^روابط \(1\)$/);
  const modal2 = page.getByRole('dialog');
  await modal2.locator('select').first().locator('option[value="d1"]').waitFor({ state: 'attached' });
  // the recorded count still shows the link, but DOC-120 is not offered and
  // the UI states the gap instead of failing silently
  await expect(modal2.getByText('روابط خارج نطاق صلاحياتك غير معروضة.')).toBeVisible();
  const offered = await modal2.locator('select').first().locator('option').evaluateAll(
    (els) => els.map((e) => (e as HTMLOptionElement).value),
  );
  expect(offered).not.toContain('d4');
  // only in-scope documents are ever offered as new targets
  for (const v of offered.filter(Boolean)) expect(['d1', 'd2', 'd3', 'd5', 'd8']).toContain(v);
  await page.keyboard.press('Escape');
  // hygiene: restore the seed membership (the next test's first navigation
  // re-seeds anyway, but leave no trap for a future reader)
  await page.evaluate(() => {
    const api = (window as any).__protoApi;
    api.userApi.setAccess('mu-1', { p1: 'DELETE', p2: 'WRITE', p3: 'READ', p4: 'READ' });
  });
});
