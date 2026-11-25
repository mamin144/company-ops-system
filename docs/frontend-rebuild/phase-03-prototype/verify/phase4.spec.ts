import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

// Phase 4 — foundation spec: the new app/features/shared/services/i18n layering
// must boot identically to Phase 3, the ErrorBoundary must catch and recover,
// the mock adapter must stay production-isolated, and the dependency rules
// (features never import features; shared never imports features) must hold.
// Temp output only; mock data only. Runs against :5199 (dist build).

const here = path.dirname(url.fileURLToPath(import.meta.url));
const protoRoot = path.resolve(here, '..');
const srcRoot = path.join(protoRoot, 'src');

const loginAs = async (page: any, role = 'مدير (تجريبي)') => {
  await page.goto('/login');
  await page.getByRole('radio', { name: role }).click();
  await page.getByRole('button', { name: /دخول تجريبي/ }).click();
  await page.locator('.shell').waitFor({ timeout: 10000 });
};

test.describe('phase 4 foundation', () => {
  test('app boots through the new app/ layer; approved greeting intact', async ({ page }) => {
    await loginAs(page);
    // dashboard feature renders through app/router → app/layouts shell
    const h1 = page.locator('.cmdHead h1').first();
    await expect(h1).toBeVisible({ timeout: 8000 });
    await expect(h1).toContainText('صباح الخير');
    // 3.17-D composition preserved: two SplitTexts → 5 words, name direction-isolated
    await expect(page.locator('.cmdHead h1 [data-i18n-skip]')).toHaveCount(1);
    await expect(page.locator('.cmdHead h1 .split-word')).toHaveCount(5);
  });

  test('unknown route still renders the honest 404 state', async ({ page }) => {
    await loginAs(page);
    await page.goto('/phase4-definitely-not-a-route');
    await expect(page.getByRole('heading', { name: 'الصفحة غير موجودة' })).toBeVisible();
    await expect(page.getByText('تحقق من الرابط أو ارجع للرئيسية.')).toBeVisible();
  });

  test('error boundary catches render crashes and recovers', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
    await loginAs(page);
    // prototype-only crash probe route (registered only when VITE_PROTOTYPE=1)
    await page.goto('/_test/crash');
    await expect(page.getByRole('heading', { name: 'حدث خطأ غير متوقع في هذه الشاشة' })).toBeVisible({ timeout: 8000 });
    await expect(consoleErrors.some((t) => t.includes('[ErrorBoundary]'))).toBe(true);
    // recovery path 1: try again (boundary reset, probe throws again — proves reset works)
    await page.getByRole('button', { name: 'حاول مجددًا / Try again' }).click();
    await expect(page.getByRole('heading', { name: 'حدث خطأ غير متوقع في هذه الشاشة' })).toBeVisible();
    // recovery path 2: back home lands on the dashboard, fully working
    await page.getByRole('button', { name: 'العودة للرئيسية / Back home' }).click();
    await page.waitForURL((u) => u.pathname === '/');
    await expect(page.locator('.shell')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.cmdHead h1').first()).toContainText('صباح الخير');
  });

  test('mock adapter is production-isolated (import-time guard)', async () => {
    // Runs the node-side probe: bundles services/api as a PRODUCTION build
    // (VITE_PROTOTYPE='') and expects the adapter guard to throw on import.
    const out = execFileSync('node', [path.join(here, 'probe-mock-isolation.mjs')], { encoding: 'utf8', cwd: protoRoot });
    expect(out).toContain('ISOLATION-OK');
  });

  test('dependency rules: features never import features; shared never imports features', async () => {
    const walk = (dir: string): string[] =>
      fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const p = path.join(dir, e.name);
        return e.isDirectory() ? walk(p) : (/\.(tsx?|css)$/.test(e.name) ? [p] : []);
      });
    const featuresDir = path.join(srcRoot, 'features');
    const featureFiles = walk(featuresDir);
    // 1) inside features/, only the feature's own index.ts may reference '@/features/'
    for (const f of featureFiles) {
      const text = fs.readFileSync(f, 'utf8');
      const isOwnIndex = path.dirname(f) === featuresDir || path.basename(f) === 'index.ts';
      const refs = [...text.matchAll(/['"]@?\/?features\/([\w-]+)/g)].map((m) => m[1]);
      const own = path.basename(path.dirname(path.dirname(f))); // features/<name>/components|x
      if (!isOwnIndex) {
        for (const ref of refs) {
          expect(
            ref === own,
            `${path.relative(srcRoot, f)} imports @/features/${ref} — feature-to-feature imports must go through index.ts of the app/router layer, never sideways`
          ).toBe(true);
        }
      }
    }
    // 2) shared/ must not import feature internals at all
    for (const f of walk(path.join(srcRoot, 'shared'))) {
      const text = fs.readFileSync(f, 'utf8');
      expect(text.includes('@/features/'), `${path.relative(srcRoot, f)} imports a feature — shared must stay feature-free`).toBe(false);
    }
    // 3) services/api must not import React UI (no .tsx, no shared/ui)
    for (const f of walk(path.join(srcRoot, 'services'))) {
      const text = fs.readFileSync(f, 'utf8');
      expect(text.includes('@/shared/ui'), `${path.relative(srcRoot, f)} imports shared/ui — services must not import React UI`).toBe(false);
      expect(f.endsWith('.tsx'), `${path.relative(srcRoot, f)} is JSX — services must stay UI-free`).toBe(false);
    }
  });
});
