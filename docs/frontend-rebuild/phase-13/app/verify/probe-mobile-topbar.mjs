// One-off probe (not part of the suite): measure the shell topbar and the
// ع/EN language toggle at phone width against the built preview on :5199.
// Optional first argv overrides the target (Phase 6: http://localhost:5201).
import { chromium } from '@playwright/test';
const target = process.argv[2] || 'http://localhost:5199';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
await p.goto(target + '/login');
await p.locator('.rolePick label').nth(0).click();
await p.getByRole('button', { name: /دخول تجريبي|Demo login/ }).click();
await p.locator('.shell').waitFor({ timeout: 10000 });
const info = await p.evaluate(() => {
  const topbar = document.querySelector('.topbar');
  const btn = [...document.querySelectorAll('.topbar button')].find((x) => x.textContent.trim() === 'ع/EN');
  const r = btn?.getBoundingClientRect();
  return {
    vw: innerWidth,
    topbarScrollW: topbar?.scrollWidth,
    topbarClientW: topbar?.clientWidth,
    overflowX: topbar ? getComputedStyle(topbar).overflowX : null,
    langBtn: r ? { x: Math.round(r.x), right: Math.round(r.right), w: Math.round(r.width) } : null,
    langBtnInViewport: r ? r.right > 0 && r.left < innerWidth : null,
  };
});
console.log(JSON.stringify(info, null, 2));
await b.close();
