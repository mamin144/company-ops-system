// Mock-adapter isolation probe (Phase 4; two-case contract since Phase 13).
// Node-side, run by phase4.spec.ts. Bundles the services/api facade as a
// PRODUCTION build and executes it in Node:
//   Case A (fixture): VITE_PROTOTYPE='1' → the adapter's import-time
//     isolation guard throws "[prototype] mock adapter blocked outside the
//     isolated prototype build". Exit 0 + guard message = fixture isolation.
//   Case B (http): VITE_PROTOTYPE empty (production default) → the facade
//     must import CLEANLY and report adapterMode==='http' — a production
//     build never falls back to fixtures. Exit 0 + ISOLATION-HTTP-OK.
// Any deviation exits 1 with ISOLATION-FAIL.
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const here = path.dirname(url.fileURLToPath(import.meta.url));
const protoRoot = path.resolve(here, '..');
const out = path.join(process.env.TEMP || here, 'phase4-mock-isolation-probe.cjs');

const ENV_DEFINES = {
  'import.meta.env.PROD': 'true',
  'import.meta.env.MODE': "'production'",
  'import.meta.env.DEV': 'false',
  'import.meta.env.VITE_API_BASE_URL': "''",
};

await build({
  entryPoints: [path.join(protoRoot, 'src/services/api/index.ts')],
  bundle: true,
  platform: 'browser',
  format: 'cjs',
  outfile: out,
  logLevel: 'silent',
  // Case A: fixture build attempt.
  define: { ...ENV_DEFINES, "import.meta.env.VITE_PROTOTYPE": "'1'" },
});

try {
  execFileSync('node', [out], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  console.error('ISOLATION-FAIL: production bundle loaded the mock adapter without throwing');
  process.exit(1);
} catch (e) {
  const stderr = String(e.stderr || '');
  fs.rmSync(out, { force: true });
  if (!stderr.includes('mock adapter blocked')) {
    console.error('ISOLATION-FAIL: unexpected failure (fixture case)\n' + stderr);
    process.exit(1);
  }
  console.log('ISOLATION-OK: guard threw as designed:', stderr.split('\n').find((l) => l.includes('mock adapter blocked'))?.trim());
}

// Case B: production default build (no fixture flag) imports cleanly. A tiny
// generated entry imports the facade and reports the selected transport —
// the probe asserts adapterMode==='http', not just "no crash".
const entryB = path.join(process.env.TEMP || here, 'phase4-isolation-http-entry.mjs');
fs.writeFileSync(entryB, [
  `import { adapterMode } from '${path.join(protoRoot, 'src/services/api').replaceAll('\\', '/')}';`,
  `if (adapterMode !== 'http') {`,
  `  console.error('ISOLATION-FAIL: adapterMode=' + adapterMode);`,
  `  process.exit(1);`,
  `}`,
  `console.log('ISOLATION-HTTP-OK: adapterMode=http');`,
].join('\n'));
await build({
  entryPoints: [entryB],
  bundle: true,
  platform: 'browser',
  format: 'cjs',
  outfile: out,
  logLevel: 'silent',
  define: { ...ENV_DEFINES, "import.meta.env.VITE_PROTOTYPE": "''" },
});
fs.rmSync(entryB, { force: true });

try {
  const stdout = execFileSync('node', [out], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  fs.rmSync(out, { force: true });
  if (!stdout.includes('ISOLATION-HTTP-OK')) {
    console.error('ISOLATION-FAIL: http bundle ran but did not report adapterMode=http\n' + stdout);
    process.exit(1);
  }
  console.log(stdout.trim());
} catch (e) {
  const stderr = String(e.stderr || '');
  fs.rmSync(out, { force: true });
  console.error('ISOLATION-FAIL: production default (http) bundle did not import cleanly\n' + stderr);
  process.exit(1);
}
process.exit(0);
