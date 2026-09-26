import { test, expect } from '@playwright/test';

test.describe('Phase G: Archive & Documents Redesign Comprehensive Suite', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[autoComplete=username]', 'admin');
    await page.fill('input[autoComplete=current-password]', 'admin123');
    await page.click('button.btn--primary');
    await page.waitForURL('**/dashboard');
  });

  test('Archive page loads two-pane workspace, folder tree, and document list', async ({ page }) => {
    await page.goto('/archive');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.archiveWorkspace')).toBeVisible();
    await expect(page.locator('.archiveSidebar')).toBeVisible();
    await expect(page.locator('.archiveMain')).toBeVisible();

    await expect(page.locator('h1')).toContainText('الأرشيف والمستندات');
    await expect(page.locator('.heroChip')).toBeVisible();
    await expect(page.locator('.folderTreeNode', { hasText: 'كل المستندات' })).toBeVisible();
  });

  test('Folder Tree allows selecting a folder and creating a new folder', async ({ page }) => {
    await page.goto('/archive');
    await page.waitForLoadState('networkidle');

    const allDocsFolder = page.locator('.folderTreeNode', { hasText: 'كل المستندات' });
    await allDocsFolder.click();
    await expect(allDocsFolder).toHaveClass(/active/);

    await page.click('button[aria-label="إضافة مجلد جديد"]');
    const folderModal = page.locator('.modal', { hasText: 'إضافة مجلد جديد' });
    await expect(folderModal).toBeVisible();

    const uniqueFolderName = `مجلد اختبار ${Date.now()}`;
    await folderModal.locator('input').fill(uniqueFolderName);
    await folderModal.locator('button[type="submit"]').click();

    await expect(folderModal).toBeHidden();
    await expect(page.locator('.folderTreeNode', { hasText: uniqueFolderName })).toBeVisible();

    await page.click(`.folderTreeNode:has-text("${uniqueFolderName}")`);
    await expect(page.locator(`.folderTreeNode:has-text("${uniqueFolderName}")`)).toHaveClass(/active/);
  });

  test('Search and filter toolbar functions correctly', async ({ page }) => {
    await page.goto('/archive');
    await page.waitForLoadState('networkidle');

    const searchInput = page.locator('.archiveToolbar input[placeholder*="بحث"]');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('عقد');
    await page.waitForTimeout(300);

    const clearBtn = page.locator('.archiveToolbar button', { hasText: 'مسح الفلاتر' });
    await expect(clearBtn).toBeVisible();
    await clearBtn.click();
    await expect(searchInput).toHaveValue('');
  });

  test('Batch document selection displays floating batch bar and allows clear selection', async ({ page }) => {
    await page.goto('/archive');
    await page.waitForLoadState('networkidle');

    const firstCheckbox = page.locator('.archiveTableDesktop tbody input[type="checkbox"]').first();
    if (await firstCheckbox.isVisible()) {
      await firstCheckbox.check();

      const batchBar = page.locator('.archiveBatchBar');
      await expect(batchBar).toBeVisible();
      await expect(batchBar.locator('.archiveBatchBar__count')).toContainText('تم تحديد');

      await batchBar.locator('button', { hasText: 'إلغاء التحديد' }).click();
      await expect(batchBar).toBeHidden();
    }
  });

  test('Document Revisions modal opens and displays revision history', async ({ page }) => {
    await page.goto('/archive');
    await page.waitForLoadState('networkidle');

    const revisionBtn = page.locator('.archiveTableDesktop button.linkBtn.num').first();
    if (await revisionBtn.isVisible()) {
      await revisionBtn.click();
      const modal = page.locator('.modal', { hasText: 'إصدارات المستند' });
      await expect(modal).toBeVisible();

      await page.click('.modal .modal__head button');
      await expect(modal).toBeHidden();
    }
  });

  test('Mobile viewport (375x667): Folder drawer toggle works and zero horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/archive');
    await page.waitForLoadState('networkidle');

    const hasOverflow = await page.evaluate(() => document.body.scrollWidth > window.innerWidth);
    expect(hasOverflow).toBe(false);

    const toggleBtn = page.locator('.archiveFolderToggle');
    await expect(toggleBtn).toBeVisible();
    await toggleBtn.click();

    await expect(page.locator('.archiveSidebar')).toHaveClass(/open/);

    await page.click('.archiveBackdrop.open');
    await expect(page.locator('.archiveSidebar')).not.toHaveClass(/open/);
  });

 test('Tablet viewport (768x1024): Clean responsive layout with zero horizontal overflow', async ({ page }) => {
 await page.setViewportSize({ width: 768, height: 1024 });
 await page.goto('/archive');
 await page.waitForLoadState('networkidle');

 const hasOverflow = await page.evaluate(() => document.body.scrollWidth > window.innerWidth);
 expect(hasOverflow).toBe(false);

 await expect(page.locator('.archiveWorkspace')).toBeVisible();
 });

 test('Desktop (1366x768) and Wide (1920x1080): Two-pane split view renders with zero horizontal overflow', async ({ page }) => {
 for (const size of [{ width: 1366, height: 768 }, { width: 1920, height: 1080 }]) {
 await page.setViewportSize(size);
 await page.goto('/archive');
 await page.waitForLoadState('networkidle');

 const hasOverflow = await page.evaluate(() => document.body.scrollWidth > window.innerWidth);
 expect(hasOverflow).toBe(false);

 await expect(page.locator('.archiveSidebar')).toBeVisible();
 await expect(page.locator('.archiveMain')).toBeVisible();
 }
 });
});
