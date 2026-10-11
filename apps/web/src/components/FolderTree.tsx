import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import type { Folder } from '@cos/shared';
import { IconPlus, IconTrash } from './Icons';
import { Modal, Field, TextInput, ConfirmDialog, useToast } from './ui';
import { useAuth } from '../context/AuthContext';

export const IconFolder = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
  </svg>
);

export const IconFolderOpen = ({ size = 18 }: { size?: number }) => (
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
  folderCount?: Record<string, number>;
}

export const FolderTree = ({ onSelect, selectedId, onDropDocument }: FolderTreeProps) => {
  const { can } = useAuth();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [newFolderModalOpen, setNewFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [parentFolderId, setParentFolderId] = useState<string | null>(null);
  const [deleteFolderTarget, setDeleteFolderTarget] = useState<Folder | null>(null);
  const toast = useToast();

  const loadFolders = () => {
    api.get<Folder[]>('/api/folders').then(setFolders).catch(() => setFolders([]));
  };

  useEffect(() => {
    loadFolders();
  }, []);

  const toggle = (id: string, e?: React.MouseEvent | React.KeyboardEvent) => {
    if (e) e.stopPropagation();
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) {
      toast('error', 'الرجاء إدخال اسم المجلد');
      return;
    }
    try {
      await api.post('/api/folders', {
        name: newFolderName.trim(),
        parentId: parentFolderId || undefined,
      });
      if (parentFolderId) {
        setExpanded((prev) => new Set([...prev, parentFolderId]));
      }
      toast('success', 'تم إنشاء المجلد بنجاح');
      setNewFolderName('');
      setNewFolderModalOpen(false);
      loadFolders();
    } catch (err: any) {
      toast('error', err.response?.data?.message || err.message || 'خطأ في إنشاء المجلد');
    }
  };

  const handleDeleteFolder = async () => {
    if (!deleteFolderTarget) return;
    try {
      await api.del(`/api/folders/${deleteFolderTarget.id}`);
      toast('success', 'تم حذف المجلد بنجاح');
      if (selectedId === deleteFolderTarget.id) {
        onSelect(null);
      }
      setDeleteFolderTarget(null);
      loadFolders();
    } catch (err: any) {
      toast('error', err.response?.data?.message || err.message || 'خطأ في حذف المجلد');
    }
  };

  const rootFolders = folders.filter((f) => !f.parentId);

  const renderFolder = (f: Folder, depth: number) => {
    const isExpanded = expanded.has(f.id);
    const children = folders.filter((child) => child.parentId === f.id);
    const hasChildren = children.length > 0;
    const isSelected = selectedId === f.id;

    return (
      <div key={f.id} role="treeitem" aria-expanded={hasChildren ? isExpanded : undefined} aria-selected={isSelected}>
        <div
          className={`folderTreeNode ${isSelected ? 'active' : ''}`}
          onClick={() => onSelect(f.id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSelect(f.id);
            } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
              if (hasChildren) {
                // Toggle expansion smoothly on either arrow key
                e.preventDefault();
                toggle(f.id, e);
              }
            }
          }}
          tabIndex={0}
          onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.backgroundColor = 'var(--bg-active)'; }}
          onDragLeave={(e) => { e.currentTarget.style.backgroundColor = ''; }}
          onDrop={(e) => {
            e.preventDefault();
            e.currentTarget.style.backgroundColor = '';
            const docId = e.dataTransfer.getData('text/plain');
            if (docId && onDropDocument) onDropDocument(f.id, docId);
          }}
          style={{ paddingInlineStart: `${depth * 18 + 10}px` }}
        >
          <span
            className={`folderTreeNode__chevron ${isExpanded ? 'expanded' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              toggle(f.id, e);
            }}
            aria-label={hasChildren ? (isExpanded ? 'طي المجلد' : 'توسيع المجلد') : undefined}
          >
            {hasChildren ? '◀' : '•'}
          </span>
          <span className="folderTreeNode__icon" style={{ color: f.color || 'var(--primary)' }}>
            {isExpanded ? <IconFolderOpen size={16} /> : <IconFolder size={16} />}
          </span>
          <span className="folderTreeNode__title" title={f.name}>{f.name}</span>

          <div className="folderTreeNode__btnGroup" onClick={(e) => e.stopPropagation()}>
            {can('archive.upload') && (
              <button
                type="button"
                className="folderTreeNode__btn"
                title="مجلد فرعي جديد"
                aria-label={`إضافة مجلد فرعي داخل ${f.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setParentFolderId(f.id);
                  setNewFolderModalOpen(true);
                }}
              >
                +
              </button>
            )}
            {can('archive.delete') && (
              <button
                type="button"
                className="folderTreeNode__btn folderTreeNode__btn--danger"
                title="حذف المجلد"
                aria-label={`حذف مجلد ${f.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteFolderTarget(f);
                }}
              >
                <IconTrash size={13} />
              </button>
            )}
          </div>
        </div>
        {isExpanded && children.map((child) => renderFolder(child, depth + 1))}
      </div>
    );
  };

  return (
    <div className="folderTreeContainer" role="tree" aria-label="شجرة مجلدات الأرشيف">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 8px 8px 8px' }}>
        <span className="text-muted" style={{ fontSize: 12, fontWeight: 700 }}>المجلدات</span>
        {can('archive.upload') && (
          <button
            className="btn btn--sm btn--ghost"
            onClick={() => {
              setParentFolderId(null);
              setNewFolderModalOpen(true);
            }}
            title="مجلد رئيسي جديد"
            aria-label="إضافة مجلد جديد"
          >
            <IconPlus size={14} /> جديد
          </button>
        )}
      </div>

      <div
        className={`folderTreeNode ${!selectedId ? 'active' : ''}`}
        onClick={() => onSelect(null)}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect(null);
          }
        }}
        onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.backgroundColor = 'var(--bg-active)'; }}
        onDragLeave={(e) => { e.currentTarget.style.backgroundColor = ''; }}
        onDrop={(e) => {
          e.preventDefault();
          e.currentTarget.style.backgroundColor = '';
          const docId = e.dataTransfer.getData('text/plain');
          if (docId && onDropDocument) onDropDocument(null, docId);
        }}
        style={{ paddingInlineStart: 10, marginBottom: 4 }}
      >
        <span style={{ width: 20, display: 'inline-block' }}></span>
        <span className="folderTreeNode__icon"><IconFolder size={16} /></span>
        <span className="folderTreeNode__title"><strong>كل المستندات</strong></span>
      </div>

      {rootFolders.map((f) => renderFolder(f, 0))}

      <Modal
        title={parentFolderId ? 'إضافة مجلد فرعي جديد' : 'إضافة مجلد جديد'}
        open={newFolderModalOpen}
        onClose={() => setNewFolderModalOpen(false)}
      >
        <form onSubmit={handleCreateFolder} className="stack">
          <Field label="اسم المجلد *">
            <TextInput
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="مثال: عقود المشاريع، اعتمادات المواد…"
              autoFocus
            />
          </Field>
          <div className="formActions">
            <button type="submit" className="btn btn--primary">إنشاء المجلد</button>
            <button type="button" className="btn btn--ghost" onClick={() => setNewFolderModalOpen(false)}>إلغاء</button>
          </div>
        </form>
      </Modal>

      {deleteFolderTarget && (
        <ConfirmDialog
          open={!!deleteFolderTarget}
          text={`هل تريد بالتأكيد حذف المجلد "${deleteFolderTarget.name}"؟ سيتم الاحتفاظ بكافة المستندات ونقلها للمجلد العام.`}
          onConfirm={handleDeleteFolder}
          onCancel={() => setDeleteFolderTarget(null)}
        />
      )}
    </div>
  );
};

