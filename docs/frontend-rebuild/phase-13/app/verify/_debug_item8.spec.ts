import { test, expect } from '@playwright/test';
const loginAs = async (page: any, idx: number) => {
  await page.goto('/login');
  await page.locator('.rolePick label').nth(idx).click();
  await page.getByRole('button', { name: /دخول تجريبي|Demo login/ }).click();
  await page.locator('.shell').waitFor({ timeout: 10000 });
};
test('debug: item8 replica', async ({ page }) => {
  await loginAs(page, 0);
  await page.goto('/projects');
  await page.locator('.cmdHead button', { hasText: 'المشاريع' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.locator('[aria-label="كود المشروع *"]').fill('PRJ-DBL');
  await dlg.locator('[aria-label="اسم المشروع *"]').fill('مشروع النقر المزدوج (تجريبي)');
  await expect(dlg.getByRole('button', { name: 'حفظ' })).toBeEnabled();
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('.formActions button')].find((x) => x.textContent?.trim() === 'حفظ') as HTMLButtonElement | undefined;
    if (!b || b.disabled) throw new Error('save button missing/disabled: found=' + !!b);
    b.click();
    b.click();
  });
  await page.waitForTimeout(800);
  console.log('modal count: ' + (await page.locator('.modal').count()));
  console.log('toasts: ' + JSON.stringify((await page.locator('.toast').allTextContents())));
  await page.locator('input[aria-label="بحث"]').fill('PRJ-DBL');
  await page.waitForTimeout(500);
  console.log('rows PRJ-DBL: ' + (await page.locator('.recRow', { hasText: 'PRJ-DBL' }).count()));
  await page.locator('input[aria-label="بحث"]').fill('');
  await page.waitForTimeout(500);
  console.log('all rows: ' + JSON.stringify((await page.locator('.recRow').allInnerTexts()).map(r => r.slice(0, 60))));
});
