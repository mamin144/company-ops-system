/**
 * Phase 14 O2/O5/O6 — financial "unavailable" contract helpers.
 *
 * Rule: a financial value that was never entered, or whose rules are not
 * defined, is returned as an explicit UnavailableField. It is NEVER coerced
 * to 0. A genuine stored 0.00 is preserved as the number 0.
 */
import type { UnavailableField, UnavailableReason } from '@cos/shared';

export const unavailable = (reason: UnavailableReason): UnavailableField => ({
  value: null,
  unavailable: true,
  reason,
});

/**
 * Money value coming from a nullable DB column.
 * NULL/undefined -> unavailable envelope. Numeric (incl. "0.00") -> number.
 */
export const numericOrUnavailable = (
  value: number | string | null | undefined,
  reason: UnavailableReason = 'NOT_ENTERED',
): number | UnavailableField => {
  if (value === null || value === undefined) return unavailable(reason);
  const n = Number(value);
  if (!Number.isFinite(n)) return unavailable(reason);
  return n;
};

/**
 * SUM() over zero rows is SQL NULL -> 0 is a *derived* total over real rows,
 * not a fabricated entered value (Σ of an empty set is genuinely 0).
 */
export const sumOrZero = (value: number | string | null | undefined): number => {
  if (value === null || value === undefined) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};
