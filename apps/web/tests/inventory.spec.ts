import { test, expect } from '@playwright/test';

test.describe('Phase H: Warehouses, Items & Stock Redesign Comprehensive Suite', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[autoComplete=username]', 'admin');
    await page.fill('input[autoComplete=current-password]', 'admin123');
    await page.click('button.btn--primary');
    await page.waitForURL('**/dashboard');
  });

  test('Warehouses page loads header, hero chip, search toolbar, and table/cards', async ({ page }) => {
    await page.goto('/warehouses');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1', { hasText: 'المخازن' })).toBeVisible();
    await expect(page.locator('.heroChip')).toBeVisible();
    await expect(page.locator('.invToolbar input')).toBeVisible();
    await expect(page.locator('button', { hasText: 'مخزن جديد' })).toBeVisible();

    // Verify modal opens
    await page.locator('button', { hasText: 'مخزن جديد' }).click();
    await expect(page.locator('.modal', { hasText: 'مخزن جديد' })).toBeVisible();
    await page.locator('.modal .formActions button', { hasText: 'إلغاء' }).click();
    await expect(page.locator('.modal')).toBeHidden();
  });

  test('Items page loads header, hero chip, filters, and items table/cards', async ({ page }) => {
    await page.goto('/items');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1', { hasText: 'الأصناف' })).toBeVisible();
    await expect(page.locator('.heroChip')).toBeVisible();
    await expect(page.locator('.invToolbar input')).toBeVisible();
    await expect(page.locator('button', { hasText: 'صنف جديد' })).toBeVisible();

    // Verify modal opens
    await page.locator('button', { hasText: 'صنف جديد' }).click();
    await expect(page.locator('.modal', { hasText: 'صنف جديد' })).toBeVisible();
    await page.locator('.modal .formActions button', { hasText: 'إلغاء' }).click();
    await expect(page.locator('.modal')).toBeHidden();
  });

  test('Stock page loads workspace, tabs navigation, KPIs, and balances', async ({ page }) => {
    await page.goto('/stock');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1', { hasText: 'إدارة المخزون' })).toBeVisible();
    await expect(page.locator('.heroChip')).toBeVisible();
    await expect(page.locator('.stockTabsNav')).toBeVisible();

    // Check tabs
    const historyTab = page.locator('.stockTabBtn', { hasText: 'سجل الحركات' });
    const overviewTab = page.locator('.stockTabBtn', { hasText: 'الأرصدة ومستويات المخزون' });
    const lowStockTab = page.locator('.stockTabBtn', { hasText: 'أصناف تحت حد الأمان' });

    await expect(historyTab).toBeVisible();
    await expect(overviewTab).toBeVisible();
    await expect(lowStockTab).toBeVisible();

    // Switch to overview tab
    await overviewTab.click();
    await expect(overviewTab).toHaveClass(/active/);
    await expect(page.locator('.stockKpiGrid')).toBeVisible();

    // Switch to low-stock tab
    await lowStockTab.click();
    await expect(lowStockTab).toHaveClass(/active/);

    // Open new transaction modal
    await page.locator('button', { hasText: 'حركة جديدة' }).click();
    await expect(page.locator('.modal', { hasText: 'حركة مخزنية جديدة' })).toBeVisible();
    await page.locator('.modal .formActions button', { hasText: 'إلغاء' }).click();
    await expect(page.locator('.modal')).toBeHidden();
  });

  test('Mobile viewport (375x667): Warehouses, Items, and Stock render with zero horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    for (const path of ['/warehouses', '/items', '/stock']) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const hasOverflow = await page.evaluate(() => document.body.scrollWidth > window.innerWidth);
      expect(hasOverflow).toBe(false);
    }
  });

  test('Tablet viewport (768x1024): Inventory pages render with zero horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });

    for (const path of ['/warehouses', '/items', '/stock']) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const hasOverflow = await page.evaluate(() => document.body.scrollWidth > window.innerWidth);
      expect(hasOverflow).toBe(false);
    }
  });

  test('Desktop (1366x768) and Wide (1920x1080): Precision views with zero horizontal overflow', async ({ page }) => {
    for (const size of [{ width: 1366, height: 768 }, { width: 1920, height: 1080 }]) {
      await page.setViewportSize(size);
      for (const path of ['/warehouses', '/items', '/stock']) {
        await page.goto(path);
        await page.waitForLoadState('networkidle');
        const hasOverflow = await page.evaluate(() => document.body.scrollWidth > window.innerWidth);
        expect(hasOverflow).toBe(false);
      }
    }
  });
});
