// Build guard: plain node (production service) requires explicit .js
// extensions on relative imports. tsx tolerates extensionless imports,
// so without this check a dev-green build could crash in production.
// Fails the build listing offenders; fix with: node fix_esm_imports.js
const fs = require('node:fs');
const path = require('node:path');

const SRC = path.join(__dirname, 'src');
const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) walk(f, out);
    else if (/\.ts$/.test(f) && !/\.test\.ts$/.test(f)) out.push(f);
  }
  return out;
};

const bad = [];
for (const file of walk(SRC)) {
  const src = fs.readFileSync(file, 'utf8');
  const re = /((?:from\s+|import\s*\()\s*)(['"])(\.\.?\/[^'"]*)\2/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const spec = m[3];
    if (!/\.(js|mjs|cjs|jsx|ts|tsx|json|css|html|svg|png|jpg|node)$/.test(spec)) {
      bad.push(`${path.relative(SRC, file)} -> ${spec}`);
    }
  }
}
if (bad.length) {
  console.error('Extensionless relative imports (break plain-node production):');
  bad.forEach((b) => console.error('  ' + b));
  process.exit(1);
}
console.log('ESM import check passed.');
