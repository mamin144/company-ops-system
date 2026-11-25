import { test, expect } from '@playwright/test';

// Phase 3.8 — screen / route coverage matrix (kept).
// Every route, nested tab and dialog kind must actually render and be usable,
// not merely exist. Temp output only; mock data only.
const loginAs = async (page: any, role = 'مدير (تجريبي)') => {
  await page.goto('/login');
  await page.getByRole('radio', { name: role }).click();
  await page.getByRole('button', { name: /دخول تجريبي/ }).click();
  await page.locator('.shell').waitFor({ timeout: 10000 });
};

test.describe('route matrix', () => {
  const ROUTES: [string, string][] = [
    ['/', 'صباح الخير'],
    ['/projects', 'المشاريع'],
    ['/projects/p1/overview', 'ملخص المشروع'],
    ['/projects/p1/sites', 'المواقع'],
    ['/projects/p1/documents', 'مستندات المشروع'],
    ['/projects/p1/warehouses', 'مخازن المشروع'],
    ['/projects/p1/stock', 'مخزون المشروع'],
    ['/projects/p1/financials', 'المقايسات'],
    ['/financials', 'الموقف المالي والتعاقدي'],
    ['/archive', 'الأرشيف'],
    ['/inventory', 'الحركات والأرصدة'],
    ['/inventory/warehouses', 'مخزن (وهمي)'],
    ['/inventory/items', 'دليل الأصناف'],
    ['/inventory/stock', 'الرقم/التاريخ'],
    ['/inventory/requests', 'طلبات المواد'],
    ['/admin', 'المستخدمون'],
    ['/audit', 'التدقيق'],
    ['/reports', 'التقارير والتصدير'],
    ['/settings', 'الإعدادات'],
    ['/search', 'اكتب حرفين'],
    ['/notifications', 'إشعارات'],
  ];

  test.beforeEach(async ({ page }) => { await loginAs(page); });

  for (const [url, text] of ROUTES) {
    test(`route renders: ${url}`, async ({ page }) => {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('.content').getByText(text, { exact: false }).first())
        .toBeVisible({ timeout: 8000 });
      // every route also lands in a known content area, never a blank shell
      await expect(page.locator('.content')).not.toBeEmpty();
    });
  }

  test('login screen renders before any session', async ({ page }) => {
    await page.evaluate(() => localStorage.clear());
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /منظومة التشغيل/ })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'مدير (تجريبي)' })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'مشاهد (تجريبي)' })).toBeVisible();
  });

  test('404 and 403 render honest states', async ({ page }) => {
    await page.goto('/definitely-not-a-route');
    await expect(page.getByRole('heading', { name: 'الصفحة غير موجودة' })).toBeVisible();
    // invalid project id -> not-found, not a rejection and not an empty shell
    await page.goto('/projects/p-nope');
    await expect(page.getByText('المشروع غير موجود أو خارج نطاق صلاحياتك')).toBeVisible();
    // guard denies a route the role lacks
    await page.getByRole('button', { name: 'خروج' }).click();
    await loginAs(page, 'مشاهد (تجريبي)');
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: 'لا صلاحية لديك' })).toBeVisible();
  });
});

test.describe('dialog matrix — open, initial focus, Escape, focus restore', () => {
  test.beforeEach(async ({ page }) => { await loginAs(page); });

  /** Every dialog kind must behave the same way, not just the first one. */
  // NOTE: the project "add site" action is deliberately absent — no demo role
  // holds `sites.edit` (it is not in any ROLE_BASE), so the affordance can never
  // render. Recorded as a gap rather than tested through a bypass.
  const openers: [string, string, () => Promise<void>][] = [
    ['/projects/p1/financials', 'بند جديد', async (page) => { await page.getByRole('button', { name: '+ بند جديد' }).click(); }],
    ['/inventory/stock', 'حركة جديدة', async (page) => { await page.getByRole('button', { name: '+ حركة جديدة' }).click(); }],
    ['/inventory/requests', 'طلب جديد', async (page) => { await page.getByRole('button', { name: '+ طلب جديد' }).click(); }],
    ['/inventory/warehouses', 'مخزن جديد', async (page) => { await page.getByRole('button', { name: '+ مخزن جديد' }).click(); }],
    ['/inventory/items', 'صنف جديد', async (page) => { await page.getByRole('button', { name: '+ صنف جديد' }).click(); }],
    ['/reports', 'معاينة', async (page) => { await page.getByRole('button', { name: 'معاينة' }).first().click(); }],
    ['/audit', 'التفاصيل', async (page) => { await page.getByRole('button', { name: 'التفاصيل' }).first().click(); }],
  ];

  for (const [url, openerLabel, open] of openers) {
    test(`dialog behaves: ${openerLabel} on ${url}`, async ({ page }) => {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('.content').getByText(openerLabel, { exact: false }).first()).toBeVisible({ timeout: 8000 });
      await open(page);
      const opener = page.getByRole('button', { name: openerLabel }).first();
      const dlg = page.getByRole('dialog');
      await expect(dlg).toBeVisible();
      // focus moved inside
      await expect.poll(async () => page.evaluate(() => !!document.querySelector('.modal')?.contains(document.activeElement))).toBe(true);
      // Escape closes, focus returns to the control that opened it
      await page.keyboard.press('Escape');
      await expect(dlg).toBeHidden();
      await expect(opener).toBeFocused();
      // and focus is never left on a detached node
      const stillLive = await page.evaluate(() => document.activeElement?.isConnected ?? false);
      expect(stillLive).toBe(true);
    });
  }

  test('destructive confirm dialogs are modal and cancellable', async ({ page }) => {
    await page.goto('/inventory/items', { waitUntil: 'domcontentloaded' });
    const opener = page.getByRole('button', { name: 'حذف' }).first();
    await opener.click();
    const dlg = page.getByRole('dialog');
    await expect(dlg).toBeVisible();
    await expect(dlg).toContainText('لن يُحذف شيء حقيقي');
    await expect.poll(async () => page.evaluate(() => !!document.querySelector('.modal')?.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(dlg).toBeHidden();
    await expect(opener).toBeFocused();
  });
});

test('no demo role can reach the add-site action (sites.edit is unheld)', async ({ page }) => {
  await loginAs(page, 'مدير (تجريبي)');
  for (const role of ['إدارة (تجريبي)', 'مخازن (تجريبي)', 'مشاهد (تجريبي)']) {
      await expect(page.locator('.shell')).toBeVisible();
      await page.getByRole('button', { name: 'خروج' }).click();
      await expect(page.getByRole('button', { name: /دخول تجريبي/ })).toBeVisible({ timeout: 10000 });
      await loginAs(page, role);
      await page.goto('/projects/p1/overview', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('.content').getByRole('button', { name: '+ موقع' })).toHaveCount(0);
    }
  });

test.describe('permissions on the mock path', () => {
  test('viewer: no create/edit affordances anywhere, and the mock refuses anyway', async ({ page }) => {
    await loginAs(page, 'مشاهد (تجريبي)');
    for (const [url, label] of [['/inventory/warehouses', '+ مخزن جديد'], ['/inventory/items', '+ صنف جديد'], ['/projects', '+ المشاريع']] as [string, string][]) {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('.content').getByRole('button', { name: label })).toHaveCount(0);
    }
    const denied = await page.evaluate(async () => {
      const api = (window as any).__protoApi;
      return {
        warehouse: await api.stockApi ? null : null,
        boq: await api.boqApi.create('p1', { itemCode: 'x', description: 'y', unit: 'z', quantity: 1, unitPrice: 1 }, 'mu-4'),
        ipc: await api.ipcApi.create('p1', { ipcNumber: 9, date: '2026-10-13', status: 'draft' }, 'mu-4'),
        mr: await api.mrApi.create({ projectId: 'p1', warehouseId: 'w1', by: 'x', lines: [{ itemId: 'i1', requested: 1 }] }, 'mu-4'),
        report: await api.reportApi.export('mu-4', 'projects', 'csv'),
      };
    });
    expect(denied.boq.code).toBe(403);
    expect(denied.ipc.code).toBe(403);
    expect(denied.mr.ok).toBe(false);
    expect(denied.report.code).toBe(403);
  });

  test('project scope: a project outside membership resolves to nothing', async ({ page }) => {
    // mu-7 (management) has p1 WRITE only
    await loginAs(page, 'إدارة (تجريبي)');
    await page.goto('/projects');
    await expect(page.getByText('PRJ-004').first()).toBeVisible();
    await expect(page.getByText('PRJ-007')).toHaveCount(0);
    await page.goto('/projects/p2/financials');
    await expect(page.getByText('المشروع غير موجود أو خارج نطاق صلاحياتك')).toBeVisible();
    const scoped = await page.evaluate(() => {
      const api = (window as any).__protoApi;
      return { p1: api.canProject('mu-7', 'projects.view', 'p1'), p3: api.canProject('mu-7', 'projects.view', 'p3') };
    });
    expect(scoped.p1).toBe(true);
    expect(scoped.p3).toBe(false);
  });

  test('DENY beats GRANT on the export gate', async ({ page }) => {
    await loginAs(page);
    const r = await page.evaluate(async () => {
      const api = (window as any).__protoApi;
      const before = await api.reportApi.export('mu-2', 'stock', 'csv');
      api.userApi.setOverrides('mu-2', { 'warehouse.edit': 'DENY', 'reports.view': 'DENY' });
      const after = await api.reportApi.export('mu-2', 'stock', 'csv');
      api.userApi.setOverrides('mu-2', { 'warehouse.edit': 'DENY', 'reports.view': 'GRANT' });
      return { before: before.ok, after: after.ok, code: (after as any).code };
    });
    expect(r.before).toBe(true);
    expect(r.after).toBe(false);
    expect(r.code).toBe(403);
  });
});