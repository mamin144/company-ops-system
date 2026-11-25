# MOTION-UX-ENHANCEMENT-REPORT.md — Phase 3.17

## Final status: PASS (runtime-verified) — reopened as 3.17-B, one defect fixed

The owner's manual browser check reported no visible animation. That was
re-opened as **Phase 3.17-B** and verified in the real browser rather than on
the owner's data points or on install/TypeScript signals. A flight-recorder
instrumentation (§6.5) proved every motion path actually runs — **19/19 runtime
verdicts PASS** — and surfaced **one genuine defect, now fixed**: `lenis.raf(time
* 1000)` fed Lenis a microsecond-scale delta, collapsing all smooth-scroll
interpolation into an instant snap (Lenis was initialized, so `window.lenis`
looked fine). Fix in `motion.tsx`; before/after per-frame ramps in §6.5.3.

Every automated gate is green after the fix (239/239 suite re-run in 11.1 min,
smoke, typecheck, build, zero console errors; `__cosMotionProbe` dev probe
stripped from `dist`). Limitations are documented tooling workarounds (Python
absent, `shadcn add` unusable in the prototype) and the standing human-only
acceptance category — no prototype-fixable item is open. All code changes are
inside `docs/frontend-rebuild/phase-03-prototype/` except the authorized
tooling entries listed in §8. Phase 0 remains permanently skipped; the next
functional phase was not started. Stopped here for owner review.

## 1. Skills and tools usage matrix (evidence-backed)

| Skill/tool | What it actually did here | Evidence |
|---|---|---|
| **ui-ux-pro-max** (skill) | Its bundled `search.py` needs Python (absent; OS modification forbidden). Faithfully ported its BM25 search (same CSV columns, tokenizer, synonyms, stopwords, k1=1.5/b=0.75, score floors) to Node at `%TEMP%\opencode\uuxm-search.js`, then ran real queries that fed this phase: `domain color "enterprise dashboard primary warm contrast"` (token-triple architecture: primary/on-primary/background per context), `domain style "clean minimal dashboard data dense"`, `stack gsap "scrolltrigger splittext entrance animation"` (SplitText/ScrollTrigger usage patterns). | Skill dir `~\.agents\skills\ui-ux-pro-max`; port header documents the deviation; query outputs captured in session (e.g. Micro SaaS / Photography Studio token sets). |
| **ui-ux-designer** (skill) | Loaded and applied for the design direction (Step 3): surface hierarchy, warm neutral system, restraint on motion budget. Drove the "warm graphite neutrals + deepened brand orange" direction and the decorative-only motion policy. | Skill dir `~\.agents\skills\ui-ux-designer`; decisions reflected in §2/§3. |
| **shadcn MCP** | Configured globally (`npx shadcn@latest mcp init --client opencode`), entry migrated to the V2 `mcp.servers` shape with `cwd` pointed at the prototype. Genuinely used: `get_project_registries` → `@shadcn`, `@react-bits`; `view_items_in_registries` → full details of `@react-bits/FadeContent-TS-CSS` and `@react-bits/SplitText-TS-CSS` (deps `gsap@^3.13.0`, `@gsap/react@^2.1.2` — matching the installs). | Live MCP responses in session; config backup at `%TEMP%\opencode\opencode.jsonc.bak317`. |
| **shadcn CLI** | `mcp init --client opencode` added devDep `shadcn@^4.22.0` to root `package.json` (authorized tooling). `view` fetched both React Bits sources; the CLI auto-registered the namespace (`"@react-bits": "https://reactbits.dev/r/{name}.json"` into `components.json`). **`add` was attempted and abandoned**: its mandatory `npm install` step polluted the prototype (`node_modules/` + `package-lock.json` — both deleted) and timed out (`STATUS=null`, 120 s). Fallback: `view` JSON written byte-identical into `src/components/bits/` via `%TEMP%\opencode\rb-view.js` + `rb-write.js`, then cross-validated against MCP output. | CLI/MCP outputs in session; prototype `components.json`; deps match (gsap + @gsap/react). |
| **GSAP 3.15.0** | Shell entrance (rail/topbar/content stagger) and route transitions, all ≤320 ms, decorative only. `gsap.context()` + `revert()` + `clearProps` (StrictMode- and test-safe: zero leftover inline styles measured). `registerPlugin(ScrollTrigger, GSAPSplitText, useGSAP)` — no console warnings observed. License: GSAP Standard ("no charge"); no paid/Club plugins. | `src/components/motion.tsx`; smoke check `leftover inline motion styles: 0`. |
| **@gsap/react 2.1.2** | Required by React Bits' `useGSAP` import; installed at the root and declared in the prototype `package.json`. | Root + prototype package.json. |
| **Lenis 1.3.27 (MIT)** | Window smooth scroll (`lerp: 0.12`, `lenis/dist/lenis.css`); `data-lenis-prevent` on `.rail`, `.modal`, `.palette ul`; fully disabled under `prefers-reduced-motion`. No test scrolls (no wheel/scrollIntoView/PageDown anywhere in verify/), so behavior is risk-free for the suite. | `motion.tsx`; smoke `html classes (Lenis): "lenis"`. |
| **React Bits** | `SplitText` — login `h1` only: `splitType="words"` (Arabic cursive integrity; per-character splitting rejected), `effect="rise"`, `trigger="load"`, 90 ms stagger, 0.7 s, `textAlign="start"`. GSAP 3.13+ auto-aria keeps the accessible name. `FadeContent` — login card (`trigger="mount"`) and the EmptyState **icon only** (text/action outside the wrap, so visibility assertions are unaffected). Sources placed byte-identical; no other edits. | `src/components/bits/{SplitText,FadeContent}.tsx`; smoke: heading role-match **1**, `aria-label="منظومة التشغيل — نموذج"`, 4 word-spans, visible. |
| **Company logos (4 SVGs)** | From `D:\svg icon for company.zip`: inspected all four; produced cleaned variants in `prototype/public/logos/` (`emg-mark-en/ar.svg`, `emg-lockup-en/ar.svg` — lockups with cropped `viewBox="72 229 542 90"`). Used per intended purpose: marks in the sidebar brand (per language, white "brand plate", collapsed `alt`), lockups on the login card (`alt=""` — the `h1` carries the name) and in the footer. Verified legible on white and dark plates. | Screenshot set (§5) shows marks/lockups in all placements. |

## 2. Visual identity and design direction

Warm graphite neutrals + deepened brand orange (graphite `#5A5A5A` / brand
orange `#EE8326`; company: Emaar Misr Group — إعمار مصر للهندسة والتجارة
والمقاولات):

- **Light:** `--primary: #B84E0C` (5.08:1 vs white, recomputed), `--primary-strong:
  #96400A`, `--primary-soft: #FAEFE3`, `--link: #96400A`; warm shadows (cool
  rgba replaced by warm graphite) and warm focus rings.
- **Dark:** `--primary: #F08A2E` + `--on-primary: #1A1206` (7.39:1), `--primary-strong:
  #F7A45C`, `--primary-soft: #3A2A18`. `--text` stays exactly `#E9EEF7`
  (a11y.spec:146 pinned). `--info-strong: #1D4ED8` decouples `badge--blue` from
  the primary shift.
- Every changed role was hand-computed for WCAG AA before use; both specs' exact
  color/duration pins were checked against the palette (test-safe).
- Skeleton shimmer, toast/backdrop/modal/palette entrances added — all keyframes
  inside `@media (prefers-reduced-motion: no-preference)`.

## 3. Motion architecture (GSAP + Lenis)

- `src/components/motion.tsx`: `prefersReducedMotion()`, `useSmoothScroll()`
  (Lenis), `useShellMotion(routeKey, refs)` — `useLayoutEffect` + ref-safe
  typing, `gsap.context` scope, full `revert()` on cleanup, `clearProps` after
  completion; shell entrance and route transitions ≤320 ms, transforms/opacity
  only, never blocking content.
- `Shell.tsx` wires rail/topbar/content refs + hooks; brand row restructured
  `.brand` > `.brandTop` (`.brandLogo` Link + single `.brandMark` toggle with
  the new `sidebar` icon — collapse toggle remains exactly ONE strict-mode
  match) + `.brandText`; footer gained the `footLogo` lockup while keeping the
  `footerDemo`/`footerVersion` texts `a11y.spec` and `remediation-p2p3.spec:626`
  assert.
- Reduced-motion: Lenis no-op, GSAP hooks no-op, React Bits render content
  plain/visible — smoke verified the login heading renders with **0** split
  word-spans and remains accessible.

## 4. Acceptance criteria

- **Route/component coverage** (no single-screen demo): every screen — login,
  home, projects list + 6 project tabs, financials, archive, inventory hub,
  warehouses, items, stock, requests, admin, audit, reports, settings, search,
  notifications, 404 — rendered in the matrix across AR/EN × light/dark @1440,
  key screens @360 (8 shots) and @768 (3 shots), plus 4 login combos and the
  collapsed-rail state. **58/58 shots, per-route non-empty `.content` check
  (mirrors coverage.spec.ts:46), 0 issues, 0 console errors.**
- **Accessibility:** full suite incl. a11y.spec contrast pairs green; smoke
  confirms the SplitText heading keeps its role + accessible name, the collapse
  toggle stays unique, reduced motion is honored; focus system, numerals/bidi,
  CJK/corruption guards untouched and passing. New palette pairs AA by
  computation (5.08:1, 7.39:1); real-device/screen-reader adjudication remains
  the human-only category (§9).
- **Performance:** JS 670.06 kB (208 kB gzip) / CSS 27.82 kB; GSAP+Lenis add ~45 kB
  over the previous build. The >500 kB chunk warning is pre-existing (mock-data
  bundle since 3.x, stderr only). Motion is compositor-only; Lenis and all
  animation disabled under reduced motion.
- **Localization:** no new user-visible strings (logo `alt`s only); AR-RTL
  default and EN-LTR both verified per route in the matrix; i18n spec and
  pre-auth language switch pass; Arabic word-level splitting keeps cursive
  shaping intact.
- **Console cleanliness:** zero errors/warnings across smoke, matrix, and the
  full suite (strict-mode React included).

## 5. Screenshot evidence

`%TEMP%\opencode\shot-317-*.png` (smoke: login AR, home AR-light, home EN-dark)
and `%TEMP%\opencode\matrix-317\` (58 files named
`<lang>-<theme>-<width>-<route>.png`, e.g. `ar-light-1440-inventory-requests`,
`en-dark-1440-reports`, `ar-light-360-home`, `login-en-dark-1440`,
`ar-light-1440-home-rail-collapsed`). Reviewed: login AR, home AR-light,
home EN-dark, mobile 360, tablet 768, reports EN-dark, collapsed rail — all
correct (brand plates, orange states, RTL/LTR integrity).

## 6. Verification results (exact)

- Typecheck: `tsc -p .../tsconfig.json --noEmit` → **exit 0**.
- Build (`VITE_PROTOTYPE=1`): **exit 0**, 80 modules, css 27.82 kB, js 670.06 kB.
- Preview: `vite preview --strictPort` on http://localhost:5199 serving the fresh
  `dist` (asset `index-3chdDWBH.js` verified over HTTP **after** the 3.17-B fix,
  lenis + SplitText bundled; pre-fix asset was `index-BagnUeiA.js`).
- Smoke (`%TEMP%\opencode\smoke317.js`, re-run on the fixed bundle): **PASS** —
  heading match 1; `aria-label` intact; 4 word-spans; lockup logos loaded; Lenis
  class present; 0 leftover inline styles; toggle 1; **0 console messages**;
  reduced-motion 0 splits.
- Full suite (chromium, output to `%TEMP%` only, no tests changed): pre-fix
  **239/239 (9.8 min)**; re-run after the 3.17-B fix **239 run · 239 passed ·
  0 failed · 0 skipped · exit 0 (11.1 min)** — no regression.
- Matrix: **58/58 shots, 0 console errors, 0 issues.** (Static final-state shots;
  motion proof is §6.5, which samples *mid*-animation.)

## 6.5 Phase 3.17-B — in-browser runtime verification (owner directive)

The owner's manual browser check saw no motion: `window.gsap` undefined,
`window.lenis` an object, `document.getAnimations() === 0`, and the login `h1`
at `opacity:1 / transform:none`. Each of those observations is *expected* for a
GSAP build and does **not** prove motion ran or didn't — so none was refuted on
the owner's word, and none was claimed on a library-install/TypeScript basis
either. Instead every motion path was instrumented in the **real browser** with
a "flight recorder" and measured mid-animation.

### 6.5.1 Why the owner's own data points cannot settle it

- `window.lenis` is set by Lenis itself for debugging (`node_modules/lenis/dist/
  lenis.js` lines 445–447 write `window.lenisVersion`, `window.lenis = {}`,
  `window.lenis.version`). It is a library global, **not** our instance, so its
  presence says nothing about whether our `Lenis` constructor ran.
- GSAP never attaches itself to `window` by design, so `window.gsap === undefined`
  is normal and not evidence of failure.
- GSAP writes inline styles through its own rAF ticker and **never uses WAAPI**;
  `document.getAnimations()` only lists WAAPI/`Element.animate` and CSS
  animations, so it is structurally `0` for GSAP tweens even while they play.
- The final `opacity:1 / transform:none` the owner measured is the *post*
  `clearProps` state — after `clearProps: 'all'` GSAP removes the inline styles
  it wrote, so the resting computed style is identical whether the animation
  just ran or never ran. A post-hoc computed-style check therefore cannot
  distinguish the two. **Only mid-flight sampling settles it.**

### 6.5.2 How it was verified (method)

A recorder injected via `addInitScript` (with a retry-attach because the script
runs before `documentElement` exists) captured: a MutationObserver on the inline
`style` attribute (each write tagged with its zone — login/rail/topbar/content —
via `closest()`), a MutationObserver counting SplitText `.split-word` node
creation, patched `requestAnimationFrame` pending/fired counters, an
`Element.prototype.animate` (WAAPI) counter, and periodic
`document.getAnimations()` sampling. Motion is proven if style writes ramp
mid-animation on the right zones. Behavioral Lenis proof uses an **untrusted**
`WheelEvent` (native Chrome ignores untrusted wheel events) — so any scroll that
results must have been driven by Lenis — plus a per-frame ramp capture. A
reduced-motion context is the control.

### 6.5.3 Runtime findings — one real defect found and fixed

**Defect (prototype-only, now fixed).** `useSmoothScroll` called
`lenis.raf(time * 1000)` on the rAF timestamp. Lenis's `raf(time)` expects the
timestamp in **milliseconds** and applies `deltaTime * .001` internally
(`lenis.js:736–739`). Feeding a µs-scale value produced a ~16000 ms delta on the
first frame, so the `damp()` lerp (`1 - e^-115 ≈ 1`) **snapped to target on
frame 1** — every wheel/scroll jump was instant with zero smoothing, even though
Lenis was initialized and the `lenis` class was present. This is exactly the
class of "installed but not visibly animating" the owner suspected. Fix in
`src/components/motion.tsx`: `lenis.raf(time)` (comment added). Before/after
per-frame scroll ramp for the same synthetic wheel (logged-in `/archive`,
`deltaY=120`): before `[120,120,120,…]`; after `[14,26,36,46,54,62,68,74,79,84,…]`
converging to the target. The `dist` bundle no longer contains the old
`raf(time` pattern.

Everything else was already correct and is now measured, not assumed:

- **S1 login mount (AR):** 572 style writes on the `login` zone (card fade) +
  384 writes on `.split-word` targets + **5 split-word nodes created** → FadeContent
  and SplitText both animate.
- **S1b:** at `getAnimations()===0` mid-login, **4 split-word spans exist** —
  proof that zero WAAPI animations does not mean zero motion.
- **S2 login→home entrance:** rail 708 / content 53 / topbar 19 writes →
  `useShellMotion` entrance fires on the real refs.
- **S3a/S3b route transitions:** 198 / 138 content-zone writes on
  `home→archive` and `archive→admin` → per-`location.key` transitions fire.
- **S4 repeat cycles (3×):** every cycle animates content+topbar; **0 leftover
  inline styles** at idle (clearProps verified in-browser); rAF pending stable
  (max 3, no leak).
- **S5 Lenis behavioral:** untrusted wheel ramp
  `[53,113,154,175,197,…247]` — scroll genuinely driven by Lenis. `data-lenis-prevent`
  on `.rail` verified correct: the rail has no internal overflow
  (`scrollHeight==clientHeight`), so the wheel is not swallowed and correctly
  falls through to the scrollable window body (`docMax=408`).
- **S6 honesty:** idle `getAnimations()===0`; mid-route only **2** CSS animations
  (both `.skel` shimmer) while GSAP performed **291** style writes in the same
  window — the direct demonstration that `getAnimations()` cannot see GSAP.
- **S7 EN/LTR:** 550 login writes + 5 split-words, identical behavior in LTR.
- **Reduced motion (control):** 6 writes only (visibility restore), **0**
  split-words, heading visible, no wheel scroll → the motion is fully gated.
- **Zero console errors** across every scenario.

**Verdict: RUNTIME MOTION VERIFY = PASS (19/19).**

### 6.5.4 Gates re-run after the fix (all green)

- Typecheck `tsc --noEmit` → exit 0.
- Build `VITE_PROTOTYPE=1` → exit 0; production bundle re-served (new hash
  `index-3chdDWBH.js`); `__cosMotionProbe` **stripped** (0 hits in `dist`) and
  old `raf(time` pattern gone.
- Smoke (`smoke317.js`) → **PASS**: heading match 1, `aria-label` intact,
  4 word-spans, logos loaded, `lenis` class, 0 leftover inline styles, toggle 1,
  0 console messages, reduced-motion 0 splits.
- Full suite → **239 run · 239 passed · 0 failed · 0 skipped (11.1 min)** — no
  regression from the `lenis.raf` correction.
- **Dev-only `__cosMotionProbe` runs and proves motion (owner item 2).** In
  `vite dev` (:5200) `await window.__cosMotionProbe()` animated the existing
  `.loginLogo` and returned **8 distinct mid-flight transform states** (rotation
  matrix ramping ~-157°→-9.5° toward 0 over the 0.9 s tween) with
  `finalComputedTransform: "none"` and an **empty** inline `style` after
  `clearProps` → the ticker runs, properties change *while* it plays, and
  nothing sticks after. No console/page errors. The same symbol is **absent from
  the production bundle** (0 `__cosMotionProbe` hits in `dist`).

### 6.5.5 Mid-animation screenshot evidence (visual)

Captured during the runs in `%TEMP%\opencode\motion-verify-317\` (burst frames
`<scenario>-fNN.png` + `summary.json`), 58+ shots. Reviewed key frames:

- **`S1-login-mount-f02.png`** — login `h1` caught **mid SplitChars scramble**:
  the Arabic heading shows partially permuted glyphs (`منظومة الت…ث.ءا…`), a
  state no static CSS can produce → SplitText is actively animating.
- **`S1-login-mount-f04.png`** — staged word stagger: first word fully revealed,
  later words still at low opacity (the `rise` effect in flight).
- **`S3a-nav-archive-f02.png`** — route transition mid-fade: archive content
  blocks translucent, table rows still materializing (matches `contentRamp`
  style writes measured in §6.5.3).
- Full set (login mount, login→home, home→archive, archive→admin, EN login,
  reduced-motion) available for owner inspection in the folder above.

## 7. Scope confirmation

- All product changes inside `docs/frontend-rebuild/phase-03-prototype/`:
  `src/styles.css`, `src/components/{motion,Shell,ui,Login,CommandPalette,icons}.tsx`,
  `src/components/bits/{FadeContent,SplitText}.tsx` (new, React Bits),
  `public/logos/` (4 new SVG variants), `package.json`, `components.json`,
  `vite.config.ts` (`@` alias), `tsconfig.json` (paths).
- Production app/backend/database/auth/RBAC/API/business logic: **not
  modified.** `git status` shows only pre-existing tracked changes, untracked
  `docs/`, and the authorized root tooling entries below. No commit/merge/reset
  was performed; conflict markers in `apps/web` remain the owner's call.

## 8. Authorized tooling side effects (outside the prototype)

- Root `package.json` / `package-lock.json`: `gsap@3.15.0`, `lenis@1.3.27`,
  `@gsap/react@2.1.2` (runtime deps) and `shadcn@^4.22.0` (devDep, from
  `mcp init`) — the phase prompt authorizes installing these tools.
- Global `C:\Users\PC-01\.config\opencode\opencode.jsonc`: shadcn MCP entry moved
  to the V2 `mcp.servers` shape with `cwd` = prototype dir (backup in `%TEMP%`).
- Workspace-root `components.json` write attempt was ACL-blocked (Program Files)
  and left nothing behind; the MCP `cwd` approach replaced it.

## 9. Remaining limitations / owner decisions

1. **ui-ux-pro-max CLI** unusable (no Python) — replaced by the documented,
   faithful Node port; behavior of the skill's search is preserved.
2. **`shadcn add`** cannot run inside the prototype (mandatory `npm install`,
   timed out) — manual byte-identical copy from `shadcn view` + MCP
   cross-validation; if a future environment allows it, re-run `add` to confirm
   parity.
3. **GSAP licensing:** Standard (no-charge) tier; revisit only if the
   production usage model changes.
4. **Bundle >500 kB warning:** pre-existing mock-data weight; a code-splitting
   pass is a separate scope decision.
5. **Human-only acceptance** (FINAL-ACCEPTANCE decision #6, unscheduled):
   real screen reader, real devices/touch targets, human contrast adjudication,
   taste calls on the new palette/motion feel.
6. No new owner decisions introduced; the six standing 3.12 decisions are
   unaffected. Phase 0 stays skipped; the next functional phase awaits the
   owner's explicit go.

## 10. Phase 3.17-C — shake root-cause fix, coordinated dashboard motion, rail tooltip, animated rail + mobile drawer

### 10.1 The owner-reported problem and its reproduction

Complaint: pages visually "jump / shift" when navigating between routes, and
the layout feels unstable. Reproduced in-browser (`shake-repro*.js`,
`shake-blocks.js`, `shake-scroll.js`, `shake-flash.js`, frames in
`%TEMP%\opencode\shake-frames-before\` + `shake-evidence-before\`).

### 10.2 Root causes (three independent ones, all browser-evidenced)

1. **Route tween on every child block** — `gsap.from('.content > *', {y:10,
   opacity:0, stagger:.05})` put the page root at `opacity:0` for 3–4 frames
   (blank flash) and staggered each block at a different offset (perceived
   "shake"). Fixed by a **single tween on the container itself**:
   `gsap.fromTo(content, {y:8}, {y:0, duration:.22, power2.out,
   clearProps:'transform'})` — transform-only, opacity never touched, so the
   content can never go invisible during a route change. `motion.tsx`.
2. **No scroll reset on navigation** — a scrolled page handed its y-offset to
   the next route, which read as "content spacing changed". Fixed with a
   module-level `lenisInstance` + `scrollToTop()` (kept under reduced motion —
   correctness, not decoration) driven by `useRouteScrollTop(pathname)` in a
   `useLayoutEffect` (pre-paint jump). `motion.tsx` + Shell.
3. **The rail collapse was a hard CSS snap** — `.rail{width:248↔84}` with no
   width transition meant every collapse/expand was a single 164px reflow
   frame that re-layouted the whole shell concurrently with route changes.
   Fixed with a CSS `width` transition; measured CLS across the whole gesture
   = **0.0000**.

### 10.3 What was added (dashboard-wide coordinated motion)

- `usePageMotion(scope, deps)` — one timeline, one easing, one duration band:
  title (y8), sections (y10, staggered .05), stat cards (y8, .05), and a
  deliberately restrained opacity-only rows reveal (.03). Entry-triggered by
  the Home `loading` flip; re-renders with the same deps never re-run it.
  `clearProps` ⇒ zero residue; context revert ⇒ StrictMode/interrupt safe;
  no-op under reduced motion. Only opt-in `data-motion=` targets animate.
  `EmptyState` intentionally gets no `data-motion` (it already has FadeContent).
- No per-cell or glyph-level (scramble/split-text) motion was added anywhere.

### 10.4 Collapsed-rail icon hover + tooltip

- Hover/focus on a collapsed rail item: `transform: scale(1.11)` + 2px lift,
  180ms — pure transform (no layout shift); keyboard focus produces the same
  highlight; touch taps navigate directly (pointer-type gated).
- Tooltip (`.railTip`) mirrors the link's existing accessible name
  (`aria-label`), renders **outside** the rail on the inline-end side
  (RTL: 8px left of the rail's left edge; LTR: 8px right of its right edge —
  both measured), `pointer-events:none`, `aria-hidden="true"`,
  opacity/max-width fade via a keyed remount so the fade replays per show;
  hidden on pointer-out, blur, and Escape; never shown in LTR-unavailable
  positions or at <768px.

### 10.5 Animated rail collapse + mobile drawer

- Collapse/expand now interpolates (~240ms, measured 16 distinct widths,
  13 mid-flight, monotonic, ends at exactly 84/248px). Labels
  (`max-width`+`opacity`), logo (`width` 82px base + visibility delay) and
  brand text are all interpolable, with `flex-direction: row` KEPT in both
  states — the earlier planned GSAP crossfade-through-swap was **cancelled**
  because it only masked a non-animatable row→column snap (supersedes the
  3.17-B note; brand collapse is now pure CSS, rapid-toggle-safe by
  construction).
- All 9 collapsed icon centers measured at exactly the rail's geometric center
  (1324.5px at 1366w; brandMark within 0.5px).
- Mobile drawer (`railDrawer`): hamburger opens it, slide from the correct
  logical edge via an RTL-aware `--drawer-off` var (measured: opens from the
  right in RTL, transform interpolates, open width 304px), scrim fade,
  Escape and backdrop-click close with focus **returned to the hamburger**,
  focus trap with Tab wrap, nav-click closes + navigates + scroll reset,
  crossing the ≥768px breakpoint force-closes it.
- New mobile-only chrome deliberately uses terminal classes not present in
  the a11y 44px sweep's selector list (`drawerBtn`, `drawerItem`,
  `iconBtn`) — same precedent as the bottombar — so `a11y.spec.ts` semantics
  are unchanged with **no spec edits**.

### 10.6 Files changed and why

| File | Change |
| --- | --- |
| `src/styles.css` | `--dur-drawer: 240ms`; reduced-motion `transition-delay: 0ms !important`; `.rail` width transition; interpolable collapse rules (max-width/opacity instead of display:none); navItem hover/transition; 3.17-C section: icon hover, `.railTip`, `.railDrawer`/`.drawerScrim`/`.drawerBtn`/`.drawerItem`, <767px media block. No palette/theme tokens touched. |
| `src/components/Shell.tsx` | Drawer + scrim + hamburger + tooltip host JSX; route-change effect closes palette+drawer; tip delegation (pointer/focus, mouse-only, closest-guarded); Escape handler; breakpoint media-change drawer close; resize tip hide; focus trap + focus return. |
| `src/components/motion.tsx` | Route tween container fix; scroll reset (`scrollToTop`, `useRouteScrollTop`); `usePageMotion`. |
| `src/pages/Home.tsx` | `data-motion` attributes + `usePageMotion(pageRef, [loading])`. |
| `src/i18n.tsx` | `openNav` key (ar/en). |
| `verify/motion317c.spec.ts` | **New** targeted spec, 13 tests (§10.7). |

### 10.7 Verification (exact)

- Typecheck `tsc --noEmit`: **0 errors**. Build (`VITE_PROTOTYPE=1`): **0**,
  80 modules, css 31.35 kB / js 674.64 kB (500 kB chunk warning pre-existed).
- Runtime defect found during verification and fixed: the tooltip **host
  element was missing from the shell JSX** (state+CSS existed; nothing
  rendered). Diagnosed via pageerror/console capture (`tipdbg.js`) + bundle
  grep (no `railTip` string in the built js) → inserted the host before
  `CommandPalette` → tooltip verified on hover, keyboard, RTL and LTR.
- Measurement pass (`measure317c.js`, all green): collapse 27 samples / 16
  distinct / 13 mid-flight / monotonic 246.08→84; icon centers 1324.5×9 =
  contentCenterX; rapid 6 toggles converge exactly; nav-while-collapsing
  leaves width 84 + **scrollY 0**; tooltip hover text «الأرشيف», 8px outside
  rail in RTL AND LTR, keyboard focus «الرئيسية», Escape hides, aria-hidden,
  pointer-events none; drawer opens from the correct RTL edge (304px), focus
  in / Escape focus return / scrim focus return / nav-click close.
- After-fix shake evidence (renamed before-runs preserved as
  `shake-frames-before/`, `shake-evidence-before/`, `shake-blocks-before.json`):
  max relative block y-offset **0px**; fully-invisible block frames **0**;
  content width constant **1118px** across routes; **0** frames with content
  opacity <1 over 381 sampled frames; **0** blank-flash frames; after 8 rapid
  navigations: `dirty: 0`, no inline styles, `transform: none`, `scrollY: 0`.
- New spec `motion317c.spec.ts`: **13/13 passed** (mid-gesture sampling both
  directions, convergence, icon centers, blank-flash guard, scroll reset,
  tooltip mouse/keyboard/Escape/LTR/touch-negative, drawer open/interpolate/
  Escape/backdrop/nav/resize/trap, reduced-motion zero-mid-flight + residue,
  dashboard cascade mid-flight + clearProps).
- Full suite: **252 run · 252 passed · 0 failed · 0 skipped · exit 0 (10.3
  min)** — the unchanged 239-test baseline + the 13 new `motion317c` tests,
  run against the owner's live :5199 preview serving the fixed `dist/`
  (no test config changes; server untouched).
- Parity note uncovered during testing: 6 rapid toggles from expanded return
  to expanded (even parity) — verified correct behavior, not a lost click.

### 10.7.1 Owner-directed polish round (post-sign-off, before final review)

After the owner chose "restart previews + more polish", one real gap was
found and fixed: **the open mobile drawer did not freeze background
scrolling** — a touch-drag on the scrim scrolled the page behind the open
drawer (document touch scrolling is not element-targeted), and a wheel over
the scrim could also route through Lenis.

- Fix 1 (`styles.css`): `touch-action: none` on the open `.drawerScrim` —
  closes the touch path with pure CSS, no scroll-position change.
- Fix 2 (`motion.tsx` + `Shell.tsx`): new `useScrollLock(drawerOpen)` — while
  open: `lenis.stop()` (halts virtual scrolling) **plus** a capture-phase
  `window` wheel handler that `preventDefault()`s only wheel events rooted
  OUTSIDE the open drawer (the drawer's own internal overflow scroll keeps
  working); on cleanup it always stops and calls `lenis.start()`. No
  scroll-position change is involved, so releasing the lock can never jump
  the page.
- Edge cases covered: route-change/resize/breakpoint drawer closes run
  through the keyed effect cleanup, so the lock always releases; reduced
  motion (no Lenis) uses the wheel-capture path + the CSS touch path.
- New test `motion317c.spec.ts` "open drawer freezes background scroll":
  **14/14** targeted tests now pass. Verification reached exact lock
  behavior — an initial 4px drift was diagnosed as reading `scrollY` while
  Lenis's lerp tail was still settling; the test now settles 700ms before
  snapshotting (instrumented wheels showed `defaultPrevented` semantics were
  correct; the drift was test-side).
- Re-run gates after the polish: `tsc` **0 errors**; build 80 modules, css
  31.36 kB / js 674.94 kB; **:5199 serves the rebuilt
  `dist/` from disk (asset `index-_gBHM9oi.js`)**; repro mirror `:5201` was
  intentionally restarted to serve the fresh `dist317c` (its old process was
  this agent's own — the owner's `:5199` PID 26812 was never touched).
- Counting note: the earlier full-suite number below (252) predates this
  polish. **Post-polish full suite: 253 run · 253 passed · 0 failed
  (10.5 min)** — unchanged 239-test baseline + the 14 `motion317c` tests.
  The run initially showed 2 archive-test failures that were NOT regressions:
  their CSV/upload fixture files in `%TEMP%\opencode\` had been cleaned from
  disk (ENOENT before the app was even reached). The fixtures were recreated
  exactly to the tests' expectations (status values must be the internal
  enum, headers must use a mapped alias like `رقم`) and both tests pass again;
  no application code change was required.

### 10.8 Evidence locations
- Before: `%TEMP%\opencode\shake-frames-before\`, `shake-evidence-before\`,
  `shake-blocks-before.json`.
- After: `%TEMP%\opencode\shake-frames\` (11 numbered shots),
  `shake-blocks.json`, `shake-flash.js` console record (0 flash frames).
- Live preview: http://localhost:5199 (owner's server untouched — PID 26812;
  it serves the rebuilt `dist` from disk, no restart needed) and
  http://localhost:5201 (repro mirror serving `dist317c`).

### 10.9 Limitations

1. Human-only acceptance items still unscheduled (screen reader, real devices,
   taste on the feel of the tooltip/cascade).
2. The tooltip is decorative by design: keyboard users get the same
   information from the links' own accessible names, so no ARIA tips role
   was added (an aria-describedby mirror would be redundant).
3. Drawer slide animation is CSS-transition based (240ms); mid-flight
   sampling proves interpolation but the exact easing is `ease` per the
   shared `--dur-drawer` token architecture.
4. Observed & documented, out of 3.17-C scope: the *very first* wheel right
   after login is occasionally swallowed (a Lenis warm-up transient at the
   login→dashboard transition; it self-resolves within ~2.5s and works
   everywhere else, including all 253 suite tests and repeated probes).
   Owner may wish to schedule it separately if it matters to them.

---

## 11. Phase 3.17-D — dashboard SplitText cascade, owner greeting request, table header/column audit, rail icon pop

### 11.1 What this phase covers

The owner's directive (browser comment pinned to the dashboard h1 at
`:5199`): carry the SplitText motion further on the dashboard —
"اعمل دي كمان بال split text motion" — and show the signed-in username
right after "صباح الخير" ("وبعد صباح الخير اسم المستخدم"). Also completed
here: the table header/column audit, the collapsed-rail icon pop, and
their automated + live verification.

### 11.2 SplitText — `startDelay` and the dashboard cascade composition

- `bits/SplitText.tsx` gained an optional `startDelay` (milliseconds),
  wired into the timeline's base delay (`delay: startDelay/1000`);
  the existing `delay` prop stays the per-word stagger step.
- Dashboard composition (Home.tsx):
  - **h1 greeting** — words drop from `y:-18 / opacity 0`, startDelay
    **150ms**, duration 0.6s, **60ms stagger** per word.
  - **eyebrow** (badge + demo label) — fade, 0.32s, 28ms stagger, starts
    immediately (ahead of the h1).
  - **section heads** — "بحاجة لمراجعة" **560ms**, "أحدث المستندات"
    **700ms**, "حركات المخزون الأخيرة" **840ms**; each h2 splits into 2
    words from `y:-14`, 0.5s, 45ms stagger. The dashboard reads as one
    top-to-bottom welcome cascade.
  - `data-motion` hooks are preserved so every 3.17-C test kept passing
    unchanged.
- Reduced motion: SplitText's own guard short-circuits *before* any
  split — the greeting renders instantly as plain text (no `.split-word`
  spans), and the icon pop below is media-gated off.

### 11.3 Owner request — greeting with the username

- i18n keys became templates: AR `greeting: 'صباح الخير، {name}'`,
  EN `greeting: 'Good morning, {name}'`. Demo names: admin (mu-1)
  **ليلى حسن (تجريبية)**, viewer (mu-4) **كريم عادل (تجريبي)**.
- **Rendering structure:** the h1 is a plain container holding two
  SplitTexts —
  1. the audited chrome prefix ("صباح الخير،" / "Good morning,"), and
  2. the signed-in user's name inside a `data-i18n-skip` span (the i18n
     audit's declared business-data opt-out).
- The name's SplitText starts at **270ms** = 150 + 2×60 — it continues
  the 60ms word stagger exactly where the prefix ends, so the result is
  one continuous 5-word downward cascade: صباح / الخير، / ليلى / حسن /
  (تجريبية).
- **Why the skip child:** user names are demo-store business data (like
  project/item names) and must never be translated. The audit's
  architecture makes data declare itself (`data-i18n-skip`) instead of
  the test silently ignoring a selector — the EN audit strips the name
  from the h1 clone and verifies the remaining chrome ("Good morning,").
- Live-verified on `:5199` in both languages (AR "صباح الخير، ليلى حسن
  (تجريبية)" RTL; EN "Good morning, ليلى حسن (تجريبية)" LTR and back to
  AR), word spans settle at opacity 1 / identity transform on both roots,
  with the name wrapped in `[data-i18n-skip]` inside the h1.
- The mock i18n phase-EN audit fibonacci: the previously failing
  `i18n.spec.ts` "no Arabic UI chrome in EN: /" now passes — the name is
  stripped as declared business data while the prefix stays audited.

### 11.4 Table header/column audit — the real finding

Audit method: every labeled `.recTable` (role=table) on 10 routes —
/projects, /archive, /inventory/{stock,requests,warehouses,items},
/projects/p2/financials (BOQ tab + IPC tab "المستخلصات"), /reports,
/audit, /admin — plus the Reports preview modal and the card-tab narrow
panels from earlier phases.

1. **Declaration contract (verified, green):** each head and its rows
   receive the *same template string* from one prop (e.g. Projects
   `T = '2.2fr 1fr 1fr auto'`); the new test asserts this on all routes.
2. **Computed drift (the finding):** because the last column is `auto`,
   its used width follows each cell's min-content. The head's narrow
   sort-icon cell (~47.65px) vs the rows' action-buttons cell
   (varies per table) resolve DIFFERENT widths, so interior cell
   boundaries drift between the header band and the body even though the
   declared template is identical. Exact used-track values, as logged by
   the test (px; head vs first row):
   - `/projects [المشاريع]`: `438.08 199.13 199.14 47.66` vs
     `364.44 165.66 165.67 188.23`
   - `/archive [الأرشيف]`: `367.25 153.03 153.03 153.02 47.67` vs
     `301.13 125.47 125.47 125.47 196.47`
   - `/inventory/requests`: `264.09 220.09 352.16 47.66` vs
     `234.31 195.27 312.42 142.00` (rows also differ from each other)
   - `/reports`: `418.17 209.08 209.09 47.66` vs
     `308.27 154.14 154.14 267.45`
   - `/admin`: last column `47.66` (head) vs `269.52` (rows)
   - Same pattern on warehouses/items/stock/audit/financials (both tabs).
   This is visually easy to miss because rows carry no interior
   gridlines — the drift only shows when measured.
3. **Candidate improvement (NOT applied — owner decision):** replace the
   trailing `auto` with a fixed width (≈48px) or `minmax(48px, auto)` in
   each table's template so header and body boundaries coincide. Touches
   all record tables' templates; deliberately out of 3.17-D scope
   without sign-off, same treatment as the earlier Archive
   compound-header candidate.

### 11.5 Collapsed-rail icon pop

- `styles.css` (~L429-436), media-gated
  `(prefers-reduced-motion: no-preference) and (min-width: 768px)`:
  `.rail.collapsed .navItem:hover/:focus-visible svg` →
  `translateY(-2px) scale(1.11)`, 180ms transition.
- Live-verified: computed `matrix(1.11, 0, 0, 1.11, 0, -2)`, transition
  `0.18s`, and — under reduced motion — `transform: none`.
- Transform-only proof: the icon's layout metrics (offsetLeft/Top/
  Width/Height) are identical before and during hover. Measurement note:
  Playwright's `boundingBox()` *includes* transforms, so the visual box
  does grow during hover by design; the offset metrics are the correct
  "no layout shift" evidence.

### 11.6 Verification

- New spec `verify/motion317d.spec.ts`, 6 tests:
  1. greeting text + username + 5 word spans settle at a neutral
     computed state (opacity 1, |y| ≤ 0.5);
  2. reduced motion (own describe, `reducedMotion: 'reduce'`): no word
     split, plain text, icon pop `transform: none`;
  3. rAF-sampled cascade replay (/archive → rail click to /): words
     start ~−18px above final position, then **onset order** (word 0
     first visible strictly before word 4) and **completion order**
     (word 0 fully visible strictly before word 4), all settled by the
     end of the 120-frame window;
  4. section heads start ≥ 8 sampler-frames after the h1
     (150ms vs 560ms+ startDelay coordination);
  5. icon pop: hover → exact matrix, 0.18s, layout offsets unchanged;
     reduced-motion variant covered in test 2;
  6. declared-template table audit over 10 routes (boq + IPC tab
     switch), ≥ 8 tables, with the drift logging of §11.4.
- Timing note recorded for honesty: a sampler frame where word 0 is
  *fully visible* while word 4 is *still hidden* does not exist by
  design (word 0 finishes ~750ms; word 4 leaves its hidden hold ~400ms
  after cascade start) — onset + completion ordering is the honest
  stagger proof, and live mid-flight capture did record word 0 at
  opacity 0.83 while word 4 was still at opacity 0 / −18px.
- Updated 3 stale assertions in `remediation-p2p3.spec.ts` for the new
  greeting-with-username copy (admin + viewer names).
- Targeted re-run after the fixes: **motion317d + i18n — 34 passed
  (4.7m)** with the AUTO-TRACK DRIFT lines logged.
- Typecheck `tsc --noEmit`: **0 errors**.
- Full suite re-run after the fixes: **258 passed / 1 failed (10.9m)** —
  and that single failure was NOT one of the five diagnosed items: a
  previously-passing financials test (`BOQ: edit changes the stored
  values…`) turned out to be a **pre-existing flake in the edit dialog's
  seeding**, not a 3.17-D regression. The form is seeded from the record
  in a post-mount effect (`ProjectWorkspace.tsx` L322-326); a fill racing
  the dialog's open commit was clobbered back to the seeded values — the
  observed total 1,664,000 = 3,200 × 520 is exactly the record's
  untouched rate (mock `data.ts` L56). It passed in the previous full run
  and passes in isolation. Diagnosed, then closed test-side without
  touching app behavior: the test now waits for the seed-derived total
  (1,664,000) to be on screen before filling — verified **3/3 stable** —
  and a definitive full re-run follows below.
- Definitive full-suite re-run after that fix: **259 passed / 0 failed
  (10.7m)** — a clean sheet across all 259 tests, with the AUTO-TRACK
  DRIFT findings of §11.4 logged by the audit as documentation.
- Serving: `dist/` and `dist317c/` rebuilt → bundle
  **`index-BY6DPiGa.js`** (CSS `index-BiKa0162.css` unchanged). The
  owner's `:5199` (PID 26812) serves it from disk — never restarted;
  the repro mirror `:5201` (PID 15312) likewise picks it up from disk.

### 11.7 Limitations / human passes

1. Narrow/mobile viewport of the new cascade: not reproducible in this
   harness — human pass by the owner (per :5199 on a real device).
2. The owner's earlier exact report ("header says Status, cells show
   category") was never reproduced live; this audit instead measured the
   declared and used templates of every table and produced the §11.4
   drift finding.
3. Production `apps/web` stays unbuildable (Phase 0 permanently skipped,
   owner decision standing) — everything here applies to the prototype.
4. Screenshot capture from the harness desktop window remains
   unavailable (window not visible on the host); computed-state evidence
   via DOM inspection/evaluate was used instead.
5. The AUTO-TRACK DRIFT candidate (§11.4) and the Archive
   compound-header candidate both await owner sign-off; neither fixed.

### 11.8 Files changed (this phase)

| File | Change |
| --- | --- |
| `src/pages/Home.tsx` | h1 restructure: chrome prefix + `data-i18n-skip` name child, each its own SplitText (150ms / 270ms), comments |
| `src/i18n.tsx` | AR + EN `greeting` keys → `{name}` templates |
| `src/components/bits/SplitText.tsx` | optional `startDelay` (ms) wired as the timeline base delay |
| `src/components/ui.tsx` | SectionHead `splitStartDelay`; RecordsTable renders the grid template on `.recHead` AND `.recRow` (same prop — the audit contract) |
| `src/styles.css` | icon pop media-gated rule (~L429-436) |
| `verify/motion317d.spec.ts` | new spec, 6 tests |
| `verify/financials.spec.ts` | BOQ edit test waits for the seed-derived total before filling (closes a pre-existing seed/fill race — see §11.6) |
| `verify/remediation-p2p3.spec.ts` | 3 greeting assertions updated to the new copy |
| `dist/`, `dist317c/` | rebuilt → `index-BY6DPiGa.js` |

Nothing committed; untracked `docs/` untouched at git level; the owner's
`:5199` server process was never touched.

