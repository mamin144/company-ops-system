import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import type { Folder } from '@cos/shared';

export const IconFolder = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
  </svg>
);

export const IconFolderOpen = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
    <line x1="12" y1="11" x2="12" y2="17"></line>
    <line x1="9" y1="14" x2="15" y2="14"></line>
  </svg>
);

interface FolderTreeProps {
  onSelect: (folderId: string | null) => void;
  selectedId: string | null;
  onDropDocument?: (folderId: string | null, documentId: string) => void;
}

export const FolderTree = ({ onSelect, selectedId, onDropDocument }: FolderTreeProps) => {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    api.get<Folder[]>('/api/folders').then(setFolders);
  }, []);

  const toggle = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  };

  const rootFolders = folders.filter((f) => !f.parentId);

  const renderFolder = (f: Folder, depth: number) => {
    const isExpanded = expanded.has(f.id);
    const children = folders.filter((child) => child.parentId === f.id);
    const hasChildren = children.length > 0;
    const isSelected = selectedId === f.id;

    return (
      <div key={f.id}>
        <div
          onClick={() => onSelect(f.id)}
          onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.backgroundColor = 'var(--bg-active)'; }}
          onDragLeave={(e) => { e.currentTarget.style.backgroundColor = isSelected ? 'var(--bg-active)' : 'transparent'; }}
          onDrop={(e) => {
            e.preventDefault();
            e.currentTarget.style.backgroundColor = isSelected ? 'var(--bg-active)' : 'transparent';
            const docId = e.dataTransfer.getData('text/plain');
            if (docId && onDropDocument) onDropDocument(f.id, docId);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '6px 8px',
            paddingLeft: `${depth * 16 + 8}px`,
            cursor: 'pointer',
            backgroundColor: isSelected ? 'var(--bg-active)' : 'transparent',
            borderRadius: 4,
            userSelect: 'none',
          }}
        >
          <span
            onClick={(e) => hasChildren && toggle(f.id, e)}
            style={{ width: 20, display: 'inline-block', textAlign: 'center', color: 'var(--text-muted)' }}
          >
            {hasChildren ? (isExpanded ? '▾' : '▸') : ' '}
          </span>
          <span style={{ color: f.color || 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <IconFolder size={16} />
            {f.name}
          </span>
        </div>
        {isExpanded && children.map((child) => renderFolder(child, depth + 1))}
      </div>
    );
  };

  return (
    <div className="folder-tree" style={{ padding: 8 }}>
      <div
        onClick={() => onSelect(null)}
        onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.backgroundColor = 'var(--bg-active)'; }}
        onDragLeave={(e) => { e.currentTarget.style.backgroundColor = selectedId === null ? 'var(--bg-active)' : 'transparent'; }}
        onDrop={(e) => {
          e.preventDefault();
          e.currentTarget.style.backgroundColor = selectedId === null ? 'var(--bg-active)' : 'transparent';
          const docId = e.dataTransfer.getData('text/plain');
          if (docId && onDropDocument) onDropDocument(null, docId);
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '6px 8px',
          cursor: 'pointer',
          backgroundColor: selectedId === null ? 'var(--bg-active)' : 'transparent',
          borderRadius: 4,
          fontWeight: 'bold'
        }}
      >
        <span style={{ width: 20, display: 'inline-block' }}></span>
        <IconFolder size={16} /> <span style={{ marginLeft: 6 }}>كل المستندات</span>
      </div>
      {rootFolders.map((f) => renderFolder(f, 0))}
    </div>
  );
};
