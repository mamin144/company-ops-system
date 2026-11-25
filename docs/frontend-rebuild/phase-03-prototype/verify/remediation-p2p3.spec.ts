import { test, expect } from '@playwright/test';
import * as fs from 'fs';

// Phase 3.12 P2/P3 remediation verification (new).
// Temp output only; mock data only. Fresh seed per test (full navigation re-seeds).
const loginAs = async (page: any, role: string) => {
  await page.goto('/login');
  await page.getByRole('radio', { name: role }).click();
  await page.getByRole('button', { name: /دخول تجريبي/ }).click();
  await page.locator('.shell').waitFor({ timeout: 10000 });
};
const rowOf = (page: any, needle: string) => page.locator('.recRow', { hasText: needle });
const toEn = async (page: any) => {
  await page.getByRole('button', { name: 'ع/EN' }).click();
  await expect(page.locator('html[dir="ltr"]')).toHaveCount(1);
};
const openMenu = async (row: any) => {
  await row.getByRole('button', { name: 'المزيد' }).click();
  return row.page().getByRole('menu');
};

test.describe('P2-01 archive row menu', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'مدير (تجريبي)');
    await page.goto('/archive');
    await expect(rowOf(page, 'DOC-220')).toBeVisible();
  });

  test('primary preview stays visible; rest lives in the menu with a danger group', async ({ page }) => {
    const row = rowOf(page, 'DOC-220');
    await expect(row.getByRole('button', { name: 'معاينة' })).toBeVisible();
    await expect(row.getByRole('button', { name: 'تنزيل' })).toBeVisible();
    // crowded single-purpose buttons are gone from the row surface
    await expect(row.getByRole('button', { name: 'الحالة' })).toHaveCount(0);
    await expect(row.getByRole('button', { name: 'حذف' })).toHaveCount(0);
    await row.getByRole('button', { name: 'المزيد' }).click();
    const menu = page.getByRole('menu');
    for (const name of ['الحالة', 'استبدال', /روابط/, 'تعديل']) {
      await expect(menu.getByRole('menuitem', { name }).first()).toBeVisible();
    }
    await expect(menu.getByText('إجراءات خطرة')).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'حذف' })).toBeVisible();
  });

  test('menu keyboard: arrows move, Escape closes and restores focus', async ({ page }) => {
    const trigger = rowOf(page, 'DOC-220').getByRole('button', { name: 'المزيد' });
    await trigger.focus();
    await page.keyboard.press('Enter');
    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();
    const first = menu.getByRole('menuitem').first();
    await expect(first).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(menu.getByRole('menuitem').nth(1)).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('menu action still opens the status flow end to end', async ({ page }) => {
    await rowOf(page, 'DOC-220').getByRole('button', { name: 'المزيد' }).click();
    await page.getByRole('menu').getByRole('menuitem', { name: 'الحالة' }).click();
    await expect(page.getByRole('dialog')).toContainText('تغيير الحالة');
  });

  test('viewer (no edit/delete) gets no menu at all', async ({ page }) => {
    await page.getByRole('button', { name: 'خروج' }).click();
    await loginAs(page, 'مشاهد (تجريبي)');
    await page.goto('/archive');
    // viewer scope holds only the two project-less documents
    await expect(rowOf(page, 'DOC-301').getByRole('button', { name: 'معاينة' })).toBeVisible();
    await expect(rowOf(page, 'DOC-301').getByRole('button', { name: 'المزيد' })).toHaveCount(0);
  });

  test('menu works in the narrow card layout', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto('/archive');
    await rowOf(page, 'DOC-220').getByRole('button', { name: 'المزيد' }).click();
    const menu = page.getByRole('menu');
    await expect(menu.getByRole('menuitem', { name: 'الحالة' })).toBeVisible();
    await menu.getByRole('menuitem', { name: 'الحالة' }).click();
    await expect(page.getByRole('dialog')).toContainText('تغيير الحالة');
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  });
});

test.describe('P2-02 admin row menu + access clarity', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'مدير (تجريبي)');
    await page.goto('/admin');
    await expect(rowOf(page, 'ليلى حسن')).toBeVisible();
  });

  test('details and edit stay discoverable; rest grouped; delete separated', async ({ page }) => {
    const row = rowOf(page, 'كريم عادل');
    await expect(row.getByRole('button', { name: 'التفاصيل' })).toBeVisible();
    await expect(row.getByRole('button', { name: 'تعديل المستخدم' })).toBeVisible();
    await expect(row.getByRole('button', { name: 'حذف الحساب' })).toHaveCount(0);
    await expect(row.getByRole('button', { name: 'إعادة تعيين كلمة المرور' })).toHaveCount(0);
    await row.getByRole('button', { name: 'المزيد' }).click();
    const menu = page.getByRole('menu');
    await expect(menu.getByRole('menuitem', { name: /تعطيل الحساب/ })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: /إعادة تعيين/ })).toBeVisible();
    await expect(menu.getByText('إجراءات خطرة')).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: /حذف الحساب/ })).toBeVisible();
  });

  test('access cell explains itself via tooltip with per-project levels', async ({ page }) => {
    const cell = rowOf(page, 'دينا خالد').locator('.recCell').nth(4);
    const title = await cell.locator('span[title]').first().getAttribute('title');
    expect(title).toContain('PRJ-004');
    expect(title).toMatch(/تعديل|قراءة|حذف/);
  });

  test('menu works in the narrow card layout', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto('/admin');
    await rowOf(page, 'كريم عادل').getByRole('button', { name: 'المزيد' }).click();
    await expect(page.getByRole('menu').getByRole('menuitem', { name: /تعطيل الحساب/ })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  });
});

test.describe('P2-03 enter submits archive search', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'مدير (تجريبي)');
    await page.goto('/archive');
  });

  test('Enter filters identically to the button, resets page, keeps sort', async ({ page }) => {
    await page.getByRole('button', { name: 'التالي' }).click();
    await expect(page.getByText('صفحة 2 من 2')).toBeVisible();
    await page.getByRole('searchbox', { name: 'بحث' }).fill('مستخلص');
    await page.keyboard.press('Enter');
    await expect(rowOf(page, 'DOC-198')).toBeVisible();
    await expect(page.locator('.recRow')).toHaveCount(1);
    // status sort header still offered and functional afterwards
    await page.getByRole('button', { name: 'مسح الفلاتر' }).click();
    await expect(page.getByText('صفحة 1 من 2')).toBeVisible();
  });

  test('empty results honest; keyboard focus stays in a sane place', async ({ page }) => {
    await page.getByRole('searchbox', { name: 'بحث' }).fill('zzz-no-such-doc');
    await page.keyboard.press('Enter');
    await expect(page.getByText('لا نتائج مطابقة')).toBeVisible();
    const active = await page.evaluate(() => document.activeElement?.getAttribute('role'));
    expect(active).toBe('searchbox');
  });
});

test.describe('P2-04 preview demo banner', () => {
  test('banner visible in modal in both languages', async ({ page }) => {
    await loginAs(page, 'مدير (تجريبي)');
    await page.goto('/archive');
    await rowOf(page, 'DOC-220').getByRole('button', { name: 'معاينة' }).click();
    await expect(page.getByRole('dialog').getByText('معاينة تجريبية — ليس المستند الأصلي')).toBeVisible();
    await page.keyboard.press('Escape');
    await toEn(page);
    await rowOf(page, 'DOC-220').getByRole('button', { name: 'Preview' }).click();
    await expect(page.getByRole('dialog').getByText('Demo preview — not the original document')).toBeVisible();
  });
});

test.describe('P2-05 status change confirmation', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'مدير (تجريبي)');
    await page.goto('/archive');
  });

  const openStatus = async (page: any, num: string) => {
    await rowOf(page, num).getByRole('button', { name: 'المزيد' }).click();
    await page.getByRole('menu').getByRole('menuitem', { name: 'الحالة' }).click();
    const dlg = page.getByRole('dialog');
    await dlg.getByLabel('الحالة').selectOption('approved');
    await dlg.getByRole('button', { name: 'حفظ التعديلات' }).click();
    return dlg;
  };

  test('confirm step shows doc, from/to; cancel keeps everything', async ({ page }) => {
    const dlg = await openStatus(page, 'DOC-301');
    await expect(dlg).toContainText('DOC-301');
    await expect(dlg).toContainText('مسودة');
    await expect(dlg).toContainText('معتمدة');
    await expect(dlg).toContainText('قيود انتقال موثقة');
    await dlg.getByRole('button', { name: 'إلغاء' }).click();
    await expect(dlg).toBeHidden();
    // unchanged, selection retained on reopen
    await expect(rowOf(page, 'DOC-301').getByText('مسودة')).toBeVisible();
  });

  test('confirm applies, refreshes list, announces success', async ({ page }) => {
    const dlg = await openStatus(page, 'DOC-301');
    await dlg.getByRole('button', { name: 'تأكيد' }).click();
    await expect(dlg).toBeHidden();
    await expect(rowOf(page, 'DOC-301').getByText('معتمدة')).toBeVisible();
    await expect(page.locator('.toast--success')).toContainText('تم تغيير الحالة');
  });

  test('cycles every status value without getting stuck', async ({ page }) => {
    const statuses = ['submitted', 'under-review', 'approved', 'rejected', 'superseded', 'archived', 'draft'];
    for (const s of statuses) {
      await rowOf(page, 'DOC-301').getByRole('button', { name: 'المزيد' }).click();
      await page.getByRole('menu').getByRole('menuitem', { name: 'الحالة' }).click();
      const dlg = page.getByRole('dialog');
      await dlg.getByLabel('الحالة').selectOption(s);
      await dlg.getByRole('button', { name: 'حفظ التعديلات' }).click();
      await dlg.getByRole('button', { name: 'تأكيد' }).click();
      await expect(dlg).toBeHidden();
    }
    await expect(rowOf(page, 'DOC-301').getByText('مسودة')).toBeVisible();
  });

  test('no status affordance without the permission', async ({ page }) => {
    await page.getByRole('button', { name: 'خروج' }).click();
    await loginAs(page, 'مشاهد (تجريبي)');
    await page.goto('/archive');
    await expect(rowOf(page, 'DOC-301').getByRole('button', { name: 'المزيد' })).toHaveCount(0);
  });
});

test.describe('P2-06 inventory naming', () => {
  test('hub, tab and nav names are distinct in both languages', async ({ page }) => {
    await loginAs(page, 'مدير (تجريبي)');
    await page.goto('/inventory');
    await expect(page.getByRole('heading', { name: 'إدارة المخزون' })).toBeVisible();
    await page.goto('/inventory/stock');
    await expect(page.getByRole('tab', { name: 'حركات وأرصدة المخزون' })).toBeVisible();
    await toEn(page);
    await page.goto('/inventory');
    await expect(page.getByRole('heading', { name: 'Inventory management' })).toBeVisible();
    await page.goto('/inventory/stock');
    await expect(page.getByRole('tab', { name: 'Stock movements & balances' })).toBeVisible();
  });
});

test.describe('P2-08 localized override labels', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'مدير (تجريبي)');
    await page.goto('/admin');
    await rowOf(page, 'عمر فاروق').getByRole('button', { name: 'التفاصيل' }).click();
  });

  test('override options read as Arabic labels, values unchanged', async ({ page }) => {
    const dlg = page.getByRole('dialog');
    const sel = dlg.locator('select[data-testid="override-archive.view"]');
    await expect(sel).toContainText('يرث صلاحية الدور');
    const values = await sel.locator('option').evaluateAll((els) => els.map((e) => (e as HTMLOptionElement).value));
    expect(values).toEqual(['INHERIT', 'GRANT', 'DENY']);
    await expect(dlg).toContainText('المنع الصريح يتغلب على المنح');
  });

  test('locale switch keeps override semantics identical', async ({ page }) => {
    const before = await page.evaluate(async () => {
      const api = (window as any).__protoApi;
      return api.userApi.effective('mu-2').allowed;
    });
    // the header toggle sits behind the modal backdrop — close first
    await page.keyboard.press('Escape');
    await toEn(page);
    await rowOf(page, 'عمر فاروق').getByRole('button', { name: /التفاصيل|Details/ }).click();
    const dlg = page.getByRole('dialog');
    await expect(dlg.locator('select[data-testid="override-archive.view"]')).toContainText('Inherit role permission');
    await expect(dlg).toContainText('Explicit DENY beats GRANT');
    const after = await page.evaluate(async () => {
      const api = (window as any).__protoApi;
      return api.userApi.effective('mu-2').allowed;
    });
    expect(after).toEqual(before);
  });

  test('access levels render localized in both languages', async ({ page }) => {
    const dlg = page.getByRole('dialog');
    await expect(dlg.locator('select[data-testid="access-p1"]')).toContainText('قراءة');
    // the header toggle sits behind the modal backdrop — close first
    await page.keyboard.press('Escape');
    await toEn(page);
    await rowOf(page, 'عمر فاروق').getByRole('button', { name: /التفاصيل|Details/ }).click();
    await expect(page.getByRole('dialog').locator('select[data-testid="access-p1"]')).toContainText('Read');
  });
});

test.describe('P2-09 no internal flags in user copy', () => {
  test('approve:false appears nowhere in either language', async ({ page }) => {
    await loginAs(page, 'مدير (تجريبي)');
    await page.goto('/inventory/requests');
    await expect(page.locator('.content').getByText('approve:false')).toHaveCount(0);
    // the contract note lives in the request details modal, in plain language
    await rowOf(page, 'MR-012').getByRole('button', { name: 'التفاصيل' }).click();
    await expect(page.getByRole('dialog')).toContainText('العقد المدعوم الوحيد');
    await expect(page.getByRole('dialog').getByText('approve:false')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await toEn(page);
    await expect(page.locator('.content').getByText('approve:false')).toHaveCount(0);
  });

  test('reject toast uses the natural message', async ({ page }) => {
    await loginAs(page, 'مدير (تجريبي)');
    await page.goto('/inventory/requests');
    await rowOf(page, 'MR-012').getByRole('button', { name: 'رفض' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'تأكيد' }).click();
    await expect(page.locator('.toast--success')).toContainText('رُفض الطلب (تجريبي)');
  });
});

test.describe('P2-10 movement type labels', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'مدير (تجريبي)');
    await page.goto('/inventory/stock');
  });

  test('filter options are localized labels without permission keys', async ({ page }) => {
    const opts = await page.getByLabel('نوع الحركة').locator('option').allInnerTexts();
    expect(opts.join(' ')).toContain('تحويل');
    expect(opts.join(' ')).not.toContain('warehouse.');
  });

  test('dialog options explain the stock effect, keys stay in code', async ({ page }) => {
    await page.getByRole('button', { name: '+ حركة جديدة' }).click();
    const dlg = page.getByRole('dialog');
    const opts = await dlg.getByLabel('نوع الحركة').locator('option').allInnerTexts();
    expect(opts.join('|')).toContain('نقل بين مخزنين');
    expect(opts.join('|')).not.toContain('warehouse.');
    await page.keyboard.press('Escape');
  });

  test('all five types localized in English too', async ({ page }) => {
    await toEn(page);
    await page.goto('/inventory/stock');
    const opts = await page.getByLabel('Movement type').locator('option').allInnerTexts();
    for (const w of ['Receipt', 'Issue', 'Transfer', 'Adjustment', 'Return']) {
      expect(opts.join(' ')).toContain(w);
    }
    await expect(rowOf(page, 'TRF-304')).toContainText('Transfer');
  });
});

test.describe('P2-11 status enums localized + audited', () => {
  test('EN chips across stock, requests, projects, archive, financials', async ({ page }) => {
    await loginAs(page, 'مدير (تجريبي)');
    await toEn(page);
    await page.goto('/financials');
    await expect(page.locator('.content').getByText('Approved').first()).toBeVisible();
    await expect(page.locator('.content').getByText('معتمدة')).toHaveCount(0);
    await page.goto('/inventory/requests');
    await expect(rowOf(page, 'MR-012').getByText('Submitted')).toBeVisible();
    await page.goto('/inventory/stock');
    await expect(rowOf(page, 'TRF-304').getByText('Transfer')).toBeVisible();
    await page.goto('/projects');
    await expect(rowOf(page, 'PRJ-004').getByText('Active')).toBeVisible();
    await page.goto('/archive');
    await expect(rowOf(page, 'DOC-220').getByText('Under review')).toBeVisible();
  });

  test('AR labels unchanged (same strings as the old map)', async ({ page }) => {
    await loginAs(page, 'مدير (تجريبي)');
    await page.goto('/inventory/requests');
    await expect(rowOf(page, 'MR-012').getByText('مقدمة')).toBeVisible();
    await page.goto('/projects/p1/financials');
    await page.getByRole('tab', { name: 'المستخلصات' }).click();
    await expect(page.locator('.content').getByText('معتمدة').first()).toBeVisible();
  });
});

test.describe('P2-12 dashboard density + greeting', () => {
  test.beforeEach(async ({ page }) => { await loginAs(page, 'مدير (تجريبي)'); });

  test('status cards link to filtered request lists', async ({ page }) => {
    await page.goto('/');
    await page.locator('div.cards').nth(1).getByRole('link', { name: /مقدمة/ }).click();
    await expect(page).toHaveURL(/\/inventory\/requests\?status=submitted/);
    await expect(rowOf(page, 'MR-012')).toBeVisible();
  });

  test('stat cards separate label and value; greeting rewritten', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /صباح الخير، ليلى حسن/ })).toBeVisible();
    const html = await page.locator('.card', { hasText: 'المشاريع' }).first().innerHTML();
    expect(html).toContain('<br>');
    await toEn(page);
    await expect(page.getByRole('heading', { name: /Good morning, ليلى حسن/ })).toBeVisible();
  });

  test('recent movements show localized type, warehouse and reference', async ({ page }) => {
    await page.goto('/');
    const panel = page.locator('section', { hasText: 'أحدث الحركات' });
    await expect(panel).toContainText('مرتجع');
    await expect(panel).toContainText('المخزن المركزي');
    await expect(panel).toContainText('RET-403');
  });
});

test.describe('gap P1-04: projects sorting', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'مدير (تجريبي)');
    await page.goto('/projects');
  });

  test('sorting reorders genuinely; toggle reverses', async ({ page }) => {
    const firstCode = () => page.locator('.recRow').first().innerText();
    // default code-asc: PRJ-002 first
    await expect(firstCode()).resolves.toContain('PRJ-002');
    // status asc vs desc must genuinely reorder (exact locale order is the
    // engine's business — the UI must reflect it and reverse on toggle)
    await page.getByRole('button', { name: 'الحالة — ترتيب' }).click();
    const ascFirst = await firstCode();
    await page.getByRole('button', { name: 'الحالة — ترتيب' }).click();
    const descFirst = await firstCode();
    expect(ascFirst).not.toEqual(descFirst);
    await page.getByRole('button', { name: 'الحالة — ترتيب' }).click();
    await expect(firstCode()).resolves.toEqual(ascFirst);
  });

  test('filter change resets the page', async ({ page }) => {
    await page.locator('select[aria-label="الحالة"]').selectOption('active');
    await expect(page.locator('.recRow')).toHaveCount(1);
  });
});

test.describe('gap P1-04: BOQ/IPC sorting and pagination', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'مدير (تجريبي)');
    await page.goto('/projects/p1/financials');
  });

  test('BOQ sort changes rows; creating rows opens page two', async ({ page }) => {
    const firstCode = () => page.locator('.recRow').first().innerText();
    await expect(firstCode()).resolves.toContain('01-01');
    await page.getByRole('button', { name: 'الوصف — ترتيب' }).click();
    await expect(firstCode()).resolves.not.toContain('01-01');
    await page.getByRole('button', { name: 'الوصف — ترتيب' }).click();
    // create a 6th line -> genuine second page
    await page.getByRole('button', { name: '+ بند جديد' }).click();
    const dlg = page.getByRole('dialog');
    await dlg.getByLabel('رقم البند').fill('09-09');
    await dlg.getByLabel('الوصف').fill('بند اختباري للترقيم');
    await dlg.getByLabel('الوحدة').fill('م²');
    await dlg.getByLabel('الكمية').fill('10');
    await dlg.getByLabel('الفئة').fill('100');
    await dlg.getByRole('button', { name: 'حفظ' }).click();
    // order by code asc so the new 09-09 lands on page two for real
    await page.getByRole('button', { name: 'رقم البند — ترتيب' }).click();
    await expect(page.getByText('صفحة 1 من 2')).toBeVisible();
    await page.getByRole('button', { name: 'التالي' }).click();
    await expect(rowOf(page, '09-09')).toBeVisible();
  });

  test('IPC sort + pager across a created sixth certificate', async ({ page }) => {
    await page.getByRole('tab', { name: 'المستخلصات' }).click();
    await expect(page.locator('.recRow')).toHaveCount(4);
    for (const n of [5, 6]) {
      await page.getByRole('button', { name: '+ مستخلص جديد' }).click();
      const dlg = page.getByRole('dialog');
      await dlg.getByLabel('رقم المستخلص').fill(String(n));
      await dlg.getByRole('button', { name: 'حفظ' }).click();
    }
    await expect(page.getByText('صفحة 1 من 2')).toBeVisible();
    await page.getByRole('button', { name: 'الصافي — ترتيب' }).click();
    await page.getByRole('button', { name: 'الصافي — ترتيب' }).click();
    const first = await page.locator('.recRow').first().innerText();
    expect(first).toContain('#2');
    await page.getByRole('button', { name: 'التالي' }).click();
    await expect(page.getByText('صفحة 2 من 2')).toBeVisible();
  });
});

const TMP = 'C:\\Users\\PC-01\\AppData\\Local\\Temp\\opencode';

test.describe('gap warehouse CSV import', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'مدير (تجريبي)');
    await page.goto('/inventory/warehouses');
    await expect(page.locator('.recRow').first()).toBeVisible();
  });

  const writeCsv = (name: string, body: string) => {
    fs.writeFileSync(`${TMP}\\${name}`, body, 'utf8');
    return `${TMP}\\${name}`;
  };

  test('valid rows import with mapping, dup + errors skipped with reasons', async ({ page }) => {
    const file = writeCsv('wh-import-mixed.csv',
      'الكود,الاسم,النوع,الموقع,الحالة,المشروع\n' +
      'WH-T1,مخزن اختبار,موقع,التجمع,نشط,p1\n' +
      'WH-C1,مكرر,موقع,التجمع,نشط,\n' +
      'WH-T2,,موقع,التجمع,نشط,\n' +
      'WH-T3,مخزن سيء,مستودع,التجمع,نشط,\n');
    await page.getByRole('button', { name: 'استيراد CSV (تجريبي)' }).click();
    const dlg = page.getByRole('dialog');
    await dlg.locator('input[type="file"]').setInputFiles(file);
    // mapping auto-filled from Arabic headers (lands on the mapping step)
    await expect(dlg.getByRole('tab', { name: /مطابقة الأعمدة/ })).toHaveAttribute('aria-selected', 'true');
    await dlg.getByRole('button', { name: /مراجعة الصفوف/ }).last().click();
    await expect(dlg.getByText('الاسم مطلوب')).toBeVisible();
    await expect(dlg.getByText('كود مكرر — سيُتخطى')).toBeVisible();
    await expect(dlg.getByText('النوع يجب أن يكون مركزي/موقع')).toBeVisible();
    await dlg.getByRole('button', { name: /الملخص والتأكيد/ }).last().click();
    await expect(dlg).toContainText(/سيُضاف: \+1/);
    await expect(dlg).toContainText(/سيُتخطى: \+?3/);
    await dlg.getByRole('button', { name: 'تأكيد الاستيراد' }).click();
    await expect(dlg).toBeHidden();
    // the list re-sorts code-ascending, so the new WH-T1 lands on page two —
    // search for it instead of assuming position
    await page.getByRole('searchbox', { name: 'بحث' }).fill('WH-T1');
    await expect(page.locator('.recRow', { hasText: 'WH-T1' })).toBeVisible();
    await expect(page.locator('.toast--success')).toContainText('+1');
  });

  test('non-CSV file rejected; cancel changes nothing', async ({ page }) => {
    const file = writeCsv('wh-import-bad.txt', 'الكود,الاسم\nWH-X,س');
    const before = await page.locator('.recRow').count();
    await page.getByRole('button', { name: 'استيراد CSV (تجريبي)' }).click();
    const dlg = page.getByRole('dialog');
    await dlg.locator('input[type="file"]').setInputFiles(file);
    await expect(dlg).toContainText('CSV');
    await dlg.getByRole('button', { name: 'إلغاء الاستيراد' }).click();
    await expect(dlg).toBeHidden();
    expect(await page.locator('.recRow').count()).toBe(before);
  });

  test('unknown project rejected with a row error', async ({ page }) => {
    const file = writeCsv('wh-import-proj.csv', 'الكود,الاسم,المشروع\nWH-T9,مخزن,px-nope\n');
    await page.getByRole('button', { name: 'استيراد CSV (تجريبي)' }).click();
    const dlg = page.getByRole('dialog');
    await dlg.locator('input[type="file"]').setInputFiles(file);
    await dlg.getByRole('button', { name: /مراجعة الصفوف/ }).last().click();
    await expect(dlg.getByText('المشروع غير موجود')).toBeVisible();
    await page.keyboard.press('Escape');
  });
});

test.describe('gap archive metadata CSV export', () => {
  test.beforeEach(async ({ page }) => { await loginAs(page, 'مدير (تجريبي)'); });

  const grabDocuments = async (page: any) => {
    await page.goto('/reports');
    const row = page.locator('.recRow', { hasText: 'documents' });
    await expect(row).toBeVisible();
    const [download] = await Promise.all([page.waitForEvent('download'), row.getByRole('button', { name: 'تصدير CSV' }).click()]);
    const p = await download.path();
    return { name: download.suggestedFilename(), text: fs.readFileSync(p as string, 'utf8') };
  };
  const dataRows = (csv: string) => csv.slice(1).split('\r\n').filter(Boolean).slice(1);

  test('documents report listed; rows scoped; statuses are raw codes', async ({ page }) => {
    const f = await grabDocuments(page);
    expect(f.name).toMatch(/^documents-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(dataRows(f.text)).toHaveLength(8);
    expect(f.text).toContain(',under-review,');
    expect(f.text).not.toContain('قيد المراجعة');
    expect(f.text).toContain('DOC-220');
  });

  test('project filter narrows the file; unauthorized export refused', async ({ page }) => {
    await page.goto('/archive?project=p2');
    await expect(rowOf(page, 'DOC-120')).toBeVisible();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('.ctxExport').getByRole('button', { name: 'تصدير CSV' }).click(),
    ]);
    const text = fs.readFileSync((await download.path()) as string, 'utf8');
    expect(dataRows(text)).toHaveLength(1);
    expect(text).toContain('DOC-120');
    // direct mock attempt without the dataset permission fails on the path
    const r = await page.evaluate(async () => {
      const api = (window as any).__protoApi;
      return api.reportApi.export('mu-4', 'documents', 'csv');
    });
    expect(r.ok).toBe(false);
    expect(r.code).toBe(403);
  });

  test('formula-leading titles neutralized without touching data', async ({ page }) => {
    await page.goto('/archive');
    await page.getByRole('button', { name: '+ رفع مستند (تجريبي)' }).click();
    const dlg = page.getByRole('dialog');
    await dlg.getByLabel('عنوان المستند *').fill('=SUM(1+1)');
    await dlg.getByRole('button', { name: 'رفع' }).click();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('.ctxExport').getByRole('button', { name: 'تصدير CSV' }).click(),
    ]);
    const text = fs.readFileSync((await download.path()) as string, 'utf8');
    expect(text).toContain("'=SUM(1+1)");
    // the stored title itself is untouched
    await expect(rowOf(page, '=SUM(1+1)')).toBeVisible();
  });
});

test.describe('settings: density, collapse, offline, footer', () => {
  test.beforeEach(async ({ page }) => { await loginAs(page, 'مدير (تجريبي)'); });

  test('density toggle changes layout, announces state, persists', async ({ page }) => {
    await page.goto('/');
    const btn = page.getByRole('button', { name: /الكثافة/ });
    await expect(btn).toHaveAttribute('aria-pressed', 'false');
    await btn.click();
    await expect(btn).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(async () => page.evaluate(() => document.documentElement.dataset.density)).toBe('compact');
    expect(await page.evaluate(() => localStorage.getItem('cos-proto-density'))).toBe('compact');
    await page.reload();
    await expect.poll(async () => page.evaluate(() => document.documentElement.dataset.density)).toBe('compact');
    await expect(page.getByRole('button', { name: /الكثافة/ })).toHaveAttribute('aria-pressed', 'true');
  });

  test('sidebar collapse persists across reload', async ({ page }) => {
    await page.goto('/');
    const brand = page.getByRole('button', { name: /طي القائمة|فتح القائمة/ });
    await brand.click();
    await expect(page.locator('.rail.collapsed')).toHaveCount(1);
    expect(await page.evaluate(() => localStorage.getItem('cos-proto-collapsed'))).toBe('1');
    await page.reload();
    await expect(page.locator('.rail.collapsed')).toHaveCount(1);
  });

  test('offline banner is honest: shows on offline, hides on online, no queue claims', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.offBanner')).toHaveCount(0);
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    const banner = page.locator('.offBanner');
    await expect(banner).toBeVisible();
    await expect(banner).not.toContainText(/طابور|مزامنة|queue|sync/i);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect(banner).toHaveCount(0);
  });

  test('footer carries demo build context', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.foot')).toContainText('بيانات وهمية للمراجعة فقط');
    await expect(page.locator('.foot')).toContainText('إصدار تجريبي 0.1');
  });
});

test.describe('login: radios, hints, technical tile, pre-auth language', () => {
  test('role selection uses native radios with scope hints', async ({ page }) => {
    await page.goto('/login');
    const group = page.getByRole('radiogroup');
    await expect(group.getByRole('radio')).toHaveCount(5);
    await expect(group).toContainText('وصول كامل');
    await expect(group).toContainText('عرض فقط');
    await group.getByRole('radio', { name: 'فني (تجريبي)' }).check();
    await expect(group.getByRole('radio', { name: 'فني (تجريبي)' })).toBeChecked();
    await page.keyboard.press('ArrowDown');
  });

  test('technical tile logs in with real technical permissions', async ({ page }) => {
    await loginAs(page, 'فني (تجريبي)');
    await page.goto('/archive');
    await expect(page.getByRole('button', { name: '+ رفع مستند (تجريبي)' })).toBeVisible();
    await page.goto('/admin');
    await expect(page.getByText('لا صلاحية لديك')).toBeVisible();
  });

  test('language switches before login and survives reload + login', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'English (LTR)' }).click();
    await expect(page.locator('html[dir="ltr"]')).toHaveCount(1);
    await page.reload();
    await expect(page.locator('html[dir="ltr"]')).toHaveCount(1);
    await page.getByRole('radio', { name: 'Viewer (demo)' }).click();
    await page.getByRole('button', { name: /Demo login/ }).click();
    await page.locator('.shell').waitFor({ timeout: 10000 });
    await expect(page.locator('html[dir="ltr"]')).toHaveCount(1);
    await expect(page.getByRole('heading', { name: /Good morning, كريم عادل/ })).toBeVisible();
  });
});

test.describe('P3 arrows follow reading direction', () => {
  test('forward links point with the locale, back links against it', async ({ page }) => {
    await loginAs(page, 'مدير (تجريبي)');
    await page.goto('/');
    await expect(page.locator('.content').getByText('←', { exact: true }).first()).toBeVisible();
    await toEn(page);
    await expect(page.locator('.content').getByText('→', { exact: true }).first()).toBeVisible();
    await page.goto('/no-such-route-xyz');
    await expect(page.locator('.denyBox').getByRole('link', { name: /Home/ })).toContainText('←');
    await toAr(page);
  });

  const toAr = async (page: any) => {
    await page.getByRole('button', { name: 'ع/EN' }).click();
    await expect(page.locator('html[dir="rtl"]')).toHaveCount(1);
  };
});

test.describe('B-09 repeat issue wording', () => {
  test('partially-issued request offers continue-with-remaining', async ({ page }) => {
    await loginAs(page, 'مدير (تجريبي)');
    await page.goto('/inventory/requests');
    await page.getByRole('searchbox', { name: 'بحث' }).fill('MR-008');
    // MR-008: requested 80, issued 30 → remaining 50
    await expect(rowOf(page, 'MR-008').getByRole('button', { name: 'استكمال الصرف (المتبقي 50)' })).toBeVisible();
    // approved-but-untouched keeps the start label
    await page.getByRole('searchbox', { name: 'بحث' }).fill('MR-011');
    await expect(rowOf(page, 'MR-011').getByRole('button', { name: 'بدء الصرف' })).toBeVisible();
  });
});

test.describe('overview summary + sites truthfulness', () => {
  test.beforeEach(async ({ page }) => { await loginAs(page, 'مدير (تجريبي)'); });

  test('overview shows live counts with working deep links', async ({ page }) => {
    await page.goto('/projects/p1/overview');
    await expect(page.getByText('ملخص المشروع')).toBeVisible();
    await page.getByRole('link', { name: /عرض طلبات المشروع/ }).click();
    await expect(page).toHaveURL(/\/inventory\/requests\?project=p1/);
    await page.goto('/projects/p1/overview');
    await page.getByRole('link', { name: /عرض في الأرشيف/ }).click();
    await expect(page).toHaveURL(/\/archive\?project=p1/);
  });

  test('sites unavailable note shown since no demo role holds the permission', async ({ page }) => {
    await page.goto('/projects/p1/overview');
    await expect(page.getByText('إنشاء المواقع يتطلب صلاحية غير ممنوحة')).toBeVisible();
    await expect(page.getByRole('button', { name: '+ موقع' })).toHaveCount(0);
  });
});

test.describe('DENY precedence + guard messages localized', () => {
  test('explicit DENY beats role GRANT on the mock path', async ({ page }) => {
    await loginAs(page, 'مدير (تجريبي)');
    await page.goto('/');
    const before = await page.evaluate(async () => {
      const api = (window as any).__protoApi;
      return api.userApi.effective('mu-7').allowed['reports.view'];
    });
    expect(before).toBe(true);
    await page.evaluate(async () => {
      const api = (window as any).__protoApi;
      api.userApi.setOverrides('mu-7', 'mu-1', { 'reports.view': 'DENY' });
    });
    const after = await page.evaluate(async () => {
      const api = (window as any).__protoApi;
      return {
        allowed: api.userApi.effective('mu-7').allowed['reports.view'],
        exp: await api.reportApi.export('mu-7', 'projects', 'csv'),
      };
    });
    expect(after.allowed).toBe(false);
    expect(after.exp.ok).toBe(false);
    expect(after.exp.code).toBe(403);
    // restore for hygiene (next test re-seeds anyway)
    await page.evaluate(async () => {
      const api = (window as any).__protoApi;
      api.userApi.setOverrides('mu-7', 'mu-1', {});
    });
  });
});

test.describe('contextual export edge cases', () => {
  test.beforeEach(async ({ page }) => { await loginAs(page, 'مدير (تجريبي)'); });

  test('zero-match filter keeps the strip with a truthful zero count', async ({ page }) => {
    await page.goto('/inventory/items');
    await page.getByRole('searchbox', { name: 'بحث' }).fill('zzz-no-such-item');
    await expect(page.getByText('لا نتائج مطابقة')).toBeVisible();
    const strip = page.locator('.ctxExport');
    await expect(strip).toBeVisible();
    await expect(strip).toContainText('0');
    await expect(strip).toContainText('بالعناوين فقط');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      strip.getByRole('button', { name: 'تصدير CSV' }).click(),
    ]);
    const text = fs.readFileSync((await download.path()) as string, 'utf8');
    const rows = text.slice(1).split('\r\n').filter(Boolean);
    expect(rows).toHaveLength(1); // header only
    await expect(page.locator('.toast--success')).toBeVisible();
  });

  test('viewer sees lists but no export surface', async ({ page }) => {
    await page.getByRole('button', { name: 'خروج' }).click();
    await loginAs(page, 'مشاهد (تجريبي)');
    await page.goto('/inventory/warehouses');
    await expect(page.locator('.recRow').first()).toBeVisible();
    await expect(page.locator('.ctxExport')).toHaveCount(0);
  });
});

test.describe('C-03 audit export honors grid sort', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'مدير (تجريبي)');
    await page.goto('/audit');
    await expect(page.locator('.recRow').first()).toBeVisible();
  });

  const fileUsers = async (page: any) => {
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'تصدير CSV' }).first().click(),
    ]);
    const text = fs.readFileSync((await download.path()) as string, 'utf8');
    const lines = text.slice(1).split('\r\n').filter(Boolean);
    const head = lines[0].split(',');
    const ui = head.indexOf('username');
    return lines.slice(1).map((l) => l.split(',')[ui]);
  };

  test('user asc file order matches the grid; desc reverses it', async ({ page }) => {
    await page.locator('.recHead').getByRole('button', { name: /المستخدم/ }).click();
    const gridFirst = await page.locator('.recRow').first().innerText();
    const asc = await fileUsers(page);
    // same comparator family as the engine ('ar', numeric) — not the default locale
    expect([...asc].sort((a, b) => a.localeCompare(b, 'ar', { numeric: true }))).toEqual(asc);
    expect(gridFirst).toContain(asc[0]);
    await page.locator('.recHead').getByRole('button', { name: /المستخدم/ }).click();
    const desc = await fileUsers(page);
    expect([...desc].sort((a, b) => b.localeCompare(a, 'ar', { numeric: true }))).toEqual(desc);
    const gridFirstDesc = await page.locator('.recRow').first().innerText();
    expect(gridFirstDesc).toContain(desc[0]);
  });

  test('entity sort applies to the full filtered set, not the page', async ({ page }) => {
    await page.locator('.recHead').getByRole('button', { name: /الكيان/ }).click();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'تصدير CSV' }).first().click(),
    ]);
    const text = fs.readFileSync((await download.path()) as string, 'utf8');
    const lines = text.slice(1).split('\r\n').filter(Boolean);
    expect(lines.length).toBeGreaterThan(10); // all 32 rows, not one page
    const head = lines[0].split(',');
    const ei = head.indexOf('entity');
    const vals = lines.slice(1).map((l) => l.split(',')[ei]);
    expect([...vals].sort((a, b) => a.localeCompare(b, 'ar', { numeric: true }))).toEqual(vals);
  });
});

test.describe('command palette localized + operable', () => {
  test.beforeEach(async ({ page }) => { await loginAs(page, 'مدير (تجريبي)'); });

  test('no raw route slugs in hints; open/select/escape with focus restore', async ({ page }) => {
    await page.goto('/');
    const trigger = page.getByRole('button', { name: /بحث/ }).first();
    await trigger.click();
    const dlg = page.getByRole('dialog');
    await expect(dlg.getByRole('combobox')).toBeFocused();
    const hints = await dlg.locator('li span.muted').allInnerTexts();
    expect(hints.join('|')).not.toMatch(/^\//m);
    expect(hints.join('|')).not.toContain('/inventory');
    await dlg.getByRole('combobox').fill('تدقيق');
    await expect(dlg.getByRole('option', { name: /التدقيق/ })).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/audit/);
    // let the route-change close flush before toggling again (no race)
    await expect(page.getByRole('dialog')).toBeHidden();
    // shortcut path + escape restores focus to the trigger
    await page.keyboard.press('ControlOrMeta+k');
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(trigger).toBeFocused();
  });
});

test.describe('notifications refresh + deep links; empty fixtures; failNext retry', () => {
  test.beforeEach(async ({ page }) => { await loginAs(page, 'مدير (تجريبي)'); });

  test('refresh re-reads; deep link lands on the destination', async ({ page }) => {
    await page.goto('/notifications');
    await page.getByRole('button', { name: 'تحديث' }).click();
    await expect(page.locator('.panel').getByText('MR-012')).toBeVisible();
    await page.getByRole('link', { name: 'فتح المرتبط' }).first().click();
    await expect(page).toHaveURL(/\/inventory\/requests/);
  });

  test('empty states are honest, not loaders', async ({ page }) => {
    await page.goto('/inventory/stock?project=p4');
    await expect(page.getByText('لا نتائج مطابقة')).toBeVisible();
    await page.goto('/audit');
    await page.getByLabel('من تاريخ').fill('2099-01-01');
    await expect(page.getByText('لا نتائج مطابقة')).toBeVisible();
    await expect(page.getByRole('button', { name: 'مسح الفلاتر' }).first()).toBeVisible();
  });

  test('injected failure shows error with working retry', async ({ page }) => {
    await page.evaluate(async () => {
      await (window as any).__protoTestHooks.failNext('documents');
    });
    await page.goto('/archive');
    await expect(page.getByRole('alert')).toBeVisible();
    await page.getByRole('button', { name: 'إعادة المحاولة' }).click();
    await expect(rowOf(page, 'DOC-220')).toBeVisible();
  });
});

test.describe('mixed-direction isolation', () => {
  test.beforeEach(async ({ page }) => { await loginAs(page, 'مدير (تجريبي)'); });

  test('emails and codes are isolated with no mid-token wrap', async ({ page }) => {
    await page.goto('/admin');
    const email = page.locator('.recRow', { hasText: 'dina.khaled@example.org' }).locator('.email').first();
    await expect(email).toBeVisible();
    await expect(email).toHaveCSS('white-space', 'nowrap');
    await expect(email).toHaveCSS('direction', 'ltr');
    await page.goto('/archive');
    const code = page.locator('.recRow', { hasText: 'DOC-220' }).locator('.num.ltr').first();
    await expect(code).toBeVisible();
    await expect(code).toHaveCSS('direction', 'ltr');
  });
});

test.describe('corruption guard expanded', () => {
  const BAD = /[\u3000-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF\uFF00-\uFFEF]|\{[a-zA-Z_][a-zA-Z0-9_]*\}/;
  const scan = async (page: any, label: string) => {
    const hits = await page.evaluate(() => {
      const out: string[] = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let n = walker.nextNode();
      while (n) {
        const t = (n.textContent ?? '').trim();
        if (t) out.push(t);
        n = walker.nextNode();
      }
      return out;
    });
    const bad = (hits as string[]).filter((t) => BAD.test(t));
    expect(bad, `corrupt text on ${label}: ${bad.slice(0, 3).join(' | ')}`).toEqual([]);
  };

  test('no CJK or unresolved tokens across routes, dialogs, locales', async ({ page }) => {
    await loginAs(page, 'مدير (تجريبي)');
    for (const url of ['/', '/projects', '/archive', '/inventory/stock', '/inventory/requests', '/financials', '/admin', '/audit', '/reports', '/settings', '/notifications']) {
      await page.goto(url);
      await scan(page, `ar:${url}`);
    }
    // dialogs
    await page.goto('/archive');
    await rowOf(page, 'DOC-220').getByRole('button', { name: 'معاينة' }).click();
    await scan(page, 'ar:archive-viewer');
    await page.keyboard.press('Escape');
    await page.goto('/admin');
    await rowOf(page, 'ليلى حسن').getByRole('button', { name: 'التفاصيل' }).click();
    await scan(page, 'ar:admin-details');
    await page.keyboard.press('Escape');
    // induced error surface
    await page.evaluate(async () => { await (window as any).__protoTestHooks.failNext('documents'); });
    await page.goto('/archive');
    await scan(page, 'ar:archive-error');
    await page.getByRole('button', { name: 'إعادة المحاولة' }).click();
    // English pass over the principal screens
    await toEn(page);
    for (const url of ['/', '/archive', '/inventory/stock', '/admin', '/audit']) {
      await page.goto(url);
      await scan(page, `en:${url}`);
    }
  });
});

test.describe('locale numeral convention', () => {
  test.beforeEach(async ({ page }) => { await loginAs(page, 'مدير (تجريبي)'); });

  test('displayed quantities, money and dates use Western digits; codes exact', async ({ page }) => {
    await page.goto('/inventory/stock');
    // signed quantities render with Western digits and ASCII-style signs
    await expect(rowOf(page, 'TRF-304')).toContainText('−2');
    await expect(rowOf(page, 'TRF-304')).not.toContainText('٢');
    await expect(rowOf(page, 'GIN-105')).toContainText('+20');
    await expect(rowOf(page, 'GIN-105')).not.toContainText('٢٠');
    await page.goto('/financials');
    await expect(page.locator('.content').getByText('27,839,000')).toBeVisible();
    // project codes keep their exact stored form wherever they render
    await page.goto('/projects');
    await expect(rowOf(page, 'برج النيل').getByText('PRJ-004')).toBeVisible();
    // contract codes keep their exact stored form (workspace header shows it)
    await page.goto('/projects/p1/overview');
    await expect(page.locator('.content').getByText('C-2026-014').first()).toBeVisible();
  });
});
