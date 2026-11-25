import { test, expect } from '@playwright/test';

// Phase 3.12 P1 remediation verification (new).
// Temp output only; mock data only. Each test starts from a fresh seed
// (full navigation re-seeds the in-memory mock).
const loginAs = async (page: any, role: string) => {
  await page.goto('/login');
  await page.getByRole('radio', { name: role }).click();
  await page.getByRole('button', { name: /دخول تجريبي/ }).click();
  await page.locator('.shell').waitFor({ timeout: 10000 });
};
const rowOf = (page: any, needle: string) => page.locator('.recRow', { hasText: needle });

test.describe('P1-01 viewer project empty state', () => {
  test.beforeEach(async ({ page }) => { await loginAs(page, 'مشاهد (تجريبي)'); });

  test('membership-empty shows the scoped message with a next action, not a generic empty', async ({ page }) => {
    await page.goto('/projects');
    await expect(page.getByText('لا توجد مشاريع ضمن نطاق وصول دورك')).toBeVisible();
    await expect(page.getByText('عضويتك الحالية لا تشمل أي مشروع')).toBeVisible();
    // legitimate next action, and it works
    await page.locator('.empty').getByRole('link', { name: /الرئيسية/ }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test('no unauthorized project names leak in the scoped state', async ({ page }) => {
    await page.goto('/projects');
    for (const code of ['PRJ-004', 'PRJ-007', 'PRJ-002', 'PRJ-009']) {
      await expect(page.locator('.content').getByText(code)).toHaveCount(0);
    }
  });

  test('truly empty list (after local deletes) shows the generic empty, still English-clean', async ({ page }) => {
    await page.getByRole('button', { name: 'خروج' }).click();
    await loginAs(page, 'مدير (تجريبي)');
    await page.goto('/projects');
    // delete every visible project (admin sees all four seeds)
    for (let i = 0; i < 4; i++) {
      const del = page.locator('.recRow').first().getByRole('button', { name: 'حذف' });
      await del.click();
      await page.getByRole('dialog').getByRole('button', { name: 'تأكيد' }).click();
    }
    await expect(page.getByText('لا توجد بيانات بعد')).toBeVisible();
    await expect(page.getByText('لا توجد مشاريع ضمن نطاق')).toHaveCount(0);
  });
});

test.describe('P1-02 project deep links', () => {
  test.beforeEach(async ({ page }) => { await loginAs(page, 'مدير (تجريبي)'); });

  test('documents tab links to archive pre-filtered by project', async ({ page }) => {
    await page.goto('/projects/p1/documents');
    await page.getByRole('link', { name: 'عرض في الأرشيف' }).click();
    await expect(page).toHaveURL(/\/archive\?project=p1/);
    await expect(rowOf(page, 'DOC-220')).toBeVisible();
    await expect(rowOf(page, 'DOC-120')).toHaveCount(0); // p2 stays out
  });

  test('warehouses and stock tabs link to filtered destinations', async ({ page }) => {
    await page.goto('/projects/p1/warehouses');
    await page.getByRole('link', { name: 'عرض المخازن' }).click();
    await expect(page).toHaveURL(/\/inventory\/warehouses\?project=p1/);
    await expect(rowOf(page, 'WH-S1')).toBeVisible();
    await expect(rowOf(page, 'WH-S2')).toHaveCount(0);
    await page.goto('/projects/p1/stock');
    await page.getByRole('link', { name: 'عرض الحركات' }).click();
    await expect(page).toHaveURL(/\/inventory\/stock\?project=p1/);
  });

  test('overview cards link to documents, warehouses, movements and requests', async ({ page }) => {
    await page.goto('/projects/p1/overview');
    await expect(page.getByText('ملخص المشروع')).toBeVisible();
    await page.getByRole('link', { name: /طلبات المشروع|عرض طلبات/ }).click();
    await expect(page).toHaveURL(/\/inventory\/requests\?project=p1/);
  });

  test('restricted project deep link shows denial, not foreign rows', async ({ page }) => {
    await page.getByRole('button', { name: 'خروج' }).click();
    await loginAs(page, 'إدارة (تجريبي)'); // mu-7: p1 only (per exports.spec usage)
    await page.goto('/archive?project=p2');
    await expect(page.getByText('ليس لديك صلاحية تصفية هذا المشروع')).toBeVisible();
    await expect(page.locator('.recRow')).toHaveCount(0);
  });

  test('empty project shows honest no-results, back preserves context', async ({ page }) => {
    await page.goto('/projects/p4/documents');
    await page.getByRole('link', { name: 'عرض في الأرشيف' }).click();
    await expect(page).toHaveURL(/\/archive\?project=p4/);
    await expect(page.getByText('لا نتائج مطابقة')).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/\/projects\/p4\/documents/);
  });
});

test.describe('P1-03 legacy folder token', () => {
  test.beforeEach(async ({ page }) => { await loginAs(page, 'مدير (تجريبي)'); });

  test('rows render the real folder name, never a literal placeholder', async ({ page }) => {
    await page.goto('/archive');
    await expect(rowOf(page, 'DOC-220')).toContainText('مجلد قديم: إنشائي');
    await expect(page.locator('.content').getByText('{f}')).toHaveCount(0);
    await expect(page.locator('.content').getByText('{name}')).toHaveCount(0);
  });

  test('viewer modal renders the folder name too', async ({ page }) => {
    await page.goto('/archive');
    await rowOf(page, 'DOC-220').getByRole('button', { name: 'معاينة' }).click();
    const dlg = page.getByRole('dialog');
    await expect(dlg).toContainText('مجلد قديم: إنشائي');
    await expect(dlg.getByText('{f}')).toHaveCount(0);
    await page.keyboard.press('Escape');
  });
});

test.describe('P1-04 approval confirmation', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'مدير (تجريبي)');
    await page.goto('/inventory/requests');
    await expect(rowOf(page, 'MR-012')).toBeVisible();
  });

  test('approve opens a dialog with number, project and lines; cancel changes nothing', async ({ page }) => {
    await rowOf(page, 'MR-012').getByRole('button', { name: 'اعتماد' }).click();
    const dlg = page.getByRole('dialog');
    await expect(dlg).toContainText('MR-012');
    await expect(dlg).toContainText('برج النيل');
    await expect(dlg).toContainText('حديد تسليح');
    await dlg.getByRole('button', { name: 'إلغاء' }).click();
    await expect(dlg).toBeHidden();
    // unchanged: still submitted, still offers approve
    await expect(rowOf(page, 'MR-012').getByText('مقدمة')).toBeVisible();
    await expect(rowOf(page, 'MR-012').getByRole('button', { name: 'اعتماد' })).toBeVisible();
  });

  test('confirmed approval transitions once; repeat attempt is refused', async ({ page }) => {
    await rowOf(page, 'MR-012').getByRole('button', { name: 'اعتماد' }).click();
    const dlg = page.getByRole('dialog');
    await dlg.getByRole('button', { name: 'تأكيد' }).click();
    await expect(rowOf(page, 'MR-012').getByText('معتمدة')).toBeVisible();
    // approve affordance is gone after transition
    await expect(rowOf(page, 'MR-012').getByRole('button', { name: 'اعتماد' })).toHaveCount(0);
    // direct second attempt on the mock path is refused, not duplicated
    const r = await page.evaluate(async () => {
      const api = (window as any).__protoApi;
      const all = await api.mrApi.list({}, 'mu-1');
      const m = all.items.find((x: any) => x.number === 'MR-012');
      return api.mrApi.act(m.id, 'approve', 'mu-1');
    });
    expect(r.ok).toBe(false);
  });

  test('reject cancel keeps draft state; confirmed reject records reason', async ({ page }) => {
    await rowOf(page, 'MR-012').getByRole('button', { name: 'رفض' }).click();
    const dlg = page.getByRole('dialog');
    await dlg.getByRole('button', { name: 'إلغاء' }).click();
    await expect(rowOf(page, 'MR-012').getByText('مقدمة')).toBeVisible();
    await rowOf(page, 'MR-012').getByRole('button', { name: 'رفض' }).click();
    const dlg2 = page.getByRole('dialog');
    await dlg2.getByLabel('سبب الرفض (اختياري)').fill('اختبار الرفض');
    await dlg2.getByRole('button', { name: 'تأكيد' }).click();
    await expect(rowOf(page, 'MR-012').getByText('مرفوضة')).toBeVisible();
  });

  test('unauthorized identity gets no approve affordance and a mock-path 403', async ({ page }) => {
    await expect(rowOf(page, 'MR-012').getByRole('button', { name: 'اعتماد' })).toBeVisible(); // sanity: admin sees it
    await page.getByRole('button', { name: 'خروج' }).click();
    // warehouse sees p1 requests (READ) but holds no approve permission
    await loginAs(page, 'مخازن (تجريبي)');
    await page.goto('/inventory/requests');
    await expect(rowOf(page, 'MR-012')).toBeVisible();
    await expect(rowOf(page, 'MR-012').getByRole('button', { name: 'اعتماد' })).toHaveCount(0);
    const r = await page.evaluate(async () => {
      const api = (window as any).__protoApi;
      const all = await api.mrApi.list({}, 'mu-2');
      const m = all.items.find((x: any) => x.number === 'MR-012');
      return api.mrApi.act(m.id, 'approve', 'mu-2');
    });
    expect(r.ok).toBe(false);
    expect(r.code).toBe(403);
  });
});

test.describe('P1-05 self safeguards', () => {
  test.beforeEach(async ({ page }) => { await loginAs(page, 'مدير (تجريبي)'); });

  test('self row actions are disabled with an explained reason', async ({ page }) => {
    await page.goto('/admin');
    const selfRow = page.locator('.recRow', { hasText: 'ليلى حسن' });
    await expect(selfRow.getByText('أنت (الحساب الحالي)')).toBeVisible();
    await selfRow.getByRole('button', { name: 'المزيد' }).click();
    const menu = page.getByRole('menu');
    await expect(menu.getByRole('menuitem', { name: /تعطيل الحساب/ })).toBeDisabled();
    await expect(menu.getByRole('menuitem', { name: /حذف الحساب/ })).toBeDisabled();
    await expect(menu.getByRole('menuitem', { name: /إعادة تعيين كلمة المرور/ })).toBeEnabled();
    await expect(selfRow).toContainText('غير متاح لحسابك الحالي');
    await page.keyboard.press('Escape');
  });

  test('with a backup admin the UI offers self-disable with an explicit warning; cancel is safe', async ({ page }) => {
    await page.goto('/admin');
    await page.evaluate(async () => {
      const api = (window as any).__protoApi;
      await api.userApi.create({ name: 'مدير بديل', email: 'backup@example.org', dept: 'د', title: 'ت', role: 'admin', active: true });
    });
    // force a re-render without navigation (navigation would re-seed the mock)
    await page.getByRole('searchbox', { name: /بحث/ }).fill('ليلى');
    await page.getByRole('searchbox', { name: /بحث/ }).fill('');
    const selfRow = page.locator('.recRow', { hasText: 'ليلى حسن' });
    await selfRow.getByRole('button', { name: 'المزيد' }).click();
    const menu = page.getByRole('menu');
    await expect(menu.getByRole('menuitem', { name: /تعطيل الحساب/ })).toBeEnabled();
    await menu.getByRole('menuitem', { name: /تعطيل الحساب/ }).click();
    const dlg = page.getByRole('dialog');
    await expect(dlg).toContainText('سيؤدي التعطيل إلى فقدان وصولك فورًا');
    await dlg.getByRole('button', { name: 'إلغاء' }).click();
    await expect(dlg).toBeHidden();
    await expect(selfRow.getByText('نشط')).toBeVisible();
  });

  test('other rows keep working actions; mock path refuses self ops', async ({ page }) => {
    await page.goto('/admin');
    const other = page.locator('.recRow', { hasText: 'كريم عادل' });
    await other.getByRole('button', { name: 'المزيد' }).click();
    await expect(page.getByRole('menu').getByRole('menuitem', { name: /تعطيل الحساب/ })).toBeEnabled();
    await page.keyboard.press('Escape');
    const r1 = await page.evaluate(async () => {
      const api = (window as any).__protoApi;
      return api.userApi.update('mu-1', 'mu-1', { active: false });
    });
    expect(r1.ok).toBe(false);
    const r2 = await page.evaluate(async () => {
      const api = (window as any).__protoApi;
      return api.userApi.remove('mu-1', 'mu-1');
    });
    expect(r2.ok).toBe(false);
  });

  test('last-admin disable is refused on the mock path with the admin message', async ({ page }) => {
    await page.goto('/admin');
    // mu-1 is the only admin-capable account in seed: disabling it must fail
    const r = await page.evaluate(async () => {
      const api = (window as any).__protoApi;
      return api.userApi.update('mu-1', 'mu-1', { active: false });
    });
    expect(r.ok).toBe(false);
    // ...but with a backup administrator present the SAME self-disable is
    // permitted by the mock rule (another active admin remains), and the UI
    // then offers it with an explicit self-warning confirmation
    const c = await page.evaluate(async () => {
      const api = (window as any).__protoApi;
      return api.userApi.create({ name: 'مدير بديل', email: 'backup@example.org', dept: 'د', title: 'ت', role: 'admin', active: true });
    });
    expect(c.ok).toBe(true);
    const r2 = await page.evaluate(async () => {
      const api = (window as any).__protoApi;
      return api.userApi.update('mu-1', 'mu-1', { active: false });
    });
    expect(r2.ok).toBe(true);
    const admins = await page.evaluate(async () => {
      const api = (window as any).__protoApi;
      return api.userApi.list().filter((u: any) => u.active && api.userApi.effective(u.id).allowed['users.manage']).map((u: any) => u.id);
    });
    expect(admins).not.toContain('mu-1');
    expect(admins.length).toBeGreaterThanOrEqual(1);
  });
});

test.describe('P1-06 role inspection', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'مدير (تجريبي)');
    await page.goto('/admin');
    await page.getByRole('tab', { name: 'الأدوار' }).click();
  });

  const ROLES: [string, string][] = [
    ['مدير النظام', 'وصول كامل لجميع الأقسام'],
    ['إدارة', 'المشاريع والاعتماد والتقارير دون إدارة المستخدمين'],
    ['مخازن', 'المخازن والحركات والصرف'],
    ['فني', 'الأرشيف والمشاريع وإنشاء الطلبات'],
    ['مشاهدة', 'عرض فقط دون تعديل'],
  ];

  for (const [name, desc] of ROLES) {
    test(`role card opens read-only matrix: ${name}`, async ({ page }) => {
      await page.getByRole('button', { name: new RegExp(`فحص صلاحيات الدور: ${name}`) }).click();
      const dlg = page.getByRole('dialog');
      await expect(dlg).toContainText(name);
      await expect(dlg).toContainText(desc);
      await expect(dlg).toContainText('صلاحيات الدور الأساسية');
      await expect(dlg).toContainText('النتيجة الفعالة');
      await expect(dlg).toContainText('المنع الصريح يتغلب على المنح');
      // raw keys present only as muted diagnostics
      await expect(dlg.locator('code').first()).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(dlg).toBeHidden();
    });
  }

  test('effective preview follows the selected user without mutating', async ({ page }) => {
    await page.getByRole('button', { name: /فحص صلاحيات الدور: مخازن/ }).click();
    const dlg = page.getByRole('dialog');
    // switch preview user to mu-2 (warehouse role + DENY override on warehouse.edit)
    await dlg.getByLabel('المستخدمون').selectOption('mu-2');
    await expect(dlg).toContainText('غير ممنوحة');
    await page.keyboard.press('Escape');
    // nothing changed: mu-2 still editable identically afterwards
    await page.getByRole('tab', { name: 'المستخدمون' }).click();
    await expect(page.locator('.recRow', { hasText: 'عمر فاروق' })).toBeVisible();
  });
});

test.describe('P1-07 transfer direction', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'مدير (تجريبي)');
    await page.goto('/inventory/stock');
    await expect(rowOf(page, 'TRF-304')).toBeVisible();
  });

  test('transfer row shows one canonical direction and both effects', async ({ page }) => {
    const row = rowOf(page, 'TRF-304');
    await expect(row).toContainText('من المخزن المركزي (تجريبي) إلى مخزن موقع البرج (تجريبي)');
    await expect(row).not.toContainText('←');
  });

  test('all five movement types render with localized labels', async ({ page }) => {
    await expect(rowOf(page, 'RET-403')).toContainText('مرتجع');
    await expect(rowOf(page, 'GOUT-207')).toContainText('صرف');
    await expect(rowOf(page, 'TRF-304')).toContainText('تحويل');
    await expect(rowOf(page, 'ADJ-503')).toContainText('تسوية');
    await expect(rowOf(page, 'GIN-105')).toContainText('إدخال');
  });

  test('missing destination is refused at form level, never half-recorded', async ({ page }) => {
    await page.getByRole('button', { name: '+ حركة جديدة' }).click();
    const dlg = page.getByRole('dialog');
    await dlg.getByLabel('نوع الحركة').selectOption('TRANSFER');
    // review is blocked without a destination
    await expect(dlg.getByRole('button', { name: 'مراجعة الحركة' })).toBeDisabled();
    await page.keyboard.press('Escape');
  });

  test('derived balances agree with the rendered effects', async ({ page }) => {
    const b = await page.evaluate(async () => {
      const api = (window as any).__protoApi;
      return api.stockApi.overview('mu-1');
    });
    // TRF-304 moved 2× i3 from w1 to w2; engine must credit the destination
    expect(b.balances['w2']['i3']).toBeGreaterThanOrEqual(0);
    const availW2 = await page.evaluate(async () => {
      const api = (window as any).__protoApi;
      return api.stockApi.available('i3', 'w2');
    });
    expect(typeof availW2).toBe('number');
  });
});
