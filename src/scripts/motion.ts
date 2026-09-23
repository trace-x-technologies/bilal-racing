/**
 * Shared motion runtime: Lenis smooth scroll + GSAP/ScrollTrigger + reveal observer.
 *
 * Every section script imports from here instead of registering plugins itself:
 *   import { gsap, ScrollTrigger, SplitText, reducedMotion } from '@/scripts/motion';
 *
 * initMotion() is idempotent and is called once from the Base layout.
 */
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(ScrollTrigger, SplitText);

export { gsap, ScrollTrigger, SplitText };

const reducedQuery =
  typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

/** True when the visitor asked for reduced motion. Read at call time — it can change. */
export function prefersReducedMotion(): boolean {
  return reducedQuery?.matches ?? false;
}

/** Snapshot at module load; prefer prefersReducedMotion() inside handlers. */
export const reducedMotion = prefersReducedMotion();

/** Coarse pointer / small screen — use to lower DPR, particle counts, etc. */
export function isLowPowerDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const small = window.innerWidth < 768;
  const cores = navigator.hardwareConcurrency ?? 8;
  return coarse || small || cores <= 4;
}

let lenis: Lenis | null = null;
let started = false;

export function getLenis(): Lenis | null {
  return lenis;
}

/** Smooth-scroll to an element, selector or y offset (falls back to native). */
export function scrollToTarget(target: string | HTMLElement | number, offset = 0): void {
  if (lenis) {
    lenis.scrollTo(target, { offset, duration: 1.4 });
    return;
  }
  const el = typeof target === 'string' ? document.querySelector<HTMLElement>(target) : target;
  if (typeof el === 'number') {
    window.scrollTo({ top: el + offset, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  } else if (el) {
    const top = el.getBoundingClientRect().top + window.scrollY + offset;
    window.scrollTo({ top, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }
}

/**
 * Move keyboard focus to an in-page target, like native fragment navigation
 * does, so the next Tab continues from there. Non-focusable sections get a
 * tabindex="-1" (and [data-nav-focus], which suppresses the ring).
 */
function focusTarget(target: HTMLElement): void {
  if (!target.hasAttribute('tabindex')) {
    target.setAttribute('tabindex', '-1');
    target.setAttribute('data-nav-focus', '');
  }
  target.focus({ preventScroll: true });
}

/** Pause/resume page scrolling (loader, modals, lightbox). */
export function lockScroll(locked: boolean): void {
  if (lenis) {
    if (locked) lenis.stop();
    else lenis.start();
  }
  document.documentElement.classList.toggle('is-scroll-locked', locked);
  document.body.style.overflow = locked ? 'hidden' : '';
}

/** Stagger step (ms) for children of [data-reveal-stagger] parents. */
const stepOf = new WeakMap<HTMLElement, number>();

const REVEAL_PROPS = ['opacity', 'transform', 'filter', 'clip-path'];

/**
 * Focus landing inside a [data-reveal] block shows it at once, including one
 * already mid-entrance (stagger delay + 900 ms fade), so a focus ring never
 * circles an invisible control. global.css covers the not-yet-revealed state;
 * this also finishes running reveal transitions and keeps the block revealed
 * after focus moves on.
 */
function revealOnFocus(event: FocusEvent): void {
  let el = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-reveal]') : null;
  while (el) {
    el.style.setProperty('--reveal-delay', '0ms');
    el.classList.add('is-in');
    for (const anim of el.getAnimations?.() ?? []) {
      if (anim instanceof CSSTransition && REVEAL_PROPS.includes(anim.transitionProperty)) anim.finish();
    }
    el = el.parentElement?.closest<HTMLElement>('[data-reveal]') ?? null;
  }
}

/**
 * Reveal-on-scroll for [data-reveal] elements. Children of a
 * [data-reveal-stagger="80"] parent stagger by *batch*: the ones that enter the
 * viewport together get 0, step, 2×step… so a card that scrolls in alone
 * (single-column phone lists) reveals at once instead of waiting its DOM index.
 */
export function initReveals(root: ParentNode = document): void {
  const items = Array.from(root.querySelectorAll<HTMLElement>('[data-reveal]:not(.is-in)'));
  if (!items.length) return;

  root.querySelectorAll<HTMLElement>('[data-reveal-stagger]').forEach((parent) => {
    const step = Number(parent.dataset.revealStagger) || 80;
    parent.querySelectorAll<HTMLElement>(':scope > [data-reveal]').forEach((child) => {
      stepOf.set(child, step);
    });
  });

  if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('is-in'));
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      const entering = entries
        .filter((entry) => entry.isIntersecting)
        .map((entry) => entry.target as HTMLElement)
        .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
      // Per-parent position within this batch.
      const k = new Map<Element, number>();
      for (const el of entering) {
        const step = stepOf.get(el);
        const parent = el.parentElement;
        if (step !== undefined && parent) {
          const i = k.get(parent) ?? 0;
          k.set(parent, i + 1);
          el.style.setProperty('--reveal-delay', `${i * step}ms`);
        }
        el.classList.add('is-in');
        io.unobserve(el);
      }
    },
    { rootMargin: '0px 0px -12% 0px', threshold: 0.08 },
  );
  items.forEach((el) => io.observe(el));
}

/** Boot once: smooth scroll, ScrollTrigger sync, anchor links, reveals. */
export function initMotion(): void {
  if (started || typeof window === 'undefined') return;
  started = true;

  const root = document.documentElement;
  root.classList.add('js');
  if (!prefersReducedMotion()) root.classList.add('js-motion');

  if (!prefersReducedMotion()) {
    lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 1, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis?.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  // In-page anchor links glide instead of jumping. Focus follows the target
  // (as native fragment navigation would) so the next Tab starts there.
  document.addEventListener('click', (event) => {
    const link = (event.target as HTMLElement | null)?.closest<HTMLAnchorElement>('a[href^="#"]');
    if (!link) return;
    const hash = link.getAttribute('href');
    if (!hash || hash === '#') return;
    const target = document.querySelector<HTMLElement>(hash);
    if (!target) return;
    event.preventDefault();
    scrollToTarget(target);
    focusTarget(target);
    history.replaceState(null, '', hash);
  });

  initReveals();
  if (!prefersReducedMotion()) document.addEventListener('focusin', revealOnFocus);

  // Fonts shift layout: refresh pinned triggers once they land. (ScrollTrigger
  // already refreshes itself on DOMContentLoaded and window load.)
  document.fonts?.ready.then(() => ScrollTrigger.refresh());

  reducedQuery?.addEventListener('change', () => window.location.reload());
}
