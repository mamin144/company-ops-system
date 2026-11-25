// Mock-adapter isolation probe (Phase 4). Node-side, run by phase4.spec.ts.
// Bundles the services/api facade as a PRODUCTION build (VITE_PROTOTYPE empty)
// and executes it. Expected: the adapter's import-time isolation guard throws
// "[prototype] mock adapter blocked outside the isolated prototype build".
// Exit 0 + the guard message on stderr = isolation verified.
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const here = path.dirname(url.fileURLToPath(import.meta.url));
const protoRoot = path.resolve(here, '..');
const out = path.join(process.env.TEMP || here, 'phase4-mock-isolation-probe.cjs');

await build({
  entryPoints: [path.join(protoRoot, 'src/services/api/index.ts')],
  bundle: true,
  platform: 'browser',
  format: 'cjs',
  outfile: out,
  logLevel: 'silent',
  define: {
    'import.meta.env.PROD': 'true',
    "import.meta.env.VITE_PROTOTYPE": "''",
    'import.meta.env.MODE': "'production'",
    'import.meta.env.DEV': 'false',
  },
});

try {
  execFileSync('node', [out], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  console.error('ISOLATION-FAIL: production bundle loaded the mock adapter without throwing');
  process.exit(1);
} catch (e) {
  const stderr = String(e.stderr || '');
  fs.rmSync(out, { force: true });
  if (stderr.includes('mock adapter blocked')) {
    console.log('ISOLATION-OK: guard threw as designed:', stderr.split('\n').find((l) => l.includes('mock adapter blocked'))?.trim());
    process.exit(0);
  }
  console.error('ISOLATION-FAIL: unexpected failure\n' + stderr);
  process.exit(1);
}
