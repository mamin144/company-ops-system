import { defineConfig, devices } from '@playwright/test';

// Kept Phase 3.2 regression config. Output goes to the OS temp dir —
// never to the repo-root test-results/ or any tracked artifact.
export default defineConfig({
  testDir: './',
  outputDir: 'C:\\Users\\PC-01\\AppData\\Local\\Temp\\opencode\\proto-verify-out',
  workers: 1,
  timeout: 300000,
  reporter: 'list',
  // Phase 6: PW_BASE_URL lets the suite point at the agent's own preview
  // (:5201/dist317c) while the mandated :5199/dist source of truth stays the
  // untouched default for owner runs. No other behavior changes.
  use: { baseURL: process.env.PW_BASE_URL || 'http://localhost:5199' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // No webServer block by design: Windows cmd/CWD quoting makes spawned
  // preview servers flaky from this path depth. Start the server manually
  // per README (from this directory so dist/ resolves), then run:
  //   node <root>/node_modules/@playwright/test/cli.js test -c verify/pw.config.ts
  // The suite fails fast with a clear connection error if :5199 is down.
});
