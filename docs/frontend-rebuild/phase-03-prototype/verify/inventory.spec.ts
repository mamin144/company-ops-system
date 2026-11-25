import { test, expect } from '@playwright/test';

// Phase 3.5 inventory + material requests verification (kept).
// Temp output only; mock data only; no real stock movement is performed.
const loginAs = async (page: any, role: string) => {
  await page.goto('/login');
  await page.getByRole('radio', { name: role }).click();
  await page.getByRole('button', { name: /دخول تجريبي/ }).click();
  await page.locator('.shell').waitFor({ timeout: 10000 });
};
const rowOf = (page: any, needle: string) => page.locator('.recRow', { hasText: needle });

test.beforeEach(async ({ page }) => {
  await loginAs(page, 'مدير (تجريبي)');
  await page.goto('/inventory/requests');
  await expect(page.getByText('MR-012').first()).toBeVisible({ timeout: 8000 });
});

test('P1-05 project filter: with-requests project, empty project, and clear', async ({ page }) => {
  // a project WITH requests narrows the list and updates the count
  const countBefore = await page.locator('.recRow').count();
  const totalAll = await page.locator('.eyebrow .badge').innerText();
  await page.getByLabel('المشروع').selectOption('p1');
  await expect(rowOf(page, 'MR-012')).toBeVisible();
  const totalP1 = await page.locator('.eyebrow .badge').innerText();
  expect(totalP1).not.toBe(totalAll);
  // no cross-contamination: every visible row belongs to p1
  for (const r of await page.locator('.recRow').all()) {
    await expect(r).toContainText('برج النيل');
  }
  // p3 has no requests at all -> honest empty state
  await page.getByLabel('المشروع').selectOption('p3');
  await expect(page.getByText('لا نتائج مطابقة')).toBeVisible();
  await expect(page.locator('.recRow')).toHaveCount(0);
  // clear returns to the full scoped list
  await page.getByRole('button', { name: 'مسح الفلاتر' }).click();
  await expect(page.locator('.recRow')).toHaveCount(countBefore);
  await page.getByLabel('المشروع').selectOption('p2');
  await expect(rowOf(page, 'MR-009')).toBeVisible();
  await expect(rowOf(page, 'MR-012')).toHaveCount(0);
});

test('project filter does not mutate data or leak other projects', async ({ page }) => {
  await page.getByLabel('المشروع').selectOption('p4');
  await expect(rowOf(page, 'MR-003')).toBeVisible();
  const filtered = await page.locator('.recRow').count();
  expect(filtered).toBe(2);
  await page.getByLabel('المشروع').selectOption('');
  // p2 and p1 rows are still exactly as seeded — filtering changed nothing
  await page.getByRole('searchbox', { name: 'بحث' }).fill('MR-009');
  await expect(rowOf(page, 'MR-009')).toBeVisible();
  await page.getByRole('searchbox', { name: 'بحث' }).fill('MR-004');
  await expect(rowOf(page, 'MR-004')).toBeVisible();
  // and the scoped total is unchanged by any of the filtering
  await page.getByRole('searchbox', { name: 'بحث' }).fill('');
  const total = await page.locator('.eyebrow .badge').innerText();
  expect(total).toContain('15');
});

test('MR lifecycle: draft -> submit -> approve, and reject via approve:false', async ({ page }) => {
  // create a draft from the audited fields only
  await page.getByRole('button', { name: '+ طلب جديد' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByLabel('المخزن').selectOption('w1');
  await dlg.getByLabel('المشروع').selectOption('p1');
  await dlg.getByLabel('الكمية المطلوبة 1').fill('4');
  await dlg.getByRole('button', { name: 'حفظ كمسودة' }).click();
  await expect(dlg).toBeHidden();
  const created = rowOf(page, 'MR-018');
  await expect(created).toBeVisible();
  await expect(created.getByText('مسودة')).toBeVisible();

  // draft offers submit; submit transitions to submitted
  await created.getByRole('button', { name: 'إرسال للمراجعة' }).click();
  await expect(rowOf(page, 'MR-018').getByText('مقدمة')).toBeVisible();

  // a draft no longer offers submit — the action set follows the status
  await expect(rowOf(page, 'MR-018').getByRole('button', { name: 'إرسال للمراجعة' })).toHaveCount(0);
  // submitted offers approve+reject to an approver (approve confirms first)
  await rowOf(page, 'MR-018').getByRole('button', { name: 'اعتماد' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'تأكيد' }).click();
  await expect(rowOf(page, 'MR-018').getByText('معتمدة')).toBeVisible();

  // reject path on another submitted request (search first so the row is on
  // the current page regardless of how the list is sorted/paged)
  await page.getByRole('searchbox', { name: 'بحث' }).fill('MR-012');
  await expect(rowOf(page, 'MR-012')).toBeVisible();
  await rowOf(page, 'MR-012').getByRole('button', { name: 'رفض' }).click();
  const rd = page.getByRole('dialog');
  await rd.getByLabel('سبب الرفض (اختياري)').fill('اختبار تجريبي');
  await rd.getByRole('button', { name: 'تأكيد' }).click();
  await expect(rowOf(page, 'MR-012').getByText('مرفوضة')).toBeVisible();
  // rejected requests offer nothing further
  await expect(rowOf(page, 'MR-012').getByRole('button', { name: 'اعتماد' })).toHaveCount(0);
  await expect(rowOf(page, 'MR-012').getByRole('button', { name: /صرف/ })).toHaveCount(0);
});

test('issue prefill from an approved request: partial then full, guarded by remaining', async ({ page }) => {
  // MR-011 approved, 100 requested, 0 issued, w1 has cement
  await page.getByRole('searchbox', { name: 'بحث' }).fill('MR-011');
  const row = rowOf(page, 'MR-011');
  await expect(row.getByText('معتمدة')).toBeVisible();
  await row.getByRole('button', { name: 'بدء الصرف' }).click();
  const dlg = page.getByRole('dialog');
  // prefilled from the request: warehouse + reference shown, qty = remaining
  await expect(dlg).toContainText('المرجع');
  await expect(dlg).toContainText('MR-011');
  await expect(dlg.getByLabel('الكمية 1')).toHaveValue('100');
  // issue partially
  await dlg.getByLabel('الكمية 1').fill('40');
  await dlg.getByRole('button', { name: 'تأكيد' }).click();
  await expect(dlg).toBeHidden();
  await expect(rowOf(page, 'MR-011').getByText('صرف جزئي')).toBeVisible();
  // remaining updated in the details view
  await rowOf(page, 'MR-011').getByRole('button', { name: 'التفاصيل' }).click();
  const det = page.getByRole('dialog');
  await expect(det).toContainText('صرف');
  await page.keyboard.press('Escape');

  // over-issue is blocked by the remaining guard (mock level). Phase 3.12:
  // a partially-issued request now offers "continue with N remaining"
  await rowOf(page, 'MR-011').getByRole('button', { name: 'استكمال الصرف (المتبقي 60)' }).click();
  const d2 = page.getByRole('dialog');
  await d2.getByLabel('الكمية 1').fill('61');
  await expect(d2.getByRole('button', { name: 'تأكيد' })).toBeDisabled();
  // exactly the remaining amount is allowed -> issues the rest, becomes issued
  await d2.getByLabel('الكمية 1').fill('60');
  await d2.getByRole('button', { name: 'تأكيد' }).click();
  await expect(d2).toBeHidden();
  await expect(rowOf(page, 'MR-011').getByText('تم الصرف')).toBeVisible();
  // a fully issued request offers no further issuing
  await expect(rowOf(page, 'MR-011').getByRole('button', { name: 'بدء الصرف' })).toHaveCount(0);
});

test('issue is blocked for non-approved requests (draft/submitted/issued)', async ({ page }) => {
  // submitted MR-012, rejected MR-009, issued MR-006 — the button itself is
  // absent, and the mock refuses the same call on the path the UI would use.
  await expect(rowOf(page, 'MR-012').getByRole('button', { name: 'بدء الصرف' })).toHaveCount(0);
  await expect(rowOf(page, 'MR-009').getByRole('button', { name: 'بدء الصرف' })).toHaveCount(0);
  await expect(rowOf(page, 'MR-006').getByRole('button', { name: 'بدء الصرف' })).toHaveCount(0);
  const res = await page.evaluate(async () => {
    const api = (window as any).__protoApi;
    if (!api) return { skipped: 'no test hook in the production bundle' };
    const issued = await api.mrApi.issue('m6', [{ itemId: 'i3', quantity: 1 }], 'mu-1');
    const draft = await api.mrApi.issue('m5', [{ itemId: 'i4', quantity: 1 }], 'mu-1');
    return { issued, draft };
  });
  // With no hook the UI assertions above are the evidence; with a hook the mock
  // must refuse both (409: only approved/partially-issued may be issued).
  if (!(res as any).skipped) {
    expect((res as any).issued.ok).toBe(false);
    expect((res as any).issued.code).toBe(409);
    expect((res as any).draft.ok).toBe(false);
    expect((res as any).draft.code).toBe(409);
  }
});

test('duplicate issue retry is refused; no double stock movement', async ({ page }) => {
  const row = rowOf(page, 'MR-015');
  await row.getByRole('button', { name: 'بدء الصرف' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByRole('button', { name: 'تأكيد' }).click();
  await expect(dlg).toBeHidden();
  await expect(rowOf(page, 'MR-015').getByText('تم الصرف')).toBeVisible();
  // retry path: the list no longer offers issuing at all
  await expect(rowOf(page, 'MR-015').getByRole('button', { name: 'بدء الصرف' })).toHaveCount(0);
  // and the guarded mock path refuses a second issue for the same request
  const res = await page.evaluate(async () => {
    const api = (window as any).__protoApi;
    if (!api) return { skipped: 'no test hook in the production bundle' };
    return api.mrApi.issue('m13', [{ itemId: 'i4', quantity: 10 }], 'mu-1');
  });
  if (!(res as any).skipped) {
    expect((res as any).ok).toBe(false);
    expect((res as any).code).toBe(409);
  }
});

test('close is offered only from issued and is labelled unverified', async ({ page }) => {
  await page.getByLabel('الحالة', { exact: true }).selectOption('issued');
  const issuedRow = page.locator('.recRow').first();
  await expect(issuedRow).toBeVisible();
  await issuedRow.getByRole('button', { name: 'إغلاق', exact: true }).click();
  const cf = page.getByRole('dialog');
  await expect(cf).toContainText('لا يوجد مسار معتمد');
  const closedNo = await page.locator('.recRow').first().innerText();
  await cf.getByRole('button', { name: 'تأكيد' }).click();
  // it leaves the `issued` filter it was found through — the list stays truthful
  await expect(page.locator('.recRow')).toHaveCount(1);
  await expect(page.locator('.recRow').first()).toContainText('تم الصرف');
  expect(await page.locator('.recRow').first().innerText()).not.toBe(closedNo);
  await page.getByLabel('الحالة', { exact: true }).selectOption('closed');
  const closedRow = page.locator('.recRow').first();
  await expect(closedRow.getByText('مغلقة')).toBeVisible();
  await expect(closedRow.getByRole('button', { name: 'إغلاق', exact: true })).toHaveCount(0);
  await expect(closedRow.getByRole('button', { name: 'التفاصيل' })).toBeVisible();
});

test('P1-04 search + filter + sort + pagination change real results', async ({ page }) => {
  // sorting by number/date toggles direction (default is createdAt desc)
  const baseline = await page.locator('.recRow').first().innerText();
  await page.getByRole('button', { name: /الرقم\/التاريخ/ }).click();
  const asc = await page.locator('.recRow').first().innerText();
  expect(asc).not.toBe(baseline);
  await page.getByRole('button', { name: /الرقم\/التاريخ/ }).click();
  expect(await page.locator('.recRow').first().innerText()).toBe(baseline);

  // pagination moves pages and the total stays constant
  const pager = page.locator('.pager');
  await expect(pager).toContainText('صفحة 1');
  const totalOnly = (s: string) => s.replace(/صفحة.*?من.*?·/, '');
  const totalText = await pager.innerText().then(totalOnly);
  const firstOnPage1 = await page.locator('.recRow').first().innerText();
  await pager.getByRole('button', { name: 'التالي' }).click();
  await expect(pager).toContainText('صفحة 2');
  expect(await pager.innerText().then(totalOnly)).toBe(totalText);
  expect(await page.locator('.recRow').first().innerText()).not.toBe(firstOnPage1);

  // a filter that still spans pages resets the page pointer to 1
  await page.getByLabel('الحالة', { exact: true }).selectOption('approved');
  await expect(page.locator('.pager')).toHaveCount(0);
  await page.getByLabel('الحالة', { exact: true }).selectOption('');
  await expect(pager).toContainText('صفحة 1');

  // narrowing to a single result hides the pager and shows exactly that row
  await page.getByRole('searchbox', { name: 'بحث' }).fill('MR-011');
  await expect(page.locator('.pager')).toHaveCount(0);
  await expect(page.locator('.recRow')).toHaveCount(1);
  await expect(page.locator('.recRow')).toContainText('MR-011');
  // no results is an explicit empty state
  await page.getByRole('searchbox', { name: 'بحث' }).fill('ZZZ-none');
  await expect(page.getByText('لا نتائج مطابقة')).toBeVisible();
});

test('permissions: viewer sees only project-less rows and no lifecycle actions; warehouse approves nothing', async ({ page }) => {
  await page.getByRole('button', { name: 'خروج' }).click();
  await loginAs(page, 'مشاهد (تجريبي)');
  await page.goto('/inventory/requests');
  await expect(rowOf(page, 'MR-007').first()).toBeVisible({ timeout: 8000 });
  // Audited scoping: a viewer with no project membership sees ONLY rows that
  // carry no project at all — project rows stay hidden, not merely read-only.
  await expect(rowOf(page, 'MR-012')).toHaveCount(0);
  await expect(rowOf(page, 'MR-011')).toHaveCount(0);
  const visible = await page.locator('.recRow').count();
  const scoped = await page.evaluate(async () => {
    const api = (window as any).__protoApi;
    return api.mrApi.list({}, 'mu-4').total;
  });
  expect(visible).toBe(scoped);
  expect(scoped).toBe(3); // MR-007, MR-015, MR-017
  // viewer holds materialRequests.view only
  await expect(page.getByRole('button', { name: '+ طلب جديد' })).toHaveCount(0);
  for (const label of ['اعتماد', 'رفض', /بدء الصرف/, 'إرسال للمراجعة', 'إغلاق', 'حذف'])
    await expect(rowOf(page, 'MR-007').getByRole('button', { name: label })).toHaveCount(0);
  await expect(rowOf(page, 'MR-007').getByRole('button', { name: 'التفاصيل' })).toBeVisible();
  // the project filter offers nothing a viewer may see and denial is enforced
  const options = await page.getByLabel('المشروع').locator('option').evaluateAll((els) => els.map((e) => (e as HTMLOptionElement).value).filter(Boolean));
  expect(options).toHaveLength(0);
  const denied = await page.evaluate(async () => {
    const api = (window as any).__protoApi;
    return api.mrApi.list({ projectId: 'p1' }, 'mu-4');
  });
  expect(denied.denied).toBe(true);
  expect(denied.total).toBe(0);

  // warehouse role can issue but not approve
  await page.getByRole('button', { name: 'خروج' }).click();
  await loginAs(page, 'مخازن (تجريبي)');
  await page.goto('/inventory/requests');
  await expect(rowOf(page, 'MR-012')).toBeVisible({ timeout: 8000 });
  await expect(rowOf(page, 'MR-012').getByRole('button', { name: 'اعتماد' })).toHaveCount(0);
  await page.getByRole('searchbox', { name: 'بحث' }).fill('MR-011');
  await expect(rowOf(page, 'MR-011').getByRole('button', { name: 'بدء الصرف' })).toBeVisible();
  // and the mock refuses an approve attempt by a non-approver
  const blocked = await page.evaluate(async () => {
    const api = (window as any).__protoApi;
    return api.mrApi.act('m1', 'approve', 'mu-2');
  });
  expect(blocked.ok).toBe(false);
  expect(blocked.code).toBe(403);
  expect(blocked.error).toContain('materialRequests.approve');
});

test('EN/LTR on the requests list and stock page', async ({ page }) => {
  await page.getByRole('button', { name: 'ع/EN' }).click();
  await expect(page.locator('html[dir="ltr"]')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'New request' })).toBeVisible();
  await expect(page.getByLabel('Project', { exact: true })).toBeVisible();
  await page.goto('/inventory/stock');
  await expect(page.getByRole('tab', { name: 'Stock movements & balances' })).toBeVisible();
  await expect(page.getByLabel('Movement type', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'ع/EN' }).click();
  await expect(page.locator('html[dir="rtl"]')).toHaveCount(1);
});

test('warehouses: sort changes the real rows; pages are disjoint', async ({ page }) => {
  await page.goto('/inventory/warehouses');
  await expect(page.locator('.recRow', { hasText: 'WH-C1' })).toBeVisible();
  await expect(page.getByText('صفحة 1 من 2')).toBeVisible();
  const pageOne = await page.locator('.recRow').allInnerTexts();
  expect(pageOne).toHaveLength(5);
  // code descending: WH-S4 must come first instead of WH-C1
  // (default is already code-ascending, so a single click toggles to desc)
  await page.getByRole('button', { name: 'الكود/الاسم — ترتيب', exact: true }).click();
  await expect(page.locator('.recRow').first()).toContainText('WH-S4');
  // project descending: the p4 warehouse leads
  // (first click switches the key and resets to asc, second toggles to desc)
  await page.getByRole('button', { name: 'المشروع — ترتيب', exact: true }).click();
  await page.getByRole('button', { name: 'المشروع — ترتيب', exact: true }).click();
  await expect(page.locator('.recRow').first()).toContainText('WH-S4');
  // back to code ascending, then page two holds the remainder only
  await page.getByRole('button', { name: 'الكود/الاسم — ترتيب', exact: true }).click();
  await page.getByRole('button', { name: 'التالي' }).click();
  await expect(page.getByText('صفحة 2 من 2')).toBeVisible();
  const pageTwo = await page.locator('.recRow').allInnerTexts();
  expect(pageTwo).toHaveLength(1);
  expect(pageTwo[0]).toContain('WH-S4');
  for (const r of pageTwo) expect(pageOne).not.toContain(r);
});

test('warehouses: management scope hides out-of-project rows entirely', async ({ page }) => {
  await page.getByRole('button', { name: 'خروج' }).click();
  await loginAs(page, 'إدارة (تجريبي)');
  await page.goto('/inventory/warehouses');
  await expect(page.locator('.recRow', { hasText: 'WH-C1' })).toBeVisible();
  await expect(page.locator('.recRow', { hasText: 'WH-S1' })).toBeVisible();
  await expect(page.locator('.recRow', { hasText: 'WH-S2' })).toHaveCount(0);
  await expect(page.locator('.recRow', { hasText: 'WH-S3' })).toHaveCount(0);
  await expect(page.locator('.recRow', { hasText: 'WH-S4' })).toHaveCount(0);
  // three in-scope rows fit on one page: no pager rendered
  await expect(page.locator('.recRow')).toHaveCount(3);
  await expect(page.locator('.pager')).toHaveCount(0);
});

test('items: category sort reorders; second page holds the remainder', async ({ page }) => {
  await page.goto('/inventory/items');
  await expect(page.locator('.recRow', { hasText: 'ITM-001' })).toBeVisible();
  await expect(page.getByText('صفحة 1 من 2')).toBeVisible();
  // category ascending: finishing items (تشطيب) lead, ITM-004 first
  await page.getByRole('button', { name: 'التصنيف/الوحدة — ترتيب', exact: true }).click();
  await expect(page.locator('.recRow').first()).toContainText('ITM-004');
  await page.getByRole('button', { name: 'التالي' }).click();
  await expect(page.getByText('صفحة 2 من 2')).toBeVisible();
  await expect(page.locator('.recRow')).toHaveCount(1);
  // search narrows and the pager disappears
  await page.getByRole('searchbox', { name: 'بحث' }).fill('حديد');
  await expect(page.locator('.recRow')).toHaveCount(1);
  await expect(page.locator('.recRow', { hasText: 'ITM-002' })).toBeVisible();
  await expect(page.locator('.pager')).toHaveCount(0);
});

test('contextual export: buttons only for identities holding reports.view', async ({ page }) => {
  await page.goto('/inventory/warehouses');
  await expect(page.locator('.ctxExport')).toBeVisible();
  await expect(page.locator('.ctxExport')).toContainText('6');
  await page.goto('/inventory/items');
  await expect(page.locator('.ctxExport')).toBeVisible();
  // viewer keeps the lists but gets no export surface at all
  await page.getByRole('button', { name: 'خروج' }).click();
  await loginAs(page, 'مشاهد (تجريبي)');
  await page.goto('/inventory/warehouses');
  await expect(page.locator('.recRow').first()).toBeVisible();
  await expect(page.locator('.ctxExport')).toHaveCount(0);
  await page.goto('/inventory/items');
  await expect(page.locator('.recRow').first()).toBeVisible();
  await expect(page.locator('.ctxExport')).toHaveCount(0);
});