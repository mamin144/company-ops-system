import { test, expect } from '@playwright/test';

test.describe('PWA Capabilities', () => {
  test('Manifest is present and correct', async ({ page }) => {
    await page.goto('/');
    const manifestTag = page.locator('link[rel="manifest"]');
    await expect(manifestTag).toBeAttached();
    
    // Check manifest JSON
    const manifestHref = await manifestTag.getAttribute('href');
    const manifestResponse = await page.request.get(manifestHref || '/manifest.webmanifest');
    expect(manifestResponse.ok()).toBeTruthy();
    
    const manifest = await manifestResponse.json();
    expect(manifest.name).toBeDefined();
    expect(manifest.start_url).toBeDefined();
    expect(manifest.display).toBe('standalone');
    expect(manifest.icons.length).toBeGreaterThan(0);
  });

  test('Service Worker registration and control', async ({ page }) => {
    await page.goto('/');
    
    // wait for SW to register and activate
    const isControlled = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return false;
      const reg = await navigator.serviceWorker.ready;
      return !!reg.active;
    });
    
    expect(isControlled).toBe(true);
  });

  test('Login and Navigation with no console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        // filter out expected 401 on initial load
        if (!msg.text().includes('401')) {
          errors.push(msg.text());
        }
      }
    });

    await page.goto('/');
    
    // Login
    await page.fill('input[autoComplete="username"]', 'admin');
    await page.fill('input[autoComplete="current-password"]', 'admin123');
    await page.click('button.btn--primary');

    // wait for nav
    await page.waitForURL('**/dashboard');
    const title = page.locator('h1, h2');
    await expect(title.first()).toBeVisible();
    
    expect(errors.length).toBe(0);
  });

  test('Offline Mode - App Shell loads', async ({ context, page }) => {
    await page.goto('/');
    
    // wait for SW to cache assets
    await page.waitForTimeout(2000); 

    // Set offline
    await context.setOffline(true);

    // Reload
    await page.reload();

    // Check if the app shell still renders (e.g. root div)
    const root = page.locator('#root');
    await expect(root).toBeVisible();
    
    // Restore
    await context.setOffline(false);
  });

  test('Mobile Viewport & RTL Layout', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    // Check RTL direction
    const htmlDir = await page.evaluate(() => document.documentElement.getAttribute('dir'));
    expect(htmlDir).toBe('rtl');
    
    // Check for no horizontal scroll
    const overflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(overflow).toBe(false);
  });
});
