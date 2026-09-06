import { useCallback, useEffect, useState } from 'react';
import { Modal } from './ui';
import { apiHead, downloadDocument } from '../lib/api';

type PreviewKind = 'pdf' | 'image' | 'unsupported';

const kindFromMime = (mime: string): PreviewKind => {
  if (mime === 'application/pdf') return 'pdf';
  if (mime.startsWith('image/')) return 'image';
  return 'unsupported';
};

export interface PreviewTarget {
  documentId: string;
  fileName: string;
  revision?: string;
}

/**
 * Direct Web Preview.
 *
 * The browser itself loads the document from the protected endpoint:
 *   <iframe src="/api/documents/:id/preview">  (PDF)
 *   <img src="/api/documents/:id/preview">     (images)
 *
 * Authentication works because the endpoint accepts the HttpOnly `cos_access`
 * cookie (same-origin request through the Vite proxy) — no tokens in URLs.
 * Before rendering, a HEAD probe (central authenticated client) validates the
 * status + MIME so errors show the real HTTP code, and unsupported types get
 * a clear message instead of a blank frame. No Blob URLs are created.
 */
export const DocumentPreviewModal = ({
  target,
  open,
  onClose,
}: {
  target: PreviewTarget | null;
  open: boolean;
  onClose: () => void;
}) => {
  const [kind, setKind] = useState<PreviewKind | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const qs = target?.revision ? `?revision=${encodeURIComponent(target.revision)}` : '';
  const previewUrl = target ? `/api/documents/${target.documentId}/preview${qs}` : '';
  const downloadPath = target ? `/api/documents/${target.documentId}/download${qs}` : '';

  const load = useCallback(async () => {
    if (!target) return;
    setError(null);
    setKind(null);
    setLoading(true);
    try {
      const head = await apiHead(previewUrl);
      if (!head.ok) {
        throw Object.assign(new Error('تعذر تحميل المستند للمعاينة.'), { status: head.status });
      }
      if (!head.contentType || head.contentType === 'application/json') {
        throw Object.assign(new Error('استجابة غير صالحة من الخادم.'), { status: head.status });
      }
      setKind(kindFromMime(head.contentType));
    } catch (e) {
      const status = (e as { status?: number }).status;
      const msg = e instanceof Error && e.message ? e.message : 'تعذر تحميل المستند للمعاينة.';
      setError(status ? `${msg} (HTTP ${status})` : msg);
    } finally {
      setLoading(false);
    }
  }, [target, previewUrl]);

  useEffect(() => {
    if (open && target) void load();
  }, [open, target, load]);

  return (
    <Modal title={target?.fileName ?? ''} open={open} onClose={onClose} wide>
      {loading ? (
        <div className="previewLoading">جارٍ تحميل المستند...</div>
      ) : error ? (
        <div className="previewError">
          <p>{error}</p>
          <div className="formActions" style={{ justifyContent: 'center' }}>
            <button className="btn btn--primary" onClick={() => void load()}>إعادة المحاولة</button>
            <button className="btn" onClick={() => void downloadDocument(downloadPath, target?.fileName ?? 'file')}>تحميل الملف</button>
          </div>
        </div>
      ) : kind === 'unsupported' ? (
        <div className="previewError">
          <p style={{ color: 'var(--text)' }}>هذا النوع من الملفات لا يدعم المعاينة داخل المتصفح.</p>
          <div className="formActions" style={{ justifyContent: 'center' }}>
            <button className="btn btn--primary" onClick={() => void downloadDocument(downloadPath, target?.fileName ?? 'file')}>تحميل الملف</button>
          </div>
        </div>
      ) : kind ? (
        <div className="previewBody">
          {kind === 'pdf' ? (
            <iframe src={previewUrl} title={target?.fileName ?? 'preview'} className="previewFrame" />
          ) : (
            <img src={previewUrl} alt={target?.fileName ?? 'preview'} className="previewImage" />
          )}
        </div>
      ) : null}
    </Modal>
  );
};
