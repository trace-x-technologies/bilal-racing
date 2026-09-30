/**
 * Race-control toasts. Anyone can do: emit('bilal:toast', { message, tone }).
 *
 * - Stacked bottom-centre inside a polite live region (static in EasterEggs.astro).
 * - Tones: info (race control), gold (team radio), red (stewards).
 * - Auto-dismiss with a length-aware timer; hover pauses; click dismisses.
 * - Duplicate messages merge into one toast with a ×N counter.
 * - Stack reflow uses FLIP on the `translate` property so it composes with
 *   the enter/exit `transform` animations.
 * - Toasts emitted before this module ran are replayed from the inline buffer.
 */
import { on, type BilalEvents } from '@/scripts/bus';
import { EASE_OUT_EXPO, play, reduced, type Tone } from './util';

type ToastDetail = BilalEvents['bilal:toast'];

interface LiveToast {
  el: HTMLElement;
  key: string;
  count: number;
  duration: number;
  remaining: number;
  startedAt: number;
  timer: number;
  closing: boolean;
  bar: Animation | null;
  counter: HTMLElement;
}

const KICKER: Record<Tone, string> = {
  info: 'Race control',
  gold: 'Team radio',
  red: 'Stewards',
};

const TONES: readonly Tone[] = ['info', 'gold', 'red'];

/** Shape of the buffer the inline script in EasterEggs.astro leaves on the region. */
export interface EarlyBuffer {
  q: Array<[string, unknown]>;
  h: (event: Event) => void;
}

export function drainEarlyBuffer(region: HTMLElement): Array<[string, unknown]> {
  const holder = region as HTMLElement & { __eggq?: EarlyBuffer };
  const buffer = holder.__eggq;
  if (!buffer) return [];
  window.removeEventListener('bilal:toast', buffer.h);
  window.removeEventListener('bilal:egg', buffer.h);
  delete holder.__eggq;
  return buffer.q.slice();
}

function durationFor(message: string): number {
  return Math.min(7500, Math.max(3400, 2300 + message.length * 55));
}

function clock(): string {
  try {
    return new Date().toLocaleTimeString('en-GB', { hour12: false });
  } catch {
    return '';
  }
}

export function initToasts(region: HTMLElement): (detail: ToastDetail) => void {
  const live: LiveToast[] = [];
  const maxVisible = () => (window.innerWidth < 640 ? 3 : 4);
  let hoverPaused = false;

  /** FLIP the remaining toasts after a DOM change (translate only). */
  function flip(mutate: () => void): void {
    const items = Array.from(region.children) as HTMLElement[];
    const before = new Map(items.map((el) => [el, el.getBoundingClientRect().top]));
    mutate();
    if (reduced()) return;
    for (const [el, top] of before) {
      if (!el.isConnected) continue;
      const dy = top - el.getBoundingClientRect().top;
      if (Math.abs(dy) < 0.5) continue;
      void play(el, [{ translate: `0 ${dy}px` }, { translate: '0 0' }], {
        duration: 460,
        easing: EASE_OUT_EXPO,
      });
    }
  }

  function startTimer(t: LiveToast): void {
    window.clearTimeout(t.timer);
    t.startedAt = performance.now();
    t.timer = window.setTimeout(() => dismiss(t), t.remaining);
    t.bar?.play();
  }

  function pauseTimer(t: LiveToast): void {
    if (t.closing) return;
    window.clearTimeout(t.timer);
    t.remaining = Math.max(600, t.remaining - (performance.now() - t.startedAt));
    t.bar?.pause();
  }

  function restartBar(t: LiveToast): void {
    t.bar?.cancel();
    t.bar = null;
    if (reduced()) return;
    const bar = t.el.querySelector<HTMLElement>('.toast-bar');
    if (!bar || typeof bar.animate !== 'function') return;
    try {
      t.bar = bar.animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }], {
        duration: t.duration,
        easing: 'linear',
        fill: 'forwards',
      });
      if (hoverPaused) t.bar.pause();
    } catch {
      t.bar = null;
    }
  }

  function dismiss(t: LiveToast, instant = false): void {
    if (t.closing) return;
    t.closing = true;
    window.clearTimeout(t.timer);
    const index = live.indexOf(t);
    if (index >= 0) live.splice(index, 1);
    const remove = () => flip(() => t.el.remove());
    if (instant) {
      remove();
      return;
    }
    const frames: Keyframe[] = reduced()
      ? [{ opacity: 1 }, { opacity: 0 }]
      : [
          { opacity: 1, transform: 'none', clipPath: 'inset(0 0 0 0)' },
          { opacity: 0, transform: 'translateX(2.5rem) skewX(-8deg)', clipPath: 'inset(0 0 0 60%)' },
        ];
    void play(t.el, frames, {
      duration: reduced() ? 160 : 300,
      easing: 'cubic-bezier(0.55, 0, 1, 0.45)',
      fill: 'forwards',
    }).then(remove);
  }

  function build(message: string, tone: Tone): LiveToast {
    const el = document.createElement('div');
    el.className = 'toast';
    el.dataset.tone = tone;

    const head = document.createElement('div');
    head.className = 'toast-head';
    head.setAttribute('aria-hidden', 'true');
    const flag = document.createElement('span');
    flag.className = 'toast-flag';
    const kicker = document.createElement('span');
    kicker.className = 'toast-kicker';
    kicker.textContent = KICKER[tone];
    const time = document.createElement('span');
    time.className = 'toast-time';
    time.textContent = clock();
    head.append(flag, kicker, time);

    const msg = document.createElement('p');
    msg.className = 'toast-msg';
    msg.textContent = message;

    const counter = document.createElement('span');
    counter.className = 'toast-count';
    counter.setAttribute('aria-hidden', 'true');

    const bar = document.createElement('span');
    bar.className = 'toast-bar';
    bar.setAttribute('aria-hidden', 'true');

    el.append(head, msg, counter, bar);

    const duration = durationFor(message);
    const t: LiveToast = {
      el,
      key: `${tone}|${message}`,
      count: 1,
      duration,
      remaining: duration,
      startedAt: 0,
      timer: 0,
      closing: false,
      bar: null,
      counter,
    };

    el.addEventListener('click', () => {
      dismiss(t);
      // The removed toast never gets a pointerleave — resume the rest now.
      hoverPaused = false;
      live.forEach((item) => !item.closing && startTimer(item));
    });
    el.addEventListener('pointerenter', () => {
      hoverPaused = true;
      live.forEach(pauseTimer);
    });
    el.addEventListener('pointerleave', () => {
      hoverPaused = false;
      live.forEach((item) => !item.closing && startTimer(item));
    });
    return t;
  }

  function show(detail: ToastDetail | undefined): void {
    const message = typeof detail?.message === 'string' ? detail.message.trim().slice(0, 220) : '';
    if (!message) return;
    const tone: Tone = detail?.tone && TONES.includes(detail.tone) ? detail.tone : 'info';

    // Same message already on screen → bump it instead of stacking a clone.
    const dupe = live.find((t) => t.key === `${tone}|${message}` && !t.closing);
    if (dupe) {
      dupe.count += 1;
      dupe.counter.textContent = `×${dupe.count}`;
      dupe.el.classList.add('has-count');
      dupe.remaining = dupe.duration;
      restartBar(dupe);
      if (!hoverPaused) startTimer(dupe);
      if (!reduced()) {
        void play(dupe.el, [{ scale: '1' }, { scale: '1.035' }, { scale: '1' }], {
          duration: 320,
          easing: EASE_OUT_EXPO,
        });
      }
      return;
    }

    const t = build(message, tone);
    live.push(t);
    flip(() => region.append(t.el));

    const frames: Keyframe[] = reduced()
      ? [{ opacity: 0 }, { opacity: 1 }]
      : [
          { opacity: 0, transform: 'translateX(-2rem) skewX(-8deg)', clipPath: 'inset(0 100% 0 0)' },
          { opacity: 1, transform: 'none', clipPath: 'inset(0 0 0 0)' },
        ];
    void play(t.el, frames, { duration: reduced() ? 180 : 620, easing: EASE_OUT_EXPO });

    restartBar(t);
    if (hoverPaused) t.remaining = t.duration;
    else startTimer(t);

    // Cap the stack: oldest leave first.
    const open = live.filter((item) => !item.closing);
    const overflow = open.length - maxVisible();
    for (let i = 0; i < overflow; i++) dismiss(open[i]);
  }

  on('bilal:toast', show);

  // Escape clears the stack (does not preventDefault — modals still get it).
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && live.length) live.slice().forEach((t) => dismiss(t));
  });

  return show;
}
