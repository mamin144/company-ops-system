/**
 * CR-03 financial-position indicators — one arithmetic, three consumers
 * (Financials.tsx, ProjectWorkspace.tsx, live-review spec).
 *
 * Every formula comes from the extended dictionary
 * `docs/frontend-rebuild/phase-09/phase-09-project-financial-metrics-dictionary.md`
 * §9 — definitions written BEFORE this implementation:
 *  - executedApproved  Σ netAmount of APPROVED IPCs only (`Ipc.netAmount`,
 *    itself derived via the audited netOf rule: lines → Σ qty×price,
 *    otherwise max(0, grossAmount − deductions)).
 *  - executionPct      executedApproved ÷ contractValue × 100 — only when
 *                      contractValue exists and is > 0.
 *  - remainingContract contractValue − executedApproved — labeled "remaining
 *                      against the contract value"; it is deliberately NOT
 *                      called "remaining for disbursement".
 *  - remainingDisbursement  always a GAP: the shared contract
 *                      (packages/shared/src/types.ts) has no payment /
 *                      disbursement data of any kind, so this indicator can
 *                      never be derived. Rendered as "not available" with a
 *                      source note — never a plausible number.
 *
 * Double-counting rule (dictionary §9.3): netAmount already folds in
 * grossAmount − deductions on the direct path, so gross/deductions are never
 * added again on top of netAmount, and non-approved IPCs enter nothing.
 */
export interface IpcSummaryLite {
  /** Σ of BOQ lines' totalPrice for this project. */
  boqTotal: number;
  /** Σ netAmount over approved IPCs only. */
  executed: number;
  /** Σ deductions over approved IPCs only. */
  deductions: number;
  approvedCount: number;
}

export interface FinancialIndicators {
  contractValue: number | null;
  executedApproved: number | null;
  deductionsApproved: number | null;
  executionPct: number | null;
  remainingContract: number | null;
  /** Constant null — honest gap, see module doc. */
  remainingDisbursement: null;
}

export const computeIndicators = (
  contractValue: number | undefined | null,
  s: IpcSummaryLite,
): FinancialIndicators => {
  const contract = contractValue == null ? null : contractValue;
  const executedApproved = s.approvedCount > 0 ? s.executed : null;
  const deductionsApproved = s.approvedCount > 0 ? s.deductions : null;
  const executionPct =
    contract != null && contract > 0 && executedApproved != null
      ? (executedApproved / contract) * 100
      : null;
  const remainingContract =
    contract != null && executedApproved != null
      ? contract - executedApproved
      : null;
  return {
    contractValue: contract,
    executedApproved,
    deductionsApproved,
    executionPct,
    remainingContract,
    remainingDisbursement: null,
  };
};

/** Locale-safe one-decimal percent, matching the money formatter's style. */
export const fmtPct = (n: number) =>
  `${n.toLocaleString('en-US', { maximumFractionDigits: 1 })}%`;
