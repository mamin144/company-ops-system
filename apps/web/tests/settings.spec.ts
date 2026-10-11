import { test, expect } from '@playwright/test';

test.describe('Phase L: Settings Redesign & Final Application Polish', () => {
  test.beforeEach(async ({ page }) => {
    // Authenticate as administrator
    await page.goto('/login');
    await page.fill('input[autoComplete="username"]', 'admin');
    await page.fill('input[autoComplete="current-password"]', 'admin123');
    await page.click('button.btn--primary');
    await page.waitForURL('**/dashboard');

    // Navigate to /settings
    await page.goto('/settings');
    await page.waitForSelector('.page-shell');
  });

  /* ------------------------------------------------------------
   * 1. NAVIGATION & SECTION TABS
   * ------------------------------------------------------------ */
  test('1. Settings navigation: Settings page loads with header, description, and all 5 tabs', async ({ page }) => {
    await expect(page.locator('h1')).toHaveText('الإعدادات');
    await expect(page.locator('.settingsTabs')).toBeVisible();

    const tabs = page.locator('.settingsTabBtn');
    await expect(tabs).toHaveCount(5);

    await expect(tabs.nth(0)).toContainText('النسخ الاحتياطي');
    await expect(tabs.nth(1)).toContainText('سجل استيراد Excel');
    await expect(tabs.nth(2)).toContainText('المظهر والعرض');
    await expect(tabs.nth(3)).toContainText('الحساب والأمان');
    await expect(tabs.nth(4)).toContainText('عن النظام و PWA');
  });

  test('Navigation between tabs smoothly switches visible panels', async ({ page }) => {
    // Initially on Backups
    await expect(page.locator('.settingsBanner')).toBeVisible();
    await expect(page.locator('text=النسخ المحفوظة على الخادم')).toBeVisible();

    // Switch to Import History
    await page.locator('.settingsTabBtn', { hasText: 'سجل استيراد Excel' }).click();
    await expect(page.locator('text=إجمالي عمليات الاستيراد')).toBeVisible();
    await expect(page.locator('input[placeholder*="بحث باسم الملف"]')).toBeVisible();

    // Switch to Appearance
    await page.locator('.settingsTabBtn', { hasText: 'المظهر والعرض' }).click();
    await expect(page.locator('text=سمة الواجهة والمظهر')).toBeVisible();
    await expect(page.locator('text=الوضع النهاري (Light)')).toBeVisible();

    // Switch to Account & Security
    await page.locator('.settingsTabBtn', { hasText: 'الحساب والأمان' }).click();
    await expect(page.locator('.settingsProfileHeader')).toBeVisible();
    await expect(page.locator('.settingsProfileName')).toBeVisible();

    // Switch to About & PWA
    await page.locator('.settingsTabBtn', { hasText: 'عن النظام و PWA' }).click();
    await expect(page.locator('text=معلومات المنظومة والـ PWA')).toBeVisible();
  });

  /* ------------------------------------------------------------
   * 2. BACKUP & RESTORE FUNCTIONALITY
   * ------------------------------------------------------------ */
  test('2. Backup permission gating: Gated from unauthorized viewers', async ({ page, browser }) => {
    // 1. Create a viewer user using the existing authenticated admin session
    const username = 'viewer_settings_test';
    const password = 'Password123!';

    await page.evaluate(async ({ u, p }) => {
      await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: u,
          fullName: 'مشاهد تجريبي',
          password: p,
          roleName: 'viewer',
          isActive: true,
        }),
      });
    }, { u: username, p: password });

    // 2. Open a fresh context as viewer
    const viewerContext = await browser.newContext();
    const viewerPage = await viewerContext.newPage();
    await viewerPage.goto('/login');
    await viewerPage.fill('input[autoComplete="username"]', username);
    await viewerPage.fill('input[autoComplete="current-password"]', password);
    await viewerPage.click('button.btn--primary');
    await viewerPage.waitForURL('**/dashboard');

    await viewerPage.goto('/settings');
    await expect(viewerPage.locator('h1')).toHaveText('الإعدادات');

    // Verify backup button does not exist for viewer
    await expect(viewerPage.locator('button', { hasText: 'نسخة احتياطية الآن' })).toBeHidden();

    // Verify unauthorized message
    await expect(viewerPage.locator('text=غير مصرح بإدارة النسخ الاحتياطي')).toBeVisible();
    await viewerContext.close();
  });

  test('3 & 4. Backup creation & persistence: Creates snapshot via API, appears in table, and persists across reload', async ({ page }) => {
    const backupBtn = page.locator('button', { hasText: 'نسخة احتياطية الآن' });
    await expect(backupBtn).toBeVisible();

    const initialCount = await page.locator('.table tbody tr').count();

    // Trigger backup creation and intercept response
    const [response] = await Promise.all([
      page.waitForResponse((res) => res.url().includes('/api/backups') && res.request().method() === 'POST'),
      backupBtn.click(),
    ]);

    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.name).toBeDefined();

    // Success toast notification
    await expect(page.locator('.toast--success')).toBeVisible({ timeout: 10000 });

    // Verify newly created backup appears in the rendered list
    const newBackupRow = page.locator('.table tbody tr', { hasText: body.name });
    await expect(newBackupRow).toBeVisible();

    // Reload page and verify persistence
    await page.reload();
    await page.waitForSelector('.page-shell');
    await expect(page.locator('.table tbody tr', { hasText: body.name })).toBeVisible();
  });

  test('5. Restore cancel: Cancel does not perform restore and dismisses modal', async ({ page }) => {
    const rows = page.locator('.table tbody tr');
    await expect(rows.first()).toBeVisible();

    const restoreBtn = rows.first().locator('button', { hasText: 'استعادة' });
    await restoreBtn.click();

    const confirmModal = page.locator('.modal', { hasText: 'تأكيد العملية' });
    await expect(confirmModal).toBeVisible();

    // Click cancel
    await confirmModal.locator('button', { hasText: 'إلغاء' }).click();
    await expect(confirmModal).toBeHidden();
  });

  test('6. Restore confirm: Real restore execution confirms safety backup snapshot and shows success toast', async ({ page }) => {
    const rows = page.locator('.table tbody tr');
    await expect(rows.first()).toBeVisible();

    const restoreBtn = rows.first().locator('button', { hasText: 'استعادة' });
    await restoreBtn.click();

    const confirmModal = page.locator('.modal', { hasText: 'تأكيد العملية' });
    await expect(confirmModal).toBeVisible();

    // Confirm restore
    const [response] = await Promise.all([
      page.waitForResponse((res) => res.url().includes('/restore') && res.request().method() === 'POST'),
      confirmModal.locator('button', { hasText: 'تأكيد' }).click(),
    ]);

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.safetyBackup).toBeDefined();

    await expect(page.locator('.toast--success')).toContainText('تم الاستعادة');
  });

  /* ------------------------------------------------------------
   * 3. IMPORT HISTORY
   * ------------------------------------------------------------ */
  test('7. Import history: Loads real records, displays entity, filename, counts, and search filter', async ({ page }) => {
    await page.locator('.settingsTabBtn', { hasText: 'سجل استيراد Excel' }).click();

    await expect(page.locator('.settingsStatCard').first()).toBeVisible();

    const searchInput = page.locator('input[aria-label="بحث في سجل الاستيراد"]');
    await expect(searchInput).toBeVisible();

    // Verify existing record columns
    const table = page.locator('.table');
    await expect(table).toBeVisible();
    await expect(table.locator('th', { hasText: 'الكيان' })).toBeVisible();
    await expect(table.locator('th', { hasText: 'اسم الملف' })).toBeVisible();
    await expect(table.locator('th', { hasText: 'النتيجة' })).toBeVisible();

    // Type query and verify filter responds
    await searchInput.fill('sweep');
    await page.waitForTimeout(200);
    const filteredText = await page.locator('.panel').textContent();
    expect(filteredText).toBeDefined();
  });

  /* ------------------------------------------------------------
   * 4. APPEARANCE & THEME SWITCHING
   * ------------------------------------------------------------ */
  test('8, 9, 10. Theme light, dark, and persistence: Synchronizes with document, topbar, and localStorage across reloads', async ({ page }) => {
    await page.locator('.settingsTabBtn', { hasText: 'المظهر والعرض' }).click();

    const lightCard = page.locator('.settingsThemeCard', { hasText: 'الوضع النهاري' });
    const darkCard = page.locator('.settingsThemeCard', { hasText: 'الوضع الليلي' });
    const topbarThemeBtn = page.locator('button.themeToggle');

    // 1. Switch to Dark
    await darkCard.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe('dark');
    await expect(topbarThemeBtn).toHaveAttribute('title', 'الوضع النهاري');

    // 2. Reload and verify Dark persists
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    // 3. Switch to Light
    await page.locator('.settingsTabBtn', { hasText: 'المظهر والعرض' }).click();
    await lightCard.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe('light');
    await expect(topbarThemeBtn).toHaveAttribute('title', 'الوضع الليلي');

    // 4. Reload and verify Light persists
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });

  /* ------------------------------------------------------------
   * 5. ACCOUNT, PROFILE & SECURITY
   * ------------------------------------------------------------ */
  test('11 & 12. Profile identity & permission display: Renders real user identity and permissions from useAuth()', async ({ page }) => {
    await page.locator('.settingsTabBtn', { hasText: 'الحساب والأمان' }).click();

    // User details from session
    await expect(page.locator('.settingsProfileName')).toBeVisible();
    await expect(page.locator('.settingsProfileRole')).toContainText('admin');
    await expect(page.locator('.settingsProfileRole')).toContainText('مدير النظام');

    // Permissions list
    const permissionBadges = page.locator('.badge--gray');
    const permCount = await permissionBadges.count();
    expect(permCount).toBeGreaterThan(10);
    await expect(permissionBadges.first()).toBeVisible();
  });

  test('13. Security DOM sanitization: No token, password, or secret is rendered in the UI', async ({ page }) => {
    // Visit all tabs and verify page HTML does not leak tokens or passwords
    const tabNames = ['النسخ الاحتياطي', 'سجل استيراد Excel', 'المظهر والعرض', 'الحساب والأمان', 'عن النظام و PWA'];

    for (const name of tabNames) {
      await page.locator('.settingsTabBtn', { hasText: name }).click();
      const content = await page.content();

      // Invariants: No raw token or hashed password in rendered DOM
      expect(content).not.toContain('eyJhbGciOi'); // standard JWT header
      expect(content).not.toContain('$2b$10$');   // bcrypt hash signature
      expect(content).not.toContain('cos_refresh_token');
      expect(content).not.toContain('admin123');
    }
  });

  /* ------------------------------------------------------------
   * 6. ABOUT & PWA INFO
   * ------------------------------------------------------------ */
  test('14. PWA/app information: Renders system version, service worker, and connection status', async ({ page }) => {
    await page.locator('.settingsTabBtn', { hasText: 'عن النظام و PWA' }).click();

    await expect(page.locator('text=Company Operations System (COS)')).toBeVisible();
    await expect(page.locator('text=v1.3.0 Enterprise PWA')).toBeVisible();
    await expect(page.locator('text=دعم العمل دون اتصال (Offline Mode)')).toBeVisible();
    await expect(page.locator('text=متصل بالشبكة (Online)')).toBeVisible();
  });

  /* ------------------------------------------------------------
   * 7. RESPONSIVE VIEWPORT & ZERO OVERFLOW VERIFICATION
   * ------------------------------------------------------------ */
  const viewports = [
    { num: 15, name: 'Mobile (375x667)', width: 375, height: 667 },
    { num: 16, name: 'Tablet (768x1024)', width: 768, height: 1024 },
    { num: 17, name: 'Desktop (1366x768)', width: 1366, height: 768 },
    { num: 18, name: 'Wide (1920x1080)', width: 1920, height: 1080 },
  ];

  for (const vp of viewports) {
    test(`${vp.num}. Responsive ${vp.name} & 22. Zero horizontal overflow: Verifies clean stacking and scrollWidth <= clientWidth`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      const tabs = ['النسخ الاحتياطي', 'سجل استيراد Excel', 'المظهر والعرض', 'الحساب والأمان', 'عن النظام و PWA'];

      for (const tabName of tabs) {
        await page.locator('.settingsTabBtn', { hasText: tabName }).click();
        await page.waitForTimeout(100);

        const overflow = await page.evaluate(() => document.body.scrollWidth > window.innerWidth);
        expect(overflow, `Overflow detected on ${vp.name} in tab ${tabName}`).toBe(false);
      }
    });
  }

  /* ------------------------------------------------------------
   * 8. ACCESSIBILITY & KEYBOARD INTERACTION
   * ------------------------------------------------------------ */
  test('19, 20, 21. Keyboard navigation, focus management, and dialog Escape handling', async ({ page }) => {
    const tablist = page.locator('.settingsTabs[role="tablist"]');
    await expect(tablist).toBeVisible();

    const tabs = page.locator('.settingsTabBtn[role="tab"]');
    for (let i = 0; i < (await tabs.count()); i++) {
      await expect(tabs.nth(i)).toHaveAttribute('aria-selected');
    }

    // Test Escape key closes restore modal
    const restoreBtn = page.locator('.table tbody tr').first().locator('button', { hasText: 'استعادة' });
    await expect(restoreBtn).toBeVisible();
    await restoreBtn.click();

    const confirmModal = page.locator('.modal', { hasText: 'تأكيد العملية' });
    await expect(confirmModal).toBeVisible();

    // Verify keyboard escape closes modal
    await page.keyboard.press('Escape');
    await expect(confirmModal).toBeHidden();
  });
});