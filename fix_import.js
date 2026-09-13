
const fs = require('fs');
let c = fs.readFileSync('apps/api/src/modules/documents/documents.routes.ts', 'utf8');

c = c.replace('// @ts-ignore\r\nimport archiver from \\'archiver\\';', 'import archiver from \\'archiver\\';');
c = c.replace('// @ts-ignore\\nimport archiver from \\'archiver\\';', 'import archiver from \\'archiver\\';');
c = c.replace('import archiver from \\'archiver\\';', 'import * as archiverModule from \\'archiver\\';\\nconst archiver = (archiverModule as any).default || archiverModule;');

fs.writeFileSync('apps/api/src/modules/documents/documents.routes.ts', c, 'utf8');

