import { test, expect } from '@playwright/test';

// Phase 3.17-C — motion/UX regression gates. Everything here asserts the
// OBSERVED runtime behavior of the fixes, not implementation internals:
//   1. The rail collapse/expand interpolates (mid-gesture width samples strictly
//      between the two state widths) and converges exactly — the old bug was a
//      single-frame 164px reflow (screen "shake").
//   2. Route transitions never blank the content (opacity of the tweened unit
//      stays 1 throughout) and land at scrollY 0 with no leftover inline styles.
//   3. Collapsed-rail tooltip: mouse AND keyboard focus show it just outside the
//      rail (RTL/LTR aware); touch does not; Escape dismisses; it never
//      intercepts pointers.
//   4. Mobile drawer: opens from the logical edge with focus moving in,
//      Escape/backdrop close return focus to the hamburger, a nav click closes
//      it, crossing to desktop closes it, and the slide actually interpolates.
//   5. Reduced motion: collapse + drawer + dashboard cascade are instant
//      (no mid-flight frames) and leave zero inline-style residue.
//   6. Rapid toggles/navs converge on the exact final state (no stuck
//      half-width, half-faded UI).
//
// Login helper note: mobile viewports hide the rail entirely, so the helper
// waits on `.topbar`, which exists at every breakpoint.

const login = async (page: import('@playwright/test').Page) => {
  await page.goto('/login');
  await page.getByRole('radio', { name: 'مدير (تجريبي)' }).click();
  await page.getByRole('button', { name: /دخول تجريبي/ }).click();
  await page.locator('.topbar').waitFor();
  await page.waitForTimeout(400); // let the shell entrance cascade finish
};

/** Arms a 40-frame width sampler in the page (call WITHOUT await, then click,
    then await the returned promise — evaluate blocks while it runs). */
const sampleWidth = (page: import('@playwright/test').Page): Promise<number[]> =>
  page.evaluate(
    (): Promise<number[]> =>
      new Promise((resolve) => {
        const vals: number[] = [];
        let n = 0;
        const tick = () => {
          const rail = document.querySelector('.rail');
          vals.push(rail ? rail.getBoundingClientRect().width : -1);
          if (++n < 40) requestAnimationFrame(tick);
          else resolve(vals);
        };
        requestAnimationFrame(tick);
      }),
  );

test.describe('3.17-C rail collapse', () => {
  test('width interpolates mid-gesture and converges exactly (both directions)', async ({ page }) => {
    await login(page);
    const arm = sampleWidth(page); // NOT awaited — arms the sampler first
    await page.locator('.brandMark').click();
    const down = await arm;
    const mid = down.filter((w) => w > 84.5 && w < 247.5);
    expect(mid.length).toBeGreaterThanOrEqual(5); // genuinely interpolated
    expect(down.slice(-5).every((w) => w <= 84.5)).toBe(true); // settled exactly
    await expect(page.locator('.rail')).toHaveCSS('width', '84px');
    // labels are collapsed via opacity + max-width, never display:none
    await expect(page.locator('.rail .navLabel').first()).toBeHidden();

    const arm2 = sampleWidth(page);
    await page.locator('.brandMark').click();
    const up = await arm2;
    expect(up.filter((w) => w > 84.5 && w < 247.5).length).toBeGreaterThanOrEqual(5);
    await expect(page.locator('.rail')).toHaveCSS('width', '248px');
  });

  test('rapid toggles + mid-flight navigation converge to the exact final state at scrollY 0', async ({ page }) => {
    await login(page);
    // 6 rapid toggles from expanded = back to expanded (even parity); must settle cleanly
    for (let i = 0; i < 6; i++) await page.locator('.brandMark').click({ delay: 20 });
    await expect(page.locator('.rail')).toHaveCSS('width', '248px');

    // scrolled page hands scroll to the next route? Must land at 0.
    await page.goto('/archive', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    await page.evaluate(() => window.scrollTo(0, 900));
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => Math.round(window.scrollY))).toBeGreaterThan(500);
    await page.locator('.rail .navItem').nth(3).click();
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await expect(page.locator('.rail')).toHaveCSS('width', '248px'); // state survived nav
    await expect(page.locator('.railTip')).toHaveCount(0); // no orphan tooltip

    // start a COLLAPSE, navigate mid-flight → collapse still completes exactly
    const arm = sampleWidth(page);
    await page.locator('.brandMark').click();
    await page.waitForTimeout(80);
    await page.locator('.rail .navItem').nth(4).click();
    const frames = await arm;
    expect(frames.filter((w) => w > 84.5 && w < 247.5).length).toBeGreaterThanOrEqual(3);
    await page.waitForTimeout(400);
    await expect(page.locator('.rail')).toHaveCSS('width', '84px');
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });

  test('collapsed rail anchors all icons at the box center with no layout shift', async ({ page }) => {
    await login(page);
    await page.locator('.brandMark').click();
    await page.waitForTimeout(350);
    const centers = await page.evaluate(() => {
      const rail = document.querySelector('.rail').getBoundingClientRect();
      const mid = rail.left + rail.width / 2;
      const icons = Array.from(document.querySelectorAll('.rail .navItem svg'))
        .map((s) => s.getBoundingClientRect())
        .map((r) => r.left + r.width / 2);
      const mark = document.querySelector('.brandMark').getBoundingClientRect();
      return { icons, mid, markCenter: mark.left + mark.width / 2 };
    });
    expect(centers.icons.length).toBeGreaterThanOrEqual(5);
    for (const c of centers.icons) expect(Math.abs(c - centers.mid)).toBeLessThanOrEqual(1);
    expect(Math.abs(centers.markCenter - centers.icons[0])).toBeLessThanOrEqual(1.5);
  });
});

test.describe('3.17-C route transition', () => {
  test('content never blanks: the tweened unit keeps opacity 1 and clears its inline styles', async ({ page }) => {
    await login(page);
    await page.goto('/archive', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(700); // entrance tween from initial mount done
    const sampledP = page.evaluate(
      (): Promise<Array<{ o: number; t: string }>> =>
        new Promise((resolve) => {
          const out: Array<{ o: number; t: string }> = [];
          let n = 0;
          const tick = () => {
            const c = document.querySelector('.content');
            if (c) out.push({ o: +getComputedStyle(c).opacity, t: getComputedStyle(c).transform });
            if (++n < 45) requestAnimationFrame(tick);
            else resolve(out);
          };
          requestAnimationFrame(tick);
        }),
    ); // NOT awaited — arms the sampler before the click
    await page.locator('.rail .navItem').nth(4).click(); // route change mid-sampling
    const frames = await sampledP;
    const mid = frames.filter((f) => f.t !== 'none');
    expect(mid.length).toBeGreaterThanOrEqual(3); // the route tween visibly ran
    for (const f of mid) expect(f.o).toBe(1); // never blanked — the old bug
    await page.waitForTimeout(350);
    const residual = await page.evaluate(() => {
      const c = document.querySelector('.content');
      return { style: c.getAttribute('style') || '', op: getComputedStyle(c).opacity };
    });
    expect(residual.op).toBe('1');
    expect(residual.style).not.toMatch(/opacity|transform/);
  });
});

test.describe('3.17-C collapsed-rail tooltip', () => {
  test('shows on hover and on keyboard focus, hides on Escape and pointer-out', async ({ page }) => {
    await login(page);
    await page.locator('.brandMark').click();
    await page.waitForTimeout(300);
    await page.locator('.rail .navItem').nth(2).hover();
    const tip = page.locator('.railTip');
    await expect(tip).toBeVisible();
    expect(await tip.textContent()).toBe('الأرشيف');
    // placed just OUTSIDE the rail (RTL: rail hugs the right edge)
    const geo = await page.evaluate(() => {
      const t = document.querySelector('.railTip').getBoundingClientRect();
      const r = document.querySelector('.rail').getBoundingClientRect();
      return { tipRight: t.right, railLeft: r.left, dir: document.documentElement.dir };
    });
    expect(geo.dir).toBe('rtl');
    expect(geo.railLeft - geo.tipRight).toBeGreaterThanOrEqual(6);
    // decorative only — never intercepts pointers, never enters the a11y tree
    await expect(tip).toHaveCSS('pointer-events', 'none');
    await expect(tip).toHaveAttribute('aria-hidden', 'true');
    await page.mouse.move(700, 400); // pointer-out unmounts it
    await expect(tip).toHaveCount(0);
    // keyboard focus shows it again
    await page.locator('.brandMark').focus();
    await page.keyboard.press('Tab');
    await expect(tip).toBeVisible();
    await page.keyboard.press('Escape'); // global dismiss
    await expect(tip).toHaveCount(0);
  });

  test('LTR placement is on the opposite (inline-end) side of the rail', async ({ page }) => {
    await login(page);
    await page.locator('.brandMark').click();
    await page.waitForTimeout(300);
    await page.locator('[data-lang-toggle]').click(); // ar → en (LTR)
    await page.waitForTimeout(300);
    await page.locator('.rail .navItem').nth(2).hover();
    const geo = await page.evaluate(() => {
      const t = document.querySelector('.railTip').getBoundingClientRect();
      const r = document.querySelector('.rail').getBoundingClientRect();
      return { tipLeft: t.left, railRight: r.right, dir: document.documentElement.dir };
    });
    expect(geo.dir).toBe('ltr');
    expect(geo.tipLeft - geo.railRight).toBeGreaterThanOrEqual(6);
  });

  test('touch never triggers the tooltip (tap navigates instead)', async ({ browser }) => {
    const ctx = await browser.newContext({ hasTouch: true });
    const page = await ctx.newPage();
    await login(page);
    await page.locator('.brandMark').click();
    await page.waitForTimeout(300);
    await page.locator('.rail .navItem').nth(2).tap();
    await page.waitForTimeout(450);
    expect(await page.locator('.railTip').count()).toBe(0);
    expect(page.url()).toContain('/archive'); // the tap was a navigation, not a hover
    await ctx.close();
  });
});

test.describe('3.17-C mobile drawer', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('opens from the logical edge with focus moving in; the slide interpolates', async ({ page }) => {
    await login(page);
    const btn = page.locator('.drawerBtn');
    await expect(btn).toBeVisible();
    await expect(page.locator('.rail')).toBeHidden(); // rail exists but display:none
    const sampleP = page.evaluate(
      (): Promise<number[]> =>
        new Promise((resolve) => {
          const xs: number[] = [];
          let n = 0;
          const tick = () => {
            const d = document.getElementById('railDrawer');
            const tr = getComputedStyle(d).transform;
            xs.push(tr === 'none' ? 0 : new DOMMatrix(tr).m41);
            if (++n < 30) requestAnimationFrame(tick);
            else resolve(xs);
          };
          requestAnimationFrame(tick);
        }),
    ); // NOT awaited
    await btn.click();
    const xs = await sampleP;
    const moving = xs.filter((x) => x > 0.5 && x < 303); // between closed(≈304) and open(0)
    expect(moving.length).toBeGreaterThanOrEqual(3); // the slide genuinely interpolated
    await expect(btn).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#railDrawer')).toBeVisible();
    const focused = await page.evaluate(() => document.activeElement.className);
    expect(focused).toContain('drawerItem'); // focus moved into the drawer
  });

  test('Escape and backdrop close both return focus to the hamburger', async ({ page }) => {
    await login(page);
    await page.locator('.drawerBtn').click();
    await page.waitForTimeout(350);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(350);
    expect(await page.evaluate(() => document.activeElement.className)).toContain('drawerBtn');
    // backdrop path
    await page.locator('.drawerBtn').click();
    await page.waitForTimeout(350);
    await page.locator('.drawerScrim').click({ position: { x: 5, y: 5 } });
    await page.waitForTimeout(350);
    expect(await page.evaluate(() => document.activeElement.className)).toContain('drawerBtn');
    await expect(page.locator('#railDrawer')).toBeHidden();
  });

  test('nav click closes it; resizing to desktop closes it too', async ({ page }) => {
    await login(page);
    await page.locator('.drawerBtn').click();
    await page.waitForTimeout(350);
    await page.locator('#railDrawer .drawerItem').nth(1).click();
    await page.waitForTimeout(450);
    expect(page.url()).toContain('/projects');
    await expect(page.locator('#railDrawer')).toBeHidden();
    // crossing the breakpoint: the drawer force-closes
    await page.setViewportSize({ width: 1280, height: 850 });
    await page.waitForTimeout(250);
    expect(await page.locator('#railDrawer').evaluate((d: HTMLElement) => d.className)).not.toContain('open');
  });

  test('focus trap keeps Tab cycling inside the open drawer', async ({ page }) => {
    await login(page);
    await page.locator('.drawerBtn').click();
    await page.waitForTimeout(350);
    for (let i = 0; i < 12; i++) await page.keyboard.press('Tab');
    const inside = await page.evaluate(() => document.getElementById('railDrawer').contains(document.activeElement));
    expect(inside).toBe(true);
  });

  test('open drawer freezes background scroll and releases it on close', async ({ page }) => {
    await login(page);
    // Setup: reach a real scroll offset through the normal (wheel) path.
    // Known pre-existing transient (outside 3.17-C scope): the very first wheel
    // right after login is occasionally swallowed; retry like a real user.
    await page.mouse.move(280, 140);
    let before = 0;
    for (let i = 0; i < 6 && before < 100; i++) {
      await page.mouse.wheel(0, 400);
      await page.waitForTimeout(450);
      before = await page.evaluate(() => window.scrollY);
    }
    expect(before).toBeGreaterThan(100);
    await page.waitForTimeout(700); // let Lenis's lerp tail fully settle
    before = await page.evaluate(() => window.scrollY);
    await page.locator('.drawerBtn').click();
    await page.waitForTimeout(400);
    // wheel over the scrim (left of the RTL drawer) moves nothing
    await page.mouse.move(40, 400);
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => window.scrollY)).toBe(before);
    // the touch path is closed by CSS (no drag-scroll through the scrim)
    const ta = await page.locator('.drawerScrim').evaluate((el) => getComputedStyle(el).touchAction);
    expect(ta).toBe('none');
    // release: normal scrolling resumes
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(before);
  });
});

test.describe('3.17-C reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('collapse, drawer and dashboard cascade are instant with zero inline residue', async ({ page }) => {
    await login(page);
    // dashboard cascade: no-op → no inline styles at all
    await page.waitForTimeout(300);
    const residue = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[data-motion]')).map((e) => (e as HTMLElement).getAttribute('style') || ''),
    );
    expect(residue.length).toBeGreaterThan(0);
    // rows carry React's own inline padding/border styles; only GSAP
    // motion residue (opacity/transform) must be absent.
    for (const s of residue) expect(s).not.toMatch(/opacity|transform/);
    // collapse: zero mid-flight frames
    const arm = sampleWidth(page);
    await page.locator('.brandMark').click();
    const frames = await arm;
    expect(frames.filter((w) => w > 84.5 && w < 247.5).length).toBe(0);
    await expect(page.locator('.rail')).toHaveCSS('width', '84px');
    // drawer still fully functional, opens instantly
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(200);
    await page.locator('.drawerBtn').click();
    await expect(page.locator('#railDrawer')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#railDrawer')).toBeHidden();
  });
});

test.describe('3.17-C dashboard cascade', () => {
  test('animates on entry (mid-flight opacity sampled) and clears all inline styles', async ({ page }) => {
    await login(page);
    // re-trigger the cascade: leave Home and come back (loading flips again)
    await page.goto('/archive', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    const sampleP = page.evaluate(
      (): Promise<number[]> =>
        new Promise((resolve) => {
          const mins: number[] = [];
          let n = 0;
          const tick = () => {
            const els = document.querySelectorAll('[data-motion]');
            if (els.length) {
              let min = 1;
              for (const e of els) min = Math.min(min, +getComputedStyle(e).opacity);
              mins.push(min);
            }
            if (++n < 45) requestAnimationFrame(tick);
            else resolve(mins);
          };
          requestAnimationFrame(tick);
        }),
    ); // NOT awaited
    await page.locator('.rail .navItem').nth(0).click(); // → / ; cascade replays
    const mins = await sampleP;
    expect(mins.some((o) => o > 0 && o < 1)).toBe(true); // cascade genuinely animated
    await page.waitForTimeout(800);
    const residue = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[data-motion]')).some((e) => (e as HTMLElement).style.opacity !== '' || (e as HTMLElement).style.transform !== ''),
    );
    expect(residue).toBe(false); // clearProps left nothing behind
  });
});
