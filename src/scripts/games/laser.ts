/**
 * Laser Pounce — the owner's favourite training tool. A red dot darts between
 * the nine cells of the garage floor; pounce on it nine times. The clock runs
 * from the first dot to the ninth pounce. A dot left alone for a moment darts
 * off again; a tap on bare floor does nothing.
 *
 * Touch / mouse: tap the dot. Keyboard: 1–9 pounce on a cell (1 = top left).
 */
import type { Cabinet, Game } from './cabinet';

const POUNCES = 9;
/** The grid sits inside this margin, as a fraction of the stage. */
const MARGIN = 0.08;
const CELL = (1 - 2 * MARGIN) / 3;
/** How far from a cell's centre the dot may land, as a fraction of the cell. */
const JITTER = 0.22;
/** An untouched dot moves on after this long. */
const DODGE_MS = 1150;
/** Forgiving hit radius in px: fingers are bigger than the dot. */
const REACH = 36;

function verdict(ms: number): string {
  if (ms < 4500) return 'Nine pounces, nine catches. The dot never stood a chance.';
  if (ms < 6500) return 'Sharp claws. The owner calls that a training record.';
  return 'Nine for nine. The dot has been thoroughly caught.';
}

export default function laserPounce(cab: Cabinet): Game {
  const stage = cab.stage;
  const dot = stage.querySelector<HTMLElement>('[data-lz-dot]');
  const paws = [...stage.querySelectorAll<HTMLElement>('[data-lz-paw]')];
  if (!dot || paws.length < POUNCES) return { start() {}, stop() {} };

  let cell = -1;
  let x = 0;
  let y = 0;
  let hits = 0;
  let t0 = 0;
  let running = false;
  let live = false;
  let raf = 0;
  let holdTimer = 0;
  let dodgeTimer = 0;

  const move = () => {
    let next = Math.floor(Math.random() * 9);
    if (next === cell) next = (next + 1 + Math.floor(Math.random() * 8)) % 9;
    cell = next;
    const jitter = () => (Math.random() * 2 - 1) * JITTER * CELL;
    x = (MARGIN + ((cell % 3) + 0.5) * CELL + jitter()) * stage.clientWidth;
    y = (MARGIN + (Math.floor(cell / 3) + 0.5) * CELL + jitter()) * stage.clientHeight;
    dot.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    window.clearTimeout(dodgeTimer);
    dodgeTimer = window.setTimeout(() => {
      if (running && live) move();
    }, DODGE_MS);
  };

  const tick = () => {
    if (!running || !live) return;
    cab.score(`${((performance.now() - t0) / 1000).toFixed(3)} s`);
    raf = requestAnimationFrame(tick);
  };

  const pounce = () => {
    const paw = paws[hits];
    if (paw) {
      paw.hidden = false;
      paw.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${Math.round(Math.random() * 50 - 25)}deg)`;
    }
    hits += 1;
    cab.aux(`${hits} / ${POUNCES}`);
    cab.sfx('click', { pitch: 1 + hits * 0.07 });
    if (hits < POUNCES) return move();

    const ms = Math.round(performance.now() - t0);
    running = false;
    cancelAnimationFrame(raf);
    window.clearTimeout(dodgeTimer);
    dot.hidden = true;
    cab.score(`${(ms / 1000).toFixed(3)} s`);
    cab.finish(ms, verdict(ms));
  };

  stage.addEventListener('pointerdown', (event) => {
    if (!running || !live || event.button !== 0) return;
    const box = stage.getBoundingClientRect();
    if (Math.hypot(event.clientX - box.left - x, event.clientY - box.top - y) <= REACH) pounce();
  });

  return {
    start() {
      hits = 0;
      cell = -1;
      live = false;
      running = true;
      paws.forEach((p) => (p.hidden = true));
      dot.hidden = true;
      cab.score('0.000 s');
      cab.aux(`0 / ${POUNCES}`);
      cab.say('Ready. The dot is coming. Keys 1 to 9 pounce on a cell, 1 is top left.');
      // A short beat to find the floor before the clock starts.
      holdTimer = window.setTimeout(() => {
        live = true;
        t0 = performance.now();
        dot.hidden = false;
        move();
        tick();
      }, 650);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
      window.clearTimeout(holdTimer);
      window.clearTimeout(dodgeTimer);
    },
    key(key, repeat) {
      if (!/^[1-9]$/.test(key)) return false;
      if (!repeat && running && live && Number(key) - 1 === cell) pounce();
      return true;
    },
  };
}
