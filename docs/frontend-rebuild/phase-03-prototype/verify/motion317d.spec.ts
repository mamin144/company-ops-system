import { test, expect } from '@playwright/test';

// Phase 3.17-D — dashboard SplitText cascade, table header/column audit,
// collapsed-rail icon pop. Everything asserts OBSERVED runtime behavior:
//   1. The h1 greeting carries the signed-in user's name right after
//      "صباح الخير" (owner request) and splits into word spans that settle
//      at a neutral computed state (opacity 1, identity/no transform).
//   2. On entry the words DROP DOWNWARD (from y ≈ -18) with a genuine
//      first→last stagger: word 0 becomes visible strictly before word 4
//      (onset order) and word 0 completes strictly before word 4. (A
//      "word 0 done while word 4 still hidden" frame does NOT exist by
//      design: word 0 finishes at ~750ms while word 4 leaves its hidden
//      hold at ~400ms.)
//   3. The section heads start AFTER the h1 (startDelay coordination:
//      150ms vs 560ms+) — the first visible h2 word frame is clearly later.
//   4. Reduced motion: no word split at all (plain text, instant), and the
//      rail icon pop is disabled.
//   5. Icon pop under normal motion: hovered collapsed-rail icon gets
//      translateY(-2px) scale(1.11) over 180ms — transform-only, so the
//      layout metrics (offsetLeft/Top/Width/Height) never change. (Playwright
//      boundingBox INCLUDES transforms, so it would drift by design.)
//   6. Table audit: every .recHead shares its rows' DECLARED inline grid
//      template on all audited routes — the code contract. The audit meanwhile
//      LOGS the computed used-size drift between head and rows (see §11:
//      the trailing `auto` track resolves differently for the narrow sort
//      header vs the action-buttons cells), kept as a logged finding, not a
//      failing assertion, until an owner decision on the template fix.
//
// Settled split-words note: with a custom from/to, SplitText's clearProps
// only strips willChange — words KEEP inline opacity/transform at their final
// values. Assertions therefore check the neutral COMPUTED state, not the
// absence of inline styles.

const login = async (page: import('@playwright/test').Page) => {
  await page.goto('/login');
  await page.getByRole('radio', { name: 'مدير (تجريبي)' }).click();
  await page.getByRole('button', { name: /دخول تجريبي/ }).click();
  await page.locator('.topbar').waitFor();
  await page.waitForTimeout(400); // let the shell entrance cascade finish
};

const wordStates = (page: import('@playwright/test').Page, sel: string) =>
  page.evaluate((sel): Array<{ op: string; y: number }> => {
    const m42 = (el: Element) => {
      const tr = getComputedStyle(el).transform;
      return tr === 'none' ? 0 : new DOMMatrix(tr).m42;
    };
    return Array.from(document.querySelectorAll(sel)).map((w) => ({
      op: getComputedStyle(w).opacity,
      y: m42(w),
    }));
  }, sel);

test.describe('3.17-D greeting + SplitText structure', () => {
  test('h1 shows "صباح الخير، {user}" and settles every word at a neutral computed state', async ({ page }) => {
    await login(page);
    const h1 = page.locator('.cmdHead h1');
    await expect(h1).toBeVisible();
    await expect(h1).toContainText('صباح الخير، ليلى حسن'); // admin demo user mu-1
    const words = h1.locator('.split-word');
    expect(await words.count()).toBe(5); // صباح / الخير، / ليلى / حسن / (تجريبية)
    await page.waitForTimeout(1600); // startDelay 150 + 4×60 stagger + 600ms tween + margin
    const states = await wordStates(page, '.cmdHead h1 .split-word');
    expect(states.length).toBe(5);
    for (const s of states) {
      expect(s.op).toBe('1');
      expect(Math.abs(s.y)).toBeLessThanOrEqual(0.5); // identity transform or none
    }
  });
});

// The reduced-motion preference lives at the describe level: the component
// guard checks matchMedia at mount, so the browser MUST be launched with
// reducedMotion: 'reduce' for the guard to take its reduced branch.
test.describe('3.17-D reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('the greeting renders instantly as plain text (no word split) and the icon pop stays off', async ({ page }) => {
    await login(page);
    const h1 = page.locator('.cmdHead h1');
    await expect(h1).toBeVisible();
    await expect(h1).toContainText('صباح الخير، ليلى حسن');
    expect(await h1.locator('.split-word').count()).toBe(0); // guard short-circuits the split
    await expect(h1).toHaveCSS('opacity', '1');
    // …and the icon pop is media-gated off
    await page.locator('.brandMark').click();
    await page.waitForTimeout(350);
    await page.locator('.rail .navItem').nth(2).hover();
    await page.waitForTimeout(250);
    expect(
      await page.locator('.rail .navItem').nth(2).locator('svg').evaluate((s) => getComputedStyle(s).transform),
    ).toBe('none');
  });
});

test.describe('3.17-D SplitText cascade motion', () => {
  test('words drop downward with a first→last stagger when the cascade replays', async ({ page }) => {
    await login(page);
    await page.goto('/archive', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    const sampleP = page.evaluate(
      (): Promise<{ ops: number[][]; ys: number[][] }> =>
        new Promise((resolve) => {
          const ops: number[][] = [];
          const ys: number[][] = [];
          let n = 0;
          const tick = () => {
            const words = document.querySelectorAll('.cmdHead h1 .split-word');
            if (words.length) {
              ops.push(Array.from(words).map((w) => +getComputedStyle(w).opacity));
              ys.push(
                Array.from(words).map((w) => {
                  const tr = getComputedStyle(w).transform;
                  return tr === 'none' ? 0 : new DOMMatrix(tr).m42;
                }),
              );
            }
            if (++n < 120) requestAnimationFrame(tick);
            else resolve({ ops, ys });
          };
          requestAnimationFrame(tick);
        }),
    ); // NOT awaited — arms the sampler before the click
    await page.locator('.rail .navItem').nth(0).click(); // → / ; cascade replays
    const { ops, ys } = await sampleP;
    expect(ops.length).toBeGreaterThanOrEqual(30); // words were actually sampled
    // downward drop: words start ~18px ABOVE their final position (y < 0)
    expect(ys.some((row) => Math.min(...row) < -2)).toBe(true);
    // fully settled by the end of the sample window
    const last = ops.length - 1;
    for (let i = 0; i < 5; i++) {
      expect(ops[last][i]).toBeGreaterThanOrEqual(0.99);
      expect(Math.abs(ys[last][i])).toBeLessThanOrEqual(0.5);
    }
    // genuine stagger: word 0 becomes VISIBLE strictly before word 4 (word 4
    // is held at opacity 0 through its 240ms stagger offset), and word 0 also
    // completes strictly before word 4 completes.
    const onset = (col: number) => ops.findIndex((row) => row[col] > 0.05);
    expect(onset(0)).toBeGreaterThanOrEqual(0);
    expect(onset(4)).toBeGreaterThan(onset(0));
    // completion order: word 0 reaches full opacity strictly before word 4
    const firstDone = (col: number) => ops.findIndex((row) => row[col] >= 0.99);
    expect(firstDone(0)).toBeGreaterThanOrEqual(0);
    expect(firstDone(4)).toBeGreaterThan(firstDone(0));
  });

  test('section heads start after the h1 (startDelay coordination)', async ({ page }) => {
    await login(page);
    await page.goto('/archive', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    const sampleP = page.evaluate(
      (): Promise<{ h1: number; heads: number }> =>
        new Promise((resolve) => {
          const first = (sel: string) => {
            const els = document.querySelectorAll(sel);
            for (const e of els) if (+getComputedStyle(e).opacity > 0.02) return true;
            return false;
          };
          let n = 0;
          let h1At = -1;
          let headsAt = -1;
          const tick = () => {
            if (h1At < 0 && first('.cmdHead h1 .split-word')) h1At = n;
            if (headsAt < 0 && first('h2.split-parent .split-word')) headsAt = n;
            if ((h1At >= 0 && headsAt >= 0) || ++n >= 150) resolve({ h1: h1At, heads: headsAt });
            else requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }),
    ); // NOT awaited
    await page.locator('.rail .navItem').nth(0).click(); // → /
    const { h1, heads } = await sampleP;
    expect(h1).toBeGreaterThanOrEqual(0); // h1 words became visible
    expect(heads).toBeGreaterThan(h1 + 8); // heads clearly later (150ms vs 560ms+)
  });
});

test.describe('3.17-D collapsed-rail icon pop', () => {
  test('hovered icon lifts + scales transform-only over 180ms', async ({ page }) => {
    await login(page);
    await page.locator('.brandMark').click(); // collapse
    await page.waitForTimeout(350);
    const item = page.locator('.rail .navItem').nth(2);
    const icon = item.locator('svg');
    const layout = () =>
      icon.evaluate((s: Element) => `${s.offsetLeft},${s.offsetTop},${s.offsetWidth},${s.offsetHeight}`);
    const before = await layout();
    await item.hover();
    await page.waitForTimeout(250); // 180ms transition + margin
    expect(await icon.evaluate((s) => getComputedStyle(s).transform)).toBe('matrix(1.11, 0, 0, 1.11, 0, -2)');
    expect(await icon.evaluate((s) => getComputedStyle(s).transitionDuration)).toBe('0.18s');
    // transform-only: the layout metrics did not change (offsetLeft/Top/Width/
    // Height ignore transforms, unlike Playwright's boundingBox which reports
    // the transformed quad — that drift is expected and NOT a layout shift).
    expect(await layout()).toBe(before);
  });
});

test.describe('3.17-D table header/column audit', () => {
  test('every recHead shares its rows’ DECLARED grid template on all audited routes', async ({ page }) => {
    await login(page);
    const routes = [
      '/projects',
      '/archive',
      '/inventory/stock',
      '/inventory/requests',
      '/inventory/warehouses',
      '/inventory/items',
      '/projects/p2/financials', // BOQ (default tab)
      '/reports',
      '/audit',
      '/admin',
    ];
    const failures: string[] = [];
    let tablesChecked = 0;
    for (const route of routes) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(700); // entrance cascade + data load
      if (route === '/projects/p2/financials') {
        await page.getByRole('tab', { name: 'المستخلصات' }).click(); // IPC tab
        await page.waitForTimeout(400);
      }
      const tables = await page.evaluate(() =>
        Array.from(document.querySelectorAll('.recTable')).map((t) => {
          const head = t.querySelector('.recHead') as HTMLElement | null;
          const rows = Array.from(t.querySelectorAll('.recRow')) as HTMLElement[];
          return {
            label: t.getAttribute('aria-label') || '?',
            headDeclared: head?.style.gridTemplateColumns ?? null,
            headComputed: head ? getComputedStyle(head).gridTemplateColumns : null,
            rowsDeclared: rows.map((r) => r.style.gridTemplateColumns),
            rowsComputed: rows.map((r) => getComputedStyle(r).gridTemplateColumns),
          };
        }),
      );
      for (const t of tables) {
        if (!t.headDeclared || t.rowsDeclared.length === 0) continue;
        tablesChecked++;
        // the CODE contract: head and every row receive the same declared
        // template string (one `template` prop feeds both).
        for (let i = 0; i < t.rowsDeclared.length; i++) {
          if (t.rowsDeclared[i] !== t.headDeclared)
            failures.push(`${route} [${t.label}] row#${i}: declared "${t.rowsDeclared[i]}" ≠ head "${t.headDeclared}"`);
        }
        // documented finding (report §11): the trailing `auto` track has no
        // fixed width, so its used size follows each cell's min-content — the
        // head's narrow sort-icon cell vs the rows' action-buttons cell
        // resolve DIFFERENT widths and the interior cell boundaries drift.
        // Logged, not failed: fixing it is an owner decision (fixed width or
        // minmax(0, Xfr)) across every table's template.
        if (t.rowsComputed.some((c) => c !== t.headComputed))
          console.log(
            `AUTO-TRACK DRIFT ${route} [${t.label}] head "${t.headComputed}" vs row "${t.rowsComputed[0]}"`,
          );
      }
    }
    expect(tablesChecked).toBeGreaterThanOrEqual(8); // the audit actually saw tables
    expect(failures).toEqual([]);
  });
});
