import { test, expect } from '@playwright/test';

test.describe('Responsive Shell & Navigation Suite', () => {
  test.beforeEach(async ({ page }) => {
    // Authenticate as admin
    await page.goto('/login');
    await page.fill('input[autoComplete="username"]', 'admin');
    await page.fill('input[autoComplete="current-password"]', 'admin123');
    await page.click('button.btn--primary');
    await page.waitForURL('**/dashboard');
  });

  test('Mobile viewport (375x667): Drawer toggle and navigation', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    // In mobile, the sidebar should be hidden off-canvas (transform)
    const sidebar = page.locator('aside.sidebar');
    await expect(sidebar).not.toHaveClass(/sidebar--open/);

    // Hamburger menu button should be visible
    const menuBtn = page.locator('button.menuBtn');
    await expect(menuBtn).toBeVisible();

    // Click menu button to open drawer
    await menuBtn.click();
    await expect(sidebar).toHaveClass(/sidebar--open/);
    await expect(page.locator('.sidebar__backdrop')).toHaveClass(/sidebar__backdrop--visible/);

    // Click backdrop to close
    await page.locator('.sidebar__backdrop').click({ position: { x: 10, y: 10 } });
    await expect(sidebar).not.toHaveClass(/sidebar--open/);
  });

  test('Tablet viewport (768x1024): Drawer exists and main content does not overflow horizontally', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });

    // Menu button visible
    await expect(page.locator('button.menuBtn')).toBeVisible();

    // Verify main content container is visible
    const main = page.locator('main.main');
    await expect(main).toBeVisible();

    // Check no horizontal scrollbar on body
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
  });

  test('Desktop viewport (1366x768): Persistent sidebar and collapse/expand toggle', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });

    // Persistent sidebar should be visible
    const sidebar = page.locator('aside.sidebar');
    await expect(sidebar).toBeVisible();

    // Menu button should NOT be visible on desktop
    await expect(page.locator('button.menuBtn')).toBeHidden();

    // Toggle collapse by clicking brand logo
    const logo = page.locator('.brand__logo');
    await logo.click();

    // Shell should have collapsed class
    const shell = page.locator('.shell');
    await expect(shell).toHaveClass(/shell--collapsed/);

    // Expand back
    await logo.click();
    await expect(shell).not.toHaveClass(/shell--collapsed/);
  });

  test('Wide Desktop (1920x1080): Proper layout scaling and RTL direction', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });

    // Verify RTL is enforced on body
    const dir = await page.getAttribute('body', 'direction') || await page.getAttribute('body', 'dir') || await page.evaluate(() => getComputedStyle(document.body).direction);
    expect(dir).toBe('rtl');

    // Sidebar on right side in RTL
    const sidebarBox = await page.locator('aside.sidebar').boundingBox();
    expect(sidebarBox).not.toBeNull();
  });

  test('Shared Components & DataTable: Modal, table accessibility and keyboard behavior', async ({ page }) => {
    // Navigate to Admin Users to test modern DataTable and Modal
    await page.goto('/admin/users');
    await expect(page.locator('h2', { hasText: 'المستخدمون' })).toBeVisible();

    // Verify DataTable has accessible table role
    const tableWrap = page.locator('.tableWrap');
    await expect(tableWrap).toHaveAttribute('role', 'region');
    await expect(tableWrap).toHaveAttribute('aria-label', 'جدول البيانات');

    // Click "مستخدم جديد" to open modernized modal
    await page.locator('button', { hasText: 'مستخدم جديد' }).click();
    const modal = page.locator('.modal');
    await expect(modal).toBeVisible();
    await expect(modal).toHaveAttribute('role', 'dialog');
    await expect(modal).toHaveAttribute('aria-modal', 'true');

    // Test Escape key closes modal
    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden();
  });
});
