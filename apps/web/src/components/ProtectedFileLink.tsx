import { useState } from 'react';
import { downloadDocument } from '../lib/api';
import { DocumentPreviewModal } from './DocumentPreviewModal';
import type { PreviewTarget } from './DocumentPreviewModal';

/**
 * PREVIEW action — opens the in-app viewer only. Never downloads.
 * DOWNLOAD action — explicit download only. Never opens the modal.
 * Two independent operations with separate endpoints:
 *   /api/documents/:id/preview   (inline)
 *   /api/documents/:id/download  (attachment)
 */
export const PreviewDocButton = ({
  documentId,
  fileName,
  revision,
  small,
  label = 'معاينة',
}: {
  documentId: string;
  fileName: string;
  revision?: string;
  small?: boolean;
  label?: string;
}) => {
  const [target, setTarget] = useState<PreviewTarget | null>(null);
  return (
    <>
      <button className={`btn btn--ghost ${small ? 'btn--sm' : ''}`} onClick={() => setTarget({ documentId, fileName, revision })}>
        {label}
      </button>
      <DocumentPreviewModal
        target={target}
        open={!!target}
        onClose={() => setTarget(null)}
      />
    </>
  );
};

export const DownloadDocButton = ({
  documentId,
  fileName,
  revision,
  small,
}: {
  documentId: string;
  fileName: string;
  revision?: string;
  small?: boolean;
}) => {
  const path = `/api/documents/${documentId}/download${revision ? `?revision=${encodeURIComponent(revision)}` : ''}`;
  return (
    <button className={`btn btn--ghost ${small ? 'btn--sm' : ''}`} onClick={() => void downloadDocument(path, fileName)}>
      تحميل
    </button>
  );
};
