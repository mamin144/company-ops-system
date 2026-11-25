import { test, expect } from '@playwright/test';

// Phase 3.2 regression suite (kept). Covers: invalid project id (P1-01),
// failure injection + recovery (P2-02), modal keyboard behavior (P2-01),
// smoke + overflow matrix. Temp output only; mock data only.
const loginAs = async (page: any, role: string) => {
  await page.goto('/login');
  await page.getByRole('radio', { name: role }).click();
  await page.getByRole('button', { name: /دخول تجريبي/ }).click();
  await page.locator('.shell').waitFor({ timeout: 10000 });
};
const failNext = (page: any, op: string) =>
  page.evaluate(([o]: string[]) => (window as any).__protoTestHooks.failNext(o), [op]);

test.beforeEach(async ({ page }) => {
  await loginAs(page, 'مدير (تجريبي)');
});

test('P1-01 regression: unknown project id shows Not Found, no rejection, valid id works', async ({ page }) => {
  const bad: string[] = [];
  page.on('pageerror', (e) => bad.push(e.message.split('\n')[0]));
  await page.goto('/projects/does-not-exist');
  await expect(page.getByText('المشروع غير موجود')).toBeVisible({ timeout: 8000 });
  await expect(page.locator('.panel .skel').first()).toHaveCount(0);
  await page.getByRole('link', { name: 'قائمة المشروعات' }).click();
  await expect(page.getByRole('heading', { name: 'المشاريع' })).toBeVisible();
  await page.goto('/projects/p1/overview');
  await expect(page.getByRole('heading', { name: /برج النيل/ })).toBeVisible({ timeout: 8000 });
  expect(bad).toHaveLength(0);
});

test('P2-02: injected failure shows error panel, retry recovers (archive + requests + workspace)', async ({ page }) => {
  const bad: string[] = [];
  page.on('pageerror', (e) => bad.push(e.message.split('\n')[0]));
  // archive
  await page.goto('/archive');
  await expect(page.getByText('DOC-220').first()).toBeVisible({ timeout: 8000 });
  await failNext(page, 'documents');
  await page.getByRole('search').getByRole('button', { name: 'بحث', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByRole('button', { name: 'إعادة المحاولة' }).click();
  await expect(page.getByText('DOC-220').first()).toBeVisible({ timeout: 8000 });
  // requests
  await page.goto('/inventory/requests');
  await expect(page.getByText('MR-012').first()).toBeVisible({ timeout: 8000 });
  await failNext(page, 'mrs');
  await page.reload();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByRole('button', { name: 'إعادة المحاولة' }).click();
  await expect(page.getByText('MR-012').first()).toBeVisible({ timeout: 8000 });
  // workspace forced error (valid id + failing fetch)
  await page.goto('/projects/p1/overview');
  await expect(page.getByRole('heading', { name: /برج النيل/ })).toBeVisible({ timeout: 8000 });
  await failNext(page, 'project');
  await page.reload();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByRole('button', { name: 'إعادة المحاولة' }).click();
  await expect(page.getByRole('heading', { name: /برج النيل/ })).toBeVisible({ timeout: 8000 });
  expect(bad).toHaveLength(0);
});

test('P2-01: modal initial focus, Tab wrap both ways, Escape, focus restore', async ({ page }) => {
  await page.goto('/archive');
  await expect(page.getByText('DOC-220').first()).toBeVisible({ timeout: 8000 });
  const trigger = page.getByRole('button', { name: /رفع مستند/ });
  await trigger.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  // 1. initial focus lands on the title input (the corner × is in the Tab
  // cycle but is deliberately not first — keyboard users land on the work)
  await expect(page.locator('.modal input').first()).toBeFocused();
  // 2. Shift+Tab from first goes to the × (first in DOM order)
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: 'إغلاق الحوار' })).toBeFocused();
  // 3. Shift+Tab from × wraps to the last control (cancel button)
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: 'إلغاء' })).toBeFocused();
  // 4. Tab from last wraps back to first (×)
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'إغلاق الحوار' })).toBeFocused();
  // 5. Tab stays inside while cycling (walk 6 stops, all inside dialog)
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Tab');
    const inside = await page.evaluate(() => {
      const d = document.querySelector('.modal');
      return !!d && d.contains(document.activeElement);
    });
    expect(inside).toBe(true);
  }
  // 6. Escape closes + focus returns to the trigger
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('smoke + zero-overflow matrix (8 widths, key screens) + clean console', async ({ page }) => {
  const bad: string[] = [];
  page.on('pageerror', (e) => bad.push('pageerror: ' + e.message.split('\n')[0]));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) bad.push('console: ' + m.text().slice(0, 150)); });
  const routes: [string, string][] = [
    ['/', 'يحتاج المراجعة'], ['/projects', 'المشاريع'], ['/projects/p1/sites', 'المواقع'],
    ['/archive', 'الأرشيف'], ['/inventory/stock', 'المخزون'], ['/inventory/requests', 'طلبات المواد'],
    ['/financials', 'الموقف المالي والتعاقدي'], ['/admin', 'الإدارة'], ['/settings', 'الإعدادات'],
  ];
  for (const w of [320, 375, 390, 430, 768, 1024, 1366, 1920]) {
    await page.setViewportSize({ width: w, height: 800 });
    for (const [url, text] of routes) {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('.content').getByText(text, { exact: false }).first()).toBeVisible({ timeout: 8000 });
      const over = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      expect(over, `overflow ${w}px on ${url}`).toBe(false);
    }
  }
  expect(bad).toHaveLength(0);
});
