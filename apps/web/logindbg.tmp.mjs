import { chromium } from 'playwright';
const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
const logs = [];
page.on('console', m => logs.push(m.type() + ': ' + m.text().slice(0, 120)));
page.on('pageerror', e => logs.push('PAGEERROR: ' + String(e).slice(0, 200)));
page.on('dialog', d => logs.push('DIALOG: ' + d.type() + ' ' + d.message().slice(0, 80)));
await page.goto('http://localhost:8080/');
await page.fill('input[autoComplete="username"]', 'admin');
await page.fill('input[autoComplete="current-password"]', 'admin123');
const btnCount = await page.locator('button.btn--primary').count();
console.log('btn--primary count:', btnCount);
await page.click('button.btn--primary');
try {
  await page.waitForURL('**/dashboard', { timeout: 15000 });
  console.log('NAVIGATED:', page.url());
} catch {
  console.log('NO-NAV, url=', page.url());
}
console.log('LOGS:', JSON.stringify(logs, null, 1));
await browser.close();
