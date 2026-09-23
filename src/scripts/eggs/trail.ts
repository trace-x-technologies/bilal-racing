/**
 * Paw-print cursor trail — fine pointers only, off for reduced motion.
 * A small pool of absolutely positioned spans is re-stamped along the path
 * (alternating left/right, rotated to the direction of travel). Each stamp's
 * fade is a compositor-driven WAAPI animation, and the only rAF is one
 * coalescing frame per pointer move, so nothing runs while the mouse rests.
 */
import { reduced } from './util';

const POOL = 24;
const STRIDE = 34; // px between prints
const SPREAD = 6.5; // px left/right of the path
const SIZE = 16;

export function initTrail(root: HTMLElement): void {
  const layer = root.querySelector<HTMLElement>('[data-trail]');
  if (!layer || reduced()) return;
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
  if (!fine.matches) return;

  const prints: HTMLElement[] = [];
  let next = 0;
  let side = 1;
  let lastX = Number.NaN;
  let lastY = Number.NaN;
  let px = 0;
  let py = 0;
  let raf = 0;

  function ensurePool(): void {
    if (prints.length) return;
    const frag = document.createDocumentFragment();
    for (let i = 0; i < POOL; i++) {
      const el = document.createElement('span');
      el.className = 'paw';
      frag.append(el);
      prints.push(el);
    }
    layer!.append(frag);
  }

  function stamp(x: number, y: number, angle: number): void {
    const el = prints[next];
    next = (next + 1) % POOL;
    el.getAnimations().forEach((a) => a.cancel());
    const rad = (angle * Math.PI) / 180;
    // Perpendicular offset → alternating left/right feet.
    const ox = Math.cos(rad) * SPREAD * side;
    const oy = Math.sin(rad) * SPREAD * side;
    side = -side;
    const base = `translate3d(${(x + ox - SIZE / 2).toFixed(1)}px, ${(y + oy - SIZE / 2).toFixed(1)}px, 0) rotate(${angle.toFixed(1)}deg)`;
    el.animate(
      [
        { opacity: 0, transform: `${base} scale(0.4)` },
        { opacity: 0.7, transform: `${base} scale(1)`, offset: 0.12 },
        { opacity: 0, transform: `${base} scale(0.85)` },
      ],
      { duration: 1100, easing: 'cubic-bezier(0.2, 0.6, 0.3, 1)', fill: 'forwards' },
    );
  }

  function frame(): void {
    raf = 0;
    if (Number.isNaN(lastX)) {
      lastX = px;
      lastY = py;
      return;
    }
    const dx = px - lastX;
    const dy = py - lastY;
    const dist = Math.hypot(dx, dy);
    if (dist < STRIDE) return;
    ensurePool();
    // Paw art points "up"; +90° turns it to face the direction of travel.
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
    const steps = Math.min(3, Math.floor(dist / STRIDE));
    for (let i = 1; i <= steps; i++) {
      const t = (i * STRIDE) / dist;
      stamp(lastX + dx * t, lastY + dy * t, angle);
    }
    const t = (steps * STRIDE) / dist;
    lastX += dx * t;
    lastY += dy * t;
    if (steps === 3) {
      // Very fast flick: jump the anchor to the pointer so prints don't lag.
      lastX = px;
      lastY = py;
    }
  }

  window.addEventListener(
    'pointermove',
    (event) => {
      if (event.pointerType !== 'mouse') return;
      px = event.clientX;
      py = event.clientY;
      if (!raf) raf = requestAnimationFrame(frame);
    },
    { passive: true },
  );
  document.documentElement.addEventListener('pointerleave', () => {
    lastX = Number.NaN;
    lastY = Number.NaN;
  });
}
