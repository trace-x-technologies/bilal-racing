/**
 * Lights Out, arcade edition — the same start as on the Race page, inside a
 * cabinet. Five red lights come on one a second, hold for a random moment, then
 * go out: pounce. The time goes on the shared Lights Out table.
 *
 * A tap while the lights are still on is a keen start: the lights reset and the
 * same round carries on. Nothing is ever taken away.
 */
import type { Cabinet, Game } from './cabinet';

const FIRST_LIGHT = 700;
const LIGHT_INTERVAL = 1000;
/** After the fifth light: a random hold of 0.2 to 3 s, so the moment can't be learned. */
const HOLD_MIN = 200;
const HOLD_RANGE = 2800;
/** No pounce this long after lights out: the round ends (the board stops at 6 s). */
const NO_LAUNCH = 6000;
/** A keen start: the lights flash, then the sequence starts over. */
const KEEN_RESET = 1100;

type Phase = 'idle' | 'arming' | 'hold' | 'go' | 'keen' | 'done';

function verdict(ms: number): string {
  if (ms > NO_LAUNCH) return 'The lights went out a while back. The owner kept your seat warm.';
  if (ms < 200) return 'Laser-pointer reflexes. The cat is taking notes.';
  if (ms < 300) return 'Podium material. Sharp, like claws on a new sofa.';
  if (ms < 450) return 'Points finish. Cool and calm. Very cat of you.';
  return 'Tyres warm. The next launch is the quick one.';
}

export default function startLights(cab: Cabinet): Game {
  const root = cab.stage.querySelector<HTMLElement>('[data-sl]');
  const pods = [...cab.stage.querySelectorAll<HTMLElement>('[data-sl-pod]')];
  const call = cab.stage.querySelector<HTMLElement>('[data-sl-call]');
  if (!root || pods.length !== 5) return { start() {}, stop() {} };

  let phase: Phase = 'idle';
  let goAt = 0;
  let raf = 0;
  let timers: number[] = [];

  const later = (fn: () => void, ms: number) => timers.push(window.setTimeout(fn, ms));
  const clear = () => {
    timers.forEach((t) => window.clearTimeout(t));
    timers = [];
    cancelAnimationFrame(raf);
  };
  const setPhase = (next: Phase, text?: string) => {
    phase = next;
    root.dataset.phase = next;
    if (call && text != null) call.textContent = text;
  };
  const setLit = (n: number) => pods.forEach((pod, i) => pod.toggleAttribute('data-on', i < n));

  const lightsOut = () => {
    setLit(0);
    setPhase('go', 'Go!');
    goAt = performance.now();
    cab.sfx('go');
    cab.say('Go!');
    const run = () => {
      if (phase !== 'go') return;
      const elapsed = performance.now() - goAt;
      cab.score(`${(elapsed / 1000).toFixed(3)} s`);
      if (elapsed > NO_LAUNCH) return end(NO_LAUNCH + 1);
      raf = requestAnimationFrame(run);
    };
    raf = requestAnimationFrame(run);
  };

  const sequence = () => {
    clear();
    setLit(0);
    setPhase('arming', 'Hands ready');
    cab.score('0.000 s');
    cab.aux('0 / 5');
    cab.say('Lights coming on. Wait for them to go out.');
    for (let i = 1; i <= 5; i++) {
      later(
        () => {
          setLit(i);
          cab.aux(`${i} / 5`);
          cab.sfx('beep', { pitch: i === 5 ? 1.06 : 1, volume: 0.8 });
          if (i === 5) {
            setPhase('hold', 'Wait for it');
            later(lightsOut, HOLD_MIN + Math.random() * HOLD_RANGE);
          }
        },
        FIRST_LIGHT + (i - 1) * LIGHT_INTERVAL,
      );
    }
  };

  const keen = () => {
    clear();
    setLit(0);
    setPhase('keen', 'Keen start · lights reset');
    cab.sfx('click');
    cab.say('Keen start. The lights reset.');
    later(sequence, KEEN_RESET);
  };

  const end = (ms: number) => {
    clear();
    setPhase('done', ms > NO_LAUNCH ? 'Lights out' : 'Launched');
    cab.score(`${(Math.min(ms, NO_LAUNCH) / 1000).toFixed(3)} s`);
    cab.finish(ms, verdict(ms));
  };

  const pounce = () => {
    if (phase === 'arming' || phase === 'hold') keen();
    else if (phase === 'go') end(Math.max(1, Math.round(performance.now() - goAt)));
  };

  cab.stage.addEventListener('pointerdown', (event) => {
    if (event.button === 0) pounce();
  });

  return {
    start: sequence,
    stop() {
      clear();
      setLit(0);
      if (phase !== 'done') setPhase('idle', 'Five red lights');
    },
    key(key, repeat) {
      if (key !== ' ' && key !== 'Enter') return false;
      if (!repeat) pounce();
      return true;
    },
  };
}
