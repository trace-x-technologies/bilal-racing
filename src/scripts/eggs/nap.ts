/**
 * Idle 60 s → the owner curls up on a spare Purrelli in the corner (the drivers
 * are out racing; somebody has to guard the tyres). Any activity wakes him.
 * Uses one timeout that re-arms itself from the last-activity timestamp (no
 * per-event timer churn). Hidden tabs don't count.
 */
import { sound } from '@/scripts/audio';
import { EASE_IN, EASE_OUT_EXPO, foundEgg, play, reduced, toast, wait } from './util';

const IDLE_MS = 60_000;

export function initNap(root: HTMLElement): void {
  const cat = root.querySelector<HTMLElement>('[data-nap]');
  if (!cat) return;

  let last = performance.now();
  let timer = 0;
  let napping = false;
  let waking = false;

  function arm(ms: number): void {
    window.clearTimeout(timer);
    timer = window.setTimeout(check, ms);
  }

  function check(): void {
    if (document.hidden) {
      arm(IDLE_MS);
      return;
    }
    const idle = performance.now() - last;
    if (idle >= IDLE_MS) sleep();
    else arm(IDLE_MS - idle + 50);
  }

  function sleep(): void {
    if (napping || waking) return;
    napping = true;
    cat!.classList.remove('is-awake');
    cat!.hidden = false;
    void play(
      cat,
      reduced()
        ? [{ opacity: 0 }, { opacity: 1 }]
        : [
            { transform: 'translateY(115%)', opacity: 0 },
            { transform: 'translateY(0)', opacity: 1 },
          ],
      { duration: reduced() ? 240 : 900, easing: EASE_OUT_EXPO },
    );
    sound.play('purr', { volume: 0.5 });
    toast('The owner is taking a champion’s power nap on the spare tyres. Move to wake him.', 'info');
    foundEgg('nap', 'Champion’s power nap on the spare tyres');
  }

  async function wake(): Promise<void> {
    if (!napping || waking) return;
    napping = false;
    waking = true;
    cat!.classList.add('is-awake');
    await wait(reduced() ? 400 : 650);
    await play(
      cat,
      reduced()
        ? [{ opacity: 1 }, { opacity: 0 }]
        : [
            { transform: 'translateY(0)', opacity: 1 },
            { transform: 'translateY(115%)', opacity: 0 },
          ],
      { duration: reduced() ? 200 : 420, easing: EASE_IN, fill: 'forwards' },
    );
    cat!.hidden = true;
    cat!.getAnimations().forEach((a) => a.cancel());
    cat!.classList.remove('is-awake');
    waking = false;
    arm(IDLE_MS);
  }

  const activity = () => {
    last = performance.now();
    if (napping) void wake();
  };
  for (const type of ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'] as const) {
    window.addEventListener(type, activity, { passive: true });
  }
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      last = performance.now();
      arm(IDLE_MS);
    }
  });

  arm(IDLE_MS);
}
