import { test, expect } from '@playwright/test';
import * as fs from 'fs';

// Phase 3.7 exports + audit filtering verification (kept).
// Temp output only; mock data only; nothing leaves the browser.
const loginAs = async (page: any, role: string) => {
  await page.goto('/login');
  await page.getByRole('radio', { name: role }).click();
  await page.getByRole('button', { name: /دخول تجريبي/ }).click();
  await page.locator('.shell').waitFor({ timeout: 10000 });
};
const rowOf = (page: any, needle: string) => page.locator('.recRow', { hasText: needle });

/** Click an export button (scoped to a report row when `reportId` is given)
    and return the downloaded filename plus its decoded text. */
const grab = async (page: any, buttonName: string, reportId?: string) => {
  const btn = reportId
    ? page.locator('.recRow', { hasText: reportId }).getByRole('button', { name: buttonName })
    : page.getByRole('button', { name: buttonName }).first();
  const [download] = await Promise.all([page.waitForEvent('download'), btn.click()]);
  const p = await download.path();
  expect(p, 'download produced a file').toBeTruthy();
  return { name: download.suggestedFilename(), text: fs.readFileSync(p as string, 'utf8') };
};
/** Data rows only — the first line is the header. */
const dataRows = (csv: string) => csv.slice(1).split('\r\n').filter(Boolean).slice(1);

test.beforeEach(async ({ page }) => {
  await loginAs(page, 'مدير (تجريبي)');
});

/* ---------------- CSV mechanics ---------------- */

test('CSV export downloads a real file with the audited columns and Arabic intact', async ({ page }) => {
  await page.goto('/reports');
  // the stock report is the one whose column set mirrors `expandForExport`
  // (the row shows the report id `stock`; the file stem is `stock-movements`)
  const f = await grab(page, 'تصدير CSV', 'stock');
  expect(f.name).toMatch(/^stock-movements-\d{4}-\d{2}-\d{2}\.csv$/);
  // UTF-8 BOM first, so Excel reads the Arabic as UTF-8 rather than mojibake
  expect(f.text.charCodeAt(0)).toBe(0xfeff);
  const lines = f.text.slice(1).split('\r\n');
  expect(lines[0]).toBe('number,type,date,warehouse,destination warehouse,project,reference number,notes,lines');
  expect(lines.length).toBeGreaterThan(2);
  // Arabic renders as real characters, not escaped or transliterated
  expect(f.text).toContain('طوب');
  expect(f.text).not.toContain('\\u');
  // no trailing CRLF: every record is exactly one line
  expect(f.text.endsWith('\r\n')).toBe(false);
});

test('CSV quoting survives commas, quotes and newlines', async ({ page }) => {
  // Inject the payload through the real stock form so it is genuine user input.
  await page.goto('/inventory/stock');
  await expect(page.locator('.recRow').first()).toBeVisible({ timeout: 8000 });
  await page.getByRole('button', { name: '+ حركة جديدة' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByLabel('التاريخ', { exact: true }).fill('2026-10-13');
  await dlg.getByLabel('الصنف 1').selectOption('i6');
  await dlg.getByLabel('الكمية 1').fill('3');
  // comma + double quote + a newline inside one free-text field
  await dlg.getByLabel('ملاحظات').fill('دفعة "أولى", مع ملاحظة\nسطر ثانٍ');
  await dlg.getByRole('button', { name: 'مراجعة الحركة' }).click();
  await dlg.getByRole('button', { name: 'تسجيل الحركة' }).click();
  await expect(dlg).toBeHidden();

  // Client-side navigation only: a full page load would re-seed the in-memory
  // mock and throw away the movement just created.
  await page.locator('nav').getByRole('link', { name: 'التقارير والتصدير' }).click();
  const f = await grab(page, 'تصدير CSV', 'stock');
  const rows = dataRows(f.text);
  // the quoted field stays on ONE record: the embedded newline lives inside quotes
  const row = rows.find((l) => l.includes('دفعة'))!;
  expect(row).toContain('"دفعة ""أولى"", مع ملاحظة\nسطر ثانٍ"');
  // the record still parses as the right number of columns
  expect(row.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).length).toBe(9);
  // the mock data itself is untouched — the quotes went into the store verbatim
  const stored = await page.evaluate(() => {
    const api = (window as any).__protoApi;
    return api.stockApi.list({ pageSize: 200 }, 'mu-1').items
      .map((t: any) => t.notes).filter((n: string) => n && n.includes('دفعة'))[0];
  });
  expect(stored).toBe('دفعة "أولى", مع ملاحظة\nسطر ثانٍ');
});

test('CSV formula injection is neutralized on the export copy only', async ({ page }) => {
  await page.goto('/inventory/stock');
  await expect(page.locator('.recRow').first()).toBeVisible({ timeout: 8000 });
  await page.getByRole('button', { name: '+ حركة جديدة' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByLabel('التاريخ', { exact: true }).fill('2026-10-13');
  await dlg.getByLabel('الصنف 1').selectOption('i6');
  await dlg.getByLabel('الكمية 1').fill('2');
  await dlg.getByLabel('المرجع', { exact: true }).fill('=HYPERLINK("http://example.invalid","pwn")');
  await dlg.getByLabel('ملاحظات').fill('@SUM(1+1)*cmd|"/c calc"!A1');
  await dlg.getByRole('button', { name: 'مراجعة الحركة' }).click();
  await dlg.getByRole('button', { name: 'تسجيل الحركة' }).click();
  await expect(dlg).toBeHidden();

  // client-side navigation — a full reload would discard the new movement
  await page.locator('nav').getByRole('link', { name: 'التقارير والتصدير' }).click();
  const f = await grab(page, 'تصدير CSV', 'stock');
  // every dangerous lead character is neutralized with a leading apostrophe
  expect(f.text).toContain(`"'=HYPERLINK(""http://example.invalid"",""pwn"")"`);
  expect(f.text).toContain(`"'@SUM(1+1)*cmd|""/c calc""!A1"`);
  // no cell still STARTS a formula
  const cells = f.text.slice(1).split('\r\n').flatMap((l) => l.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/));
  expect(cells.filter((c) => /^[=+\-@]/.test(c))).toEqual([]);

  // the underlying mock value is unchanged — only the export representation moved
  const stored = await page.evaluate(() => {
    const api = (window as any).__protoApi;
    return api.stockApi.list({ pageSize: 200 }, 'mu-1').items
      .find((t: any) => t.referenceNumber?.startsWith('='))?.referenceNumber;
  });
  expect(stored).toBe('=HYPERLINK("http://example.invalid","pwn")');
});

test('JSON export mirrors the scoped rows', async ({ page }) => {
  await page.goto('/reports');
  const f = await grab(page, 'تصدير JSON', 'stock');
  expect(f.name).toMatch(/\.json$/);
  const parsed = JSON.parse(f.text);
  expect(Array.isArray(parsed)).toBe(true);
  expect(parsed.length).toBeGreaterThan(1);
  expect(Object.keys(parsed[0])).toEqual(['number', 'type', 'date', 'warehouse', 'destination', 'project', 'referenceNumber', 'notes', 'lines']);
});

test('an empty result set still downloads a header-only file', async ({ page }) => {
  await page.goto('/audit');
  // a combination that matches nothing
  await page.getByRole('searchbox', { name: 'بحث' }).fill('لا-يوجد-مثل هذا');
  await expect(page.getByText('لا نتائج مطابقة')).toBeVisible();
  const f = await grab(page, 'تصدير CSV');
  const lines = f.text.slice(1).split('\r\n');
  expect(lines).toHaveLength(1);
  expect(lines[0]).toContain('timestamp,username,action,entity,entity id,changes');
});

/* ---------------- permissions + project scope ---------------- */

test('no reports.view: the route, the nav entry and the mock path all refuse', async ({ page }) => {
  // viewer role (mu-4) holds neither reports.view nor audit.view
  await page.getByRole('button', { name: 'خروج' }).click();
  await loginAs(page, 'مشاهد (تجريبي)');
  // the nav entry is not offered
  await expect(page.locator('nav').getByRole('link', { name: /التقارير/ })).toHaveCount(0);
  // the route is guarded
  await page.goto('/reports');
  await expect(page.getByText('لا صلاحية لديك')).toBeVisible();
  await expect(page.getByRole('button', { name: 'تصدير CSV' })).toHaveCount(0);
  // and a DIRECT mock call is refused, not merely hidden
  const direct = await page.evaluate(async () => {
    const api = (window as any).__protoApi;
    const out: any = {};
    for (const id of ['projects', 'stock', 'boq', 'ipc', 'audit', 'items', 'warehouses', 'requests']) {
      out[id] = await api.reportApi.export('mu-4', id, 'csv');
    }
    out.preview = api.reportApi.preview('mu-4', 'projects');
    out.available = api.reportApi.available('mu-4').length;
    return out;
  });
  for (const id of ['projects', 'stock', 'boq', 'ipc', 'audit', 'items', 'warehouses', 'requests']) {
    expect(direct[id].ok, `${id} must be refused`).toBe(false);
    expect(direct[id].code).toBe(403);
  }
  expect(direct.preview.ok).toBe(false);
  expect(direct.available).toBe(0);
});

test('partial project access: the export can never widen the visible scope', async ({ page }) => {
  // admin (access p1..p4) sees every project row
  const admin = await (async () => {
    await page.goto('/reports');
    return grab(page, 'تصدير CSV', 'projects');
  })();
  expect(admin.text).toContain('PRJ-004');   // p1
  expect(admin.text).toContain('PRJ-007');   // p2
  expect(admin.text).toContain('PRJ-002');   // p3
  expect(admin.text).toContain('PRJ-009');   // p4

  // management (mu-7) has access to p1 only
  await page.getByRole('button', { name: 'خروج' }).click();
  await loginAs(page, 'إدارة (تجريبي)');
  await page.goto('/reports');
  const mgr = await grab(page, 'تصدير CSV', 'projects');
  expect(mgr.text).toContain('PRJ-004');          // p1 present…
  expect(mgr.text).not.toContain('PRJ-007');      // …p2 absent
  expect(mgr.text).not.toContain('PRJ-002');      // …p3 absent
  expect(mgr.text).not.toContain('PRJ-009');      // …p4 absent

  // the BOQ export is bounded the same way: only p1's five lines
  const boq = await page.evaluate(async () => {
    const api = (window as any).__protoApi;
    const r = await api.reportApi.export('mu-7', 'boq', 'csv');
    return r.ok ? { ok: true as const, text: r.text } : r;
  });
  expect(boq.ok).toBe(true);
  expect(boq.text).toContain('01-01');                 // p1's first line
  expect(boq.text).toContain('أعمال كهربائية');         // p1's last line
  expect(boq.text).not.toContain('أعمال تشطيب');        // p2's last line
  // every single exported row belongs to p1
  for (const l of dataRows(boq.text)) expect(l.startsWith('PRJ-004,')).toBe(true);

  // and the preview never offers more than the export would write
  const scoped = await page.evaluate(() => {
    const api = (window as any).__protoApi;
    const p = api.reportApi.preview('mu-7', 'boq');
    return { rows: p.rows.length, cols: [...new Set(p.rows.map((r: any) => r.projectCode))] };
  });
  expect(scoped.rows).toBe(5);
  expect(scoped.cols).toEqual(['PRJ-004']);
});

test('reports.view granted by an override is honoured (DENY still wins)', async ({ page }) => {
  // mu-2 (warehouse) carries a reports.view GRANT override — export must work
  const granted = await page.evaluate(async () => {
    const api = (window as any).__protoApi;
    const r = await api.reportApi.export('mu-2', 'stock', 'csv');
    return r.ok ? { ok: true as const, n: r.rowCount } : r;
  });
  expect(granted.ok).toBe(true);
  expect(granted.n).toBeGreaterThan(0);

  // flip it to DENY in the live store: the same call must now fail
  const denied = await page.evaluate(async () => {
    const api = (window as any).__protoApi;
    api.userApi.setOverrides('mu-2', { 'warehouse.edit': 'DENY', 'reports.view': 'DENY' });
    const r = await api.reportApi.export('mu-2', 'stock', 'csv');
    return r.ok ? { ok: true as const } : r;
  });
  expect(denied.ok).toBe(false);
  expect(denied.code).toBe(403);
  // restore so later files see the seeded state
  await page.evaluate(() => (window as any).__protoApi.userApi.setOverrides('mu-2', { 'warehouse.edit': 'DENY', 'reports.view': 'GRANT' }));
});

test('a report id that does not exist is a 404, not an empty file', async ({ page }) => {
  const r = await page.evaluate(async () => (window as any).__protoApi.reportApi.export('mu-1', 'nope', 'csv'));
  expect(r.ok).toBe(false);
  expect(r.code).toBe(404);
});

/* ---------------- audit filtering ---------------- */

test('audit: search, multi-filter, clear, count and empty state', async ({ page }) => {
  await page.goto('/audit');
  await expect(page.locator('.recRow').first()).toBeVisible({ timeout: 8000 });
  await expect(page.locator('.recRow')).toHaveCount(10); // page size
  await expect(page.getByText('32 سجل مطابق')).toBeVisible();

  // single text filter
  await page.getByRole('searchbox', { name: 'بحث' }).fill('مستخلص');
  await expect(page.locator('.recRow').first()).toBeVisible();
  await expect(page.getByText(/سجل مطابق/)).not.toContainText('32');
  await expect(rowOf(page, 'مستخلص')).not.toHaveCount(0);

  // two filters combined — a user AND an entity
  await page.getByRole('searchbox', { name: 'بحث' }).fill('');
  await page.getByLabel('المستخدم', { exact: true }).selectOption('منى سمير (تجريبية)');
  await page.getByLabel('الكيان', { exact: true }).selectOption('طلب مواد');
  // منى has two material-request entries in the seed (one rejected, one approved)
  await expect(page.getByText('2 سجل مطابق')).toBeVisible();
  await expect(rowOf(page, 'طلب مواد')).toHaveCount(2);

  // a third filter narrows further, and one that conflicts yields an honest empty state
  await page.getByLabel('العملية', { exact: true }).selectOption('اعتماد');
  await expect(page.getByText('1 سجل مطابق')).toBeVisible();
  await page.getByLabel('العملية', { exact: true }).selectOption('حذف');
  await expect(page.getByText('لا نتائج مطابقة')).toBeVisible();
  await expect(page.getByRole('button', { name: 'مسح الفلاتر' }).first()).toBeEnabled();

  // clear restores the full permitted set
  await page.getByRole('button', { name: 'مسح الفلاتر' }).first().click();
  await expect(page.getByText('32 سجل مطابق')).toBeVisible();
  await expect(page.locator('.recRow')).toHaveCount(10);
});

test('audit: date range narrows, and an inverted range is simply empty', async ({ page }) => {
  await page.goto('/audit');
  await expect(page.locator('.recRow').first()).toBeVisible({ timeout: 8000 });
  await page.getByLabel('من تاريخ').fill('2026-10-10');
  await page.getByLabel('إلى تاريخ').fill('2026-10-12');
  const n = Number((await page.getByText(/سجل مطابق/).innerText()).replace(/[^0-9]/g, ''));
  expect(n).toBe(8); // 10-12 ×2, 10-11 ×3, 10-10 ×3
  for (const row of await page.locator('.recRow').all()) {
    const d = (await row.locator('.num').first().innerText()).slice(0, 10);
    expect(d >= '2026-10-10' && d <= '2026-10-12').toBe(true);
  }
  await page.getByLabel('من تاريخ').fill('2026-10-12');
  await page.getByLabel('إلى تاريخ').fill('2026-10-01');
  await expect(page.getByText('لا نتائج مطابقة')).toBeVisible();
});

test('audit: sorting is real and changing it returns to page 1', async ({ page }) => {
  await page.goto('/audit');
  await expect(page.locator('.recRow').first()).toBeVisible({ timeout: 8000 });
  // default: newest first
  expect((await page.locator('.recRow').first().locator('.num').first().innerText()).startsWith('2026-10-12')).toBe(true);

  // walk to page 3 so the "reset" behaviour is observable
  await page.getByRole('button', { name: 'التالي' }).click();
  await page.getByRole('button', { name: 'التالي' }).click();
  await expect(page.getByText('صفحة 3 من 4')).toBeVisible();
  await expect(page.getByText('32 سجل مطابق')).toBeVisible();

  // toggling the sort direction resets to page 1
  await page.getByRole('button', { name: /التاريخ والوقت/ }).click();
  await expect(page.getByText('صفحة 1 من 4')).toBeVisible();
  expect((await page.locator('.recRow').first().locator('.num').first().innerText()).startsWith('2026-09-28')).toBe(true);

  // sorting by user is genuinely ordered
  await page.getByRole('button', { name: /المستخدم/ }).click();
  await expect(page.getByText('صفحة 1 من 4')).toBeVisible();
  const cells = await page.locator('.recRow').evaluateAll((rows: HTMLElement[]) =>
    rows.map((r) => r.children[1].textContent ?? ''));
  expect(cells).toEqual([...cells].sort((a, b) => a.localeCompare(b)));
});

test('audit: filtering resets pagination and results stay stable across pages', async ({ page }) => {
  await page.goto('/audit');
  await expect(page.locator('.recRow').first()).toBeVisible({ timeout: 8000 });
  const pageOne = await page.locator('.recRow').allInnerTexts();

  await page.getByRole('button', { name: 'التالي' }).click();
  await expect(page.getByText('صفحة 2 من 4')).toBeVisible();
  // page 2 is genuinely different content, not a re-render of page 1
  expect(await page.locator('.recRow').allInnerTexts()).not.toEqual(pageOne);

  // a range that still needs two pages, and whose first page differs from the
  // unfiltered first page, applied while sitting on page 2
  await page.getByLabel('من تاريخ').fill('2026-09-28');
  await page.getByLabel('إلى تاريخ').fill('2026-10-05');
  await expect(page.getByText('صفحة 1 من 2')).toBeVisible();
  await expect(page.getByText('16 سجل مطابق')).toBeVisible();
  const filteredFirstPage = await page.locator('.recRow').allInnerTexts();
  expect(filteredFirstPage).not.toEqual(pageOne);

  // clearing restores the original first page exactly — no drift, no re-shuffle
  await page.getByRole('button', { name: 'مسح الفلاتر' }).first().click();
  await expect(page.locator('.recRow')).toHaveCount(10);
  expect(await page.locator('.recRow').allInnerTexts()).toEqual(pageOne);
});

test('audit: export honours the active filters', async ({ page }) => {
  await page.goto('/audit');
  await expect(page.locator('.recRow').first()).toBeVisible({ timeout: 8000 });
  await page.getByLabel('الكيان', { exact: true }).selectOption('مستخلص');
  const onScreen = Number((await page.getByText(/سجل مطافق|سجل مطابق/).innerText()).replace(/[^0-9]/g, ''));
  const f = await grab(page, 'تصدير CSV');
  expect(dataRows(f.text)).toHaveLength(onScreen);
  expect(f.text).toContain('entity id');
  // only certificates in the file
  for (const l of dataRows(f.text)) expect(l).toContain('مستخلص');

  // clearing the filter writes the whole trail again
  await page.getByRole('button', { name: 'مسح الفلاتر' }).first().click();
  const all = await grab(page, 'تصدير CSV');
  expect(dataRows(all.text)).toHaveLength(32);
});

test('audit: details modal shows the recorded change or says there is none', async ({ page }) => {
  await page.goto('/audit');
  await page.getByRole('searchbox', { name: 'بحث' }).fill('MR-2026-0015');
  await expect(page.locator('.recRow')).toHaveCount(1);
  await page.getByRole('button', { name: 'التفاصيل' }).click();
  const dlg = page.getByRole('dialog');
  await expect(dlg.getByText('الحالة')).toBeVisible();
  await expect(dlg.getByText('معتمدة')).toBeVisible();
  await expect(dlg).toContainText('لا يمكن تعديله أو حذفه');
  await page.keyboard.press('Escape');

  // a login entry records no old/new values — say so instead of inventing any
  await page.getByRole('searchbox', { name: 'بحث' }).fill('S-2026-10-06-01');
  await page.getByRole('button', { name: 'التفاصيل' }).click();
  await expect(page.getByRole('dialog').getByText('لا توجد قيم قديمة/جديدة مسجّلة')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'التفاصيل' })).toBeFocused();
});

/* ---------------- UX gates ---------------- */

test('audit + reports: EN/LTR, keyboard focus, overflow matrix, clean console', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message.split('\n')[0]));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) errors.push(m.text().slice(0, 140)); });

  // EN / LTR
  await page.goto('/audit');
  await expect(page.locator('.recRow').first()).toBeVisible({ timeout: 8000 });
  await page.getByRole('button', { name: 'ع/EN' }).click();
  await expect(page.locator('html[dir="ltr"]')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Clear filters' }).first()).toBeVisible();
  await expect(page.getByText('matching entries').first()).toBeVisible();
  await page.goto('/reports');
  await expect(page.getByRole('heading', { name: 'Reports & exports' })).toBeVisible();
  await expect(page.getByText('Stock movements').first()).toBeVisible();
  await page.getByRole('button', { name: 'ع/EN' }).click();
  await expect(page.locator('html[dir="rtl"]')).toHaveCount(1);

  // keyboard: filters reachable, modal traps and restores focus
  await page.goto('/audit');
  await expect(page.locator('.recRow').first()).toBeVisible({ timeout: 8000 });
  await page.getByRole('searchbox', { name: 'بحث' }).focus();
  await page.keyboard.type('مستند');
  await expect(page.getByText(/سجل مطابق/)).not.toContainText('32');
  await page.getByRole('button', { name: 'التفاصيل' }).first().focus();
  await page.keyboard.press('Enter');
  const dlg = page.getByRole('dialog');
  await expect(dlg).toBeVisible();
  await expect.poll(async () => page.evaluate(() => !!document.querySelector('.modal')?.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dlg).toBeHidden();
  await expect(page.getByRole('button', { name: 'التفاصيل' }).first()).toBeFocused();

  // the eight-width matrix on both screens…
  for (const w of [320, 375, 390, 430, 768, 1024, 1366, 1920]) {
    await page.setViewportSize({ width: w, height: 800 });
    await page.goto('/audit');
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), `audit ${w}`).toBe(false);
    await page.goto('/reports');
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), `reports ${w}`).toBe(false);
  }
  // …and inside an open modal at the narrowest width
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/audit');
  await page.getByRole('button', { name: 'التفاصيل' }).first().click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  await page.keyboard.press('Escape');
  await page.goto('/reports');
  await page.getByRole('button', { name: 'معاينة' }).first().click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);

  expect(errors).toEqual([]);
});

/* ---------------- contextual per-list export ---------------- */
// Same engine, same gates, same scope — called from the list itself instead
// of the Reports page. Phase 3.12 adds a prototype-only documents report, so
// Archive joins Warehouses/Items here (metadata CSV, never file contents).

test('warehouses: contextual export writes exactly the filtered list', async ({ page }) => {
  await page.goto('/inventory/warehouses');
  await expect(page.locator('.ctxExport')).toContainText('6');
  await page.getByRole('searchbox', { name: 'بحث' }).fill('البرج');
  await expect(page.locator('.recRow')).toHaveCount(1);
  await expect(page.locator('.ctxExport')).toContainText('1');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('.ctxExport').getByRole('button', { name: 'تصدير CSV' }).click(),
  ]);
  const p = await download.path();
  expect(p, 'download produced a file').toBeTruthy();
  expect(download.suggestedFilename()).toMatch(/^warehouses-\d{4}-\d{2}-\d{2}\.csv$/);
  const text = fs.readFileSync(p as string, 'utf8');
  expect(dataRows(text)).toHaveLength(1);
  expect(text).toContain('WH-S1');
  expect(text).not.toContain('WH-C1');
});

test('warehouses: management export stays inside the project scope', async ({ page }) => {
  await page.getByRole('button', { name: 'خروج' }).click();
  await loginAs(page, 'إدارة (تجريبي)');
  await page.goto('/inventory/warehouses');
  await expect(page.locator('.ctxExport')).toContainText('3');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('.ctxExport').getByRole('button', { name: 'تصدير CSV' }).click(),
  ]);
  const text = fs.readFileSync((await download.path()) as string, 'utf8');
  expect(dataRows(text)).toHaveLength(3);
  expect(text).toContain('WH-C1');
  expect(text).toContain('WH-S1');
  expect(text).not.toContain('WH-S2');
  expect(text).not.toContain('WH-S3');
  expect(text).not.toContain('WH-S4');
});

test('items: contextual JSON export writes the scoped catalogue', async ({ page }) => {
  await page.goto('/inventory/items');
  await expect(page.locator('.ctxExport')).toContainText('6');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('.ctxExport').getByRole('button', { name: 'تصدير JSON' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^items-\d{4}-\d{2}-\d{2}\.json$/);
  const parsed = JSON.parse(fs.readFileSync((await download.path()) as string, 'utf8'));
  expect(parsed).toHaveLength(6);
  expect(parsed.map((r: any) => r.code)).toContain('ITM-001');
});