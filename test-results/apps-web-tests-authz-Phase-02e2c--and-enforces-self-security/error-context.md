# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: apps\web\tests\authz.spec.ts >> Phase 9: Admin UI and Authorization >> Users tab lists users and enforces self-security
- Location: apps\web\tests\authz.spec.ts:22:3

# Error details

```
Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
Call log:
  - navigating to "/login", waiting until "load"

```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Phase 9: Admin UI and Authorization', () => {
  4  |   // We assume admin credentials from seed: admin / Secret123!
  5  |   
  6  |   test.beforeEach(async ({ page }) => {
> 7  |     await page.goto('/login');
     |                ^ Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
  8  |     await page.fill('input[type="text"]', 'admin');
  9  |     await page.fill('input[type="password"]', 'Secret123!');
  10 |     await page.click('button.btn--primary');
  11 |     await page.waitForURL('/dashboard');
  12 |   });
  13 | 
  14 |   test('Admin link is visible for admin and navigates to Admin shell', async ({ page }) => {
  15 |     const adminLink = page.locator('nav a', { hasText: 'الإدارة' });
  16 |     await expect(adminLink).toBeVisible();
  17 |     await adminLink.click();
  18 |     await page.waitForURL('/admin/users');
  19 |     await expect(page.locator('h1.pageTitle')).toHaveText('الإدارة');
  20 |   });
  21 | 
  22 |   test('Users tab lists users and enforces self-security', async ({ page }) => {
  23 |     await page.goto('/admin/users');
  24 |     await expect(page.locator('table')).toBeVisible();
  25 |     
  26 |     // Find the row for admin
  27 |     const adminRow = page.locator('tr', { hasText: 'admin' });
  28 |     await adminRow.locator('button[title="تعديل"]').click();
  29 |     
  30 |     const modal = page.locator('.modal');
  31 |     await expect(modal).toBeVisible();
  32 |     await expect(modal.locator('text=لا يمكنك تعديل صلاحيات حسابك')).toBeVisible();
  33 |     await expect(modal.locator('select').first()).toBeDisabled();
  34 |   });
  35 | 
  36 |   test('Roles tab lists roles and blocks deleting system roles', async ({ page }) => {
  37 |     await page.goto('/admin/roles');
  38 |     await expect(page.locator('table')).toBeVisible();
  39 |     
  40 |     const adminRoleRow = page.locator('tr', { hasText: 'admin' });
  41 |     await expect(adminRoleRow).toBeVisible();
  42 |     await expect(adminRoleRow.locator('text=نظام')).toBeVisible();
  43 |     await expect(adminRoleRow.locator('button[title="حذف"]')).not.toBeVisible();
  44 |   });
  45 | 
  46 |   test('Project Access tab allows selecting a user and displays bulk warning', async ({ page }) => {
  47 |     await page.goto('/admin/projects');
  48 |     
  49 |     // Click on the admin user button in the left pane
  50 |     const userBtn = page.locator('button', { hasText: 'admin' });
  51 |     await userBtn.click();
  52 |     
  53 |     // Expect self-security warning
  54 |     await expect(page.locator('text=لا يمكنك تعديل صلاحيات حسابك')).toBeVisible();
  55 |     
  56 |     // Bulk assign dropdown
  57 |     page.on('dialog', dialog => dialog.dismiss()); // auto dismiss the confirm
  58 |     await page.locator('select').first().selectOption('WRITE');
  59 |     
  60 |     // We expect the dialog was triggered (Playwright handles it automatically if we set up a listener)
  61 |   });
  62 | });
```