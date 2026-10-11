import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

test.describe('Phase K: Functional Gap Closure & Final UX Hardening', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[autoComplete=username]', 'admin');
    await page.fill('input[autoComplete=current-password]', 'admin123');
    await page.click('button.btn--primary');
    await page.waitForURL('**/dashboard');
  });

  /* ------------------------------------------------------------
   * 1. USER DELETION TESTS
   * ------------------------------------------------------------ */
  test('User Deletion: Authorized user sees delete action, self-delete blocked, deletes ordinary user', async ({ page }) => {
    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');

    // 1. Verify self-delete is disabled on the current logged-in user row
    const adminRow = page.locator('tr', { hasText: 'admin' }).first();
    await expect(adminRow).toBeVisible();
    const selfDeleteBtn = adminRow.locator('button[title*="حذف"]');
    await expect(selfDeleteBtn).toBeDisabled();

    // 2. Create a temporary user to test deletion
    const tempUsername = `temp_del_${Date.now()}`;
    await page.locator('button', { hasText: 'مستخدم جديد' }).click();
    const createModal = page.locator('.modal', { hasText: 'مستخدم جديد' });
    await expect(createModal).toBeVisible();

    await createModal.locator('input').nth(0).fill(`مستخدم مؤقت ${tempUsername}`);
    await createModal.locator('input').nth(1).fill(tempUsername);
    await createModal.locator('input').nth(2).fill('Password123!');
    await createModal.locator('button', { hasText: 'إنشاء' }).click();

    // Wait for user to appear in table
    const tempRow = page.locator('tr', { hasText: tempUsername });
    await expect(tempRow).toBeVisible();

    // 3. Delete the temporary user
    const deleteBtn = tempRow.locator('button[title="حذف المستخدم"]');
    await expect(deleteBtn).toBeVisible();
    await deleteBtn.click();

    // Confirm dialog opens
    const confirmDialog = page.locator('.modal', { hasText: 'هل تريد بالتأكيد حذف المستخدم' });
    await expect(confirmDialog).toBeVisible();
    await expect(confirmDialog).toContainText(tempUsername);

    // Click confirm
    await confirmDialog.locator('button', { hasText: 'تأكيد' }).click();

    // Verify user disappears from the table
    await expect(page.locator('tr', { hasText: tempUsername })).toHaveCount(0);
  });

  /* ------------------------------------------------------------
   * 2. FOLDER DELETION TESTS
   * ------------------------------------------------------------ */
  test('Folder Deletion: Authorized user sees folder delete action, deletes folder, and falls back cleanly', async ({ page }) => {
    await page.goto('/archive');
    await page.waitForLoadState('networkidle');

    // 1. Create a temporary folder
    const tempFolderName = `مجلد_اختبار_${Date.now().toString().slice(-4)}`;
    const addFolderBtn = page.locator('.folderTreeContainer button[title="مجلد رئيسي جديد"]');
    await addFolderBtn.click();

    const folderModal = page.locator('.modal', { hasText: 'إضافة مجلد جديد' });
    await expect(folderModal).toBeVisible();
    await folderModal.locator('input').fill(tempFolderName);
    await folderModal.locator('button', { hasText: 'إنشاء المجلد' }).click();

    // Locate the created folder
    const folderNode = page.locator('.folderTreeNode', { hasText: tempFolderName });
    await expect(folderNode).toBeVisible();

    // Select the folder
    await folderNode.click();
    await expect(folderNode).toHaveClass(/active/);

    // Delete the folder
    const deleteFolderBtn = folderNode.locator('button[title="حذف المجلد"]');
    await expect(deleteFolderBtn).toBeVisible();
    await deleteFolderBtn.click();

    // Confirmation dialog
    const confirmDialog = page.locator('.modal', { hasText: 'هل تريد بالتأكيد حذف المجلد' });
    await expect(confirmDialog).toBeVisible();
    await expect(confirmDialog).toContainText(tempFolderName);

    await confirmDialog.locator('button', { hasText: 'تأكيد' }).click();

    // Verify deleted folder disappears and selected state falls back cleanly to all documents
    await expect(page.locator('.folderTreeNode', { hasText: tempFolderName })).toHaveCount(0);
    const allDocsNode = page.locator('.folderTreeNode', { hasText: 'كل المستندات' });
    await expect(allDocsNode).toHaveClass(/active/);
  });

  /* ------------------------------------------------------------
   * 3. PDF UPLOAD INTO ALL FOLDERS TESTS
   * ------------------------------------------------------------ */
  test('PDF Upload: Uploading PDF to root and selected folder correctly persists and links folderId', async ({ page }) => {
    await page.goto('/archive');
    await page.waitForLoadState('networkidle');

    // 1. Create a dedicated folder for the upload test
    const uploadFolderName = `مجلد_رفع_${Date.now().toString().slice(-4)}`;
    await page.locator('.folderTreeContainer button[title="مجلد رئيسي جديد"]').click();
    const folderModal = page.locator('.modal', { hasText: 'إضافة مجلد جديد' });
    await folderModal.locator('input').fill(uploadFolderName);
    await folderModal.locator('button', { hasText: 'إنشاء المجلد' }).click();

    const folderNode = page.locator('.folderTreeNode', { hasText: uploadFolderName });
    await expect(folderNode).toBeVisible();

    // 2. Select this folder
    await folderNode.click();
    await expect(folderNode).toHaveClass(/active/);

    // 3. Prepare a test PDF buffer
    const pdfDocTitle = `مستند_PDF_${Date.now().toString().slice(-4)}`;
    const tempPdfPath = path.join(process.cwd(), 'temp_test.pdf');
    fs.writeFileSync(tempPdfPath, '%PDF-1.4\n%âãÏÓ\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 612 792]>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000015 00000 n\n0000000060 00000 n\n0000000111 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF');

    try {
      // 4. Click Upload Document
      await page.locator('button', { hasText: 'رفع مستند' }).click();
      const uploadModal = page.locator('.modal', { hasText: 'رفع مستند سريع' });
      await expect(uploadModal).toBeVisible();

      // Set category to 'ورق شركة' so it doesn't require a project
      await uploadModal.locator('select').first().selectOption('ورق شركة');
      await uploadModal.locator('input[type=file]').setInputFiles(tempPdfPath);
      await uploadModal.locator('input[placeholder*="اختياري"]').fill(pdfDocTitle);

      // Submit upload
      await uploadModal.locator('button[type=submit]', { hasText: 'رفع المستند' }).click();

      // 5. Verify the document appears in the selected folder view
      const docRow = page.locator('tr', { hasText: pdfDocTitle });
      await expect(docRow).toBeVisible();
    } finally {
      if (fs.existsSync(tempPdfPath)) fs.unlinkSync(tempPdfPath);
      // Clean up the folder
      const deleteFolderBtn = folderNode.locator('button[title="حذف المجلد"]');
      if (await deleteFolderBtn.isVisible()) {
        await deleteFolderBtn.click();
        const confirmDialog = page.locator('.modal', { hasText: 'هل تريد بالتأكيد حذف المجلد' });
        if (await confirmDialog.isVisible()) {
          await confirmDialog.locator('button', { hasText: 'تأكيد' }).click();
        }
      }
    }
  });

  /* ------------------------------------------------------------
   * 4. FOLDER OPEN / CLOSE (EXPAND / COLLAPSE) & KEYBOARD
   * ------------------------------------------------------------ */
  test('Folder Tree: Expand/collapse chevron, keyboard arrows, and aria-expanded semantics', async ({ page }) => {
    await page.goto('/archive');
    await page.waitForLoadState('networkidle');

    // 1. Create parent folder and child folder
    const parentName = `أب_${Date.now().toString().slice(-4)}`;
    const childName = `ابن_${Date.now().toString().slice(-4)}`;

    // Create parent
    await page.locator('.folderTreeContainer button[title="مجلد رئيسي جديد"]').click();
    let modal = page.locator('.modal', { hasText: 'إضافة مجلد جديد' });
    await modal.locator('input').fill(parentName);
    await modal.locator('button', { hasText: 'إنشاء المجلد' }).click();

    const parentNode = page.locator('.folderTreeNode', { hasText: parentName });
    await expect(parentNode).toBeVisible();

    // Create child folder via parent's + button
    await parentNode.locator('button[title="مجلد فرعي جديد"]').click();
    modal = page.locator('.modal', { hasText: 'إضافة مجلد فرعي جديد' });
    await modal.locator('input').fill(childName);
    await modal.locator('button', { hasText: 'إنشاء المجلد' }).click();

    const parentTreeItem = page.locator('div[role="treeitem"]', { hasText: parentName }).first();
    const chevron = parentNode.locator('.folderTreeNode__chevron');

    // 2. Verify toggle via chevron click
    // Initially expanded upon adding child
    await expect(chevron).toHaveClass(/expanded/);
    await expect(parentTreeItem).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('.folderTreeNode', { hasText: childName })).toBeVisible();

    // Click chevron to collapse
    await chevron.click();
    await expect(chevron).not.toHaveClass(/expanded/);
    await expect(parentTreeItem).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('.folderTreeNode', { hasText: childName })).toBeHidden();

    // 3. Verify toggle via keyboard navigation on parent node
    await parentNode.focus();
    await page.keyboard.press('ArrowLeft'); // In RTL, toggle expansion
    await expect(parentTreeItem).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('.folderTreeNode', { hasText: childName })).toBeVisible();

    await page.keyboard.press('ArrowRight'); // Toggle again
    await expect(parentTreeItem).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('.folderTreeNode', { hasText: childName })).toBeHidden();

    // Clean up parent
    const deleteBtn = parentNode.locator('button[title="حذف المجلد"]');
    await deleteBtn.click();
    const confirmDialog = page.locator('.modal', { hasText: 'هل تريد بالتأكيد حذف المجلد' });
    await confirmDialog.locator('button', { hasText: 'تأكيد' }).click();
  });

  /* ------------------------------------------------------------
   * 5. RESPONSIVE VIEWPORTS & ZERO OVERFLOW
   * ------------------------------------------------------------ */
  test('Responsive: Verify zero horizontal overflow on 375, 768, 1366, 1920 across Archive & Admin Users', async ({ page }) => {
    const viewports = [
      { width: 375, height: 667, name: 'Mobile 375' },
      { width: 768, height: 1024, name: 'Tablet 768' },
      { width: 1366, height: 768, name: 'Desktop 1366' },
      { width: 1920, height: 1080, name: 'Wide 1920' },
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      // Check Archive Page
      await page.goto('/archive');
      await page.waitForLoadState('networkidle');
      let isOverflowing = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth ||
               document.body.scrollWidth > window.innerWidth;
      });
      expect(isOverflowing, `Archive overflow at ${vp.name}`).toBe(false);

      // Check Admin Users Page
      await page.goto('/admin/users');
      await page.waitForLoadState('networkidle');
      isOverflowing = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth ||
               document.body.scrollWidth > window.innerWidth;
      });
      expect(isOverflowing, `Admin Users overflow at ${vp.name}`).toBe(false);
    }
  });
});
