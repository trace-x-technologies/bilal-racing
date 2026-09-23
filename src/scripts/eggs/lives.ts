/**
 * "Nine lives": tap the nav emblem (a[data-egg="emblem"]) nine times quickly
 * to toggle Zoomies — the touch-friendly Konami. The first tap navigates as
 * normal; from the 2nd rapid tap on we preventDefault so the page stays put.
 */
import { floatText } from './util';

const GAP_MS = 900;
const LIVES = 9;

export function initNineLives(root: HTMLElement, onNine: () => void): void {
  let count = 0;
  let last = 0;

  document.addEventListener(
    'click',
    (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const emblem = target?.closest<HTMLElement>('a[data-egg="emblem"]');
      if (!emblem) return;

      const now = performance.now();
      count = now - last > GAP_MS ? 1 : count + 1;
      last = now;
      if (count >= 2) event.preventDefault();
      if (count < 3) return;

      // Anchor under the emblem (it lives in the nav, so "under" is where there's room).
      const rect = emblem.getBoundingClientRect();
      const x = event.clientX || rect.left + rect.width / 2;
      const y = rect.bottom + 22;
      const done = count >= LIVES;
      floatText(root, done ? '9/9 · ZOOMIES' : `${count}/${LIVES}`, x, y, done ? 'red' : 'gold');
      if (done) {
        count = 0;
        onNine();
      }
    },
    true,
  );
}
