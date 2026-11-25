import { test, expect } from '@playwright/test';

// Phase 3.6 BOQ / IPC / Financials verification (kept).
// Temp output only; mock data only; no real financial operation is performed.
const loginAs = async (page: any, role: string) => {
  await page.goto('/login');
  await page.getByRole('radio', { name: role }).click();
  await page.getByRole('button', { name: /دخول تجريبي/ }).click();
  await page.locator('.shell').waitFor({ timeout: 10000 });
};
const rowOf = (page: any, needle: string) => page.locator('.recRow', { hasText: needle });

const openFinancials = async (page: any, project = 'p1') => {
  await page.goto(`/projects/${project}/financials`);
  await expect(page.getByRole('tab', { name: 'المقايسات' })).toBeVisible({ timeout: 8000 });
};

test.beforeEach(async ({ page }) => {
  await loginAs(page, 'مدير (تجريبي)');
});

test('BOQ: list, derived line totals, project total, and empty state', async ({ page }) => {
  await openFinancials(page);
  // derived per-line total: quantity × rate (01-01: 12000 × 850)
  const line1 = rowOf(page, '01-01');
  await expect(line1.getByText('10,200,000')).toBeVisible();
  // derived project total
  await expect(page.locator('.card').first()).toContainText('27,839,000');
  // search narrows the list AND the shown total
  await page.getByRole('searchbox', { name: 'بحث' }).fill('حديد');
  await expect(rowOf(page, 'حديد تسليح')).toBeVisible();
  await expect(rowOf(page, 'خرسانة جاهزة للأساسات')).toHaveCount(0);
  await expect(page.locator('.panel')).toContainText('10,625,000');

  // project with no BOQ is an honest empty state, not a zero pretending to be data
  await openFinancials(page, 'p3');
  await expect(page.getByText('لا توجد بنود مقايسة لهذا المشروع')).toBeVisible();
});

test('BOQ: create validates fields and updates the total without reload', async ({ page }) => {
  await openFinancials(page);
  const totalBefore = await page.locator('.card').first().innerText();
  await page.getByRole('button', { name: '+ بند جديد' }).click();
  const dlg = page.getByRole('dialog');
  // required fields block the save button
  await expect(dlg.getByRole('button', { name: 'حفظ' })).toBeDisabled();
  await dlg.getByLabel('رقم البند').fill('09-09');
  await dlg.getByLabel('الوحدة').fill('م²');
  await expect(dlg.getByRole('button', { name: 'حفظ' })).toBeDisabled();
  await dlg.getByLabel('الوصف').fill('بند اختبار تجريبي');
  await dlg.getByLabel('الكمية').fill('100');
  await dlg.getByLabel('الفئة').fill('24000');
  // live derived total for the row being typed
  await expect(dlg).toContainText('2,400,000');
  // negative quantity is refused inline
  await dlg.getByLabel('الكمية').fill('-5');
  await expect(dlg.getByText('الكمية يجب أن تكون أكبر من أو تساوي 0')).toBeVisible();
  await dlg.getByLabel('الكمية').fill('100');
  await dlg.getByRole('button', { name: 'حفظ' }).click();
  await expect(dlg).toBeHidden();
  // six lines now sort code-ascending across two pages — the new 09-09 is on page two
  await page.getByRole('button', { name: 'التالي' }).click();
  const newRow = rowOf(page, '09-09');
  await expect(newRow).toBeVisible();
  await expect(newRow.getByText('2,400,000')).toBeVisible();
  // the project total moved by exactly the new line
  await expect(page.locator('.card').first()).toContainText('30,239,000');
  expect(totalBefore).toContain('27,839,000');
});

test('BOQ: the total is direct-entry and re-derives the rate', async ({ page }) => {
  await openFinancials(page);
  await page.getByRole('button', { name: '+ بند جديد' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByLabel('رقم البند').fill('09-07');
  await dlg.getByLabel('الوحدة').fill('م²');
  await dlg.getByLabel('الوصف').fill('بند إجمالي مباشر تجريبي');
  await dlg.getByLabel('الكمية').fill('2');
  // quantity × rate stays live on both the total field and the derived note
  await dlg.getByLabel('الفئة').fill('1250');
  await expect(dlg.getByLabel('الإجمالي', { exact: true })).toHaveValue('2500');
  await expect(dlg).toContainText('2,500');
  // a typed negative total is refused inline
  await dlg.getByLabel('الإجمالي', { exact: true }).fill('-5');
  await expect(dlg.getByText('الإجمالي يجب أن يكون أكبر من أو يساوي 0')).toBeVisible();
  // typing the total re-derives the rate: 3000 ÷ 2 = 1500 (qty 0 is promoted to 1)
  await dlg.getByLabel('الإجمالي', { exact: true }).fill('3000');
  await expect(dlg).toContainText('3,000');
  await dlg.getByRole('button', { name: 'حفظ' }).click();
  await expect(dlg).toBeHidden();
  await expect(page.locator('.card').first()).toContainText('27,842,000');
});

test('BOQ: edit changes the stored values and the derived totals follow', async ({ page }) => {
  await openFinancials(page);
  await rowOf(page, '07-01').getByRole('button', { name: 'تعديل' }).click();
  const dlg = page.getByRole('dialog');
  // Determinism: the edit dialog seeds its form from the record in a
  // post-mount effect. Under suite timing a fill racing the open commit was
  // once clobbered back to the seeded values (observed total: 1,664,000 =
  // 3,200 × 520). Wait for the seed-derived total to be on screen first —
  // filling only after seeding has demonstrably landed.
  await expect(dlg).toContainText('1,664,000');
  await dlg.getByLabel('الفئة').fill('600');
  await expect(dlg).toContainText('1,920,000');
  await dlg.getByRole('button', { name: 'حفظ' }).click();
  await expect(dlg).toBeHidden();
  await expect(rowOf(page, '07-01').getByText('1,920,000')).toBeVisible();
  await expect(page.locator('.card').first()).toContainText('28,095,000');
});

test('BOQ: delete is bounded — a line referenced by an IPC is refused', async ({ page }) => {
  await openFinancials(page);
  // 01-01 is referenced by IPC lines -> delete must be blocked
  await rowOf(page, '01-01').getByRole('button', { name: 'حذف' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'تأكيد' }).click();
  await expect(page.locator('.errBox')).toContainText('لا يمكن حذف البند لوجود مستخلصات مرتبطة به');
  await expect(rowOf(page, '01-01')).toBeVisible();
  // a line with no IPC reference deletes cleanly and the total drops
  await rowOf(page, '07-01').getByRole('button', { name: 'حذف' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'تأكيد' }).click();
  await expect(rowOf(page, '07-01')).toHaveCount(0);
  await expect(page.locator('.card').first()).toContainText('26,175,000');
});

test('BOQ: validation failure keeps previous data intact', async ({ page }) => {
  await openFinancials(page);
  await rowOf(page, '01-02').getByRole('button', { name: 'تعديل' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByLabel('الوصف').fill('');
  await dlg.getByLabel('الفئة').fill('999');
  // bypass the client gate to prove the mock validates too
  await page.evaluate(async () => {
    const api = (window as any).__protoApi;
    await api.boqApi.update('p1', 'bq2', { itemCode: '01-02', description: '', unit: 'طن', quantity: 850, unitPrice: 999 }, 'mu-1');
  });
  await page.keyboard.press('Escape');
  await expect(rowOf(page, '01-02').getByText('حديد تسليح')).toBeVisible();
  await expect(rowOf(page, '01-02').getByText('10,625,000')).toBeVisible();
  const denied = await page.evaluate(async () => {
    const api = (window as any).__protoApi;
    return api.boqApi.update('p1', 'bq2', { itemCode: '', description: '', unit: '', quantity: 1, unitPrice: 1 }, 'mu-1');
  });
  expect(denied.ok).toBe(false);
  expect(denied.code).toBe(400);
});

test('IPC: list, derived net, BOQ linkage and previous/current quantities', async ({ page }) => {
  await openFinancials(page);
  await page.getByRole('tab', { name: 'المستخلصات' }).click();
  await expect(rowOf(page, '#1')).toBeVisible();
  // derived net on the row (1500×850 + 60×12500)
  await expect(rowOf(page, '#1')).toContainText('2,025,000');
  // the direct-amount certificate carries no lines and says so
  await expect(rowOf(page, '#4')).toContainText('قيمة مباشرة');
  await expect(rowOf(page, '#4')).toContainText('290,000');

  await rowOf(page, '#2').getByRole('button', { name: 'التفاصيل' }).click();
  const det = page.getByRole('dialog');
  // every line names its BOQ item code, unit price and amount
  await expect(det).toContainText('خرسانة جاهزة للأساسات');
  await expect(det.getByText('1,530,000')).toBeVisible();
  await expect(det.getByText('687,500')).toBeVisible();
  await expect(det).toContainText('2,586,500');
  await page.keyboard.press('Escape');
});

test('IPC: create with lines derives the net from BOQ rates', async ({ page }) => {
  await openFinancials(page);
  await page.getByRole('tab', { name: 'المستخلصات' }).click();
  // executed only counts APPROVED certificates
  await expect(page.locator('.card').nth(1)).toContainText('4,611,500');
  await page.getByRole('button', { name: '+ مستخلص جديد' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByLabel('رقم المستخلص').fill('5');
  await dlg.getByRole('button', { name: '+ إضافة صنف' }).click();
  await dlg.getByLabel('بند المقايسة 1').selectOption('bq3');
  await dlg.getByLabel('الحالي 1').fill('100');
  // live derived net: 100 × 410
  await expect(dlg).toContainText('41,000');
  await dlg.getByRole('button', { name: 'حفظ' }).click();
  await expect(dlg).toBeHidden();
  await expect(rowOf(page, '#5')).toContainText('41,000');
  // a DRAFT certificate does not move the executed figure
  await expect(page.locator('.card').nth(1)).toContainText('4,611,500');
  // once it is approved, the executed figure follows the derived net
  await rowOf(page, '#5').getByRole('button', { name: 'مقدمة' }).click();
  const d2 = page.getByRole('dialog');
  await d2.getByRole('button', { name: 'حفظ' }).click();
  await expect(d2).toBeHidden();
  await rowOf(page, '#5').getByRole('button', { name: 'معتمدة' }).click();
  const d3 = page.getByRole('dialog');
  await d3.getByRole('button', { name: 'حفظ' }).click();
  await expect(d3).toBeHidden();
  await expect(rowOf(page, '#5').getByText('معتمدة')).toBeVisible();
  await expect(page.locator('.card').nth(1)).toContainText('4,652,500');
});

test('IPC: cumulative quantity above the BOQ quantity is refused', async ({ page }) => {
  await openFinancials(page);
  await page.getByRole('tab', { name: 'المستخلصات' }).click();
  await page.getByRole('button', { name: '+ مستخلص جديد' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByLabel('رقم المستخلص').fill('6');
  await dlg.getByRole('button', { name: '+ إضافة صنف' }).click();
  await dlg.getByLabel('بند المقايسة 1').selectOption('bq3');
  // 5400 BOQ qty, 900 already executed by IPC #2 -> only 4500 left
  await expect(dlg).toContainText('المتاح: 4500');
  await dlg.getByLabel('الحالي 1').fill('4600');
  await expect(dlg.getByText('إجمالي الكمية للبند يتجاوز كمية المقايسة')).toBeVisible();
  await expect(dlg.getByRole('button', { name: 'حفظ' })).toBeDisabled();
  // exactly the allowance is accepted
  await dlg.getByLabel('الحالي 1').fill('4500');
  await expect(dlg.getByRole('button', { name: 'حفظ' })).toBeEnabled();
  // the mock refuses the same thing on its own path
  const res = await page.evaluate(async () => {
    const api = (window as any).__protoApi;
    return api.ipcApi.create('p1', { ipcNumber: 6, date: '2026-10-13', status: 'draft', lines: [{ boqItemId: 'bq3', currentQuantity: 4600 }] }, 'mu-1');
  });
  expect(res.ok).toBe(false);
  expect(res.code).toBe(400);
  expect(res.error).toContain('تتجاوز كمية المقايسة');
  // nothing partial was created
  await page.keyboard.press('Escape');
  await expect(rowOf(page, '#6')).toHaveCount(0);
});

test('IPC: duplicate number in the same project is refused', async ({ page }) => {
  await openFinancials(page);
  await page.getByRole('tab', { name: 'المستخلصات' }).click();
  await page.getByRole('button', { name: '+ مستخلص جديد' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByLabel('رقم المستخلص').fill('1');
  await dlg.getByRole('button', { name: 'حفظ' }).click();
  await expect(dlg.locator('.errBox')).toContainText('رقم المستخلص مستخدم بالفعل');
  await expect(rowOf(page, '#1')).toHaveCount(1);
});

test('IPC: transitions follow the audited matrix (no backward moves)', async ({ page }) => {
  await openFinancials(page);
  await page.getByRole('tab', { name: 'المستخلصات' }).click();
  // draft #4 may move forward to submitted only
  const draft = rowOf(page, '#4');
  await expect(draft.getByRole('button', { name: 'مقدمة' })).toBeVisible();
  await expect(draft.getByRole('button', { name: 'معتمدة' })).toHaveCount(0);
  // submitted #3 may go to approved or rejected
  const submitted = rowOf(page, '#3');
  await expect(submitted.getByRole('button', { name: 'معتمدة' })).toBeVisible();
  await expect(submitted.getByRole('button', { name: 'مرفوضة' })).toBeVisible();
  // approved #1 is terminal — no forward action at all
  await expect(rowOf(page, '#1').getByRole('button', { name: 'مقدمة' })).toHaveCount(0);
  await expect(rowOf(page, '#1').getByRole('button', { name: 'معتمدة' })).toHaveCount(0);

  // a backward move is refused by the mock even if forced
  const back = await page.evaluate(async () => {
    const api = (window as any).__protoApi;
    const cur = api.ipcApi.get('p1', 'ipc1', 'mu-1');
    return api.ipcApi.update('p1', 'ipc1', { ipcNumber: cur.ipcNumber, date: cur.date, status: 'submitted' }, 'mu-1');
  });
  expect(back.ok).toBe(false);
  expect(back.code).toBe(409);

  // forward move works and recomputes nothing it should not
  await draft.getByRole('button', { name: 'مقدمة' }).click();
  const dlg = page.getByRole('dialog');
  await expect(dlg.getByLabel('الحالة', { exact: true })).toHaveValue('submitted');
  await dlg.getByRole('button', { name: 'حفظ' }).click();
  await expect(dlg).toBeHidden();
  await expect(rowOf(page, '#4').getByText('مقدمة')).toBeVisible();
});

test('IPC: delete is draft-only', async ({ page }) => {
  await openFinancials(page);
  await page.getByRole('tab', { name: 'المستخلصات' }).click();
  // #4 is draft -> deletable
  await expect(rowOf(page, '#4').getByRole('button', { name: 'حذف' })).toBeVisible();
  // #1 is approved -> no delete button at all
  await expect(rowOf(page, '#1').getByRole('button', { name: 'حذف' })).toHaveCount(0);
  await rowOf(page, '#4').getByRole('button', { name: 'حذف' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'تأكيد' }).click();
  await expect(rowOf(page, '#4')).toHaveCount(0);
  const refused = await page.evaluate(async () => {
    const api = (window as any).__protoApi;
    return api.ipcApi.remove('p1', 'ipc1', 'mu-1');
  });
  expect(refused.ok).toBe(false);
  expect(refused.code).toBe(409);
});

test('permissions enforced on the MOCK path, not just hidden buttons', async ({ page }) => {
  // ---- viewer (no project membership at all) ----
  await page.getByRole('button', { name: 'خروج' }).click();
  await loginAs(page, 'مشاهد (تجريبي)');
  await page.goto('/projects/p1/financials');
  // With no membership, the project itself resolves to nothing — the financials
  // tab is unreachable, which is stronger than hiding its buttons.
  await expect(page.getByText('المشروع غير موجود أو خارج نطاق صلاحياتك')).toBeVisible();
  await expect(page.getByRole('tab', { name: 'المقايسات' })).toHaveCount(0);
  await expect(page.getByText('27,839,000')).toHaveCount(0);
  const denied = await page.evaluate(async () => {
    const api = (window as any).__protoApi;
    return {
      boq: await api.boqApi.create('p1', { itemCode: 'x', description: 'y', unit: 'z', quantity: 1, unitPrice: 1 }, 'mu-4'),
      ipc: await api.ipcApi.create('p1', { ipcNumber: 9, date: '2026-10-13', status: 'draft' }, 'mu-4'),
      list: api.boqApi.list('p1', 'mu-4').length,
    };
  });
  expect(denied.boq.ok).toBe(false);
  expect(denied.boq.code).toBe(403);
  expect(denied.ipc.ok).toBe(false);
  expect(denied.ipc.code).toBe(403);
  expect(denied.list).toBe(0);

  // ---- technical (mu-3: p1 WRITE, p2 READ) — no login tile for this role, so
  //      the read/write distinction is exercised straight on the mock path ----
  const readOnly = await page.evaluate(async () => {
    const api = (window as any).__protoApi;
    return {
      readP2: api.canProject('mu-3', 'projects.view', 'p2'),
      writeP2: api.canProject('mu-3', 'projects.edit', 'p2'),
      writeP1: api.canProject('mu-3', 'projects.edit', 'p1'),
      readListP2: api.boqApi.list('p2', 'mu-3').length,
      attempt: await api.boqApi.create('p2', { itemCode: 'x', description: 'y', unit: 'z', quantity: 1, unitPrice: 1 }, 'mu-3'),
      ipcAttempt: await api.ipcApi.create('p2', { ipcNumber: 9, date: '2026-10-13', status: 'draft' }, 'mu-3'),
    };
  });
  expect(readOnly.readP2).toBe(true);
  expect(readOnly.writeP2).toBe(false);
  // Membership never grants what the role base lacks: `technical` holds no
  // `projects.edit` at all, so WRITE access on p1 cannot promote it to an editor.
  expect(readOnly.writeP1).toBe(false);
  // READ membership still shows the lines...
  expect(readOnly.readListP2).toBeGreaterThan(0);
  // ...but every write through the mock is refused
  expect(readOnly.attempt.ok).toBe(false);
  expect(readOnly.attempt.code).toBe(403);
  expect(readOnly.ipcAttempt.ok).toBe(false);
  expect(readOnly.ipcAttempt.code).toBe(403);

  // ---- management: p1 WRITE, no membership elsewhere ----
  await page.getByRole('button', { name: 'خروج' }).click();
  await loginAs(page, 'إدارة (تجريبي)');
  const scoped = await page.evaluate(async () => {
    const api = (window as any).__protoApi;
    return {
      p1: api.canProject('mu-7', 'projects.edit', 'p1'),
      p3: api.canProject('mu-7', 'projects.edit', 'p3'),
      denyReadP3: api.canProject('mu-7', 'projects.view', 'p3'),
      readP1: api.canProject('mu-7', 'projects.view', 'p1'),
      // no membership on p3 -> the route-level project gate denies first (403),
      // exactly as requireAnyProjectAccess runs before the handler
      noAccessP3: await api.boqApi.create('p3', { itemCode: 'x', description: 'y', unit: 'z', quantity: 1, unitPrice: 1 }, 'mu-7'),
      // Grant WRITE on p3 so the route gate passes; the handler's project
      // ownership check must then report "not found" for a p1 line.
      grant: api.userApi.setAccess('mu-1', { p1: 'DELETE', p2: 'WRITE', p3: 'WRITE', p4: 'READ' }),
      crossProject: await api.boqApi.update('p3', 'bq1', { itemCode: 'a', description: 'b', unit: 'c', quantity: 1, unitPrice: 1 }, 'mu-1'),
      restore: api.userApi.setAccess('mu-1', { p1: 'DELETE', p2: 'WRITE', p3: 'READ', p4: 'READ' }),
    };
  });
  expect(scoped.p1).toBe(true);
  expect(scoped.p3).toBe(false);
  expect(scoped.readP1).toBe(true);
  expect(scoped.denyReadP3).toBe(false);
  expect(scoped.noAccessP3.ok).toBe(false);
  expect(scoped.noAccessP3.code).toBe(403);
  // editing p1's line through p3's URL is a 404, never a cross-project write
  expect(scoped.crossProject.ok).toBe(false);
  expect(scoped.crossProject.code).toBe(404);
  // and the line itself is untouched
  const stillThere = await page.evaluate(async () => {
    const api = (window as any).__protoApi;
    return api.boqApi.list('p1', 'mu-1').find((b: any) => b.id === 'bq1');
  });
  expect(stillThere.itemCode).toBe('01-01');
  expect(stillThere.unitPrice).toBe(850);
});

test('project scope: figures of another project are never rendered', async ({ page }) => {
  // admin (access p1..p4) sees both p1 and p2 financial sections
  await page.goto('/financials');
  await expect(page.getByText('27,839,000')).toBeVisible();  // p1 BOQ total
  await expect(page.getByText('15,816,000')).toBeVisible();  // p2 BOQ total
  // management (access p1 only) must not see p2 money at all
  await page.getByRole('button', { name: 'خروج' }).click();
  await loginAs(page, 'إدارة (تجريبي)');
  await page.goto('/financials');
  await expect(page.getByText('27,839,000')).toBeVisible();
  await expect(page.getByText('15,816,000')).toHaveCount(0);
  // and a direct deep link to p2 financials resolves to the not-found state
  // rather than rendering another project's money
  await page.goto('/projects/p2/financials');
  await expect(page.getByText('المشروع غير موجود أو خارج نطاق صلاحياتك')).toBeVisible();
  await expect(page.getByText('15,816,000')).toHaveCount(0);
  await expect(rowOf(page, '01-01')).toHaveCount(0);
});

test('Financials page shows no invented figures', async ({ page }) => {
  await page.goto('/financials');
  const section = page.locator('section.panel').first();
  // executed = sum of APPROVED certificates only (2,025,000 + 2,586,500)
  await expect(section).toContainText('4,611,500');
  // submitted and draft certificates are NOT counted as executed
  await expect(section).not.toContainText('5,911,500');
  // contract value has no source in the model -> explicit "not available"
  await expect(section).toContainText('قيمة العقد');
  await expect(section).toContainText('غير متاح');
});

test('financials: EN/LTR, keyboard focus restoration, overflow matrix, clean console', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message.split('\n')[0]));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) errors.push(m.text().slice(0, 120)); });

  // EN
  await page.goto('/financials');
  await page.getByRole('button', { name: 'ع/EN' }).click();
  await expect(page.locator('html[dir="ltr"]')).toHaveCount(1);
  await expect(page.getByText('BOQ total').first()).toBeVisible();
  await expect(page.getByText('Not available').first()).toBeVisible();
  await page.getByRole('button', { name: 'ع/EN' }).click();
  await expect(page.locator('html[dir="rtl"]')).toHaveCount(1);

  // keyboard: open the BOQ dialog, Escape closes, focus returns to the opener
  await openFinancials(page);
  const opener = page.getByRole('button', { name: '+ بند جديد' });
  await opener.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect.poll(async () => page.evaluate(() => !!document.querySelector('.modal')?.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(opener).toBeFocused();

  // overflow matrix on both screens and inside an open dialog
  for (const w of [320, 375, 390, 430, 768, 1024, 1366, 1920]) {
    await page.setViewportSize({ width: w, height: 800 });
    await page.goto('/financials');
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), `financials ${w}`).toBe(false);
    await page.goto('/projects/p1/financials');
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), `boq ${w}`).toBe(false);
    await page.getByRole('tab', { name: 'المستخلصات' }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), `ipc ${w}`).toBe(false);
  }
  await page.setViewportSize({ width: 375, height: 800 });
  await openFinancials(page);
  await page.getByRole('button', { name: '+ بند جديد' }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  await page.keyboard.press('Escape');
  expect(errors).toHaveLength(0);
});