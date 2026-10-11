import { test, expect } from '@playwright/test';

test.describe('Phase 9: Admin UI and Authorization', () => {
  // Seed credentials: admin / admin123
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[autoComplete="username"]', 'admin');
    await page.fill('input[autoComplete="current-password"]', 'admin123');
    await page.click('button.btn--primary');
    await page.waitForURL('**/dashboard');
  });

  test('Admin link is visible for admin and navigates to Admin shell', async ({ page }) => {
    const adminLink = page.locator('nav a', { hasText: 'الإدارة' });
    await expect(adminLink).toBeVisible();
    await adminLink.click();
    await page.waitForURL('**/admin/users');
    await expect(page.locator('.pageTitle')).toContainText('الإدارة');
  });

  test('Users tab lists users and enforces self-security', async ({ page }) => {
    await page.goto('/admin/users');
    await expect(page.locator('table')).toBeVisible();
    
    // Find the logged-in admin's own row and click Edit.
    // NOTE (test-only fix, Phase 5): a plain hasText:'admin' row locator also
    // matches user 'm.amin' (its role cell reads 'admin'), causing a strict-mode
    // violation. Scoping to the username cell (first column, exact match)
    // preserves the test's intent: editing self must show the self-security warning.
    const adminRow = page.locator('tbody tr').filter({
      has: page.locator('td').nth(0).getByText('admin', { exact: true }),
    });
    await adminRow.locator('button[title="تعديل"]').click();
    
    // Modal should open with self-security warning
    const modal = page.locator('.modal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('text=لا يمكنك تعديل صلاحيات حسابك')).toBeVisible();
  });

  test('Roles tab lists roles and blocks deleting system roles', async ({ page }) => {
    await page.goto('/admin/roles');
    await expect(page.locator('table')).toBeVisible();
    
    // Admin role should be marked as system (badge)
    const adminRoleRow = page.locator('tr', { hasText: 'admin' });
    await expect(adminRoleRow).toBeVisible();
    await expect(adminRoleRow.locator('.badge', { hasText: 'نظام' })).toBeVisible();
    // System roles should not have a delete button
    await expect(adminRoleRow.locator('button[title="حذف"]')).not.toBeVisible();
  });

  test('Project Access tab shows user list and self-security', async ({ page }) => {
    await page.goto('/admin/projects');
    
    // Should show user list
    const userBtn = page.locator('button', { hasText: 'مدير النظام' });
    await expect(userBtn).toBeVisible();
    await userBtn.click();
    
    // Self-security warning
    await expect(page.locator('text=لا يمكنك تعديل صلاحيات حسابك')).toBeVisible();
  });
});
