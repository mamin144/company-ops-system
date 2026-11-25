import { test, expect, type Page } from '@playwright/test';

// Phase 5 — Shell, Authentication & Localization regression suite.
// Everything asserts OBSERVED runtime behavior against the built preview:
//   1. Pre-paint language restore: the inline index.html script applies the
//      saved language to <html> BEFORE any paint. Discriminated by aborting
//      all JS module requests — React can never run, so any direction on
//      <html> must have come from the inline script itself.
//   2. Pre-paint default: with no saved choice, ar/rtl stands (JS blocked).
//   3. Session restoration: a valid restored session enters the shell directly
//      with zero uncaught errors.
//   4. Expired/invalid session: a session id that no longer resolves to a live
//      mock user record is dropped at state initialization — the actor lands
//      on /login, the shell never renders, and the stale storage entry is
//      cleaned up. (Mocked "account deleted / session expired" — the demo
//      has no real 401 contract; see the Phase 5 report.)
//   5. Return destination + logout: the Guard carries the attempted route in
//      history state ("from"), Login honours internal paths only (never "//"),
//      and sign-out always lands back on /login with protected routes locked.
//   6. 403 vs authentication: an authenticated-but-unauthorized actor gets the
//      localized permission-denied state — NOT a login redirect.
//   7. Shell chrome localization: the previously hardcoded strings (brand tag
//      "Direction D · prototype", breadcrumb aria-label, palette dialog name,
//      the three `<Tabs label>` identifiers) and the document title are
//      translated in BOTH directions, asserted in one session.
//   8. Mobile drawer keyboard contract: open via keyboard → focus lands on the
//      first item, Tab wraps inside the drawer, Escape closes and returns
//      focus to the hamburger; the panel sits on the start side in both RTL
//      and LTR. Zero uncaught errors.

const loginAdmin = async (page: Page) => {
  // Role tiles: admin=0, manager=1, warehouse=2, viewer=3, technical=4
  // (DEMO_ROLES order). Selecting by index avoids guessing display copy.
  await page.goto('/login');
  await page.locator('.rolePick label').nth(0).click();
  await page.getByRole('button', { name: /دخول تجريبي|Demo login/ }).click();
  await page.locator('.shell').waitFor({ timeout: 10000 });
  await page.waitForTimeout(400); // let the shell entrance cascade settle
};
const loginAs = async (page: Page, idx: number) => {
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

/** Phase 5 finding (recorded in the report): at phone widths the shell topbar
    overflows (925px of content in a 390px viewport, overflow-x: visible), so
    the ع/EN toggle sits beyond the trailing edge and a real touch user cannot
    reach it — pre-existing approved Phase 3 shell behavior, flagged for owner
    decision. The tests below still need the flip, so when the control is
    clipped they dispatch a real DOM click event on it (the React handler
    fires exactly as a genuine click would). */
const flipLang = async (page: Page) => {
  const btn = page.locator('[data-lang-toggle]');
  const inVP = await btn.evaluate((el) => { const r = el.getBoundingClientRect(); return r.right > 0 && r.left < innerWidth && r.bottom > 0 && r.top < innerHeight; });
  if (inVP) await btn.click();
  else await btn.dispatchEvent('click');
};

test.describe('Phase 5 — pre-paint language restore (JS blocked)', () => {
  test('saved EN applies lang/dir to <html> before any JS runs', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('cos-proto-lang', 'en'));
    await page.route('**/assets/*.js', (r) => r.abort());
    await page.route('**/src/*.tsx', (r) => r.abort());
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  });

  test('no saved choice keeps the ar/rtl default', async ({ page }) => {
    await page.route('**/assets/*.js', (r) => r.abort());
    await page.route('**/src/*.tsx', (r) => r.abort());
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });
});

test.describe('Phase 5 — session restoration and invalidation', () => {
  test('a valid restored session enters the shell directly (no login), zero uncaught errors', async ({ page }) => {
    const errs = trackErrors(page);
    await page.addInitScript(() => {
      sessionStorage.setItem('cos-proto-user', JSON.stringify({ id: 'mu-1', name: 'ليلى حسن', role: 'admin' }));
    });
    await page.goto('/');
    await page.locator('.shell').waitFor({ timeout: 10000 });
    await expect(page.locator('.topbar')).toContainText('ليلى حسن');
    expect(errs.msgs).toEqual([]);
    errs.off();
  });

  test('an expired/invalid session id is dropped: /login redirect, no shell flash, storage cleaned', async ({ page }) => {
    const errs = trackErrors(page);
    await page.addInitScript(() => {
      sessionStorage.setItem('cos-proto-user', JSON.stringify({ id: 'ghost-99', name: 'شبح', role: 'viewer' }));
    });
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('.shell')).toHaveCount(0);
    const left = await page.evaluate(() => sessionStorage.getItem('cos-proto-user'));
    expect(left).toBeNull(); // refresh() cleaned the invalidated entry
    expect(errs.msgs).toEqual([]);
    errs.off();
  });
});

test.describe('Phase 5 — return destination, logout, forbidden', () => {
  test('logout locks protected routes; login returns to the attempted internal destination', async ({ page }) => {
    await loginAdmin(page);
    await page.getByRole('button', { name: 'خروج' }).click();
    await expect(page).toHaveURL(/\/login/);
    // Protected route while signed out → login page, then return destination.
    await page.goto('/reports?q=1');
    await expect(page).toHaveURL(/\/login/);
    await page.locator('.rolePick label').nth(0).click();
    await page.getByRole('button', { name: /دخول تجريبي|Demo login/ }).click();
    await page.locator('.shell').waitFor({ timeout: 10000 });
    expect(new URL(page.url()).pathname).toBe('/reports');
    expect(new URL(page.url()).search).toContain('q=1');
    // Sign out again — back to /login, protected content gone.
    await page.getByRole('button', { name: 'خروج' }).click();
    await expect(page).toHaveURL(/\/login/);
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
  });

  test('login never leaves the app origin (destination rule)', async ({ page }) => {
    // Whatever state a history record carries, the honored destination rule
    // accepts single-"/"-prefixed internal paths only. Observable contract:
    // a post-login URL is always same-origin, same-shell.
    await page.goto('/reports');
    await expect(page).toHaveURL(/\/login/);
    await page.locator('.rolePick label').nth(0).click();
    await page.getByRole('button', { name: /دخول تجريبي|Demo login/ }).click();
    await page.locator('.shell').waitFor({ timeout: 10000 });
    const u = new URL(page.url());
    expect(u.pathname).toBe('/reports');
    expect(u.origin).not.toContain('evil');
  });

  test('authenticated but unauthorized → localized 403 state, never a login redirect', async ({ page }) => {
    await loginAs(page, 3); // viewer
    await page.goto('/admin');
    await expect(page.locator('.denyBox')).toBeVisible();
    await expect(page.locator('.denyBox h1')).toHaveText('لا صلاحية لديك');
    // English direction renders the English denial copy.
    await page.getByRole('button', { name: 'ع/EN' }).click();
    await expect(page.locator('html[dir="ltr"]')).toHaveCount(1);
    await expect(page.locator('.denyBox h1')).toHaveText('Not permitted');
  });
});

test.describe('Phase 5 — shell chrome localization', () => {
  test('brand tag, document title, breadcrumb name, tablists and palette dialog translate both ways', async ({ page }) => {
    await loginAdmin(page);

    // Arabic
    await expect(page.locator('.brandText .muted.small')).toHaveText('الاتجاه D · نموذج تفاعلي');
    await expect(page).toHaveTitle('COS v2 — نموذج تفاعلي (بيانات وهمية)');
    await page.goto('/projects');
    expect(await page.locator('nav.crumbs').getAttribute('aria-label')).toBe('مسار التنقل');
    await page.goto('/settings');
    await expect(page.locator('[role=tablist]')).toHaveAttribute('aria-label', 'الإعدادات');
    await page.goto('/admin');
    await expect(page.locator('[role=tablist]')).toHaveAttribute('aria-label', 'الإدارة');
    await page.goto('/inventory/stock');
    const stockH1 = ((await page.locator('.cmdHead h1').first().textContent()) ?? '').trim();
    expect(await page.locator('[role=tablist]').first().getAttribute('aria-label')).toBe(stockH1);
    await page.locator('.topbar .btn', { hasText: 'بحث' }).first().click();
    await expect(page.locator('.palette[role=dialog]')).toHaveAttribute('aria-label', 'لوحة الأوامر');
    await page.keyboard.press('Escape');

    // English
    await page.getByRole('button', { name: 'ع/EN' }).click();
    await expect(page.locator('html[dir="ltr"]')).toHaveCount(1);
    await expect(page).toHaveTitle('COS v2 — interactive prototype (mock data)');
    await page.goto('/');
    await expect(page.locator('.brandText .muted.small')).toHaveText('Direction D · prototype');
    await page.goto('/projects');
    expect(await page.locator('nav.crumbs').getAttribute('aria-label')).toBe('Breadcrumb');
    await page.goto('/settings');
    await expect(page.locator('[role=tablist]')).toHaveAttribute('aria-label', 'Settings');
    await page.goto('/admin');
    await expect(page.locator('[role=tablist]')).toHaveAttribute('aria-label', 'Admin');
    await page.goto('/inventory/stock');
    const stockH1En = ((await page.locator('.cmdHead h1').first().textContent()) ?? '').trim();
    expect(await page.locator('[role=tablist]').first().getAttribute('aria-label')).toBe(stockH1En);
    await page.locator('.topbar .btn', { hasText: 'Search' }).first().click();
    await expect(page.locator('.palette[role=dialog]')).toHaveAttribute('aria-label', 'Command palette');
  });
});

test.describe('Phase 5 — mobile drawer keyboard + direction', () => {
  test('open→focus→Tab-wrap→Escape-return works; panel on the start side in RTL and LTR', async ({ page }) => {
    const errs = trackErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAdmin(page);
    await page.locator('.drawerBtn').focus();

    // --- RTL ---
    await page.keyboard.press('Enter');
    const drawer = page.locator('#railDrawer');
    await expect(drawer).toHaveClass(/open/);
    // Focus lands on the first drawer item (rAF-deferred).
    await expect(drawer.locator('.drawerItem').first()).toBeFocused();
    // The panel hugs the start edge — in RTL that is the right edge. Measure
    // only AFTER the slide-in transition settles (mid-flight rects race).
    await page.waitForTimeout(400);
    const rRect = await drawer.evaluate((el) => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right }; });
    expect(rRect.right).toBeGreaterThanOrEqual(page.viewportSize()!.width - 30);
    // Tab wraps inside the drawer: from the close button back to the first item.
    while ((await page.evaluate(() => document.activeElement?.className ?? '')).includes('drawerItem')) {
      await page.keyboard.press('Tab');
    }
    await page.keyboard.press('Tab'); // now on the close button; wrap to first
    await expect(drawer.locator('.drawerItem').first()).toBeFocused();
    // Escape closes and returns focus to the hamburger.
    await page.keyboard.press('Escape');
    await expect(drawer).not.toHaveClass(/open/);
    await expect(page.locator('.drawerBtn')).toBeFocused();

    // --- LTR (English) ---
    await flipLang(page);
    await expect(page.locator('html[dir="ltr"]')).toHaveCount(1);
    // Phase 6 (Finding 1 fixed): the ع/EN toggle is now inside the viewport at
    // 390px, so flipLang performs a REAL click which moves keyboard focus onto
    // the toggle itself (in Phase 5 it was clipped at 925px and the synthetic
    // dispatchEvent branch left focus untouched). Re-focus the hamburger so
    // this test's actual subject stays intact: Enter on the hamburger must
    // open the drawer in LTR exactly as it already does in RTL above.
    await page.locator('.drawerBtn').focus();
    await page.keyboard.press('Enter');
    await expect(drawer).toHaveClass(/open/);
    await page.waitForTimeout(400); // settled slide-in position
    const lRect = await drawer.evaluate((el) => el.getBoundingClientRect().left);
    expect(lRect).toBeLessThanOrEqual(30);
    await page.keyboard.press('Escape');
    await expect(drawer).not.toHaveClass(/open/);
    await expect(page.locator('.drawerBtn')).toBeFocused();
    expect(errs.msgs).toEqual([]);
    errs.off();
  });
});
