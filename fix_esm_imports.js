// Add explicit .js extensions to relative imports (ESM requirement for plain node).
// Safe: verifies target exists as .ts (or /index.ts) before rewriting.
const fs = require('node:fs');
const path = require('node:path');

const SRC = 'C:/Users/PC-01/Documents/Default Project/company-ops-system/apps/api/src';
const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) walk(f, out);
    else if (/\.ts$/.test(f) && !/\.test\.ts$/.test(f)) out.push(f);
  }
  return out;
};

let changed = 0, problems = [];
for (const file of walk(SRC)) {
  let src = fs.readFileSync(file, 'utf8');
  const dir = path.dirname(file);
  const next = src.replace(/((?:from\s+|import\s*\()\s*)(['"])(\.\.?\/[^'"]*)\2/g, (m, pre, q, spec) => {
    // skip only real asset/code extensions (.routes/.repository/.service are TS basenames, not extensions)
    if (/\.(js|mjs|cjs|jsx|ts|tsx|json|css|html|svg|png|jpg|node)$/.test(spec)) return m;
    const abs = path.resolve(dir, spec);
    if (fs.existsSync(abs + '.ts')) return `${pre}${q}${spec}.js${q}`;
    if (fs.existsSync(path.join(abs, 'index.ts'))) return `${pre}${q}${spec}/index.js${q}`;
    problems.push(`${path.relative(SRC, file)} -> ${spec}`);
    return m;
  });
  if (next !== src) { fs.writeFileSync(file, next, 'utf8'); changed++; }
}
console.log(`files changed: ${changed}, unresolved: ${problems.length}`);
problems.slice(0, 20).forEach((p) => console.log('  ?? ' + p));
