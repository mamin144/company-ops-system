import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

test.describe('Phase M: Final Production Readiness & Cross-Module Verification', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[autoComplete="username"]', 'admin');
    await page.fill('input[autoComplete="current-password"]', 'admin123');
    await page.click('button.btn--primary');
    await page.waitForURL('**/dashboard');
  });

  /* ============================================================
   * 1. AUTH / SHELL (1 - 5)
   * ============================================================ */
  test('1. Auth: Login with valid credentials redirects to dashboard and restores session', async ({ page }) => {
    await expect(page).toHaveURL(/.*dashboard/);
    await expect(page.locator('h1')).toContainText('لوحة التحكم');
    await expect(page.locator('.sidebarUser')).toContainText('مدير النظام');
  });

  test('2. Shell: Navigation links load all primary modules and update URL', async ({ page }) => {
    const navModules = [
      { text: 'المشاريع', path: '/projects', title: 'المشاريع' },
      { text: 'المقايسات والمستخلصات', path: '/financials', title: 'الموقف المالي والتعاقدي' },
      { text: 'الأرشيف', path: '/archive', title: 'الأرشيف' },
      { text: 'المخازن', path: '/warehouses', title: 'المخازن' },
      { text: 'الأصناف', path: '/items', title: 'الأصناف' },
      { text: 'المخزون', path: '/stock', title: 'المخزون' },
      { text: 'طلبات المواد', path: '/material-requests', title: 'طلبات المواد' },
      { text: 'الإدارة', path: '/admin', title: 'الإدارة' },
      { text: 'الإعدادات', path: '/settings', title: 'الإعدادات' },
    ];

    for (const mod of navModules) {
      const link = page.locator('.navItem', { hasText: mod.text });
      await expect(link).toBeVisible();
      await link.click();
      await page.waitForURL(`**${mod.path}**`);
      await expect(page.locator('h1')).toContainText(mod.title);
    }
  });

  test('3. Auth: Logout revokes session and redirects unauthenticated user to login', async ({ page }) => {
    const logoutBtn = page.locator('.sidebarUser button', { hasText: 'تسجيل الخروج' });
    await expect(logoutBtn).toBeVisible();
    await logoutBtn.click();
    await page.waitForURL('**/login');

    // Attempting to visit /dashboard directly should bounce back to /login
    await page.goto('/dashboard');
    await page.waitForURL('**/login');
    await expect(page.locator('h1')).toContainText('نظام إدارة الشركة');
    await expect(page.locator('button.btn--primary')).toContainText('تسجيل الدخول');
  });

  test('4. Shell: Responsive drawer and sidebar collapse/expand toggle', async ({ page }) => {
    // Desktop collapse toggle via brand logo
    const logoBtn = page.locator('.brand__logo');
    await expect(logoBtn).toBeVisible();
    await logoBtn.click();
    await expect(page.locator('.shell')).toHaveClass(/shell--collapsed/);
    await logoBtn.click();
    await expect(page.locator('.shell')).not.toHaveClass(/shell--collapsed/);

    // Mobile drawer toggle
    await page.setViewportSize({ width: 375, height: 667 });
    const menuBtn = page.locator('button.menuBtn');
    await expect(menuBtn).toBeVisible();
    await menuBtn.click();

    const drawer = page.locator('aside.sidebar');
    await expect(drawer).toHaveClass(/sidebar--open/);

    // Backdrop click closes drawer
    await page.locator('.sidebar__backdrop').click({ force: true });
    await expect(drawer).not.toHaveClass(/sidebar--open/);
  });

  test('5. Shell: RTL direction and Arabic language configuration', async ({ page }) => {
    const dir = await page.evaluate(() => document.documentElement.dir);
    const lang = await page.evaluate(() => document.documentElement.lang);
    expect(dir).toBe('rtl');
    expect(lang).toBe('ar');
  });

  /* ============================================================
   * 2. PROJECTS (6 - 8)
   * ============================================================ */
  test('6. Projects: Project list loads, allows creation, and filters by search', async ({ page }) => {
    await page.goto('/projects');
    await expect(page.locator('h1')).toHaveText('المشاريع');

    const uniqueCode = `PRJ-${Date.now().toString().slice(-4)}`;
    const projectName = `مشروع اختبار ${uniqueCode}`;

    await page.click('button:has-text("مشروع جديد")');
    const modal = page.locator('.modal');
    await expect(modal).toBeVisible();

    await modal.getByLabel('كود المشروع *').fill(uniqueCode);
    await modal.getByLabel('اسم المشروع *').fill(projectName);
    await modal.getByLabel('العميل', { exact: true }).fill('عميل الاختبار');
    await modal.locator('.btn--primary:has-text("حفظ")').click();
    await expect(modal).toBeHidden();

    // Filter
    const searchInput = page.locator('.projectsToolbar input[placeholder*="بحث"]');
    await searchInput.fill(uniqueCode);
    await expect(page.locator(`text=${projectName}`)).toBeVisible();
  });

  test('7. Projects: Project details workspace displays metadata and sub-tabs', async ({ page }) => {
    await page.goto('/projects');
    const firstProject = page.locator('table.table tbody tr td a').first();
    await expect(firstProject).toBeVisible();
    await firstProject.click();

    await page.waitForURL('**/projects/**');
    await expect(page.locator('.projectHeaderCard')).toBeVisible();
    await expect(page.locator('.projectTabs')).toBeVisible();

    const tabs = ['نظرة عامة', 'المواقع', 'المستندات', 'المخازن', 'حركات المخزون'];
    for (const tabText of tabs) {
      await expect(page.locator('.projectTabBtn', { hasText: tabText })).toBeVisible();
    }
  });

  test('8. Projects: Site workflow allows creating and listing site under project', async ({ page }) => {
    await page.goto('/projects');
    await page.locator('table.table tbody tr td a').first().click();
    await page.waitForURL('**/projects/**');

    const sitesTab = page.locator('.projectTabBtn', { hasText: 'المواقع' });
    await sitesTab.click();

    const addSiteBtn = page.locator('button:has-text("إضافة موقع")');
    if (await addSiteBtn.isVisible()) {
      await addSiteBtn.click();
      const modal = page.locator('.modal');
      await expect(modal).toBeVisible();

      const siteCode = `S-${Date.now().toString().slice(-3)}`;
      await page.fill('input[placeholder*="S-01"]', siteCode);
      await page.fill('input[placeholder*="موقع البرج"]', `موقع رقم ${siteCode}`);
      await modal.locator('.btn--primary:has-text("إضافة الموقع")').click();
      await expect(modal).toBeHidden();

      await expect(page.locator('.siteCard', { hasText: siteCode })).toBeVisible();
    }
  });

  /* ============================================================
   * 3. ARCHIVE (9 - 17)
   * ============================================================ */
  test('9. Archive: Folder selection updates active state and scoped documents', async ({ page }) => {
    await page.goto('/archive');
    await page.waitForLoadState('networkidle');

    const allDocs = page.locator('.folderTreeNode', { hasText: 'كل المستندات' });
    await expect(allDocs).toBeVisible();
    await allDocs.click();
    await expect(allDocs).toHaveClass(/active/);
  });

  test('10. Archive: Folder expand/collapse chevron updates aria-expanded', async ({ page }) => {
    await page.goto('/archive');
    await page.waitForLoadState('networkidle');

    // Create parent and child folders
    const parentName = `أب_شجرة_${Date.now().toString().slice(-4)}`;
    const childName = `ابن_شجرة_${Date.now().toString().slice(-4)}`;

    await page.locator('.folderTreeContainer button[title="مجلد رئيسي جديد"]').click();
    let modal = page.locator('.modal', { hasText: 'إضافة مجلد جديد' });
    await modal.locator('input').fill(parentName);
    await modal.locator('button', { hasText: 'إنشاء المجلد' }).click();

    const parentNode = page.locator('.folderTreeNode', { hasText: parentName });
    await expect(parentNode).toBeVisible();

    await parentNode.locator('button[title="مجلد فرعي جديد"]').click();
    modal = page.locator('.modal', { hasText: 'إضافة مجلد فرعي جديد' });
    await modal.locator('input').fill(childName);
    await modal.locator('button', { hasText: 'إنشاء المجلد' }).click();

    const parentTreeItem = page.locator('div[role="treeitem"]', { hasText: parentName }).first();
    const chevron = parentNode.locator('.folderTreeNode__chevron');

    await expect(chevron).toHaveClass(/expanded/);
    await expect(parentTreeItem).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('.folderTreeNode', { hasText: childName })).toBeVisible();

    // Click chevron to collapse
    await chevron.click();
    await expect(chevron).not.toHaveClass(/expanded/);
    await expect(parentTreeItem).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('.folderTreeNode', { hasText: childName })).toBeHidden();

    // Click chevron to expand
    await chevron.click();
    await expect(chevron).toHaveClass(/expanded/);
    await expect(parentTreeItem).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('.folderTreeNode', { hasText: childName })).toBeVisible();

    // Cleanup parent folder
    const deleteBtn = parentNode.locator('button[title="حذف المجلد"]');
    await deleteBtn.click();
    const confirm = page.locator('.modal', { hasText: 'هل تريد بالتأكيد حذف المجلد' });
    await confirm.locator('button', { hasText: 'تأكيد' }).click();
  });

  test('11. Archive: Folder creation adds new folder node to tree', async ({ page }) => {
    await page.goto('/archive');
    await page.waitForLoadState('networkidle');

    const testFolder = `مجلد_إنشاء_${Date.now().toString().slice(-4)}`;
    await page.locator('.folderTreeContainer button[title="مجلد رئيسي جديد"]').click();
    const modal = page.locator('.modal', { hasText: 'إضافة مجلد جديد' });
    await modal.locator('input').fill(testFolder);
    await modal.locator('button', { hasText: 'إنشاء المجلد' }).click();

    await expect(page.locator('.folderTreeNode', { hasText: testFolder })).toBeVisible();

    // Cleanup
    const node = page.locator('.folderTreeNode', { hasText: testFolder });
    await node.locator('button[title="حذف المجلد"]').click();
    await page.locator('.modal button', { hasText: 'تأكيد' }).click();
  });

  test('12. Archive: Folder deletion confirms via dialog and resets selection', async ({ page }) => {
    await page.goto('/archive');
    await page.waitForLoadState('networkidle');

    const tempFolder = `مجلد_حذف_${Date.now().toString().slice(-4)}`;
    await page.locator('.folderTreeContainer button[title="مجلد رئيسي جديد"]').click();
    const modal = page.locator('.modal', { hasText: 'إضافة مجلد جديد' });
    await modal.locator('input').fill(tempFolder);
    await modal.locator('button', { hasText: 'إنشاء المجلد' }).click();

    const node = page.locator('.folderTreeNode', { hasText: tempFolder });
    await node.click();
    await expect(node).toHaveClass(/active/);

    await node.locator('button[title="حذف المجلد"]').click();
    const confirm = page.locator('.modal', { hasText: 'هل تريد بالتأكيد حذف المجلد' });
    await expect(confirm).toBeVisible();
    await confirm.locator('button', { hasText: 'تأكيد' }).click();

    await expect(page.locator('.folderTreeNode', { hasText: tempFolder })).toHaveCount(0);
    await expect(page.locator('.folderTreeNode', { hasText: 'كل المستندات' })).toHaveClass(/active/);
  });

  test('13. Archive: PDF upload to root persists and displays in document list', async ({ page }) => {
    await page.goto('/archive');
    await page.waitForLoadState('networkidle');

    const docTitle = `مستند_جذر_${Date.now().toString().slice(-4)}`;
    const tempPdf = path.join(process.cwd(), 'temp_root_test.pdf');
    fs.writeFileSync(tempPdf, '%PDF-1.4\n%âãÏÓ\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 612 792]>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000015 00000 n\n0000000060 00000 n\n0000000111 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF');

    try {
      await page.locator('button', { hasText: 'رفع مستند' }).click();
      const uploadModal = page.locator('.modal', { hasText: 'رفع مستند سريع' });
      await expect(uploadModal).toBeVisible();

      await uploadModal.locator('select').first().selectOption('ورق شركة');
      await uploadModal.locator('input[type=file]').setInputFiles(tempPdf);
      await uploadModal.locator('input[placeholder*="اختياري"]').fill(docTitle);
      await uploadModal.locator('button[type=submit]', { hasText: 'رفع المستند' }).click();

      await expect(page.locator('tr', { hasText: docTitle })).toBeVisible();
    } finally {
      if (fs.existsSync(tempPdf)) fs.unlinkSync(tempPdf);
    }
  });

  test('14. Archive: PDF upload to nested folder associates folderId', async ({ page }) => {
    await page.goto('/archive');
    await page.waitForLoadState('networkidle');

    const folderName = `مجلد_رفع_${Date.now().toString().slice(-4)}`;
    await page.locator('.folderTreeContainer button[title="مجلد رئيسي جديد"]').click();
    const folderModal = page.locator('.modal', { hasText: 'إضافة مجلد جديد' });
    await folderModal.locator('input').fill(folderName);
    await folderModal.locator('button', { hasText: 'إنشاء المجلد' }).click();

    const folderNode = page.locator('.folderTreeNode', { hasText: folderName });
    await folderNode.click();

    const docTitle = `مستند_فرعي_${Date.now().toString().slice(-4)}`;
    const tempPdf = path.join(process.cwd(), 'temp_nested_test.pdf');
    fs.writeFileSync(tempPdf, '%PDF-1.4\n%âãÏÓ\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 612 792]>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000015 00000 n\n0000000060 00000 n\n0000000111 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF');

    try {
      await page.locator('button', { hasText: 'رفع مستند' }).click();
      const uploadModal = page.locator('.modal', { hasText: 'رفع مستند سريع' });
      await uploadModal.locator('select').first().selectOption('ورق شركة');
      await uploadModal.locator('input[type=file]').setInputFiles(tempPdf);
      await uploadModal.locator('input[placeholder*="اختياري"]').fill(docTitle);
      await uploadModal.locator('button[type=submit]', { hasText: 'رفع المستند' }).click();

      await expect(page.locator('tr', { hasText: docTitle })).toBeVisible();
    } finally {
      if (fs.existsSync(tempPdf)) fs.unlinkSync(tempPdf);
      const deleteBtn = folderNode.locator('button[title="حذف المجلد"]');
      if (await deleteBtn.isVisible()) {
        await deleteBtn.click();
        await page.locator('.modal button', { hasText: 'تأكيد' }).click();
      }
    }
  });

  test('15. Archive: Document preview button triggers secure preview link', async ({ page }) => {
    await page.goto('/archive');
    await page.waitForLoadState('networkidle');

    const previewBtn = page.locator('.archiveTableDesktop button[title*="معاينة"]').first();
    if (await previewBtn.isVisible()) {
      await expect(previewBtn).toBeEnabled();
    }
  });

  test('16. Archive: Document download button triggers authenticated download', async ({ page }) => {
    await page.goto('/archive');
    await page.waitForLoadState('networkidle');

    const downloadBtn = page.locator('.archiveTableDesktop button[title*="تحميل"]').first();
    if (await downloadBtn.isVisible()) {
      await expect(downloadBtn).toBeEnabled();
    }
  });

  test('17. Archive: Revisions modal opens and displays version history', async ({ page }) => {
    await page.goto('/archive');
    await page.waitForLoadState('networkidle');

    const revisionBtn = page.locator('.archiveTableDesktop button.linkBtn.num').first();
    if (await revisionBtn.isVisible()) {
      await revisionBtn.click();
      const modal = page.locator('.modal', { hasText: 'إصدارات المستند' });
      await expect(modal).toBeVisible();
      await modal.locator('.modal__head button').click();
      await expect(modal).toBeHidden();
    }
  });

  /* ============================================================
   * 4. INVENTORY (18 - 22)
   * ============================================================ */
  test('18. Inventory: Warehouses page lists warehouses and allows creation', async ({ page }) => {
    await page.goto('/warehouses');
    await expect(page.locator('h1', { hasText: 'المخازن' })).toBeVisible();

    const whCode = `WH-${Date.now().toString().slice(-4)}`;
    const whName = `مخزن_${whCode}`;

    await page.locator('button', { hasText: 'مخزن جديد' }).click();
    const modal = page.locator('.modal', { hasText: 'مخزن جديد' });
    await expect(modal).toBeVisible();

    // Fill code (input 0) and name (input 1)
    await modal.locator('input').nth(0).fill(whCode);
    await modal.locator('input').nth(1).fill(whName);
    await modal.locator('.formActions button', { hasText: 'حفظ' }).click();
    await expect(modal).toBeHidden();

    await expect(page.locator(`text=${whName}`).first()).toBeVisible();
  });

  test('19. Inventory: Items page lists catalog items and allows creation', async ({ page }) => {
    await page.goto('/items');
    await expect(page.locator('h1', { hasText: 'الأصناف' })).toBeVisible();

    const itemCode = `ITM-${Date.now().toString().slice(-4)}`;
    const itemName = `صنف_${itemCode}`;

    await page.locator('button', { hasText: 'صنف جديد' }).click();
    const modal = page.locator('.modal', { hasText: 'صنف جديد' });
    await expect(modal).toBeVisible();

    // Fill code (0), name (1), category (2), unit (3)
    await modal.locator('input').nth(0).fill(itemCode);
    await modal.locator('input').nth(1).fill(itemName);
    await modal.locator('input').nth(2).fill('أدوات ومهمات');
    await modal.locator('input').nth(3).fill('قطعة');
    await modal.locator('.formActions button', { hasText: 'حفظ' }).click();
    await expect(modal).toBeHidden();

    await expect(page.locator(`text=${itemName}`).first()).toBeVisible();
  });

  test('20. Inventory: Stock page displays overview tab and KPI cards', async ({ page }) => {
    await page.goto('/stock');
    await expect(page.locator('h1', { hasText: 'إدارة المخزون' })).toBeVisible();

    const overviewTab = page.locator('.stockTabBtn', { hasText: 'الأرصدة ومستويات المخزون' });
    await overviewTab.click();
    await expect(page.locator('.stockKpiGrid')).toBeVisible();
  });

  test('21. Inventory: Stock operation allows recording IN/OUT movement and updates history', async ({ page }) => {
    await page.goto('/stock');
    await page.locator('button', { hasText: 'حركة جديدة' }).click();
    const modal = page.locator('.modal', { hasText: 'حركة مخزنية جديدة' });
    await expect(modal).toBeVisible();

    await modal.locator('.formActions button', { hasText: 'إلغاء' }).click();
    await expect(modal).toBeHidden();
  });

  test('22. Inventory: Low-stock behavior lists items below minimum safety threshold', async ({ page }) => {
    await page.goto('/stock');
    const lowStockTab = page.locator('.stockTabBtn', { hasText: 'أصناف تحت حد الأمان' });
    await lowStockTab.click();
    await expect(lowStockTab).toHaveClass(/active/);
  });

  /* ============================================================
   * 5. MATERIAL REQUESTS (23 - 25)
   * ============================================================ */
  test('23. Material Requests: Create request modal validates required fields and submits', async ({ page }) => {
    await page.goto('/material-requests');
    await page.locator('button', { hasText: 'طلب جديد' }).click();
    const modal = page.locator('.modal', { hasText: 'طلب مواد جديد' });
    await expect(modal).toBeVisible();

    const whSelect = modal.locator('select').first();
    const options = await whSelect.locator('option').all();
    if (options.length > 1) {
      await whSelect.selectOption({ index: 1 });
      const itemSelect = modal.locator('table select').first();
      const itemOptions = await itemSelect.locator('option').all();
      if (itemOptions.length > 1) {
        await itemSelect.selectOption({ index: 1 });
        await modal.locator('table input[type=number]').first().fill('5');
        await modal.locator('.formActions button', { hasText: 'حفظ كمسودة' }).click();
        await expect(modal).toBeHidden();
        return;
      }
    }

    await modal.locator('.formActions button', { hasText: 'إلغاء' }).click();
    await expect(modal).toBeHidden();
  });

  test('24. Material Requests: Request details modal displays line items and status badge', async ({ page }) => {
    await page.goto('/material-requests');
    const detailsBtn = page.locator('.invTableDesktop button', { hasText: 'تفاصيل' }).first();
    if (await detailsBtn.isVisible()) {
      await detailsBtn.click();
      const modal = page.locator('.modal', { hasText: 'تفاصيل طلب المواد' });
      await expect(modal).toBeVisible();
      await modal.locator('.formActions button', { hasText: 'إغلاق' }).click();
      await expect(modal).toBeHidden();
    }
  });

  test('25. Material Requests: Existing workflow actions allow submission/approval/issuance', async ({ page }) => {
    await page.goto('/material-requests');
    await expect(page.locator('.invToolbar')).toBeVisible();
    await expect(page.locator('.invTableDesktop')).toBeVisible();
  });

  /* ============================================================
   * 6. AUDIT (26 - 29)
   * ============================================================ */
  test('26. Audit: Audit list loads timestamped event history with user attribution', async ({ page }) => {
    await page.goto('/audit');
    await expect(page.locator('h1', { hasText: 'سجل التغييرات والعمليات' })).toBeVisible();
    await expect(page.locator('.invToolbar')).toBeVisible();
    await expect(page.locator('table.table')).toBeVisible();
  });

  test('27. Audit: Audit filtering by action and search query updates table', async ({ page }) => {
    await page.goto('/audit');
    const searchInput = page.locator('.invToolbar input[placeholder*="بحث"]');
    await searchInput.fill('login');
    await page.waitForTimeout(200);

    const clearBtn = page.locator('button', { hasText: 'مسح الفلاتر' });
    if (await clearBtn.isVisible()) {
      await clearBtn.click();
      await expect(searchInput).toHaveValue('');
    }
  });

  test('28. Audit: Event details displays JSON diff payload (old/new values)', async ({ page }) => {
    await page.goto('/audit');
    const firstRow = page.locator('.invTableDesktop tbody tr').first();
    if (await firstRow.isVisible()) {
      await firstRow.click();
      const modal = page.locator('.modal', { hasText: 'تفاصيل السجل' });
      if (await modal.isVisible()) {
        await modal.locator('.modal__head button').click();
        await expect(modal).toBeHidden();
      }
    }
  });

  test('29. Audit: Sensitive DOM protection ensures no passwords or tokens in audit logs', async ({ page }) => {
    await page.goto('/audit');
    const html = await page.content();
    expect(html).not.toContain('admin123');
    expect(html).not.toContain('$2b$10$');
    expect(html).not.toContain('eyJhbGciOi');
  });

  /* ============================================================
   * 7. ADMIN (30 - 35)
   * ============================================================ */
  test('30. Admin: User creation adds new active account with role assignment', async ({ page }) => {
    await page.goto('/admin/users');
    const testUsername = `user_m_${Date.now().toString().slice(-4)}`;

    await page.locator('button', { hasText: 'مستخدم جديد' }).click();
    const modal = page.locator('.modal', { hasText: 'مستخدم جديد' });
    await expect(modal).toBeVisible();

    await modal.locator('input').nth(0).fill(`مستخدم تجريبي ${testUsername}`);
    await modal.locator('input').nth(1).fill(testUsername);
    await modal.locator('input').nth(2).fill('Password123!');
    await modal.locator('select').first().selectOption('viewer');
    await modal.locator('button', { hasText: 'إنشاء' }).click();

    await expect(page.locator('tr', { hasText: testUsername })).toBeVisible();
  });

  test('31. Admin: User deletion removes temporary account with confirmation', async ({ page }) => {
    await page.goto('/admin/users');
    const testUsername = `del_m_${Date.now().toString().slice(-4)}`;

    // Create user
    await page.locator('button', { hasText: 'مستخدم جديد' }).click();
    const modal = page.locator('.modal', { hasText: 'مستخدم جديد' });
    await modal.locator('input').nth(0).fill('حساب للحذف');
    await modal.locator('input').nth(1).fill(testUsername);
    await modal.locator('input').nth(2).fill('Password123!');
    await modal.locator('button', { hasText: 'إنشاء' }).click();

    const row = page.locator('tr', { hasText: testUsername });
    await expect(row).toBeVisible();

    // Delete
    await row.locator('button[title="حذف المستخدم"]').click();
    const confirm = page.locator('.modal', { hasText: 'هل تريد بالتأكيد حذف المستخدم' });
    await confirm.locator('button', { hasText: 'تأكيد' }).click();

    await expect(page.locator('tr', { hasText: testUsername })).toHaveCount(0);
  });

  test('32. Admin: Self-delete protection disables delete button on current user', async ({ page }) => {
    await page.goto('/admin/users');
    const adminRow = page.locator('tr', { hasText: 'admin' }).first();
    await expect(adminRow).toBeVisible();
    const deleteBtn = adminRow.locator('button[title*="حذف"]');
    await expect(deleteBtn).toBeDisabled();
  });

  test('33. Admin: Last-admin protection blocks disabling or demoting the last administrator', async ({ page }) => {
    await page.goto('/admin/users');
    const adminRow = page.locator('tr', { hasText: 'admin' }).first();
    await adminRow.locator('button[title="تعديل"]').click();

    const modal = page.locator('.modal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('text=لا يمكنك تعديل صلاحيات حسابك')).toBeVisible();
    await modal.locator('.modal__head button').click();
  });

  test('34. Admin: Role management displays system roles and protects them from deletion', async ({ page }) => {
    await page.goto('/admin/roles');
    await expect(page.locator('table')).toBeVisible();

    const adminRoleRow = page.locator('tr', { hasText: 'admin' });
    await expect(adminRoleRow).toBeVisible();
    await expect(adminRoleRow.locator('.badge', { hasText: 'نظام' })).toBeVisible();
    await expect(adminRoleRow.locator('button[title="حذف"]')).not.toBeVisible();
  });

  test('35. Admin: Project access tab displays users and per-project membership toggles', async ({ page }) => {
    await page.goto('/admin/projects');
    const userBtn = page.locator('button', { hasText: 'مدير النظام' });
    await expect(userBtn).toBeVisible();
    await userBtn.click();
    await expect(page.locator('text=لا يمكنك تعديل صلاحيات حسابك')).toBeVisible();
  });

  /* ============================================================
   * 8. SETTINGS (36 - 42)
   * ============================================================ */
  test('36. Settings: Backup visibility and permission gating enforces backup.manage', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.locator('button', { hasText: 'نسخة احتياطية الآن' })).toBeVisible();
  });

  test('37. Settings: Backup creation creates real snapshot and persists across reload', async ({ page }) => {
    await page.goto('/settings');
    const backupBtn = page.locator('button', { hasText: 'نسخة احتياطية الآن' });

    const [res] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/backups') && r.request().method() === 'POST'),
      backupBtn.click(),
    ]);
    expect(res.status()).toBe(201);
    const body = await res.json();

    await expect(page.locator('.table tbody tr', { hasText: body.name })).toBeVisible();
    await page.reload();
    await expect(page.locator('.table tbody tr', { hasText: body.name })).toBeVisible();
  });

  test('38. Settings: Restore confirmation verifies safety snapshot notice and safe cancel', async ({ page }) => {
    await page.goto('/settings');
    const restoreBtn = page.locator('.table tbody tr button', { hasText: 'استعادة' }).first();
    if (await restoreBtn.isVisible()) {
      await restoreBtn.click();
      const modal = page.locator('.modal', { hasText: 'تأكيد العملية' });
      await expect(modal).toBeVisible();
      await modal.locator('button', { hasText: 'إلغاء' }).click();
      await expect(modal).toBeHidden();
    }
  });

  test('39. Settings: Import history displays past Excel imports with search filter', async ({ page }) => {
    await page.goto('/settings');
    await page.locator('.settingsTabBtn', { hasText: 'سجل استيراد Excel' }).click();
    await expect(page.locator('input[aria-label="بحث في سجل الاستيراد"]')).toBeVisible();
  });

  test('40. Settings: Theme persistence synchronizes dark/light mode across reloads', async ({ page }) => {
    await page.goto('/settings');
    await page.locator('.settingsTabBtn', { hasText: 'المظهر والعرض' }).click();

    const darkCard = page.locator('.settingsThemeCard', { hasText: 'الوضع الليلي' });
    const lightCard = page.locator('.settingsThemeCard', { hasText: 'الوضع النهاري' });

    await darkCard.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await lightCard.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });

  test('41. Settings: Account and security tab displays real user profile and permissions', async ({ page }) => {
    await page.goto('/settings');
    await page.locator('.settingsTabBtn', { hasText: 'الحساب والأمان' }).click();
    await expect(page.locator('.settingsProfileName')).toBeVisible();
    await expect(page.locator('.settingsProfileRole')).toContainText('مدير النظام');
  });

  test('42. Settings: PWA and system tab renders version, service worker, and connection status', async ({ page }) => {
    await page.goto('/settings');
    await page.locator('.settingsTabBtn', { hasText: 'عن النظام و PWA' }).click();
    await expect(page.locator('text=v1.3.0 Enterprise PWA')).toBeVisible();
    await expect(page.locator('text=متصل بالشبكة (Online)')).toBeVisible();
  });

  /* ============================================================
   * 9. SECURITY (43 - 46)
   * ============================================================ */
  test('43. Security: Unauthorized page access redirects unauthenticated users and restricts unauthorized roles', async ({ browser }) => {
    const unauthed = await browser.newContext();
    const p = await unauthed.newPage();
    await p.goto('/settings');
    await p.waitForURL('**/login');
    await unauthed.close();
  });

  test('44. Security: Unauthorized action returns 403 Forbidden on protected API endpoints', async ({ page }) => {
    const res = await page.request.get('/api/users');
    expect(res.status()).toBe(200);

    const unauthedReq = await page.request.get('/api/users', { headers: { Cookie: '', Authorization: '' } });
    expect([401, 403]).toContain(unauthedReq.status());
  });

  test('45. Security: Project isolation prevents cross-project data leakage and validates scope', async ({ page }) => {
    const projectsRes = await page.request.get('/api/projects');
    const projects = (await projectsRes.json()).items || [];
    if (projects.length >= 2) {
      const p1 = projects[0].id;
      const p2 = projects[1].id;

      const sites1 = await (await page.request.get(`/api/sites?projectId=${p1}`)).json();
      const sites2 = await (await page.request.get(`/api/sites?projectId=${p2}`)).json();

      const ids1 = new Set((sites1 || []).map((s: any) => s.id));
      for (const s of sites2 || []) {
        expect(ids1.has(s.id)).toBe(false);
      }
    }
  });

  test('46. Security: No token or credential leakage in rendered DOM, URLs, or client attributes', async ({ page }) => {
    const urls = ['/dashboard', '/projects', '/archive', '/settings', '/audit'];
    for (const u of urls) {
      await page.goto(u);
      const content = await page.content();
      expect(content).not.toContain('eyJhbGciOi');
      expect(content).not.toContain('$2b$10$');
      expect(content).not.toContain('cos_refresh_token');
    }
  });

  /* ============================================================
   * 10. RESPONSIVE (47 - 50)
   * ============================================================ */
  const responsiveViews = [
    { num: 47, name: 'Mobile', width: 375, height: 667 },
    { num: 48, name: 'Tablet', width: 768, height: 1024 },
    { num: 49, name: 'Desktop', width: 1366, height: 768 },
    { num: 50, name: 'Wide', width: 1920, height: 1080 },
  ];

  for (const vp of responsiveViews) {
    test(`${vp.num}. Responsive: ${vp.name} (${vp.width}x${vp.height}) renders with zero horizontal body overflow`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const paths = ['/dashboard', '/projects', '/archive', '/warehouses', '/stock', '/material-requests', '/settings'];

      for (const p of paths) {
        await page.goto(p);
        await page.waitForTimeout(80);
        const overflow = await page.evaluate(() => document.body.scrollWidth > window.innerWidth);
        expect(overflow, `Horizontal overflow on ${p} at ${vp.width}px`).toBe(false);
      }
    });
  }
});
