/**
 * Laser pointer ("l"): a red dot glued to the pointer, and a cat arm reaching
 * up from below the screen. The paw lags behind the dot, the shoulder (a base
 * point under the bottom edge) lags behind the paw, so the arm swings like a
 * real reach. Every so often it swipes — and the dot dodges.
 * rAF only runs while something is still moving; Esc also turns it off.
 */
import { sound } from '@/scripts/audio';
import { foundEgg, play, pointer, rand, reduced, toast } from './util';

export interface LaserControl {
  toggle(): void;
  off(): void;
  readonly active: boolean;
}

/** Paw anchor sits this far below the dot so the toe beans end just under it. */
const PAW_OFFSET = 24;

export function initLaser(root: HTMLElement): LaserControl | null {
  const layer = root.querySelector<HTMLElement>('[data-laser]');
  const dot = layer?.querySelector<HTMLElement>('.laser-dot');
  const arm = layer?.querySelector<HTMLElement>('.laser-arm');
  const swipeEl = layer?.querySelector<HTMLElement>('.laser-swipe');
  const paw = layer?.querySelector<SVGElement>('.laser-pawsvg');
  if (!layer || !dot || !arm || !swipeEl) return null;

  let active = false;
  let raf = 0;
  let swipeTimer = 0;
  let tx = pointer.x;
  let ty = pointer.y;
  let jx = 0;
  let jy = 0;
  let px = tx;
  let py = ty;
  let bx = tx;

  const onMove = (event: PointerEvent) => {
    tx = event.clientX;
    ty = event.clientY;
    kick();
  };

  function kick(): void {
    if (!raf && active) raf = requestAnimationFrame(tick);
  }

  function tick(): void {
    raf = 0;
    const still = reduced();
    jx *= 0.84;
    jy *= 0.84;
    const dx = tx + jx;
    const dy = ty + jy;
    dot!.style.transform = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0)`;

    const gx = dx;
    const gy = dy + PAW_OFFSET;
    const ease = still ? 1 : 0.11;
    px += (gx - px) * ease;
    py += (gy - py) * ease;
    bx += (px - bx) * (still ? 1 : 0.035);

    // Shoulder is under the bottom edge; cap the lean so it stays arm-like.
    const by = window.innerHeight + 70;
    const reach = Math.max(40, by - py);
    const ox = Math.max(-reach * 1.1, Math.min(reach * 1.1, bx - px));
    const angle = (-Math.atan2(ox, reach) * 180) / Math.PI;
    arm!.style.transform = `translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0) rotate(${angle.toFixed(2)}deg)`;

    const moving =
      Math.abs(gx - px) + Math.abs(gy - py) > 0.4 || Math.abs(jx) + Math.abs(jy) > 0.3 || Math.abs(px - bx) > 0.6;
    if (moving) kick();
  }

  function scheduleSwipe(): void {
    window.clearTimeout(swipeTimer);
    swipeTimer = window.setTimeout(swipe, rand(900, 1800));
  }

  function swipe(): void {
    if (!active) return;
    const close = Math.hypot(tx + jx - px, ty + jy + PAW_OFFSET - py) < 70;
    if (close && !reduced()) {
      const flip = Math.random() < 0.5 ? -1 : 1;
      void play(
        swipeEl,
        [
          { transform: 'translateY(0)' },
          { transform: 'translateY(12px)', offset: 0.3 },
          { transform: 'translateY(-30px)', offset: 0.55 },
          { transform: 'translateY(0)' },
        ],
        { duration: 380, easing: 'cubic-bezier(0.3, 0.7, 0.3, 1)' },
      );
      void play(
        paw,
        [
          { transform: 'rotate(0deg)' },
          { transform: `rotate(${-16 * flip}deg)`, offset: 0.3 },
          { transform: `rotate(${14 * flip}deg)`, offset: 0.55 },
          { transform: 'rotate(0deg)' },
        ],
        { duration: 380, easing: 'cubic-bezier(0.3, 0.7, 0.3, 1)' },
      );
      swipeEl!.classList.add('is-clawing');
      window.setTimeout(() => {
        swipeEl!.classList.remove('is-clawing');
        // The dot escapes at the last millisecond. Every. Single. Time.
        const a = rand(-Math.PI * 0.95, -Math.PI * 0.05);
        const d = rand(50, 90);
        jx = Math.cos(a) * d;
        jy = Math.sin(a) * d;
        kick();
      }, 190);
    }
    scheduleSwipe();
  }

  function set(next: boolean): void {
    if (next === active) return;
    active = next;
    document.documentElement.classList.toggle('egg-laser', next);
    if (next) {
      tx = pointer.x;
      ty = pointer.y;
      px = tx;
      py = window.innerHeight + 90; // reach up from below the screen
      bx = tx;
      layer!.hidden = false;
      window.addEventListener('pointermove', onMove, { passive: true });
      kick();
      scheduleSwipe();
      sound.play('click');
      toast('Laser pointer armed. Driver focus: gone.', 'red');
      foundEgg('laser', 'Laser pointer in the braking zone');
      if (!reduced()) {
        void play(dot, [{ opacity: 0, scale: '3' }, { opacity: 1, scale: '1' }], { duration: 360, easing: 'ease-out' });
      }
    } else {
      window.removeEventListener('pointermove', onMove);
      window.clearTimeout(swipeTimer);
      cancelAnimationFrame(raf);
      raf = 0;
      layer!.hidden = true;
      toast('Laser holstered. Focus restored (allegedly).', 'info');
    }
  }

  return {
    toggle: () => set(!active),
    off: () => set(false),
    get active() {
      return active;
    },
  };
}
