// Copies non-TS assets (SQL migrations) next to the compiled output.
const fs = require('node:fs');
const path = require('node:path');
const src = path.join(__dirname, 'src', 'database', 'migrations');
const dest = path.join(__dirname, 'dist', 'database', 'migrations');
fs.rmSync(dest, { recursive: true, force: true });
fs.cpSync(src, dest, { recursive: true });
console.log(`migrations copied: ${src} -> ${dest}`);
