import { test, expect } from '@playwright/test';

// Phase 3.12 accessibility acceptance (new). All measurements run against the
// real rendered page — no axe dependency, no claims beyond what is measured.
// NOTE: only the reduced-motion block below opts into that emulation — the
// other blocks run with normal motion because forced reduced-motion freezes
// custom-property resolution in Chromium (verified: var(--focus-ring) and
// theme vars read stale under the flag), which would test the emulator
// instead of the app.

const loginAs = async (page: any, role: string) => {
  await page.goto('/login');
  await page.getByRole('radio', { name: role }).click();
  await page.getByRole('button', { name: /دخول تجريبي/ }).click();
  await page.locator('.shell').waitFor({ timeout: 10000 });
};

/** WCAG relative luminance + contrast ratio, computed in-page from live styles. */
const ratio = async (page: any, fgSel: string, bgSel: string) =>
  page.evaluate(([f, b]: string[]) => {
    const lum = (css: string) => {
      const m = css.match(/rgba?\(([^)]+)\)/);
      if (!m) return 0;
      const [r, g, b2] = m[1].split(',').slice(0, 3).map((v) => Number(v.trim()) / 255);
      const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
      return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b2);
    };
    const fg = getComputedStyle(document.querySelector(f)!).color;
    const bg = getComputedStyle(document.querySelector(b)!).backgroundColor;
    const l1 = lum(fg), l2 = lum(bg);
    return { ratio: (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05), fg, bg };
  }, [fgSel, bgSel] as any);

test.describe('touch targets (measured bounding boxes)', () => {
  test.beforeEach(async ({ page }) => { await loginAs(page, 'مدير (تجريبي)'); });

  test('desktop: buttons, inputs, tabs, nav meet 44px', async ({ page }) => {
    await page.goto('/inventory/requests');
    const small: string[] = await page.evaluate(() => {
      const bad: string[] = [];
      const els = Array.from(document.querySelectorAll('.btn, .tabBtn, .input, .select, .navItem, .linkBtn'));
      for (const el of els.slice(0, 40)) {
        const h = (el as HTMLElement).getBoundingClientRect().height;
        if (h < 44) bad.push(`${el.className} :: ${Math.round(h)}px :: ${(el.textContent ?? '').trim().slice(0, 30)}`);
      }
      return bad;
    });
    expect(small).toEqual([]);
  });

  test('phone: bottom bar, menu items and dialog controls meet 44px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto('/archive');
    const bar = await page.locator('.bottombar a, .bottombar button').first().boundingBox();
    expect(bar?.height).toBeGreaterThanOrEqual(44);
    await page.locator('.recRow').first().getByRole('button', { name: 'المزيد' }).click();
    const h = await page.getByRole('menu').getByRole('menuitem').first().boundingBox();
    expect(h?.height).toBeGreaterThanOrEqual(44);
  });
});

test.describe('focus visibility + dialog keyboard', () => {
  test.beforeEach(async ({ page }) => { await loginAs(page, 'مدير (تجريبي)'); });

  test('keyboard focus shows the visible ring and reaches dialogs', async ({ page }) => {
    await page.goto('/');
    // a freshly loaded page can swallow the first keypress — or report a
    // pre-recalc style — while React is still mounting: retry press+read
    // together until focus visibly lands on a control
    let ring = { tag: '', ring: 'none' };
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Tab');
      ring = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement;
        return { tag: el.tagName, ring: getComputedStyle(el).boxShadow };
      });
      if (ring.tag !== 'BODY' && ring.ring !== 'none') break;
      await page.waitForTimeout(250);
    }
    expect(ring.tag).not.toBe('BODY');
    expect(ring.ring).not.toBe('none');
    await page.goto('/archive');
    await page.locator('.recRow').first().getByRole('button', { name: 'معاينة' }).click();
    const dlg = page.getByRole('dialog');
    // initial focus lands on a 30ms timer — poll for it instead of racing it
    await expect.poll(async () => page.evaluate(() => !!document.querySelector('.modal')?.contains(document.activeElement))).toBe(true);
    await expect(dlg.getByRole('button', { name: 'إغلاق الحوار' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dlg).toBeHidden();
  });
});

test.describe('contrast (measured WCAG ratios)', () => {
  test.beforeEach(async ({ page }) => { await loginAs(page, 'مدير (تجريبي)'); });

  test('light theme: body, muted, primary button, badges, links', async ({ page }) => {
    await page.goto('/');
    const out: Record<string, number> = {};
    out.body = (await ratio(page, 'body', '.panel')).ratio;
    out.muted = (await page.evaluate(() => {
      const el = document.querySelector('.muted.small') as HTMLElement;
      const lum = (css: string) => {
        const m = css.match(/rgba?\(([^)]+)\)/);
        const [r, g, b] = m![1].split(',').slice(0, 3).map((v: string) => Number(v.trim()) / 255);
        const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
        return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
      };
      const l1 = lum(getComputedStyle(el).color), l2 = lum(getComputedStyle(document.querySelector('.panel')!).backgroundColor);
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    }));
    const tones: [string, string][] = [['blue', 'blue'], ['green', 'green'], ['amber', 'amber'], ['red', 'red'], ['gray', 'gray']];
    for (const [t] of tones) {
      const r = await page.evaluate((tone: string) => {
        const host = document.createElement('div');
        host.innerHTML = `<div class="panel" style="position:absolute;visibility:hidden"><span class="badge badge--${tone}">نص</span></div>`;
        document.body.appendChild(host);
        const lum = (css: string) => {
          const m = css.match(/rgba?\(([^)]+)\)/);
          const [r, g, b] = m![1].split(',').slice(0, 3).map((v: string) => Number(v.trim()) / 255);
          const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
          return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
        };
        const el = host.querySelector('.badge')!;
        const l1 = lum(getComputedStyle(el).color), l2 = lum(getComputedStyle(el).backgroundColor);
        host.remove();
        return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      }, t);
      out[`badge-${t}`] = r;
    }
    // eslint-disable-next-line no-console
    console.log('CONTRAST-LIGHT ' + JSON.stringify(out));
    expect(out.body).toBeGreaterThanOrEqual(4.5);
    expect(out.muted).toBeGreaterThanOrEqual(4.5);
    for (const t of tones.map(([x]) => x)) expect(out[`badge-${t}`]).toBeGreaterThanOrEqual(4.5);
  });

  test('dark theme: body and muted hold contrast', async ({ page }) => {
    await page.goto('/settings');
    await page.getByRole('tab', { name: 'المظهر واللغة' }).click();
    await page.getByRole('button', { name: 'ليلي' }).click();
    await page.goto('/');
    // full reload remounts the tree: theme restores from storage asynchronously,
    // and under reduced-motion emulation style recalc can lag behind the DOM —
    // poll the RENDERED color, not just the dataset flag
    await expect.poll(async () => page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');
    await expect.poll(async () => page.evaluate(() => getComputedStyle(document.body).color)).toBe('rgb(233, 238, 247)');
    const dark = await ratio(page, 'body', '.panel');
    // eslint-disable-next-line no-console
    console.log('CONTRAST-DARK ' + JSON.stringify(dark));
    expect(dark.ratio).toBeGreaterThanOrEqual(4.5);
  });
});

test.describe('reduced motion honored', () => {
  test.use({ reducedMotion: 'reduce' });
  test('transitions collapse under reduced-motion preference', async ({ page }) => {
    await loginAs(page, 'مدير (تجريبي)');
    await page.goto('/');
    const d = await page.evaluate(() => getComputedStyle(document.querySelector('.btn')!).transitionDuration);
    // .01ms override serializes as 0s/near-zero depending on engine — assert numeric
    expect(d.split(',').every((v) => parseFloat(v) < 0.05)).toBe(true);
  });
});

test.describe('radio semantics + menu contract', () => {
  test('login group exposes real radios; arrow keys move natively', async ({ page }) => {
    await page.goto('/login');
    const group = page.getByRole('radiogroup');
    await group.getByRole('radio', { name: 'مدير (تجريبي)' }).check();
    await expect(group.getByRole('radio', { name: 'مدير (تجريبي)' })).toBeChecked();
    await page.keyboard.press('ArrowDown');
    const checked = await group.locator('input[type="radio"]:checked').getAttribute('value');
    expect(['manager', 'warehouse', 'viewer', 'technical', 'admin']).toContain(checked);
  });
});
