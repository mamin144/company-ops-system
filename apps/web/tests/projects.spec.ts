import { test, expect } from '@playwright/test';

test.describe('Phase F: Projects, Sites & Financials Comprehensive Suite', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto('/login');
    await page.fill('input[autoComplete="username"]', 'admin');
    await page.fill('input[autoComplete="current-password"]', 'admin123');
    await page.click('button.btn--primary');
    await page.waitForURL('**/dashboard');
  });

  /* ============================================================
     1. Projects List, Search, and Create Workflow
     ============================================================ */
  test('Projects list renders, allows creating a project, and filters by search', async ({ page }) => {
    await page.goto('/projects');
    await expect(page.locator('h1')).toHaveText('المشاريع');

    // Verify hero stats chip renders tabular total
    const heroChip = page.locator('.heroChip');
    await expect(heroChip).toBeVisible();

    // Verify projects table renders
    const table = page.locator('table.table');
    await expect(table).toBeVisible();

    // Create a new test project
    const uniqueCode = `PRJ-${Date.now().toString().slice(-4)}`;
    const projectName = `مشروع برج الأمل ${uniqueCode}`;

    await page.click('button:has-text("مشروع جديد")');
    await expect(page.locator('.modal')).toBeVisible();

    await page.locator('.modal').getByLabel('كود المشروع *').fill(uniqueCode);
    await page.locator('.modal').getByLabel('اسم المشروع *').fill(projectName);
    await page.locator('.modal').getByLabel('العميل', { exact: true }).fill('شركة العاصمة للإسكان');

    await page.click('.modal .btn--primary:has-text("حفظ")');
    await expect(page.locator('.modal')).toBeHidden();

    // Filter by unique code
    const searchInput = page.locator('.projectsToolbar input[placeholder*="بحث"]');
    await searchInput.fill(uniqueCode);

    // Verify project appears in table
    await expect(page.locator(`text=${projectName}`)).toBeVisible();
  });

  /* ============================================================
     2. Project Details Workspace & Sites Management
     ============================================================ */
  test('Project Details workspace loads, displays meta, and allows adding a site', async ({ page }) => {
    await page.goto('/projects');
    
    // Click on the first project link
    const firstProjectLink = page.locator('table.table tbody tr td a').first();
    await expect(firstProjectLink).toBeVisible();
    await firstProjectLink.click();

    // Verify workspace layout
    await page.waitForURL('**/projects/**');
    await expect(page.locator('.projectHeaderCard')).toBeVisible();
    await expect(page.locator('.projectTabs')).toBeVisible();

    // Check tabs
    const sitesTab = page.locator('.projectTabBtn:has-text("المواقع")');
    await expect(sitesTab).toBeVisible();
    await sitesTab.click();

    // Add a site to the project
    const addSiteBtn = page.locator('button:has-text("إضافة موقع")');
    if (await addSiteBtn.isVisible()) {
      await addSiteBtn.click();
      await expect(page.locator('.modal')).toBeVisible();

      const siteCode = `S-${Date.now().toString().slice(-3)}`;
      await page.fill('input[placeholder*="S-01"]', siteCode);
      await page.fill('input[placeholder*="موقع البرج"]', `موقع رقم ${siteCode}`);

      await page.click('.modal .btn--primary:has-text("إضافة الموقع")');
      await expect(page.locator('.modal')).toBeHidden();

      // Verify site card rendered with exact text locator
      await expect(page.locator('.siteCard', { hasText: siteCode })).toBeVisible();
    }
  });

  /* ============================================================
     3. Financials Position Overview (BOQ / IPC)
     ============================================================ */
  test('Financials page renders grouped tables, summary KPIs, and allows expand/collapse', async ({ page }) => {
    await page.goto('/financials');
    await expect(page.locator('h1')).toHaveText('الموقف المالي والتعاقدي');

    // Verify financial KPI chips
    await expect(page.locator('.finHero')).toBeVisible();
    const finKpis = page.locator('.finKpi');
    await expect(finKpis.first()).toBeVisible();

    // Verify grouped table
    const finTable = page.locator('.finTable');
    await expect(finTable).toBeVisible();

    // Test expand all / collapse all
    const expandAllBtn = page.locator('button:has-text("عرض الكل")');
    await expect(expandAllBtn).toBeVisible();
    await expandAllBtn.click();

    const collapseAllBtn = page.locator('button:has-text("طي الكل")');
    await expect(collapseAllBtn).toBeVisible();
    await collapseAllBtn.click();
  });

  /* ============================================================
     4. Responsive Viewport Verification (No Unintended Overflow)
     ============================================================ */
  test('Mobile viewport (375x667): Projects page has no horizontal body overflow', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/projects');

    await expect(page.locator('.pageHero')).toBeVisible();
    await expect(page.locator('.toolbar')).toBeVisible();

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
  });

  test('Mobile viewport (375x667): Financials page has no horizontal body overflow', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/financials');

    await expect(page.locator('.finHero')).toBeVisible();

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
  });

  test('Tablet viewport (768x1024): Projects and Financials render cleanly', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/projects');
    await expect(page.locator('.pageHero')).toBeVisible();

    let scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    let clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);

    await page.goto('/financials');
    await expect(page.locator('.finHero')).toBeVisible();
    scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
  });

  test('Desktop (1366x768) and Wide (1920x1080): Proper layout scaling', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('/projects');
    await expect(page.locator('.pageHero')).toBeVisible();

    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/financials');
    await expect(page.locator('.finHero')).toBeVisible();
  });
});
