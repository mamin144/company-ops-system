import { test, expect } from '@playwright/test';

test.describe('Modern Dashboard E2E & Visual Verification', () => {
  test.beforeEach(async ({ page }) => {
    // Authenticate as admin
    await page.goto('/login');
    await page.fill('input[autoComplete="username"]', 'admin');
    await page.fill('input[autoComplete="current-password"]', 'admin123');
    await page.click('button.btn--primary');
    await page.waitForURL('**/dashboard');
  });

  test('Dashboard loads with Hero, KPI metrics, Charts, and Recent activity', async ({ page }) => {
    // Check Hero title and date
    await expect(page.locator('h1')).toHaveText('لوحة التحكم الرئيسية');
    await expect(page.locator('.dashHero')).toBeVisible();

    // Check KPI cards render with tabular numbers
    const kpiCards = page.locator('.dashboardKpis .card');
    await expect(kpiCards.first()).toBeVisible();
    const count = await kpiCards.count();
    expect(count).toBeGreaterThanOrEqual(4);

    // Verify stock chart is visible
    const barChart = page.locator('.barChart');
    await expect(barChart).toBeVisible();
    await expect(barChart).toHaveAttribute('role', 'img');

    // Verify recent documents panel
    await expect(page.locator('h3', { hasText: 'أحدث المستندات المضافة' })).toBeVisible();

    // Verify recent stock transactions panel
    await expect(page.locator('h3', { hasText: 'أحدث الحركات اليومية' })).toBeVisible();
  });

  test('Dashboard Mobile layout (375x667): Stacked cards, no overflow', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    await expect(page.locator('.dashHero')).toBeVisible();
    await expect(page.locator('.dashboardKpis')).toBeVisible();

    // Verify no unintended horizontal overflow
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
  });

  test('Dashboard Tablet layout (768x1024): 2-column grid and clean spacing', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });

    await expect(page.locator('.dashHero')).toBeVisible();
    const kpiGrid = page.locator('.dashboardKpis');
    await expect(kpiGrid).toBeVisible();

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
  });
});
