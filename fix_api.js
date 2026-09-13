
const fs = require('fs');
let c = fs.readFileSync('apps/api/src/modules/documents/documents.routes.ts', 'utf8');

c = c.replace('import archiver from \'archiver\';', 'import * as archiver from \'archiver\';');
c = c.replace(/req\.params\.linkId/g, 'String(req.params.linkId)');
c = c.replace('archive.on(\\\'error\\\', (err) => {', 'archive.on(\\'error\\', (err: Error) => {');

fs.writeFileSync('apps/api/src/modules/documents/documents.routes.ts', c, 'utf8');

