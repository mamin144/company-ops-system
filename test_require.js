
const fs = require('fs');
let c = fs.readFileSync('apps/api/src/modules/documents/documents.routes.ts', 'utf8');
console.log('Contains require(fs)?', c.includes(equire('fs')));

