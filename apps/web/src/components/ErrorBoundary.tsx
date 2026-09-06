import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface State {
  error: Error | null;
}

/** Last-resort guard: a render exception shows an Arabic error screen with
 * retry — never a blank white page. Root causes are still fixed at source;
 * this only stops one component from taking down the whole app. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // keep the real cause visible in the console instead of suppressing it
    console.error('UI runtime error:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="errorScreen">
          <h1>حدث خطأ غير متوقع</h1>
          <p className="muted">{this.state.error.message}</p>
          <button className="btn btn--primary" onClick={() => window.location.reload()}>
            إعادة تحميل الصفحة
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
