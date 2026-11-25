import { test, expect, type Page } from '@playwright/test';

// Phase 6 — Dashboard (COS) & Projects regression suite.
// Every expected number below is derived from the deterministic fixtures in
// src/services/api/adapters/mock/data.ts (never invented), resolved through
// the SAME scoping rule the pages consume:
//   - docs: p1 = d1,d2,d3 · p2 = d4 · p3 = d6,d7 · projectless = d5,d8
//   - warehouses w2→p1 · w3→p2 · w5→p3 · w6→p4 (w1/w4 projectless)
//   - visibleProjects: no `projects.access` base grant → identity access map;
//     admin resolves to p1..p4 through mu-1's access map
//   - mu-1 admin (p1 DELETE · p2 WRITE · p3 READ · p4 READ)
//       → 4 projects / 8 docs / 6 warehouses · 6 items; recent moves unfiltered
//   - mu-3 technical (p1 WRITE, p2 READ)
//       → 2 projects / 6 docs (p3 titles d6/d7 must not leak) / recent moves
//         = RET-403, GOUT-207, TRF-304, GOUT-206 (p3's GOUT-203 must not leak)
//   - mu-4 viewer (no membership)
//       → 0 projects / 2 docs (d5,d8) / recent moves = RET-403, TRF-304,
//         GIN-105, ADJ-503 (GOUT-207/GOUT-206 + p2's d4 must not leak)
// Finding 1 (Phase 5): the topbar carried 925px of content in a 390px viewport
//   and ع/EN sat beyond the edge — the fix hides .tbCmd/.demoBadge/.topbar kbd/
//   .userChip at ≤767px; the toggle must be reachable AND still flip the language.
// Finding 2 (Phase 5→6): `.recTable--sub` shells share one grid (subgrid), so
//   computed head columns === every row's columns, exactly.
// Duplicate submission: a genuine double-tap on save fires the handler twice
//   inside one React batch (before any re-render) — the render-time `disabled`
//   cannot cover that window, so the guard is a synchronous ref. The test
//   dispatches two clicks in one evaluate() to reproduce exactly that window.

const loginAs = async (page: Page, idx: number) => {
  // Role tiles: admin=0, manager=1, warehouse=2, viewer=3, technical=4
  // (DEMO_ROLES order — same convention as phase5.spec.ts).
  await page.goto('/login');
  await page.locator('.rolePick label').nth(idx).click();
  await page.getByRole('button', { name: /دخول تجريبي|Demo login/ }).click();
  await page.locator('.shell').waitFor({ timeout: 10000 });
};

/** Collects uncaught page errors in the current test; assert none at the end. */
const trackErrors = (page: Page): { msgs: string[]; off: () => void } => {
  const msgs: string[] = [];
  const h = (e: Error) => msgs.push(e.message);
  page.on('pageerror', h);
  return { msgs, off: () => page.off('pageerror', h) };
};

const bodyText = (page: Page) => page.locator('body').textContent().then((s) => s ?? '');

/**
 * Dashboard stat cards: Home renders the three scoped overview cards
 * (المشاريع/الأرشيف/المخزون) plus up to three MR queue cards for roles with
 * materialRequests.view — so assertions target the scoped trio by label and
 * never depend on how many queue cards the fixture yields for a role.
 */
const statValue = async (page: Page, label: string) => {
  const cards = await page.evaluate(() =>
    [...document.querySelectorAll('.statCard')].map((c) => ({
      label: c.querySelector('.l')?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      value: c.querySelector('.v.num')?.textContent?.replace(/\s+/g, '').trim() ?? '',
    })),
  );
  return cards.find((c) => c.label === label)?.value ?? '(missing)';
};

test.describe('Phase 6 — dashboard scoped data & permission matrices', () => {
  test('admin (mu-1): full-scope numbers 4 projects / 8 docs / 6-6 inventory; recent moves unfiltered', async ({ page }) => {
    const errs = trackErrors(page);
    await loginAs(page, 0);
    await page.goto('/');
    await expect(page.locator('.statCard').first()).toBeVisible();
    await expect.poll(() => statValue(page, 'المشاريع'), { timeout: 15000 }).toBe('4');
    expect(await statValue(page, 'الأرشيف')).toBe('8');
    expect(await statValue(page, 'المخزون')).toBe('6/6');
    const body = await bodyText(page);
    expect(body).toContain('RET-403'); // newest projectless txn — always visible
    expect(body).toContain('GOUT-207'); // p1 txn — admin reaches everything
    expect(errs.msgs).toEqual([]);
    errs.off();
  });

  test('technical (mu-3): scoped to 2 projects / 6 docs; p3 content leaks nowhere', async ({ page }) => {
    const errs = trackErrors(page);
    await loginAs(page, 4);
    await page.goto('/');
    await expect(page.locator('.statCard').first()).toBeVisible();
    await expect.poll(() => statValue(page, 'المشاريع'), { timeout: 15000 }).toBe('2');
    expect(await statValue(page, 'الأرشيف')).toBe('6');
    expect(await statValue(page, 'المخزون')).toBe('6/6'); // facades scope by canRead, not membership
    const body = await bodyText(page);
    expect(body).not.toContain('مخطط معماري مرفوض'); // d6 — p3-only document
    expect(body).not.toContain('محضر استلام موقع'); // d7 — p3-only document
    expect(body).not.toContain('GOUT-203'); // p3 txn must not leak into recent moves
    expect(errs.msgs).toEqual([]);
    errs.off();
  });

  test('viewer (mu-4): 0 projects / 2 docs; recent rows only show reachable refs; /projects is the scoped empty state', async ({ page }) => {
    const errs = trackErrors(page);
    await loginAs(page, 3);
    await page.goto('/');
    await expect(page.locator('.statCard').first()).toBeVisible();
    await expect.poll(() => statValue(page, 'المشاريع'), { timeout: 15000 }).toBe('0');
    expect(await statValue(page, 'الأرشيف')).toBe('2');
    expect(await statValue(page, 'المخزون')).toBe('6/6');
    const body = await bodyText(page);
    expect(body).toContain('تقرير اختبار خرسانة'); // d5 — projectless
    expect(body).toContain('أرشيف ٢٠٢٤'); // d8 — projectless
    expect(body).not.toContain('مقايسة بنود التشطيب'); // d4 — p2 must not leak
    expect(body).not.toContain('GOUT-207'); // p1 txn must not leak
    expect(body).not.toContain('GOUT-206'); // w2→p1 txn must not leak
    for (const n of ['RET-403', 'TRF-304', 'GIN-105', 'ADJ-503']) expect(body).toContain(n);
    // 0 projects on the card → the projects page is the honest scoped empty state
    await page.goto('/projects');
    await expect(page.locator('.empty')).toContainText('لا توجد مشاريع ضمن نطاق وصول دورك');
    await expect(page.locator('.cmdHead button', { hasText: 'المشاريع' })).toHaveCount(0);
    expect(errs.msgs).toEqual([]);
    errs.off();
  });
});

test.describe('Phase 6 — Projects list (function + permission matrix)', () => {
  test('technical (mu-3): exactly PRJ-004 + PRJ-007; details-only rows; no create', async ({ page }) => {
    const errs = trackErrors(page);
    await loginAs(page, 4);
    await page.goto('/projects');
    await expect(page.locator('.recRow')).toHaveCount(2);
    const body = await bodyText(page);
    expect(body).toContain('PRJ-004');
    expect(body).toContain('PRJ-007');
    expect(body).not.toContain('PRJ-002'); // p3 — no membership
    expect(body).not.toContain('PRJ-009'); // p4 — no membership
    await expect(page.locator('.recRow button')).toHaveCount(0); // role has no projects.edit/delete
    await expect(page.locator('.recRow a.linkBtn')).toHaveCount(2); // details on both rows
    await expect(page.locator('.cmdHead button', { hasText: 'المشاريع' })).toHaveCount(0); // role lacks projects.create
    expect(errs.msgs).toEqual([]);
    errs.off();
  });

  test('admin (mu-1): create survives a genuine double-tap (exactly one row), then the mock row deletes', async ({ page }) => {
    const errs = trackErrors(page);
    await loginAs(page, 0);
    await page.goto('/projects');
    await expect(page.locator('.recRow')).toHaveCount(4);
    expect(await bodyText(page)).toContain('PRJ-002'); // 'code' asc → first sorted fixture code
    // create — Phase 9 CR-01 remediation made `projectSchema.code` REQUIRED on
    // the audited contract, so the form now needs the code too (old name-only
    // path retired; single disclosed test-line accommodation)
    await page.locator('.cmdHead button', { hasText: 'المشاريع' }).click();
    await page.locator('input[aria-label="كود المشروع *"]').fill('PRJ-MOCK');
    await page.locator('input[aria-label="اسم المشروع *"]').fill('مشروع تجربة النقر المزدوج');
    // two synchronous clicks inside one React batch — the exact duplicate window
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('.formActions button')].find((x) => x.textContent?.trim() === 'حفظ') as HTMLButtonElement | undefined;
      if (!b || b.disabled) throw new Error('save button missing/disabled');
      b.click();
      b.click();
    });
    await expect(page.locator('.modal')).toHaveCount(0); // modal unmounted after the first tap
    await page.locator('input[aria-label="بحث"]').fill('PRJ-MOCK');
    await expect(page.locator('.recRow')).toHaveCount(1); // exactly ONE row despite the double tap
    // delete the mock row via its row action + confirm dialog
    await page.locator('.recRow button', { hasText: 'حذف' }).click();
    await page.getByRole('button', { name: 'تأكيد' }).click();
    await expect(page.locator('.recRow')).toHaveCount(0); // filtered list is empty after deletion
    // clearing the filter restores the 4 scoped fixture rows
    await page.locator('input[aria-label="بحث"]').fill('');
    await expect(page.locator('.recRow')).toHaveCount(4);
    expect(errs.msgs).toEqual([]);
    errs.off();
  });
});

test.describe('Phase 6 — finding 1 regression: topbar fits a 390px viewport', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  const expectFits = async (page: Page) => {
    const info = await page.evaluate(() => {
      const tb = document.querySelector('.topbar');
      const langBtn = document.querySelector('[data-lang-toggle]') as HTMLElement | null;
      const r = langBtn?.getBoundingClientRect();
      return {
        scrollW: tb?.scrollWidth ?? 0,
        clientW: tb?.clientWidth ?? 0,
        langInVP: !!r && r.right > 0 && r.left < innerWidth,
        langW: r ? Math.round(r.width) : 0,
      };
    });
    expect(info.scrollW, 'topbar scrollWidth (Phase 5 probed 925px over 390px)').toBeLessThanOrEqual(info.clientW);
    expect(info.clientW).toBeLessThanOrEqual(390);
    expect(info.langInVP).toBe(true);
    expect(info.langW).toBeGreaterThanOrEqual(44); // touch target preserved
    // the trimmed set must actually be display:none at ≤767px
    for (const sel of ['.tbCmd', '.demoBadge', '.userChip', '.densCmd']) {
      await expect(page.locator(sel)).toBeHidden();
    }
  };

  test('admin ar on /: fits, ع/EN reachable, tapping it flips ar→en live', async ({ page }) => {
    await loginAs(page, 0);
    await page.goto('/');
    await expect(page.locator('.topbar')).toBeVisible();
    await expectFits(page);
    await page.locator('[data-lang-toggle]').click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expectFits(page); // still fits after the flip
  });

  test('admin en on /projects: fits without horizontal overflow', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('cos-proto-lang', 'en'));
    await loginAs(page, 0);
    await page.goto('/projects');
    await expect(page.locator('.topbar')).toBeVisible();
    await expectFits(page);
  });

  test('viewer (mu-4) on /projects (scoped empty state at 390px): still fits', async ({ page }) => {
    await loginAs(page, 3);
    await page.goto('/projects');
    await expect(page.locator('.empty')).toBeVisible();
    await expectFits(page);
  });
});

test.describe('Phase 6 — finding 2 regression: shared tables resolve identical head/row columns', () => {
  const tableCols = (page: Page) => page.evaluate(() =>
    [...document.querySelectorAll('.recTable--sub')].map((tbl) => {
      const c = (el: Element | null) => (el ? getComputedStyle(el).gridTemplateColumns : null);
      return { head: c(tbl.querySelector('.recHead')), rows: [...tbl.querySelectorAll('.recRow')].map(c).filter(Boolean) };
    }),
  );

  const expectAligned = async (page: Page, minRows: number) => {
    await expect(page.locator('.recTable--sub')).toHaveCount(1);
    const tables = await tableCols(page);
    for (const tbl of tables) {
      expect(tbl.head, 'head computed columns must exist').toBeTruthy();
      expect(tbl.rows.length, 'table must have visible body rows').toBeGreaterThanOrEqual(minRows);
      for (const r of tbl.rows) expect(r).toBe(tbl.head); // exact resolved equality — no drift
    }
  };

  test('projects list (2.2fr 1fr 1fr auto): head === every row, exactly', async ({ page }) => {
    await loginAs(page, 0);
    await page.goto('/projects');
    await expectAligned(page, 4);
  });

  test('project financials p2: BOQ tab (bq6-bq8) and IPC tab (ipc5+ipc6) both aligned', async ({ page }) => {
    await loginAs(page, 0);
    await page.goto('/projects/p2/financials');
    await expectAligned(page, 2); // BOQ tab
    await page.getByRole('tab', { name: 'المستخلصات' }).click();
    await expectAligned(page, 2); // IPC tab
  });
});

test.describe('Phase 6 — stacked-card mode untouched at 390px (finding 2 control)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('projects list at 390px: header hidden, rows single-track', async ({ page }) => {
    await loginAs(page, 0);
    await page.goto('/projects');
    await expect(page.locator('.recRow')).toHaveCount(4);
    const info = await page.evaluate(() => {
      const head = document.querySelector('.recHead');
      const row = document.querySelector('.recRow');
      return {
        headDisplay: head ? getComputedStyle(head).display : null,
        rowDisplay: row ? getComputedStyle(row).display : null,
        rowTracks: row ? getComputedStyle(row).gridTemplateColumns.split(' ').filter(Boolean).length : 0,
      };
    });
    expect(info.headDisplay, 'stacked-card mode still hides the header row').toBe('none');
    expect(info.rowDisplay).toBe('grid');
    expect(info.rowTracks).toBe(1); // 1fr — not the subgrid desktop template
  });
});
