// Error-shape contract for API failures (Phase 4 foundation).
// In the running prototype all "API" failures surface as plain Error strings
// from the mock adapter (Arabic server-contract strings + optional `errorKey`
// originals — see shared/ui errText). When the real HTTP adapter lands, it
// must normalize every failure into the shapes below so screens keep calling
// errText() without change.

export interface ValidationApiError {
  kind: 'validation';
  /** Server field-level issues; presentation only, never re-validated here. */
  fields?: Record<string, string>;
  /** Server contract message (Arabic), optional i18n `errorKey` passthrough. */
  error: string;
  errorKey?: string;
  errorVars?: Record<string, string | number>;
}

export interface HttpApiError {
  kind: 'http';
  status: number;
  /** Server contract message when the server provides one. */
  error?: string;
  errorKey?: string;
}

export interface NetworkApiError {
  kind: 'network';
  /** True when the call was aborted (timeout or caller cancellation). */
  aborted?: boolean;
}

export type ApiError = ValidationApiError | HttpApiError | NetworkApiError;

export const toApiError = (e: unknown): ApiError => {
  if (e instanceof Error) {
    const anyE = e as Error & { status?: number; aborted?: boolean };
    if (anyE.aborted) return { kind: 'network', aborted: true };
    if (typeof anyE.status === 'number') return { kind: 'http', status: anyE.status };
    // Timeout InAbort from the transport helper
    return { kind: 'network' };
  }
  return { kind: 'network' };
};
