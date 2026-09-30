/**
 * Pit Stop Paws — the car stops in the box, then the four wheel nuts light up
 * one at a time in a random order. Hit each lit nut; the clock runs from the
 * first light to the fourth hit. A tap on the wrong nut does nothing at all.
 */
import type { Cabinet, Game } from './cabinet';

const WHEELS = ['Front left', 'Front right', 'Rear left', 'Rear right'];

function verdict(ms: number): string {
  if (ms < 2000) return 'World-record stop. The wheel guns are still spinning.';
  if (ms < 2600) return 'Championship stop. Green light, car away.';
  if (ms < 3500) return 'Clean stop. All four on, car released.';
  return 'All four on. The owner inspected every nut in person.';
}

export default function pitStop(cab: Cabinet): Game {
  const root = cab.stage.querySelector<HTMLElement>('[data-pt]');
  const nuts = [...cab.stage.querySelectorAll<HTMLButtonElement>('[data-pt-nut]')];
  const call = cab.stage.querySelector<HTMLElement>('[data-pt-call]');
  const numEl = cab.stage.querySelector<SVGTextElement>('[data-pt-num]');
  if (!root || nuts.length !== WHEELS.length) return { start() {}, stop() {} };

  const numbers = (root.dataset.numbers ?? '').split(',').filter(Boolean);
  let order: number[] = [];
  let step = 0;
  let t0 = 0;
  let running = false;
  /** True once the first nut is lit and the clock is running. */
  let live = false;
  let raf = 0;
  let timer = 0;

  const setNut = (i: number, state: 'idle' | 'lit' | 'done') => {
    const nut = nuts[i];
    if (!nut) return;
    nut.dataset.state = state;
    nut.setAttribute('aria-label', state === 'idle' ? `${WHEELS[i]} wheel` : `${WHEELS[i]} wheel, ${state === 'lit' ? 'lit' : 'done'}`);
  };

  const enable = (on: boolean) => nuts.forEach((n) => (n.disabled = !on));

  const light = () => {
    const i = order[step];
    if (i == null) return;
    setNut(i, 'lit');
    cab.sfx('beep', { pitch: 1 + step * 0.12, volume: 0.7 });
    cab.say(WHEELS[i] ?? '');
  };

  const tick = () => {
    if (!running || !live) return;
    cab.score(`${((performance.now() - t0) / 1000).toFixed(3)} s`);
    raf = requestAnimationFrame(tick);
  };

  const hit = (i: number) => {
    if (!running || !live || order[step] !== i) return;
    setNut(i, 'done');
    cab.sfx('click', { pitch: 1.5 });
    step += 1;
    cab.aux(`${step} / ${WHEELS.length}`);
    if (step < WHEELS.length) return light();

    const ms = Math.round(performance.now() - t0);
    running = false;
    cancelAnimationFrame(raf);
    root.dataset.phase = 'done';
    if (call) call.textContent = 'Go, go, go';
    cab.score(`${(ms / 1000).toFixed(3)} s`);
    cab.finish(ms, verdict(ms));
  };

  nuts.forEach((nut, i) => {
    // pointerdown, not click: the stop is timed to the press, not the release.
    nut.addEventListener('pointerdown', (event) => {
      if (event.button === 0) hit(i);
    });
    // Keyboard activation (Enter / Space on a focused nut) arrives as a click with detail 0.
    nut.addEventListener('click', (event) => {
      if (event.detail === 0) hit(i);
    });
  });
  enable(false);

  return {
    start() {
      order = [0, 1, 2, 3];
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j]!, order[i]!];
      }
      step = 0;
      live = false;
      running = true;
      nuts.forEach((_, i) => setNut(i, 'idle'));
      enable(true);
      root.dataset.phase = 'in';
      if (call) call.textContent = 'Box, box';
      const n = numbers[Math.floor(Math.random() * numbers.length)];
      if (numEl && n) numEl.textContent = n;
      cab.score('0.000 s');
      cab.aux(`0 / ${WHEELS.length}`);
      cab.say('Car in the box. Wait for a wheel to light up.');
      // A random hold, so the first light can't be anticipated.
      timer = window.setTimeout(
        () => {
          live = true;
          root.dataset.phase = 'go';
          t0 = performance.now();
          light();
          tick();
        },
        750 + Math.random() * 900,
      );
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      enable(false);
    },
    key(key, repeat) {
      const i = ['1', '2', '3', '4'].indexOf(key);
      if (i < 0) return false;
      if (!repeat) hit(i);
      return true;
    },
  };
}
