import { test, expect } from '@playwright/test';

test.describe('Phase J: Audit & Activity Log Redesign Comprehensive Suite', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[autoComplete=username]', 'admin');
    await page.fill('input[autoComplete=current-password]', 'admin123');
    await page.click('button.btn--primary');
    await page.waitForURL('**/dashboard');
  });

  test('Audit page loads header, hero chip with count, search toolbar, and table/cards', async ({ page }) => {
    await page.goto('/audit');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1', { hasText: 'سجل التغييرات والعمليات' })).toBeVisible();
    await expect(page.locator('.heroChip')).toBeVisible();
    await expect(page.locator('.heroChip')).toContainText('سجل');
    await expect(page.locator('.invToolbar select').first()).toBeVisible();
    await expect(page.locator('.invToolbar input[placeholder*=بحث]')).toBeVisible();
    await expect(page.locator('button', { hasText: 'تحديث' })).toBeVisible();
  });

  test('Toolbar filter selection and search work as expected', async ({ page }) => {
    await page.goto('/audit');
    await page.waitForLoadState('networkidle');

    const searchInput = page.locator('.invToolbar input[placeholder*=بحث]');
    await searchInput.fill('admin');
    await page.waitForTimeout(400);

    const clearBtn = page.locator('button', { hasText: 'مسح الفلاتر' });
    await expect(clearBtn).toBeVisible();
    await clearBtn.click();
    await expect(searchInput).toHaveValue('');
  });

  test('Event details modal opens on click, displays structured metadata and JSON diff, without sensitive tokens', async ({ page }) => {
    await page.goto('/audit');
    await page.waitForLoadState('networkidle');

    const detailBtn = page.locator('.invTableDesktop button', { hasText: 'عرض التفاصيل' }).first();
    if (await detailBtn.isVisible()) {
      await detailBtn.click();
      const modal = page.locator('.modal', { hasText: 'تفاصيل السجل والبيانات' });
      await expect(modal).toBeVisible();

      // Check metadata items
      await expect(modal.locator('.auditDetailsGrid')).toBeVisible();
      await expect(modal.locator('.auditDetailsItem__label', { hasText: 'معرف السجل' })).toBeVisible();
      await expect(modal.locator('.auditDetailsItem__label', { hasText: 'الوقت والتاريخ' })).toBeVisible();

      // Check diff container
      await expect(modal.locator('.auditDiffContainer')).toBeVisible();
      await expect(modal.locator('.auditDiffCol__title', { hasText: 'القيمة السابقة' })).toBeVisible();
      await expect(modal.locator('.auditDiffCol__title', { hasText: 'القيمة الجديدة' })).toBeVisible();

      // Ensure no raw passwords, secrets or authorization bearer tokens are shown
      const modalContent = await modal.innerText();
      expect(modalContent).not.toContain('Bearer ');
      expect(modalContent).not.toContain('password123');

      // Close modal
      await modal.locator('.formActions button', { hasText: 'إغلاق' }).click();
      await expect(modal).toBeHidden();
    }
  });

  test('Modal closes on Escape key', async ({ page }) => {
    await page.goto('/audit');
    await page.waitForLoadState('networkidle');

    const detailBtn = page.locator('.invTableDesktop button', { hasText: 'عرض التفاصيل' }).first();
    if (await detailBtn.isVisible()) {
      await detailBtn.click();
      const modal = page.locator('.modal', { hasText: 'تفاصيل السجل والبيانات' });
      await expect(modal).toBeVisible();

      await page.keyboard.press('Escape');
      await expect(modal).toBeHidden();
    }
  });

  test('Responsive viewports verification with zero horizontal overflow', async ({ page }) => {
    const viewports = [
      { width: 375, height: 667, name: 'Mobile 375' },
      { width: 768, height: 1024, name: 'Tablet 768' },
      { width: 1366, height: 768, name: 'Laptop 1366' },
      { width: 1920, height: 1080, name: 'Desktop 1920' },
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/audit');
      await page.waitForLoadState('networkidle');

      const isOverflowing = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth ||
               document.body.scrollWidth > window.innerWidth;
      });
      expect(isOverflowing, `Horizontal overflow detected at ${vp.name}`).toBe(false);

      if (vp.width < 768) {
        // Mobile cards should be rendered
        const mobileCards = page.locator('.auditCard');
        if (await mobileCards.count() > 0) {
          await expect(mobileCards.first()).toBeVisible();
        }
      }
    }
  });
});
