# Phase 2 — Direction Comparison A/B/C/D (مقارنة الاتجاهات)
`docs/frontend-rebuild/phase-02/direction-comparison.md` — comparison only. **No direction approved.** Facts (source-verified) are separated from judgments (§4) throughout.

## 1. Navigation
| | A Operations Desk | B Project Spine | C Queues First | D Balanced Operations |
|---|---|---|---|---|
| Structure | Slim icon rail + ⌘K-first, flat module list | Project hub + nested workspace routes + global areas | Home queues + flat modules, tasks link to entities | First-class global nav (7 modules) + project workspaces + home queues |
| Permission behavior | Items hidden without rights; `/403` for direct URLs | Same + workspace tabs hidden per scope | Same; tasks filtered by rights | Same; no module demoted |
| Judgment | Fastest for experts; weakest orientation cues | Best orientation (breadcrumbs); deepest tree | Clearest start point; weakest browsing | Most complete but most chrome to keep consistent |

## 2. Home screen
| | A | B | C | D |
|---|---|---|---|---|
| Composition | Exception strip + dense figures | Role-aware queues + figures | Queue cards only | Queues (verified sources) + figures + module entries |
| Data sources | Verified matrix only (all directions — brief §5) | Same | Same | Same |
| Judgment | Efficient, intimidating | Balanced | Clearest calm states; thinnest figures | Most informative; busiest first paint |

## 3. Project context
| | A | B | C | D |
|---|---|---|---|---|
| Model | Project as filter among equals | Project as primary axis (7 nested routes) | Project opened from tasks | Project workspaces for scoped info; global ops never forced through a project |
| Fact | `projectId` on sites/docs/warehouses/stock/MR/BOQ/IPC (verified, optional on several); items/folders/admin/audit project-free (verified) | Same facts | Same facts | Same facts |
| Judgment | Under-uses a dominant relationship | Risks overstating it | Under-serves project-heavy days | Directly encodes the verified mix — at the cost of two navigation mental models |

## 4. Global operations (items, admin, audit, settings)
A: first-class (flat list). B: parallel homes (kept, secondary emphasis). C: secondary browsing. D: first-class by construction.
**Fact**: these workflows are project-independent in source. **Judgment**: D and A serve them best; B and C require discipline to avoid demotion.

## 5. Archive
All directions implement the same unified full-width Archive (no folder tree/sidebar/drawer/panel, no folder create/rename/delete/move UI): scoped search/filters, upload (folder-independent, verified), preview (MIME-probed), download, ZIP batch bar, revisions timeline, replace, links, status, delete confirm, record cards on mobile. A/D emphasize dense multi-line records + bulk bar; B adds scoped project views + full workspace link; C reaches via tasks. No direction drops a verified function; folder records/relationships stay preserved in data.

## 6. Inventory
All keep: CRUD + import/export (gated), 6-filter history, overview KPIs + per-warehouse balances, low-stock tab with calm state, MR lifecycle via supported contracts, per-state perm gates. A/D lead on table density; B scopes per project; C surfaces via tasks.

## 7. Financial workflows (BOQ/IPC + approvals)
All keep: hub + per-project tabs, cumulative guards, transition matrix, dup-number rule, approve `{approve:false}` rejection path, `reports.view` export gating. Presentation differs (tables in A/D, project tab in B, approval cards in C). MR approval actions in every direction render only with `materialRequests.approve` + `submitted` state (verified key).

## 8. Mobile use
A: bottom bar + cards + bottom action. B: stacked workspace, thumb actions. C: native task cards, strongest mobile story. D: bottom bar + site/warehouse task cards + stacked workspace (designed mobile-first, per mandate).
**Judgment**: C wins pure mobile; D closest overall; all meet 375px/no-overflow/44px rules.

## 9. Information density
A highest (ops-room) · B medium (entity focus) · C lowest chrome (task focus) · D high-but-structured (dense tables + calm queues). All preserve density toggle + tabular numerals.

## 10. Strengths / weaknesses / misfit users
- **A**: throughput for expert clerks / intimidating for occasional roles / wrong if viewers dominate.
- **B**: fewest lost contexts / over-centralization risk / wrong if work proves non-project-centered.
- **C**: clearest "what needs me" / weakest reference browsing; task coverage must be exhaustive / wrong if compliance browsing dominates.
- **D**: nothing important homeless; honest queues; mobile-first / most surfaces to build and keep consistent; weakest single identity; wrong if team capacity favors fewer surfaces.

## 11. Functional-parity risks (all directions: zero drops required)
Route mapping (IA doc), 7-tab destinations, lifecycle contracts, guard matrices, state coverage, and redirect policy apply identically. Direction-specific risks: A — queue strip under-specification; B — global-area demotion; C — task-coverage exhaustiveness; D — consistency drift across many surfaces (mitigation: shared component system + parity checklist per surface).

## 11b. Approved-constraint compliance (applies equally; distinguishes no direction)
- **Folder removal**: all four implement the identical unified Archive (no rails/drawers/management/move UI); folder feature removal therefore does not favor any direction. Evaluation proceeds on navigation, hierarchy, global-vs-scoped work, efficiency, responsive layouts, and parity risks.
- **Zero horizontal scrolling**: all four use multi-line records/cards, wrapping toolbars/tabs, viewport-fitting dialogs/drawers/menus, and full-field preservation at 320/375/390/430/768/1024/1366/1920. No direction retains table scrollers.
- Directions stay distinct (command density vs project spine vs task queues vs balanced coverage) and **all remain unapproved**.

## 12. Best-fit assessment (judgment, NOT approval)
On audited evidence alone, **D fits best**: it is the only composition that simultaneously (a) restricts home queues to verified sources, (b) gives project-free workflows first-class homes (a verified fact A/B/C handle unevenly), (c) keeps project context where the schema supports it, and (d) meets the mobile-first mandate structurally rather than responsively. **Trade-offs accepted openly**: higher build/consistency cost, softer identity than B, and a busier home than C. If the owner values a single strong identity over coverage completeness, B remains the coherent alternative; if daily work is approval-dominated, C deserves a pilot. **Decision: owner Q1. Nothing here is approved.**
