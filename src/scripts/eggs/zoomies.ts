/**
 * ZOOMIES MODE — Konami code or nine emblem taps.
 * html.zoomies + emit('bilal:zoomies'), speed-line overlay, a livery cat that
 * skids in, winds up, and blasts off, and a brief shake of visible page elements
 * (animated on `translate`/`rotate` so it composes with sections' own transforms).
 */
import { emit, on } from '@/scripts/bus';
import { sound } from '@/scripts/audio';
import { isLowPowerDevice } from '@/scripts/motion';
import { foundEgg, play, reduced, toast, wait } from './util';

export type ZoomiesSource = 'konami' | 'nine-lives';

export interface ZoomiesControl {
  toggle(source: ZoomiesSource): void;
  readonly active: boolean;
}

const EGG_LABEL: Record<ZoomiesSource, string> = {
  konami: 'The ancient cheat code',
  'nine-lives': 'Nine lives, nine taps',
};

const SHAKE_TARGETS = 'main :is(h1, h2, h3, img, canvas, button, .photo-slot), footer :is(h2, h3, img)';

export function initZoomies(root: HTMLElement): ZoomiesControl | null {
  const layer = root.querySelector<HTMLElement>('[data-zl]');
  if (!layer) return null;
  const cat = layer.querySelector<HTMLElement>('[data-zl-cat]');
  const word = layer.querySelector<HTMLElement>('[data-zl-word]');
  const pill = root.querySelector<HTMLButtonElement>('[data-zpill]');
  if (isLowPowerDevice()) layer.classList.add('is-lite');

  let active = false;
  let run = 0;

  function shake(): void {
    const vh = window.innerHeight;
    const frames: Keyframe[] = [
      { translate: '0 0', rotate: '0deg' },
      { translate: '-2px 1px', rotate: '-0.6deg' },
      { translate: '2px -1px', rotate: '0.5deg' },
      { translate: '-1px -1px', rotate: '-0.3deg' },
      { translate: '0 0', rotate: '0deg' },
    ];
    let n = 0;
    for (const el of document.querySelectorAll<HTMLElement>(SHAKE_TARGETS)) {
      if (n >= 36) break;
      const rect = el.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > vh || rect.width === 0) continue;
      n += 1;
      void play(el, frames, { duration: 240, iterations: 6, delay: n * 14, easing: 'linear', composite: 'add' });
    }
  }

  async function burst(): Promise<void> {
    const token = ++run;
    if (reduced()) {
      layer!.classList.add('is-still');
      await wait(2400);
      if (token === run) layer!.classList.remove('is-still');
      return;
    }

    layer!.classList.add('is-burst');
    shake();

    const w = window.innerWidth;
    const catW = cat?.offsetWidth ?? 260;
    const mid = w / 2 - catW / 2;
    cat?.classList.add('is-running');
    const sprint = play(
      cat,
      [
        { transform: `translateX(${-catW * 1.15}px)`, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)' },
        { transform: `translateX(${mid + catW * 0.12}px) skewX(-6deg)`, offset: 0.3 },
        { transform: `translateX(${mid}px) skewX(4deg)`, offset: 0.38 },
        { transform: `translateX(${mid - 6}px)`, offset: 0.62, easing: 'cubic-bezier(0.6, 0, 0.9, 0.4)' },
        { transform: `translateX(${w + catW * 0.3}px) skewX(-14deg)` },
      ],
      { duration: 2300, fill: 'both' },
    );
    void play(
      word,
      [
        { transform: `translate(${w}px, -50%) skewX(-14deg)`, opacity: 0 },
        { opacity: 1, offset: 0.15 },
        { opacity: 1, offset: 0.8 },
        { transform: `translate(-100%, -50%) skewX(-14deg)`, opacity: 0 },
      ],
      { duration: 2300, easing: 'cubic-bezier(0.3, 0.1, 0.4, 1)' },
    );
    await sprint;
    if (token !== run) return;
    cat?.classList.remove('is-running');
    cat?.getAnimations().forEach((a) => a.cancel());
    layer!.classList.remove('is-burst');
  }

  function apply(next: boolean, announce: boolean): void {
    active = next;
    document.documentElement.classList.toggle('zoomies', next);
    layer!.classList.toggle('is-on', next);
    if (pill) pill.hidden = !next;
    if (announce) emit('bilal:zoomies', { on: next });
    if (next) {
      void burst();
    } else {
      run += 1;
      layer!.classList.remove('is-burst', 'is-still');
      cat?.classList.remove('is-running');
      cat?.getAnimations().forEach((a) => a.cancel());
      word?.getAnimations().forEach((a) => a.cancel());
    }
  }

  function toggle(source: ZoomiesSource): void {
    const next = !active;
    apply(next, true);
    if (next) {
      sound.play('revMeow');
      toast('ZOOMIES MODE: ENGAGED', 'red');
    } else {
      sound.play('purr');
      toast('Zoomies disengaged. Nap resumed.', 'info');
    }
    foundEgg(source, EGG_LABEL[source]);
  }

  pill?.addEventListener('click', () => {
    if (!active) return;
    apply(false, true);
    sound.play('purr');
    toast('Zoomies disengaged. Nap resumed.', 'info');
  });

  // Another section may flip Zoomies too — stay in sync without re-emitting.
  on('bilal:zoomies', (detail) => {
    if (detail && typeof detail.on === 'boolean' && detail.on !== active) apply(detail.on, false);
  });

  return {
    toggle,
    get active() {
      return active;
    },
  };
}
