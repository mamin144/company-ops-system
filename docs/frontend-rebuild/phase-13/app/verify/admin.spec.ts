import { test, expect } from '@playwright/test';

// Phase 3.3 admin/roles/access verification (kept). Temp output only; mock data only.
const loginAs = async (page: any, role: string) => {
  await page.goto('/login');
  await page.getByRole('radio', { name: role }).click();
  await page.getByRole('button', { name: /دخول تجريبي/ }).click();
  await page.locator('.shell').waitFor({ timeout: 10000 });
};
const openDetails = async (page: any, email: string) => {
  await page.locator('.recRow', { hasText: email }).getByRole('button', { name: 'التفاصيل' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
};
// Phase 3.12: disable/enable/reset/delete live in the row's accessible menu.
const rowMenuItem = async (page: any, email: string, item: string | RegExp) => {
  await page.locator('.recRow', { hasText: email }).getByRole('button', { name: 'المزيد' }).click();
  await page.getByRole('menu').getByRole('menuitem', { name: item }).click();
};

test.beforeEach(async ({ page }) => {
  await loginAs(page, 'مدير (تجريبي)');
  await page.goto('/admin');
});

test('list, search, filter, sort', async ({ page }) => {
  await expect(page.getByText('layla.hassan@example.org').first()).toBeVisible({ timeout: 8000 });
  await page.getByLabel('بحث بالاسم أو البريد أو القسم').fill('سارة');
  await expect(page.getByText('layla.hassan@example.org')).toHaveCount(0);
  await expect(page.getByText('sara.mahmoud@example.org').first()).toBeVisible();
  await page.getByRole('button', { name: 'مسح الفلاتر' }).click();
  await page.getByLabel('الدور').selectOption('warehouse');
  await expect(page.getByText('karim.adel@example.org')).toHaveCount(0);
  await expect(page.getByText('omar.farouk@example.org').first()).toBeVisible();
  await page.getByLabel('الدور').selectOption('');
  await expect(page.getByText('layla.hassan@example.org').first()).toBeVisible();
  await page.getByLabel('ترتيب').selectOption('email');
  await expect(page.locator('.recRow').first().getByText('dina.khaled@example.org')).toBeVisible();
});

test('account lifecycle: create (non-mycompany) -> edit -> disable -> enable -> delete, with validation', async ({ page }) => {
  await page.getByRole('button', { name: '+ مستخدم جديد' }).click();
  const modal = page.getByRole('dialog');
  await modal.getByLabel('الاسم *').fill('مستخدم اختبار');
  await modal.getByLabel('البريد الإلكتروني', { exact: true }).fill('not-an-email');
  /* Phase 10.1 (GAP-01): the accepted Phase 9 anatomy is a LIVE field error
     while typing (span.err[role=alert]) plus a save button that stays
     disabled until the form is valid — there is no submit-on-invalid path,
     so the old click+errBox assertion timed out on a disabled button. */
  await expect(modal.getByText('صيغة البريد غير صالحة')).toBeVisible();
  await expect(modal.getByRole('button', { name: 'حفظ التعديلات' })).toBeDisabled();
  // valid-format email → save enables, then the duplicate-email validator mirror fires
  const email = modal.getByLabel('البريد الإلكتروني', { exact: true });
  await email.fill('layla.hassan@example.org');
  await expect(modal.getByRole('button', { name: 'حفظ التعديلات' })).toBeEnabled();
  await modal.getByRole('button', { name: 'حفظ التعديلات' }).click();
  await expect(modal.locator('.errBox')).toContainText('مسجل بالفعل');
  await email.fill('test.user@example.org');
  await modal.getByLabel('الدور *').selectOption('viewer');
  await modal.getByRole('button', { name: 'حفظ التعديلات' }).click();
  await expect(modal).toBeHidden();
  await expect(page.getByText('test.user@example.org').first()).toBeVisible();
  // edit
  await page.locator('.recRow', { hasText: 'test.user@example.org' }).getByRole('button', { name: 'تعديل المستخدم' }).click();
  const editModal = page.getByRole('dialog');
  await editModal.getByLabel('المسمى الوظيفي').fill('مختبر قبول');
  await editModal.getByRole('button', { name: 'حفظ التعديلات' }).click();
  await expect(editModal).toBeHidden();
  await expect(page.locator('.recRow', { hasText: 'test.user@example.org' }).getByText('مختبر قبول')).toBeVisible();
  // disable -> enable
  await rowMenuItem(page, 'test.user@example.org', 'تعطيل الحساب');
  await page.getByRole('button', { name: 'تأكيد' }).click();
  await expect(page.locator('.recRow', { hasText: 'test.user@example.org' }).getByText('معطل')).toBeVisible();
  await rowMenuItem(page, 'test.user@example.org', 'تفعيل الحساب');
  await page.getByRole('button', { name: 'تأكيد' }).click();
  await expect(page.locator('.recRow', { hasText: 'test.user@example.org' }).getByText('نشط')).toBeVisible();
  // delete
  await rowMenuItem(page, 'test.user@example.org', 'حذف الحساب');
  await page.getByRole('button', { name: 'تأكيد' }).click();
  await expect(page.getByText('test.user@example.org')).toHaveCount(0);
});

test('password reset is simulated, shows target email, sends nothing', async ({ page }) => {
  await rowMenuItem(page, 'sara.mahmoud@example.org', 'إعادة تعيين كلمة المرور');
  const modal = page.getByRole('dialog');
  await expect(modal.getByText('sara.mahmoud@example.org')).toBeVisible();
  await modal.getByRole('button', { name: 'تأكيد' }).click();
  await expect(page.locator('.toast--success')).toContainText('لم يُرسل بريد حقيقي');
});

test('role change recomputes effective rights; GRANT/DENY/INHERIT + DENY precedence + removal', async ({ page }) => {
  // seeded evidence: mu-2 has warehouse.edit=DENY (base GRANT) and reports.view=GRANT (base none)
  await openDetails(page, 'omar.farouk@example.org');
  let modal = page.getByRole('dialog');
  await expect(modal.getByTestId('perm-warehouse.edit').getByText('(منع صريح)', { exact: true })).toBeVisible();
  await expect(modal.getByTestId('perm-warehouse.edit').getByText('معطل')).toBeVisible();
  await expect(modal.getByTestId('perm-reports.view').getByText('(منح صريح)', { exact: true })).toBeVisible();
  await expect(modal.getByTestId('perm-reports.view').getByText('نشط')).toBeVisible();
  // remove the GRANT -> back to inheritance (not granted)
  await modal.getByTestId('override-reports.view').selectOption('INHERIT');
  await modal.getByRole('button', { name: 'حفظ التعديلات' }).click();
  await expect(modal).toBeHidden();
  await openDetails(page, 'omar.farouk@example.org');
  modal = page.getByRole('dialog');
  await expect(modal.getByTestId('perm-reports.view').getByText('غير ممنوحة')).toBeVisible();
  await modal.getByRole('button', { name: 'إغلاق', exact: true }).click();
  // role change: management -> viewer drops users.manage-relevant rights; check audit.view gone
  await page.locator('.recRow', { hasText: 'mona.samir@example.org' }).getByRole('button', { name: 'تعديل المستخدم' }).click();
  const editModal = page.getByRole('dialog');
  await editModal.getByLabel('الدور *').selectOption('viewer');
  await editModal.getByRole('button', { name: 'حفظ التعديلات' }).click();
  await openDetails(page, 'mona.samir@example.org');
  await expect(page.getByRole('dialog').getByTestId('perm-audit.view').getByText('غير ممنوحة')).toBeVisible();
});

test('project access change persists per-user; others isolated; summary updates', async ({ page }) => {
  await openDetails(page, 'karim.adel@example.org');
  const modal = page.getByRole('dialog');
  await modal.getByTestId('access-p1').selectOption('WRITE');
  await modal.getByRole('button', { name: 'حفظ التعديلات' }).click();
  await expect(modal).toBeHidden();
  await expect(page.locator('.recRow', { hasText: 'karim.adel@example.org' }).getByText('1 مشروع · تعديل')).toBeVisible();
  await openDetails(page, 'karim.adel@example.org');
  await expect(page.getByRole('dialog').getByTestId('access-p1')).toHaveValue('WRITE');
  await page.getByRole('dialog').getByRole('button', { name: 'إغلاق', exact: true }).click();
  // isolation: mona keeps READ on p1
  await openDetails(page, 'mona.samir@example.org');
  await expect(page.getByRole('dialog').getByTestId('access-p1')).toHaveValue('READ');
});

test('last-admin disable + self-denial blocked with reasons; data unchanged', async ({ page }) => {
  // Phase 3.12: the self disable action is disabled in the menu with an
  // explained reason (the last-admin mock-path refusal is covered through
  // the mock API in remediation-p1, since the UI no longer offers the trap)
  const selfRow = page.locator('.recRow', { hasText: 'layla.hassan@example.org' });
  await selfRow.getByRole('button', { name: 'المزيد' }).click();
  await expect(page.getByRole('menu').getByRole('menuitem', { name: /تعطيل الحساب/ })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(selfRow.getByText('غير متاح لحسابك الحالي')).toBeVisible();
  await expect(selfRow.getByText('نشط')).toBeVisible();
  // self-denial: DENY users.manage on own row
  await openDetails(page, 'layla.hassan@example.org');
  const modal = page.getByRole('dialog');
  await modal.getByTestId('override-users.manage').selectOption('DENY');
  await modal.getByRole('button', { name: 'حفظ التعديلات' }).click();
  await expect(modal.locator('.errBox')).toContainText('سحب صلاحية إدارتك بنفسك');
  await expect(modal).toBeVisible();
  // self still admin-capable: admin nav + users tab intact
  await expect(page.locator('.rail').getByRole('link', { name: 'الإدارة', exact: true })).toBeVisible();
});

test('non-admin sees no admin UI; keyboard; EN; console; overflow', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message.split('\n')[0]));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) errors.push(m.text().slice(0, 120)); });
  await page.getByRole('button', { name: 'خروج' }).click();
  await page.goto('/login');
  await page.getByRole('radio', { name: 'إدارة (تجريبي)' }).click();
  await page.getByRole('button', { name: /دخول تجريبي/ }).click();
  await page.locator('.shell').waitFor({ timeout: 10000 });
  // the admin destination itself must be absent (group captions may legitimately
  // remain when they still contain permitted entries such as audit/reports)
  await expect(page.locator('.rail').getByRole('link', { name: 'الإدارة', exact: true })).toHaveCount(0);
  await page.goto('/admin');
  await expect(page.getByText('لا صلاحية لديك')).toBeVisible();
  // back to admin for keyboard + EN checks
  await page.getByRole('button', { name: 'خروج' }).click();
  await page.goto('/login');
  await page.getByRole('radio', { name: 'مدير (تجريبي)' }).click();
  await page.getByRole('button', { name: /دخول تجريبي/ }).click();
  await page.goto('/admin');
  await page.getByRole('button', { name: '+ مستخدم جديد' }).click();
  const modal = page.getByRole('dialog');
  await expect(modal.locator('input').first()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(modal).toBeHidden();
  await expect(page.getByRole('button', { name: '+ مستخدم جديد' })).toBeFocused();
  // EN smoke on new strings
  await page.getByRole('button', { name: 'ع/EN' }).click();
  await expect(page.locator('html[dir="ltr"]')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Admin' })).toBeVisible();
  await expect(page.getByRole('button', { name: '+ New user' })).toBeVisible();
  await page.getByRole('button', { name: 'ع/EN' }).click();
  // overflow matrix on admin
  for (const w of [320, 375, 390, 430, 768, 1024, 1366, 1920]) {
    await page.setViewportSize({ width: w, height: 800 });
    await page.goto('/admin');
    const over = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(over, `overflow ${w}px`).toBe(false);
  }
  expect(errors).toHaveLength(0);
});
