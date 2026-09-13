
const fs = require('fs');
let c = fs.readFileSync('apps/web/src/components/FolderTree.tsx', 'utf8');

c = c.replace(
  'interface FolderTreeProps {',
  'interface FolderTreeProps {\n  onDropDocument?: (folderId: string | null, documentId: string) => void;'
);

c = c.replace(
  'export const FolderTree = ({ onSelect, selectedId }: FolderTreeProps) => {',
  'export const FolderTree = ({ onSelect, selectedId, onDropDocument }: FolderTreeProps) => {'
);

const dropProps = \
          onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.backgroundColor = 'var(--bg-active)'; }}
          onDragLeave={(e) => { e.currentTarget.style.backgroundColor = isSelected ? 'var(--bg-active)' : 'transparent'; }}
          onDrop={(e) => {
            e.preventDefault();
            e.currentTarget.style.backgroundColor = isSelected ? 'var(--bg-active)' : 'transparent';
            const docId = e.dataTransfer.getData('text/plain');
            if (docId && onDropDocument) onDropDocument(f.id, docId);
          }}
\;
c = c.replace(
  'onClick={() => onSelect(f.id)}',
  'onClick={() => onSelect(f.id)}\n' + dropProps
);

const dropPropsAll = \
        onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.backgroundColor = 'var(--bg-active)'; }}
        onDragLeave={(e) => { e.currentTarget.style.backgroundColor = selectedId === null ? 'var(--bg-active)' : 'transparent'; }}
        onDrop={(e) => {
          e.preventDefault();
          e.currentTarget.style.backgroundColor = selectedId === null ? 'var(--bg-active)' : 'transparent';
          const docId = e.dataTransfer.getData('text/plain');
          if (docId && onDropDocument) onDropDocument(null, docId);
        }}
\;
c = c.replace(
  'onClick={() => onSelect(null)}',
  'onClick={() => onSelect(null)}\n' + dropPropsAll
);

fs.writeFileSync('apps/web/src/components/FolderTree.tsx', c, 'utf8');

