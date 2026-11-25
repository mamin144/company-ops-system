// Global error boundary (Phase 4 foundation). Brand-agnostic fallback in the
// approved design language; deliberately simple. Phase 5 (shell rebuild) owns
// richer presentation. The message is bilingual and static because the
// language provider may itself be the failing subtree.
import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props { children: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep the diagnosable copy in the console — the UI shows a calm fallback.
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  private hide = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div style={{ maxWidth: 720, margin: '15vh auto', padding: '0 20px' }}>
        <div className="empty" role="alert" aria-live="assertive">
          <p className="emptyIcon" aria-hidden="true" style={{ fontSize: 34, margin: 0 }}>⚠</p>
          <h2>حدث خطأ غير متوقع في هذه الشاشة</h2>
          <p className="muted">Something unexpected crashed this screen. Reload to recover.</p>
          {error.message && <p className="muted small" style={{ wordBreak: 'break-word' }}><code>{error.message}</code></p>}
          <p style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button type="button" className="btn" onClick={this.hide}>حاول مجددًا / Try again</button>
            <button type="button" className="btn" onClick={() => { window.location.assign('/'); }}>العودة للرئيسية / Back home</button>
          </p>
        </div>
      </div>
    );
  }
}
