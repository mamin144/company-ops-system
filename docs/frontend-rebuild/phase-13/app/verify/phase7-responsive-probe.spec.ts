import { test } from '@playwright/test';

// Phase 7 responsive spot-check: the three NEW dialogs (edit, revisions,
// delete confirm) must overflow-proof themselves at phone widths, and the
// console must stay clean — same technique as the regression zero-overflow
// matrix. Errors are fail-str and abort on the first offender.
const errors: string[] = [];
test('phase7 dialogs: no horizontal overflow at 375/390/768 + console', async ({ page }) => {
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/login');
  await page.getByRole('radio', { name: 'مدير (تجريبي)' }).click();
  await page.getByRole('button', { name: /دخول تجريبي/ }).click();
  await page.locator('.shell').waitFor({ timeout: 10000 });
  await page.goto('/archive');
  await page.locator('.recRow', { hasText: 'DOC-198' }).waitFor({ timeout: 8000 });

  const checkOverflow = async (label: string) => {
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (over > 0) errors.push(`${label}: horizontal overflow ${over}px`);
  };

  await checkOverflow('archive list @375');

  // edit modal @375 then @390
  await page.locator('.recRow', { hasText: 'DOC-198' }).getByRole('button', { name: 'المزيد' }).click();
  await page.getByRole('menu').getByRole('menuitem', { name: 'تعديل' }).click();
  await checkOverflow('edit modal @375');
  await page.setViewportSize({ width: 390, height: 844 });
  await checkOverflow('edit modal @390');
  await page.setViewportSize({ width: 768, height: 1024 });
  await checkOverflow('edit modal @768');
  await page.keyboard.press('Escape');

  // revisions modal @390
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.recRow', { hasText: 'DOC-220' }).getByRole('button', { name: /v03/ }).click();
  await page.getByRole('dialog').waitFor();
  await checkOverflow('revisions modal @390');
  await page.keyboard.press('Escape');

  // delete confirm @768
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.locator('.recRow', { hasText: 'DOC-198' }).getByRole('button', { name: 'المزيد' }).click();
  await page.getByRole('menu').getByRole('menuitem', { name: 'حذف' }).click();
  await page.getByRole('dialog').waitFor();
  await checkOverflow('delete confirm @768');

  if (errors.length > 0) {
    console.log('FAILURES:\n' + errors.join('\n'));
    throw new Error(`overflow/console failures: ${errors.length}`);
  }
  console.log('ALL_CLEAN');
});
