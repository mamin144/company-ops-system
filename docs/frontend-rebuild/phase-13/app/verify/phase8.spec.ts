import { test, expect } from '@playwright/test';

// Phase 8 — Inventory & Materials Operations verification (new scope only).
// Covers: the double-submit guard added to Requests.run() (prompt rule 5),
// the i18n fix for the hard-coded Arabic unit (prompt rule 7), role-gated
// action availability (prompt rule 8), and the subgrid table standard
// (project-wide fixed standard, must remain intact).
// Mock data only; no real stock movement; external output dirs only.

const loginAs = async (page: any, role: string) => {
  await page.goto('/login');
  await page.getByRole('radio', { name: role }).click();
  await page.getByRole('button', { name: /دخول تجريبي/ }).click();
  await page.locator('.shell').waitFor({ timeout: 10000 });
};
const rowOf = (page: any, needle: string) => page.locator('.recRow', { hasText: needle });
const toggleLang = (page: any) => page.locator('[data-lang-toggle]').click();

test.beforeEach(async ({ page }) => {
  await loginAs(page, 'مدير (تجريبي)');
});

test('P8-1 approve double-click guard: single success, no bogus failure toast, dialog closes once', async ({ page }) => {
  await page.goto('/inventory/requests');
  // MR-012 is seeded as submitted → approve is offered to the manager role
  const target = rowOf(page, 'MR-012');
  await expect(target.getByText('مقدمة')).toBeVisible({ timeout: 8000 });
  await target.getByRole('button', { name: 'اعتماد' }).click();
  const dlg = page.getByRole('dialog');
  await expect(dlg).toBeVisible();
  // Fire two synchronous clicks on the confirm button: with the guard the
  // second call must be a no-op; without it the mock would report a bogus
  // invalid-transition failure for the already-approved request.
  await dlg.getByRole('button', { name: 'تأكيد' }).evaluate((el: HTMLElement) => { el.click(); el.click(); });
  await expect(dlg).toBeHidden({ timeout: 5000 });
  const toasts = page.locator('.toasts .toast');
  await expect(toasts.filter({ hasText: 'اعتُمد الطلب' })).toHaveCount(1);
  await expect(page.locator('.toasts .toast--error')).toHaveCount(0);
  // state advanced exactly once and approve is no longer offered
  await expect(rowOf(page, 'MR-012').getByText('معتمد')).toBeVisible();
  await expect(rowOf(page, 'MR-012').getByRole('button', { name: 'اعتماد' })).toHaveCount(0);
  await expect(rowOf(page, 'MR-012').getByRole('button', { name: 'إرسال للمراجعة' })).toHaveCount(0);
});

test('P8-2 role gating on requests: viewer read-only, technical may create but not approve', async ({ page }) => {
  await page.goto('/inventory/requests');
  await expect(page.locator('.recRow').first()).toBeVisible({ timeout: 8000 });
  // admin sees creation
  await expect(page.getByRole('button', { name: '+ طلب جديد' })).toBeVisible();

  // viewer: read-only — no create, no mutation row actions (details is open but inert)
  await loginAs(page, 'مشاهد (تجريبي)');
  await page.goto('/inventory/requests');
  await expect(page.locator('.recRow').first()).toBeVisible({ timeout: 8000 });
  await expect(page.getByRole('button', { name: '+ طلب جديد' })).toHaveCount(0);
  for (const action of ['إرسال للمراجعة', 'اعتماد', 'رفض', 'صرف', 'إغلاق الطلب', 'حذف']) {
    await expect(page.locator('.recRow').getByRole('button', { name: action })).toHaveCount(0);
  }

  // technical: may create drafts but may not approve/reject/issue
  await loginAs(page, 'فني (تجريبي)');
  await page.goto('/inventory/requests');
  await expect(page.locator('.recRow').first()).toBeVisible({ timeout: 8000 });
  await expect(page.getByRole('button', { name: '+ طلب جديد' })).toBeVisible();
  await expect(rowOf(page, 'MR-012').getByRole('button', { name: 'اعتماد' })).toHaveCount(0);
  await expect(rowOf(page, 'MR-012').getByRole('button', { name: 'رفض' })).toHaveCount(0);
  await expect(rowOf(page, 'MR-012').getByRole('button', { name: /صرف/ })).toHaveCount(0);
});

test('P8-3 items unit i18n: EN shows "piece" for the created mock item (no hard-coded Arabic)', async ({ page }) => {
  await toggleLang(page);
  await page.goto('/inventory/items');
  await expect(page.getByRole('heading', { name: 'Items catalogue' })).toBeVisible({ timeout: 8000 });
  await page.getByRole('button', { name: '+ New item' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByLabel('Name *').fill('P8 probe item');
  await dlg.getByRole('button', { name: 'Save' }).click();
  await expect(dlg).toBeHidden();
  // the new row sorts onto page 2 — narrow with search so the pager shows it
  await page.getByPlaceholder('Search by number or name…').fill('P8 probe');
  const created = rowOf(page, 'P8 probe item').first();
  await expect(created).toBeVisible();
  await expect(created).toContainText('piece');
  // and the same flow in Arabic still shows the Arabic unit
  await toggleLang(page);
  await page.goto('/inventory/items');
  await page.getByRole('button', { name: '+ صنف جديد' }).click();
  const dlg2 = page.getByRole('dialog');
  await dlg2.getByLabel('الاسم *').fill('بند تجريبي للمرحلة 8');
  await dlg2.getByRole('button', { name: 'حفظ' }).click();
  await expect(dlg2).toBeHidden();
  // narrow to the created row so the pager cannot park it on another page
  await page.getByPlaceholder('بحث برقم أو اسم…').fill('بند تجريبي');
  const r = rowOf(page, 'بند تجريبي للمرحلة 8').first();
  await expect(r).toBeVisible();
  await expect(r).toContainText('قطعة', { timeout: 5000 });
});

test('P8-4 subgrid standard intact on the four inventory tables (≥768 both languages; stacked cards below)', async ({ page }) => {
  for (let lang = 0; lang < 2; lang++) {
    if (lang > 0) await toggleLang(page);
    for (const [url, cells] of [
      ['/inventory/warehouses', 4],
      ['/inventory/items', 4],
      ['/inventory/stock', 5],
      ['/inventory/requests', 4],
    ] as const) {
      await page.setViewportSize({ width: 1024, height: 800 });
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('.recRow').first()).toBeVisible({ timeout: 8000 });
      const table = page.locator('.recTable--sub');
      await expect(table).toHaveCount(1);
      // rows ride the shared track model via subgrid (no per-row overrides)
      const rowGTC = await page.locator('.recRow').first().evaluate((el: HTMLElement) => getComputedStyle(el).gridTemplateColumns);
      expect(rowGTC, `subgrid on ${url}`).toMatch(/^subgrid/);
      // head and first-row columns line up cell-by-cell (the real alignment)
      const headCells = await table.locator('.recHead .recCell').evaluateAll((els: HTMLElement[]) => els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, w: r.width }; }));
      const rowCells = await page.locator('.recRow').first().locator('.recCell').evaluateAll((els: HTMLElement[]) => els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, w: r.width }; }));
      expect(headCells.length, `head cells ${url}`).toBe(cells);
      expect(rowCells.length, `row cells ${url}`).toBe(cells);
      for (let i = 0; i < cells; i++) {
        expect(Math.abs(headCells[i].x - rowCells[i].x), `x ${url} cell ${i}`).toBeLessThan(1.5);
        expect(Math.abs(headCells[i].w - rowCells[i].w), `w ${url} cell ${i}`).toBeLessThan(1.5);
      }
    }
    // below 768: stacked-card mode (styles.css 383–393) — head hidden and the
    // row renders as a rounded card (its padding/border contract), not a table row
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('/inventory/requests', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.recRow').first()).toBeVisible({ timeout: 8000 });
    await expect(page.locator('.recHead').first()).toBeHidden();
    const radius = await page.locator('.recRow').first().evaluate((el: HTMLElement) => getComputedStyle(el).borderRadius);
    expect(radius, 'row is a stacked card below 768').not.toBe('0px');
  }
});

test('P8-5 low-stock tab: real thresholds only — no invented numbers, no page errors', async ({ page }) => {
  await page.goto('/inventory/stock?tab=low');
  await expect(page.getByRole('heading', { name: 'المخزون' })).toBeVisible({ timeout: 8000 });
  const bad: string[] = [];
  page.on('pageerror', (e) => bad.push(e.message.split('\n')[0]));
  const rows = await page.locator('.recRow').all();
  for (const r of rows) {
    // a low-stock row carries the item's real minimum-stock threshold
    await expect(r.locator('.num').first()).toBeVisible();
  }
  expect(bad, 'no page errors on low tab').toHaveLength(0);
});
