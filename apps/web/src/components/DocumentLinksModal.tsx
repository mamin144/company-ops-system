import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import type { Document, Project } from '@cos/shared';
import { Modal, Select, Field } from './ui';
import { IconTrash, IconPlus } from './Icons';

interface DocumentLinksModalProps {
  open: boolean;
  onClose: () => void;
  document: Document | null;
  projects: Project[];
  onSuccess: () => void;
}

export const DocumentLinksModal = ({ open, onClose, document, projects, onSuccess }: DocumentLinksModalProps) => {
  const [loading, setLoading] = useState(false);
  const [selectedProject, setSelectedProject] = useState('');

  useEffect(() => {
    if (open) {
      setSelectedProject('');
    }
  }, [open]);

  if (!document) return null;

  const links = document.links || [];

  const handleAddLink = async () => {
    if (!selectedProject) return;
    setLoading(true);
    try {
      await api.post(`/api/documents/${document.id}/links`, {
        entityType: 'project',
        entityId: selectedProject,
      });
      onSuccess();
      setSelectedProject('');
    } catch (e: any) {
      alert(e.message || 'Error adding link');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveLink = async (linkId: string) => {
    if (!confirm('هل أنت متأكد من إزالة هذا الرابط؟')) return;
    setLoading(true);
    try {
      await api.del(`/api/documents/links/${linkId}`);
      onSuccess();
    } catch (e: any) {
      alert(e.message || 'Error removing link');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title={`إدارة روابط المستند: ${document.title}`} open={open} onClose={onClose} wide>
      <div className="stack">
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <Field label="ربط بمشروع">
              <Select value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)}>
                <option value="">اختر مشروعاً...</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.projectCode} — {p.projectName}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <button 
            className="btn btn--primary" 
            style={{ marginBottom: '8px' }} 
            onClick={() => void handleAddLink()} 
            disabled={!selectedProject || loading}
          >
            <IconPlus size={16} /> إضافة
          </button>
        </div>

        <table className="table table--flat">
          <thead>
            <tr>
              <th>النوع</th>
              <th>الكيان المرتبط</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {links.length === 0 ? (
              <tr>
                <td colSpan={3} className="muted text-center">لا توجد روابط لهذا المستند</td>
              </tr>
            ) : (
              links.map((link) => {
                const project = projects.find((p) => p.id === link.entityId);
                const entityName = project ? `${project.projectCode} — ${project.projectName}` : link.entityId;
                
                return (
                  <tr key={link.id}>
                    <td>{link.entityType === 'project' ? 'مشروع' : link.entityType}</td>
                    <td>{entityName}</td>
                    <td style={{ textAlign: 'left' }}>
                      <button 
                        className="iconBtn iconBtn--danger" 
                        onClick={() => void handleRemoveLink(link.id)}
                        disabled={loading}
                      >
                        <IconTrash size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </Modal>
  );
};
