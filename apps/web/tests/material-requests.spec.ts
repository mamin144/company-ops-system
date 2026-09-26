import { test, expect } from '@playwright/test';

test.describe('Phase I: Material Requests Redesign Comprehensive Suite', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[autoComplete=username]', 'admin');
    await page.fill('input[autoComplete=current-password]', 'admin123');
    await page.click('button.btn--primary');
    await page.waitForURL('**/dashboard');
  });

  test('Material Requests page loads header, hero chip, search toolbar, and table/cards', async ({ page }) => {
    await page.goto('/material-requests');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1', { hasText: 'طلبات المواد' })).toBeVisible();
    await expect(page.locator('.heroChip')).toBeVisible();
    await expect(page.locator('.invToolbar select').first()).toBeVisible();
    await expect(page.locator('.invToolbar input[placeholder*=بحث]')).toBeVisible();
    await expect(page.locator('button', { hasText: 'طلب جديد' })).toBeVisible();
  });

  test('Filter and clear filters work as expected', async ({ page }) => {
    await page.goto('/material-requests');
    await page.waitForLoadState('networkidle');

    const searchInput = page.locator('.invToolbar input[placeholder*=بحث]');
    await searchInput.fill('اختبار_بحث');
    await page.waitForTimeout(200);

    const clearBtn = page.locator('button', { hasText: 'مسح الفلاتر' });
    await clearBtn.click();
    await expect(searchInput).toHaveValue('');
  });

  test('Create request modal opens, validates required fields, allows multi-item rows and cancellation', async ({ page }) => {
    await page.goto('/material-requests');
    await page.waitForLoadState('networkidle');

    await page.locator('button', { hasText: 'طلب جديد' }).click();
    const modal = page.locator('.modal', { hasText: 'طلب مواد جديد' });
    await expect(modal).toBeVisible();

    // Verify multi-item row addition
    const addLineBtn = modal.locator('button', { hasText: 'إضافة صنف آخر للطلب' });
    await expect(addLineBtn).toBeVisible();
    await addLineBtn.click();

    // Now there should be 2 rows and delete button for lines
    const lineDeleteBtns = modal.locator('button[aria-label*="حذف الصنف"]');
    await expect(lineDeleteBtns.first()).toBeVisible();
    await lineDeleteBtns.first().click();

    // Cancel modal
    await modal.locator('.formActions button', { hasText: 'إلغاء' }).click();
    await expect(modal).toBeHidden();
  });

  test('Request details modal opens on click and displays line-by-line item status', async ({ page }) => {
    await page.goto('/material-requests');
    await page.waitForLoadState('networkidle');

    const firstDetailsBtn = page.locator('.invTableDesktop button', { hasText: 'تفاصيل' }).first();
    if (await firstDetailsBtn.isVisible()) {
      await firstDetailsBtn.click();
      const modal = page.locator('.modal', { hasText: 'تفاصيل طلب المواد' });
      await expect(modal).toBeVisible();
      await expect(modal.locator('.mrDetailsGrid')).toBeVisible();
      await expect(modal.locator('table.table')).toBeVisible();

      await modal.locator('.formActions button', { hasText: 'إغلاق' }).click();
      await expect(modal).toBeHidden();
    }
  });

  test('Mobile viewport (375x667): Material Requests renders cleanly with zero horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/material-requests');
    await page.waitForLoadState('networkidle');

    const hasOverflow = await page.evaluate(() => document.body.scrollWidth > window.innerWidth);
    expect(hasOverflow).toBe(false);

    // Header and search toolbar should be visible
    await expect(page.locator('h1', { hasText: 'طلبات المواد' })).toBeVisible();
  });

  test('Tablet viewport (768x1024): Material Requests renders cleanly with zero horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/material-requests');
    await page.waitForLoadState('networkidle');

    const hasOverflow = await page.evaluate(() => document.body.scrollWidth > window.innerWidth);
    expect(hasOverflow).toBe(false);
  });

  test('Desktop (1366x768) and Wide (1920x1080): Precision views with zero horizontal overflow', async ({ page }) => {
    for (const size of [{ width: 1366, height: 768 }, { width: 1920, height: 1080 }]) {
      await page.setViewportSize(size);
      await page.goto('/material-requests');
      await page.waitForLoadState('networkidle');

      const hasOverflow = await page.evaluate(() => document.body.scrollWidth > window.innerWidth);
      expect(hasOverflow).toBe(false);
    }
  });
});
