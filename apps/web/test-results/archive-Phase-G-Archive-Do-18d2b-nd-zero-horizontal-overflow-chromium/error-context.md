# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: archive.spec.ts >> Phase G: Archive & Documents Redesign Comprehensive Suite >> Mobile viewport (375x667): Folder drawer toggle works and zero horizontal overflow
- Location: tests\archive.spec.ts:95:3

# Error details

```
Error: expect(locator).toHaveClass(expected) failed

Locator: locator('.archiveSidebar')
Expected pattern: /open/
Received string:  "archiveSidebar  archiveSidebar--collapsed"
Timeout: 5000ms

Call log:
  - Expect "toHaveClass" locator('.archiveSidebar') with timeout 5000ms
  - waiting for locator('.archiveSidebar')
    14 × locator resolved to <aside aria-label="شجرة المجلدات" class="archiveSidebar  archiveSidebar--collapsed">…</aside>
       - unexpected value "archiveSidebar  archiveSidebar--collapsed"

```

```yaml
- complementary "شجرة المجلدات":
  - heading "المجلدات" [level=2]
  - button "إغلاق لوحة المجلدات": ✕
  - tree "شجرة مجلدات الأرشيف"
```

# Test source

```ts
  7   |     await page.fill('input[autoComplete=current-password]', 'admin123');
  8   |     await page.click('button.btn--primary');
  9   |     await page.waitForURL('**/dashboard');
  10  |   });
  11  | 
  12  |   test('Archive page loads two-pane workspace, folder tree, and document list', async ({ page }) => {
  13  |     await page.goto('/archive');
  14  |     await page.waitForLoadState('networkidle');
  15  | 
  16  |     await expect(page.locator('.archiveWorkspace')).toBeVisible();
  17  |     await expect(page.locator('.archiveSidebar')).toBeVisible();
  18  |     await expect(page.locator('.archiveMain')).toBeVisible();
  19  | 
  20  |     await expect(page.locator('h1')).toContainText('الأرشيف والمستندات');
  21  |     await expect(page.locator('.heroChip')).toBeVisible();
  22  |     await expect(page.locator('.folderTreeNode', { hasText: 'كل المستندات' })).toBeVisible();
  23  |   });
  24  | 
  25  |   test('Folder Tree allows selecting a folder and creating a new folder', async ({ page }) => {
  26  |     await page.goto('/archive');
  27  |     await page.waitForLoadState('networkidle');
  28  | 
  29  |     const allDocsFolder = page.locator('.folderTreeNode', { hasText: 'كل المستندات' });
  30  |     await allDocsFolder.click();
  31  |     await expect(allDocsFolder).toHaveClass(/active/);
  32  | 
  33  |     await page.click('button[aria-label="إضافة مجلد جديد"]');
  34  |     const folderModal = page.locator('.modal', { hasText: 'إضافة مجلد جديد' });
  35  |     await expect(folderModal).toBeVisible();
  36  | 
  37  |     const uniqueFolderName = `مجلد اختبار ${Date.now()}`;
  38  |     await folderModal.locator('input').fill(uniqueFolderName);
  39  |     await folderModal.locator('button[type="submit"]').click();
  40  | 
  41  |     await expect(folderModal).toBeHidden();
  42  |     await expect(page.locator('.folderTreeNode', { hasText: uniqueFolderName })).toBeVisible();
  43  | 
  44  |     await page.click(`.folderTreeNode:has-text("${uniqueFolderName}")`);
  45  |     await expect(page.locator(`.folderTreeNode:has-text("${uniqueFolderName}")`)).toHaveClass(/active/);
  46  |   });
  47  | 
  48  |   test('Search and filter toolbar functions correctly', async ({ page }) => {
  49  |     await page.goto('/archive');
  50  |     await page.waitForLoadState('networkidle');
  51  | 
  52  |     const searchInput = page.locator('.archiveToolbar input[placeholder*="بحث"]');
  53  |     await expect(searchInput).toBeVisible();
  54  |     await searchInput.fill('عقد');
  55  |     await page.waitForTimeout(300);
  56  | 
  57  |     const clearBtn = page.locator('.archiveToolbar button', { hasText: 'مسح الفلاتر' });
  58  |     await expect(clearBtn).toBeVisible();
  59  |     await clearBtn.click();
  60  |     await expect(searchInput).toHaveValue('');
  61  |   });
  62  | 
  63  |   test('Batch document selection displays floating batch bar and allows clear selection', async ({ page }) => {
  64  |     await page.goto('/archive');
  65  |     await page.waitForLoadState('networkidle');
  66  | 
  67  |     const firstCheckbox = page.locator('.archiveTableDesktop tbody input[type="checkbox"]').first();
  68  |     if (await firstCheckbox.isVisible()) {
  69  |       await firstCheckbox.check();
  70  | 
  71  |       const batchBar = page.locator('.archiveBatchBar');
  72  |       await expect(batchBar).toBeVisible();
  73  |       await expect(batchBar.locator('.archiveBatchBar__count')).toContainText('تم تحديد');
  74  | 
  75  |       await batchBar.locator('button', { hasText: 'إلغاء التحديد' }).click();
  76  |       await expect(batchBar).toBeHidden();
  77  |     }
  78  |   });
  79  | 
  80  |   test('Document Revisions modal opens and displays revision history', async ({ page }) => {
  81  |     await page.goto('/archive');
  82  |     await page.waitForLoadState('networkidle');
  83  | 
  84  |     const revisionBtn = page.locator('.archiveTableDesktop button.linkBtn.num').first();
  85  |     if (await revisionBtn.isVisible()) {
  86  |       await revisionBtn.click();
  87  |       const modal = page.locator('.modal', { hasText: 'إصدارات المستند' });
  88  |       await expect(modal).toBeVisible();
  89  | 
  90  |       await page.click('.modal .modal__head button');
  91  |       await expect(modal).toBeHidden();
  92  |     }
  93  |   });
  94  | 
  95  |   test('Mobile viewport (375x667): Folder drawer toggle works and zero horizontal overflow', async ({ page }) => {
  96  |     await page.setViewportSize({ width: 375, height: 667 });
  97  |     await page.goto('/archive');
  98  |     await page.waitForLoadState('networkidle');
  99  | 
  100 |     const hasOverflow = await page.evaluate(() => document.body.scrollWidth > window.innerWidth);
  101 |     expect(hasOverflow).toBe(false);
  102 | 
  103 |     const toggleBtn = page.locator('.archiveFolderToggle');
  104 |     await expect(toggleBtn).toBeVisible();
  105 |     await toggleBtn.click();
  106 | 
> 107 |     await expect(page.locator('.archiveSidebar')).toHaveClass(/open/);
      |                                                   ^ Error: expect(locator).toHaveClass(expected) failed
  108 | 
  109 |     await page.click('.archiveBackdrop.open');
  110 |     await expect(page.locator('.archiveSidebar')).not.toHaveClass(/open/);
  111 |   });
  112 | 
  113 |  test('Tablet viewport (768x1024): Clean responsive layout with zero horizontal overflow', async ({ page }) => {
  114 |  await page.setViewportSize({ width: 768, height: 1024 });
  115 |  await page.goto('/archive');
  116 |  await page.waitForLoadState('networkidle');
  117 | 
  118 |  const hasOverflow = await page.evaluate(() => document.body.scrollWidth > window.innerWidth);
  119 |  expect(hasOverflow).toBe(false);
  120 | 
  121 |  await expect(page.locator('.archiveWorkspace')).toBeVisible();
  122 |  });
  123 | 
  124 |  test('Desktop (1366x768) and Wide (1920x1080): Two-pane split view renders with zero horizontal overflow', async ({ page }) => {
  125 |  for (const size of [{ width: 1366, height: 768 }, { width: 1920, height: 1080 }]) {
  126 |  await page.setViewportSize(size);
  127 |  await page.goto('/archive');
  128 |  await page.waitForLoadState('networkidle');
  129 | 
  130 |  const hasOverflow = await page.evaluate(() => document.body.scrollWidth > window.innerWidth);
  131 |  expect(hasOverflow).toBe(false);
  132 | 
  133 |  await expect(page.locator('.archiveSidebar')).toBeVisible();
  134 |  await expect(page.locator('.archiveMain')).toBeVisible();
  135 |  }
  136 |  });
  137 | });
  138 | 
```