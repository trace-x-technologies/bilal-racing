/**
 * Lazy entry for everything except toasts + tracker (those boot eagerly in
 * EasterEggs.astro so no early message is lost). Loaded after the page is idle.
 * Each feature is isolated: if one throws, the rest (and the page) carry on.
 */
import { initGags, type GagControl } from './gags';
import { greet } from './greeting';
import { initKeys } from './keys';
import { initLaser, type LaserControl } from './laser';
import { initNineLives } from './lives';
import { initNap } from './nap';
import { initTrail } from './trail';
import { pointer } from './util';
import { initZoomies, type ZoomiesControl } from './zoomies';

function attempt<T>(fn: () => T): T | null {
  try {
    return fn();
  } catch (error) {
    if (import.meta.env.DEV) console.warn('[eggs]', error);
    return null;
  }
}

export function initEggs(root: HTMLElement): void {
  if (root.dataset.eggsReady === 'true') return;
  root.dataset.eggsReady = 'true';

  window.addEventListener(
    'pointermove',
    (event) => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.seen = true;
    },
    { passive: true },
  );

  const zoomies: ZoomiesControl | null = attempt(() => initZoomies(root));
  const laser: LaserControl | null = attempt(() => initLaser(root));
  const gags: GagControl | null = attempt(() => initGags(root));

  attempt(() => initTrail(root));
  attempt(() => initNap(root));
  attempt(() => initNineLives(root, () => zoomies?.toggle('nine-lives')));
  attempt(() =>
    initKeys({
      konami: () => zoomies?.toggle('konami'),
      meow: () => gags?.meow(),
      box: () => gags?.box(),
      laser: () => laser?.toggle(),
      escape: () => laser?.active && laser.off(),
    }),
  );
  attempt(greet);
}
