import { test, expect } from '@playwright/test';

// Phase 3.8 — English coverage sweep (kept).
// Asserts that switching language leaves NO Arabic UI chrome behind, that
// every page group renders in both directions, and that the choice survives
// a reload. Mock data legitimately stays Arabic and is therefore excluded.
/** Language-agnostic: the demo-login tiles are labelled in the active language. */
const loginAsAny = async (page: any) => {
  await page.goto('/login');
  await page.getByRole('radio', { name: /^(مدير|Admin) \(/ }).click();
  await page.getByRole('button', { name: /دخول تجريبي|Demo login/ }).click();
  await page.locator('.shell').waitFor({ timeout: 10000 });
};
const loginAs = async (page: any) => { await loginAsAny(page); await toAr(page); };
const toEn = async (page: any) => {
  await page.locator('html[dir="ltr"]').waitFor({ state: 'attached', timeout: 5000 }).catch(() => {});
  const en = await page.locator('html[dir="ltr"]').count();
  if (!en) await page.getByRole('button', { name: 'ع/EN' }).click();
  await expect(page.locator('html[dir="ltr"]')).toHaveCount(1);
};
const toAr = async (page: any) => {
  const ar = await page.locator('html[dir="rtl"]').count();
  if (!ar) await page.getByRole('button', { name: 'ع/EN' }).click();
  await expect(page.locator('html[dir="rtl"]')).toHaveCount(1);
};

/** UI chrome only — record cells, <option> and mock data are excluded on purpose.
    The `ع/EN` toggle is a deliberate bilingual endonym (it must read the same in
    both directions), so it is excluded by a stable data hook, not a text match. */
const CHROME = [
  'nav', '.eyebrow', 'h1', 'h2', 'h3',
  '.toolbar button', '.btn:not([data-lang-toggle])', 'button:not([data-lang-toggle])',
  'label', 'th', '.card .l', '.card .f',
  '.errBox', '.empty', '.denyBox', '.offBanner', '.pager',
  '.sectionHead', '.recHead', '.tabs button', '.modal .formActions button',
];

const arabicIn = (page: any) =>
  page.evaluate((sels: string[]) => {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const sel of sels) {
      for (const el of Array.from(document.querySelectorAll(sel))) {
        // Opt-out for text that is BUSINESS DATA (project/item/user names typed
        // into the demo store). Those must never be translated, so the element
        // declares it rather than the audit silently ignoring a selector.
        if (el.closest('[data-i18n-skip]')) continue;
        // A scanned container (e.g. breadcrumbs `nav`) may legitimately embed
        // a skipped business-data child: strip those descendants so only real
        // UI chrome is audited.
        const probe = el.cloneNode(true) as HTMLElement;
        probe.querySelectorAll('[data-i18n-skip]').forEach((n) => n.remove());
        const txt = (probe.textContent ?? '').trim();
        if (!txt || seen.has(txt)) continue;
        seen.add(txt);
        if (/[\u0600-\u06FF]/.test(txt)) out.push(`${sel} :: ${txt.slice(0, 90)}`);
      }
    }
    return out;
  }, CHROME);

test.describe('English coverage', () => {
  test.beforeEach(async ({ page }) => { await loginAs(page); });

  const PAGES = [
    '/', '/projects', '/projects/p1/overview', '/projects/p1/sites',
    '/projects/p1/documents', '/projects/p1/warehouses', '/projects/p1/stock',
    '/projects/p1/financials', '/financials', '/archive',
    '/inventory', '/inventory/warehouses', '/inventory/items', '/inventory/stock',
    '/inventory/requests', '/admin', '/audit', '/reports', '/settings',
    '/search', '/notifications',
  ];

  for (const url of PAGES) {
    test(`no Arabic UI chrome in EN: ${url}`, async ({ page }) => {
      await toEn(page);
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.locator('.content').waitFor();
      await page.waitForTimeout(250); // let the mock load resolve
      expect(await arabicIn(page), `untranslated chrome on ${url}`).toEqual([]);
    });
  }

  test('both directions render the same screens (AR then EN)', async ({ page }) => {
    for (const [url, ar, en] of [
      ['/', 'يحتاج المراجعة', 'Needs review'],
      ['/inventory', 'الحركات والأرصدة', 'Movements, balances'],
      ['/inventory/items', 'دليل الأصناف', 'Items catalogue'],
      ['/inventory/warehouses', 'الكود/الاسم', 'Code / name'],
      ['/inventory/requests', 'الرقم/التاريخ', 'Number / date'],
      ['/projects', 'الكود / الاسم', 'Code / name'],
      ['/financials', 'الموقف المالي والتعاقدي', 'Financial and contractual position'],
      ['/archive', 'رفع مستند (تجريبي)', 'Upload document (demo)'],
      ['/admin', 'القسم / المسمى', 'Department / title'],
      ['/reports', 'عدد الأعمدة', 'Columns'],
      ['/audit', 'مسح الفلاتر', 'Clear filters'],
      ['/settings', 'عن النظام', 'About'],
      ['/notifications', 'تعليم الكل كمقروء', 'Mark all read'],
      ['/search', 'اكتب حرفين على الأقل', 'Type at least 2 characters'],
    ] as [string, string, string][]) {
      /* Phase 10.1 (GAP-04): this single test walks 14 pages × 2 directions =
         28 full navigations plus 28 language toggles. Against the 30s default
         per-test budget the loop is guaranteed to overflow (proven: passes in
         ~70-80s under --timeout=90000, fails at ~32s otherwise) — purely a
         budget issue, no locator or assertion defect. test.setTimeout() lifts
         this one test's budget only; no other test is affected. */
      test.setTimeout(90_000);
      await toAr(page);
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('.content').getByText(ar, { exact: false }).first()).toBeVisible({ timeout: 8000 });
      await toEn(page);
      await page.waitForTimeout(200);
      await expect(page.locator('.content').getByText(en, { exact: false }).first()).toBeVisible({ timeout: 8000 });
    }
  });

  test('the language choice survives a reload and needs no full reload to switch', async ({ page }) => {
    await toEn(page);
    await page.goto('/inventory/items', { waitUntil: 'domcontentloaded' });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('html[dir="ltr"]')).toHaveCount(1);
    await expect(page.locator('html[lang="en"]')).toHaveCount(1);
    await expect(page.locator('.content').getByText('Items catalogue').first()).toBeVisible();
    // switching back is instant and client-side (no navigation)
    await toAr(page);
    await expect(page.locator('html[dir="rtl"]')).toHaveCount(1);
    await expect(page.locator('html[lang="ar"]')).toHaveCount(1);
    await expect(page.locator('.content').getByText('دليل الأصناف').first()).toBeVisible();
  });

  test('mock error messages are shown in the selected language', async ({ page }) => {
    await toEn(page);
    await page.goto('/projects/p1/financials', { waitUntil: 'domcontentloaded' });
    await page.getByRole('tab', { name: 'Bill of quantities' }).click();
    // delete a line referenced by a certificate -> the refusal must read in English
    await page.locator('.recRow', { hasText: '01-01' }).getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click();
    await expect(page.locator('.errBox')).toContainText('The line cannot be deleted because certificates reference it.');
    // and the same refusal in Arabic
    await toAr(page);
    await page.getByRole('tab', { name: 'المقايسات' }).click();
    await page.locator('.recRow', { hasText: '01-01' }).getByRole('button', { name: 'حذف' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'تأكيد' }).click();
    await expect(page.locator('.errBox')).toContainText('لا يمكن حذف البند لوجود مستخلصات مرتبطة به');
  });

  test('permission denial reads in the selected language', async ({ page }) => {
    // viewer holds no users.manage — the guard must deny, in the chosen language
    await page.goto('/login');
    await page.getByRole('radio', { name: 'مشاهد (تجريبي)' }).click();
    await page.getByRole('button', { name: /دخول تجريبي/ }).click();
    await page.locator('.shell').waitFor({ timeout: 10000 });
    await toEn(page);
    await page.goto('/admin', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Not permitted' })).toBeVisible();
    await expect(page.locator('.denyBox')).toContainText('permission your demo role lacks');
    await toAr(page);
    await page.goto('/admin', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'لا صلاحية لديك' })).toBeVisible();
  });

  test('confirm dialogs use the punctuation of the active language', async ({ page }) => {
    await loginAs(page);
    await page.goto('/admin', { waitUntil: 'domcontentloaded' });
    await toEn(page);
    await page.locator('.recRow', { hasText: '@example.org' }).nth(1).getByRole('button', { name: 'More' }).click();
    await page.getByRole('menu').getByRole('menuitem', { name: 'Delete account' }).click();
    const dlg = page.getByRole('dialog');
    await expect(dlg).toContainText('Permanent deletion is simulated only.');
    // an English sentence must not carry the Arabic question mark
    await expect(dlg).not.toContainText('؟');
    await page.keyboard.press('Escape');
    await toAr(page);
    await page.locator('.recRow', { hasText: '@example.org' }).nth(1).getByRole('button', { name: 'المزيد' }).click();
    await page.getByRole('menu').getByRole('menuitem', { name: 'حذف الحساب' }).click();
    await expect(page.getByRole('dialog')).toContainText('الحذف النهائي محاكى فقط');
    await page.keyboard.press('Escape');
  });

test('no CJK/Hangul/Kana/fullwidth characters reach the screen', async ({ page }) => {
  // Guards against silent script corruption in seed data or dictionary values:
  // a stray CJK glyph inside an Arabic string renders as an unreadable box.
  const SCAN = '[\u3000-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF\uFF00-\uFFEF]';
  const offenders = async (label: string) => {
    const found = await page.evaluate((re: string) => {
      const rx = new RegExp(re);
      const out: string[] = [];
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let n = w.nextNode();
      while (n) {
        const txt = (n.textContent ?? '').trim();
        if (txt && rx.test(txt)) out.push(txt.slice(0, 80));
        n = w.nextNode();
      }
      return out;
    }, SCAN);
    expect(found, `CJK glyphs rendered on ${label}`).toEqual([]);
  };

  // the audit trail is the densest seed data — check it first, both directions
  for (const url of ['/audit', '/admin', '/inventory/items', '/archive', '/reports']) {
    await toAr(page);
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(250);
    await offenders(`${url} [ar]`);
    await toEn(page);
    await page.waitForTimeout(250);
    await offenders(`${url} [en]`);
  }
  // and the audit diff viewer itself, where the corrupted seed used to surface
  await toAr(page);
  await page.goto('/audit', { waitUntil: 'domcontentloaded' });
  await page.getByRole('searchbox', { name: 'بحث' }).fill('ROLE-management');
  await page.getByRole('button', { name: 'التفاصيل' }).first().click();
  await expect(page.getByRole('dialog')).toContainText('موروث');
  await expect(page.getByRole('dialog')).toContainText('منع');
});

test('mixed-direction identifiers stay readable in RTL', async ({ page }) => {
    await toAr(page);
    await page.goto('/projects', { waitUntil: 'domcontentloaded' });
    const code = page.locator('.num.ltr', { hasText: 'PRJ-004' }).first();
    await expect(code).toBeVisible();
    expect(await code.evaluate((el) => getComputedStyle(el).direction)).toBe('ltr');
    await page.goto('/admin', { waitUntil: 'domcontentloaded' });
    const email = page.locator('.num.ltr', { hasText: '@example.org' }).first();
    await expect(email).toBeVisible();
    expect(await email.evaluate((el) => getComputedStyle(el).direction)).toBe('ltr');
    // and no horizontal overflow is introduced by the isolation
    for (const w of [320, 375, 430, 768, 1366]) {
      await page.setViewportSize({ width: w, height: 800 });
      await page.goto('/admin');
      expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), `admin ${w}`).toBe(false);
    }
  });
});