
const fs = require('fs');
let c = fs.readFileSync('apps/web/src/pages/ArchivePage.tsx', 'utf8');
const handleDropDocument = \
  const handleDropDocument = async (folderId: string | null, documentId: string) => {
    try {
      await api.patch(\\\/api/documents/\\\/move\\\, { folderId });
      void list.reload();
    } catch (e: any) {
      alert(e.message || 'Error moving document');
    }
  };
\;
if (!c.includes('handleDropDocument = async')) {
  c = c.replace('  return (', handleDropDocument + '\n  return (');
}
fs.writeFileSync('apps/web/src/pages/ArchivePage.tsx', c, 'utf8');

