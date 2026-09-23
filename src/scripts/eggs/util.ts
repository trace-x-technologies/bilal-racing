/**
 * Small helpers shared by the easter-egg modules. No DOM work at import time.
 */
import { emit, type BilalEvents } from '@/scripts/bus';
import { prefersReducedMotion } from '@/scripts/motion';

export type Tone = NonNullable<BilalEvents['bilal:toast']['tone']>;

export const EASE_OUT_EXPO = 'cubic-bezier(0.16, 1, 0.3, 1)';
export const EASE_OUT_BACK = 'cubic-bezier(0.34, 1.56, 0.64, 1)';
export const EASE_IN = 'cubic-bezier(0.55, 0, 1, 0.45)';

export const reduced = (): boolean => prefersReducedMotion();

export function toast(message: string, tone: Tone = 'info'): void {
  emit('bilal:toast', { message, tone });
}

export function foundEgg(id: string, label: string): void {
  emit('bilal:egg', { id, label });
}

/** True when keystrokes belong to a form field / editor rather than the page. */
export function isTypingTarget(target: EventTarget | null): boolean {
  const candidates = [target, document.activeElement];
  for (const node of candidates) {
    if (!(node instanceof Element)) continue;
    if (node.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return true;
    if (node instanceof HTMLElement && node.isContentEditable) return true;
  }
  return false;
}

/** Last known pointer position (viewport px). Updated by index.ts. */
export const pointer = {
  x: typeof window === 'undefined' ? 0 : window.innerWidth / 2,
  y: typeof window === 'undefined' ? 0 : window.innerHeight / 2,
  seen: false,
};

/** el.animate() that never throws and resolves when finished or cancelled. */
export function play(
  el: Element | null | undefined,
  keyframes: Keyframe[],
  options: KeyframeAnimationOptions,
): Promise<void> {
  if (!el || typeof el.animate !== 'function') return Promise.resolve();
  try {
    const anim = el.animate(keyframes, options);
    return anim.finished.then(
      () => undefined,
      () => undefined,
    );
  } catch {
    return Promise.resolve();
  }
}

export const wait = (ms: number): Promise<void> => new Promise((resolve) => window.setTimeout(resolve, ms));

export const rand = (min: number, max: number): number => min + Math.random() * (max - min);

/**
 * Floating label that pops and drifts away (e.g. "3/9" under the emblem).
 * Drifts down when spawned near the top of the viewport, up otherwise.
 */
export function floatText(root: HTMLElement, text: string, x: number, y: number, tone: Tone = 'gold'): void {
  const el = document.createElement('span');
  el.className = 'egg-float';
  el.dataset.tone = tone;
  el.textContent = text;
  el.setAttribute('aria-hidden', 'true');
  const half = Math.min(120, window.innerWidth / 2 - 8);
  el.style.left = `${Math.round(Math.max(half, Math.min(window.innerWidth - half, x)))}px`;
  el.style.top = `${Math.round(y)}px`;
  root.append(el);
  const dir = y < window.innerHeight * 0.3 ? 1 : -1;
  const frames: Keyframe[] = reduced()
    ? [{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 0 }]
    : [
        { opacity: 0, transform: `translate(-50%, -50%) scale(0.5) rotate(-8deg)` },
        { opacity: 1, transform: `translate(-50%, ${-50 + dir * 40}%) scale(1.1) rotate(-8deg)`, offset: 0.22 },
        { opacity: 0, transform: `translate(-50%, ${-50 + dir * 190}%) scale(0.95) rotate(-8deg)` },
      ];
  void play(el, frames, { duration: 950, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)', fill: 'forwards' }).then(() =>
    el.remove(),
  );
}
