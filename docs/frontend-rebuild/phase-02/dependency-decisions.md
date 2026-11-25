# Phase 2 — Dependency Decisions (قرارات الاعتماديات — مقترح فقط)
`docs/frontend-rebuild/phase-02/dependency-decisions.md` — no installs, no manifest changes. Core stays React + TypeScript + Vite (+ react-router-dom, vite-plugin-pwa as today).

## Kept as-is (verified adequate)
- **Routing**: `react-router-dom` v7 — nested addressable workspace tabs, guards, fallbacks all expressible. No change.
- **PWA**: `vite-plugin-pwa` (generateSW) — matches current install/offline needs. Revisit only if background-sync scope is approved later.
- **Build/test**: Vite 7, TypeScript strict, Playwright. Backend `vitest` untouched (out of scope).

## Evaluated areas (problem → alternatives → verdict)
1. **Localization (ar/en + RTL/LTR + persistence)**
   Problem: ~hundreds of hardcoded Arabic strings, zero infra; EN required with direction switch.
   Alternatives: (a) tiny project dictionary + context (`t(key)`, nested `ar/en` maps, direction effect, persisted choice) — ~150 lines, zero dep, full control, RTL-tested by us; (b) i18next + detector + ICU — mature plurals/formatting, but +~50kB, new API surface, overkill for 2 locales with simple interpolation.
   Compat/maintenance/security/bundle: (a) trivial, auditable, 0kB. RTL: manual `dir` + logical props (already the rule). **Verdict: (a) custom micro-i18n, no new dependency.** Revisit only if a third locale or complex pluralization is approved.
2. **Forms & validation**
   Problem: ~15 modals, simple shapes, server is validation authority (`issues` payloads).
   Alternatives: (a) controlled inputs + small `useForm`-style hook + server-error mapping (current pattern, keep); (b) react-hook-form + zod — less re-render, schema reuse, but new dep + learning surface for simple forms.
   **Verdict: (a) — no new dependency.** Server messages stay source of truth.
3. **Tables / data views**
   Problem: dense sortable paged tables + mobile card replicas.
   Alternatives: (a) native tables + CSS (current, test-covered selectors); (b) TanStack Table — virtualization/sorting power, but adds API surface; lists are server-paged (≤200 rows) so virtualization is unevidenced.
   **Verdict: (a) — no new dependency.** Revisit with measured perf data only.
4. **Server state / caching**
   Problem: polling notifications, refetch-after-mutate, request dedupe on 401 retry.
   Alternatives: (a) context + hooks + `usePagedList` evolution (current, adequate); (b) TanStack Query — caching/dedupe/retry, but rewrites every data hook for unproven gain.
   **Verdict: (a) — no new dependency.**
5. **Accessible primitives (dialog/drawer/tabs/combobox)**
   Problem: focus-trap/Escape/restore/combobox correctness.
   Alternatives: (a) hardened in-house primitives (already exist: Modal/Drawer/CommandPalette patterns) + Radix **only if** audit of our trap finds gaps during implementation; (b) adopt Radix now.
   **Verdict: (a) first, Radix optional-later with evidence.** No install in proposal.
6. **Data visualization**
   Problem: none evidenced — audited data supports counts, latest-lists, and per-type tallies only; invented charts banned.
   Alternatives: CSS-only bars/lists vs echarts/recharts. **Verdict: CSS-only; chart libraries unnecessary.**
7. **Fonts**
   Cairo (Arabic, proven) + Inter (Latin/data). Self-host WOFF2 (no Google-Fonts runtime link) — build-time asset change, not a package. **Verdict: no font package.**

## Summary
**Proposed new runtime dependencies: none.** Every documented need is solvable with browser capabilities + the approved stack. Anything added later requires the same justification table and technical validation in its phase. Items needing later validation: Radix (only on demonstrated trap gaps), virtualization (only on measured data), background-sync (only on approved offline scope).
