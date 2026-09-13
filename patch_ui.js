
const fs = require('fs');
let c = fs.readFileSync('apps/web/src/pages/ArchivePage.tsx', 'utf8');

c = c.replace(
  'import { useState, useRef } from \'react\';',
  'import { useState, useRef } from \'react\';\nimport { Link } from \'react-router-dom\';\nimport { IconLink } from \'../components/Icons\';'
);

c = c.replace(
  'const [quickUploadOpen, setQuickUploadOpen] = useState(false);',
  'const [quickUploadOpen, setQuickUploadOpen] = useState(false);\n  const [selectedIds, setSelectedIds] = useState<string[]>([]);\n  const [linksDoc, setLinksDoc] = useState<Document | null>(null);'
);

const zipFn = \
  const handleDownloadZip = async () => {
    if (selectedIds.length === 0) return;
    try {
      const res = await fetch('/api/documents/export/zip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: \\\Bearer \\\\\\,
        },
        body: JSON.stringify({ documentIds: selectedIds }),
      });
      if (!res.ok) throw new Error('Failed to generate ZIP');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'archive_export.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(e.message);
    }
  };
\;

c = c.replace('const openCreate = () => {', zipFn + '\n  const openCreate = () => {');

const toggleSelection = \
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };
\;
c = c.replace('const zipFn', toggleSelection + 'const zipFn'); // oops this line is wrong because I used string replacement for the template

// I'll just use string replacement carefully.

