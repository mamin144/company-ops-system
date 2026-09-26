import { test, expect } from '@playwright/test';

test.describe('Admin User Creation Workflow', () => {
  const testUsername = `testemp_${Date.now()}`;
  const testPassword = 'StrongPassword123!';

  test.beforeEach(async ({ page }) => {
    // 1. Login as admin
    await page.goto('/login');
    await page.fill('input[autoComplete="username"]', 'admin');
    await page.fill('input[autoComplete="current-password"]', 'admin123');
    await page.click('button.btn--primary');
    await page.waitForURL('**/dashboard');
    await page.goto('/admin/users');
  });

  test('Create a new employee account, login, and verify permissions', async ({ page, browser }) => {
    // 3. Click "مستخدم جديد"
    await page.locator('button', { hasText: 'مستخدم جديد' }).click();

    // 5. Fill form
    await page.getByLabel('الاسم الكامل').fill('موظف جديد');
    await page.getByLabel('اسم المستخدم (للدخول)').fill(testUsername);
    await page.getByLabel('كلمة المرور').fill(testPassword);
    
    // Choose viewer role
    await page.getByLabel('الدور').selectOption('viewer');

    // 6. Submit
    await page.locator('button', { hasText: 'إنشاء' }).click();

    // 7. Verify success toast
    await expect(page.locator('text=تم إنشاء المستخدم بنجاح')).toBeVisible();

    // 8. Verify the new user appears in the Users table
    const newUserRow = page.locator('tr', { hasText: testUsername });
    await expect(newUserRow).toBeVisible();

    // --- STEP 3: REAL AUTHENTICATION ---
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    
    // Go to login
    await page2.goto('/login');
    await page2.fill('input[autoComplete="username"]', testUsername);
    await page2.fill('input[autoComplete="current-password"]', testPassword);
    await page2.click('button.btn--primary');

    // Verify login succeeds and navigates to dashboard
    await page2.waitForURL('**/dashboard');
    
    // Verify user identity in sidebar
    await expect(page2.locator('.sidebarUser', { hasText: 'موظف جديد' })).toBeVisible();

    // --- STEP 4: REAL AUTHORIZATION ---
    await page2.goto('/archive');
    await expect(page2.locator('h1', { hasText: 'الأرشيف' })).toBeVisible();
    
    // Should NOT be able to access Admin (redirects to dashboard)
    await page2.goto('/admin');
    await page2.waitForURL('**/dashboard');
    await expect(page2.locator('h1', { hasText: 'لوحة التحكم' })).toBeVisible();
    
    await context2.close();
  });

  test('Create User form rejects missing name/username, duplicate username', async ({ page }) => {
    // Attempt duplicate username (assume the first test ran already or admin exists)
    await page.locator('button', { hasText: 'مستخدم جديد' }).click();
    
    // Wait for modal
    await expect(page.locator('.modal', { hasText: 'مستخدم جديد' }).first()).toBeVisible();
    
    // Missing fields should keep button disabled
    const submitBtn = page.locator('button', { hasText: 'إنشاء' });
    await expect(submitBtn).toBeDisabled();
    
    // Fill just the username
    await page.getByLabel('اسم المستخدم (للدخول)').fill('admin');
    await expect(submitBtn).toBeDisabled();

    // Fill all to enable button
    await page.getByLabel('الاسم الكامل').fill('Tester');
    await page.getByLabel('كلمة المرور').fill('123'); // weak password
    
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();
    
    // Expect conflict API response toast for duplicate username OR weak password (whichever hits first)
    // Zod validation runs first in API: password must be 6 chars
    await expect(page.locator('text=بيانات غير صالحة')).toBeVisible();

    // Fix password, but keep 'admin' duplicate username
    await page.getByLabel('كلمة المرور').fill('validPassword123');
    await submitBtn.click();
    
    // Expect duplicate username toast
    await expect(page.locator('text=اسم المستخدم موجود بالفعل')).toBeVisible();
  });
});
