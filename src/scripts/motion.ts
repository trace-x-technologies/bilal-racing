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

/** Pause/resume page scrolling (loader, modals, lightbox). */
export function lockScroll(locked: boolean): void {
  if (lenis) {
    if (locked) lenis.stop();
    else lenis.start();
  }
  document.documentElement.classList.toggle('is-scroll-locked', locked);
  document.body.style.overflow = locked ? 'hidden' : '';
}

/**
 * Reveal-on-scroll for [data-reveal] elements. Parents with
 * [data-reveal-stagger="80"] give children incremental --reveal-delay.
 */
export function initReveals(root: ParentNode = document): void {
  const items = Array.from(root.querySelectorAll<HTMLElement>('[data-reveal]:not(.is-in)'));
  if (!items.length) return;

  root.querySelectorAll<HTMLElement>('[data-reveal-stagger]').forEach((parent) => {
    const step = Number(parent.dataset.revealStagger) || 80;
    parent.querySelectorAll<HTMLElement>(':scope > [data-reveal]').forEach((child, i) => {
      child.style.setProperty('--reveal-delay', `${i * step}ms`);
    });
  });

  if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('is-in'));
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
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

  // In-page anchor links glide instead of jumping.
  document.addEventListener('click', (event) => {
    const link = (event.target as HTMLElement | null)?.closest<HTMLAnchorElement>('a[href^="#"]');
    if (!link) return;
    const hash = link.getAttribute('href');
    if (!hash || hash === '#') return;
    const target = document.querySelector<HTMLElement>(hash);
    if (!target) return;
    event.preventDefault();
    scrollToTarget(target);
    history.replaceState(null, '', hash);
  });

  initReveals();

  // Fonts shift layout: refresh pinned triggers once they land.
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
  window.addEventListener('load', () => ScrollTrigger.refresh(), { once: true });

  reducedQuery?.addEventListener('change', () => window.location.reload());
}
