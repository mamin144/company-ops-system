/* Phase 3.17 — shell motion + smooth scrolling.
   Rules: every effect no-ops under prefers-reduced-motion; GSAP contexts are
   reverted on cleanup (StrictMode double-mount safe, no tween leaks, no console
   warnings); every tween clears its inline styles on completion so sticky
   positioning and measurement-based Playwright assertions keep working.
   Motion is decoration only — never a gate for content or focus. */
import { useEffect, useLayoutEffect, type RefObject } from 'react';
import { gsap } from 'gsap';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';

export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Module-level handle to the live Lenis instance. Navigation must reset the
   scroll position (Phase 3.17-C root cause #2: a scrolled archive page handed
   its y-offset to the next route, which read as "spacing changing between
   pages"). window.scrollTo alone fights Lenis's internal target, so the reset
   goes through the instance when one exists. StrictMode-safe: the cleanup
   below only clears the slot if it still points at the dying instance. */
let lenisInstance: Lenis | null = null;

/** Instantly reset scroll to the top of the document. Runs even under
    prefers-reduced-motion (a correctness fix, not decoration). */
export function scrollToTop(): void {
  if (lenisInstance) lenisInstance.scrollTo(0, { immediate: true, force: true });
  else window.scrollTo(0, 0);
}

/** Reset scroll to top whenever the route PATHNAME changes (search-param
    updates intentionally keep position). Layout effect so the jump happens
    before paint — no flash of the previous page's offset. */
export function useRouteScrollTop(pathname: string): void {
  useLayoutEffect(() => {
    scrollToTop();
  }, [pathname]);
}

/** Freeze background scrolling while a modal surface (mobile drawer) is open.
    No scroll-position change, so releasing the lock can never jump the page.
    With Lenis: stop() halts virtual scrolling; the window wheel handler then
    cancels the native default too (covers wheel over the non-scrollable
    scrim). Without Lenis (reduced motion): wheel-capture only; the scrim's
    CSS touch-action: none covers touch. */
export function useScrollLock(locked: boolean): void {
  useEffect(() => {
    if (!locked) return;
    const lenis = lenisInstance;
    lenis?.stop();
    // The open drawer itself must keep scrolling — only events rooted
    // OUTSIDE it (scrim/main) are cancelled.
    const wheel = (e: WheelEvent) => {
      if (e.target instanceof Element && e.target.closest('#railDrawer')) return;
      e.preventDefault();
    };
    window.addEventListener('wheel', wheel, { passive: false, capture: true });
    return () => {
      window.removeEventListener('wheel', wheel, { capture: true });
      lenis?.start();
    };
  }, [locked]);
}

/** Lenis smooth scrolling on the real scroll position (anchors, focus moves and
    Playwright scroll-into-view keep working natively). Off entirely when the OS
    asks for reduced motion. Inner scroll containers opt out with
    [data-lenis-prevent] (rail, modal body, palette list). */
export function useSmoothScroll(): void {
  useLayoutEffect(() => {
    if (prefersReducedMotion()) return;
    const lenis = new Lenis({ lerp: 0.12 });
    lenisInstance = lenis;
    let raf = 0;
    const tick = (time: number) => {
      // Lenis.raf expects the rAF timestamp in MILLISECONDS (it applies
      // deltaTime * .001 internally). Passing time * 1000 fed it a ~16000ms
      // delta per frame, which made damp() snap instantly — smooth scrolling
      // degenerated into jumps (Phase 3.17-B runtime finding, fixed).
      lenis.raf(time);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
      // StrictMode double-mount: the second effect run must not have its
      // instance slot cleared by the first instance's delayed cleanup.
      if (lenisInstance === lenis) lenisInstance = null;
    };
  }, []);
}

type ShellRefs = {
  rail: RefObject<HTMLElement | null>;
  topbar: RefObject<HTMLElement | null>;
  content: RefObject<HTMLElement | null>;
};

/** Shell entrance (mount, once) + route transition (per location.key).
   Both are short (<=320ms) eased fades/slides on decorative framing only —
   text and controls are never delayed past paint, and clearProps leaves the
   DOM exactly as CSS dictates when a tween finishes or is reverted. */
export function useShellMotion(routeKey: string, refs: ShellRefs): void {
  useLayoutEffect(() => {
    if (prefersReducedMotion()) return;
    const rail = refs.rail.current;
    const topbar = refs.topbar.current;
    const ctx = gsap.context(() => {
      if (rail) {
        gsap.from(rail.querySelectorAll('.brand, .navSection, .navItem'), {
          y: 6, opacity: 0, duration: 0.3, stagger: 0.022, ease: 'power2.out', clearProps: 'opacity,transform',
        });
      }
      if (topbar) {
        gsap.from(topbar, { opacity: 0, duration: 0.3, ease: 'power1.out', clearProps: 'opacity' });
      }
    });
    return () => ctx.revert();
    // entrance is a mount-only ceremony; route changes are handled below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    if (prefersReducedMotion()) return;
    const content = refs.content.current;
    if (!content) return;
    // Phase 3.17-C root cause #1: the old `gsap.from(blocks, {y:10, opacity:0,
    // stagger:.05})` put the page root at opacity 0 for 3–4 frames while the
    // crumbs block faded at a different offset/timing — the perceived "shake"
    // and blank flash on every route change (captured in shake-evidence/).
    // Fix: ONE tween on the container itself. Transform-only (content is never
    // invisible for a single frame), no stagger (zero relative offsets between
    // blocks), and `.content` carries no layout property the rail-width
    // transition animates, so the two can never fight.
    const ctx = gsap.context(() => {
      gsap.fromTo(
        content,
        { y: 8 },
        { y: 0, duration: 0.22, ease: 'power2.out', clearProps: 'transform' },
      );
    });
    return () => ctx.revert();
  }, [routeKey, refs.content]);
}

/** Coordinated page-entry motion for the dashboard (Phase 3.17-C item 3).
    One timeline, one easing, one duration band — blocks settle together in a
    single cascade instead of competing animations. Rules:
    - Entry-triggered: pass a dep that flips when content actually mounts
      (e.g. a `loading` flag) — re-renders with the same dep never re-run it.
    - Transform + opacity only, `clearProps` leaves zero residue, interrupted
      runs are reverted by the context cleanup.
    - Targets are opt-in via `data-motion` attributes so nothing animates by
      accident; rows use opacity-only (restrained) and there is no per-cell
      or glyph-level animation anywhere.
    - No-op under prefers-reduced-motion. */
export function usePageMotion(scope: RefObject<HTMLElement | null>, deps: unknown[]): void {
  useLayoutEffect(() => {
    if (prefersReducedMotion()) return;
    const root = scope.current;
    if (!root) return;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power2.out', clearProps: 'opacity,transform' } });
      const title = root.querySelectorAll('[data-motion="title"]');
      const sections = root.querySelectorAll('[data-motion="section"]');
      const cards = root.querySelectorAll('[data-motion="card"]');
      const rows = root.querySelectorAll('[data-motion="rows"]');
      if (title.length) tl.from(title, { y: 8, opacity: 0, duration: 0.26 }, 0);
      if (sections.length) tl.from(sections, { y: 10, opacity: 0, duration: 0.3, stagger: 0.05 }, 0.04);
      if (cards.length) tl.from(cards, { y: 8, opacity: 0, duration: 0.28, stagger: 0.05 }, 0.08);
      // restrained list reveal: opacity only, quick, no sliding text
      if (rows.length) tl.from(rows, { opacity: 0, duration: 0.22, stagger: 0.03 }, 0.14);
    }, root);
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/* ────────────────────────────────────────────────────────────────────────────
   DEV-ONLY runtime self-test (Phase 3.17-B, owner item 2).
   `import.meta.env.DEV` is statically false in production builds, so this
   block is dead-code-eliminated — verified by grepping the built bundle for
   `__cosMotionProbe` (0 hits). It is NOT a UI button: it exposes a console
   function that runs an obvious GSAP tween on an element that already exists
   on the page and resolves with sampled mid-flight computed styles plus the
   final cleared state — proving the ticker runs, styles change while the
   animation plays, and nothing sticks afterwards.
   Usage in `vite dev` console: await window.__cosMotionProbe()
   ──────────────────────────────────────────────────────────────────────────── */
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__cosMotionProbe = () =>
    new Promise((resolve) => {
      const el = document.querySelector<HTMLElement>('.loginLogo, .brandLogo, .content');
      if (!el || prefersReducedMotion()) {
        resolve({ skipped: true, reason: el ? 'prefers-reduced-motion' : 'no target element' });
        return;
      }
      const midFlight: string[] = [];
      const sampler = setInterval(() => midFlight.push(getComputedStyle(el).transform), 110);
      gsap.fromTo(
        el,
        { rotate: -180, scale: 0.6, opacity: 0.15 },
        {
          rotate: 0,
          scale: 1,
          opacity: 1,
          duration: 0.9,
          ease: 'none',
          clearProps: 'all',
          onComplete: () => {
            clearInterval(sampler);
            resolve({
              element: el.className,
              midFlightTransforms: midFlight,
              distinctMidStates: new Set(midFlight).size,
              finalInlineStyle: el.getAttribute('style') ?? '(none)',
              finalComputedTransform: getComputedStyle(el).transform,
            });
          },
        },
      );
    });
}
