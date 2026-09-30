/**
 * Box, Box, Box — a one-tap stacker. A box slides across the top of the tower;
 * tap to drop it. Whatever hangs over the edge is sliced off, so the tower gets
 * narrower. Every ninth box is gold and brings the full width back (nine lives).
 * The round ends when a box lands on nothing: the owner claims the tower.
 *
 * Positions and widths are fractions of the stage width, so a resize mid-round
 * only re-lays the tower. Only `transform` changes per frame.
 */
import type { Cabinet, Game } from './cabinet';

const BASE_W = 0.46;
/** Gap kept between a sliding box and the stage walls. */
const EDGE = 0.03;
/** Closer than this to dead-centre counts as a perfect drop: nothing is sliced. */
const PERFECT = 0.015;
const MIN_OVERLAP = 0.006;
const GOLD_EVERY = 9;

interface Slab {
  x: number;
  w: number;
  gold: boolean;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function verdict(count: number): string {
  if (count === 0) return 'The owner sat in that box before it landed. Fair enough.';
  if (count < 5) return 'The owner has moved in. Cosy.';
  if (count < GOLD_EVERY) return 'A proper cat tower. The owner approves.';
  if (count < GOLD_EVERY * 2) return 'Penthouse office. The owner is purring.';
  return 'Tallest tower in the paddock. The owner can see the whole grid.';
}

export default function boxStack(cab: Cabinet): Game {
  const stage = cab.stage;
  const world = stage.querySelector<HTMLElement>('[data-bx-world]');
  const pool = [...stage.querySelectorAll<HTMLElement>('[data-bx-box]')];
  const chip = stage.querySelector<HTMLElement>('[data-bx-chip]');
  const cat = stage.querySelector<HTMLElement>('[data-bx-cat]');
  if (!world || pool.length < 12) return { start() {}, stop() {} };

  let width = 0;
  let height = 0;
  let boxH = 32;
  /** Placed boxes; index = level, 0 = the base on the ground. */
  let stack: Slab[] = [];
  let cur: Slab = { x: 0, w: BASE_W, gold: false };
  let dir = 1;
  let speed = 0.5;
  let running = false;
  let raf = 0;
  let last = 0;
  let endTimer = 0;

  const node = (level: number) => pool[level % pool.length];
  const at = (x: number, level: number) => `translate3d(${x * width}px, ${-level * boxH}px, 0)`;

  const draw = (level: number, slab: Slab) => {
    const el = node(level);
    if (!el) return;
    el.hidden = false;
    el.style.width = `${slab.w * width}px`;
    el.style.transform = at(slab.x, level);
    el.toggleAttribute('data-gold', slab.gold);
  };

  /** Keep the sliding box a few rows below the top of the stage. */
  const camera = () => {
    const keep = Math.max(3, Math.floor(height / boxH) - 5);
    world.style.transform = `translate3d(0, ${Math.max(0, stack.length - keep) * boxH}px, 0)`;
  };

  const seatCat = () => {
    const top = stack[stack.length - 1];
    if (!cat || !top) return;
    cat.hidden = false;
    // The cat is 1.9 boxes wide (see .bx-cat) and sits centred on the top box.
    cat.style.transform = `translate3d(${(top.x + top.w / 2) * width - boxH * 0.95}px, ${-stack.length * boxH}px, 0)`;
  };

  const layout = () => {
    width = stage.clientWidth;
    height = stage.clientHeight;
    boxH = Math.round(clamp(height / 11, 26, 44));
    world.style.setProperty('--bx-h', `${boxH}px`);
    const from = Math.max(0, stack.length - pool.length + 1);
    for (let level = from; level < stack.length; level++) draw(level, stack[level]!);
    if (running) draw(stack.length, cur);
    else if (cat && !cat.hidden) seatCat();
    camera();
  };

  const clear = () => {
    pool.forEach((el) => (el.hidden = true));
    if (chip) chip.hidden = true;
    if (cat) cat.hidden = true;
  };

  const hud = () => {
    const count = stack.length - 1;
    cab.score(String(count));
    cab.aux(String(GOLD_EVERY - (count % GOLD_EVERY)));
  };

  const spawn = () => {
    const prev = stack[stack.length - 1]!;
    dir = stack.length % 2 ? 1 : -1;
    cur = { x: dir > 0 ? EDGE : 1 - EDGE - prev.w, w: prev.w, gold: false };
    speed = Math.min(0.5 + stack.length * 0.028, 1.45);
    draw(stack.length, cur);
    camera();
  };

  /** The sliced-off piece tumbles away. */
  const shed = (level: number, x: number, w: number, side: number) => {
    if (!chip || cab.reduced() || w * width < 2) return;
    chip.hidden = false;
    chip.style.width = `${w * width}px`;
    chip.animate(
      [
        { transform: at(x, level), opacity: 1 },
        { transform: `${at(x + side * 0.05, level - 4)} rotate(${side * 18}deg)`, opacity: 0 },
      ],
      { duration: 520, easing: 'cubic-bezier(0.5, 0, 0.9, 0.5)', fill: 'forwards' },
    );
  };

  const miss = () => {
    running = false;
    cancelAnimationFrame(raf);
    const level = stack.length;
    const el = node(level);
    if (el && !cab.reduced()) {
      el.animate([{ transform: at(cur.x, level) }, { transform: `${at(cur.x, level - 5)} rotate(${dir * 14}deg)`, opacity: 0 }], {
        duration: 480,
        easing: 'cubic-bezier(0.5, 0, 0.9, 0.5)',
      }).onfinish = () => (el.hidden = true);
    } else if (el) el.hidden = true;
    seatCat();
    const count = stack.length - 1;
    endTimer = window.setTimeout(() => cab.finish(count, verdict(count)), cab.reduced() ? 250 : 700);
  };

  const drop = () => {
    if (!running) return;
    const prev = stack[stack.length - 1]!;
    const left = Math.max(cur.x, prev.x);
    const right = Math.min(cur.x + cur.w, prev.x + prev.w);
    if (right - left < MIN_OVERLAP) return miss();

    const level = stack.length;
    const perfect = Math.abs(cur.x - prev.x) <= PERFECT;
    let slab: Slab = perfect ? { ...prev, gold: false } : { x: left, w: right - left, gold: false };
    if (!perfect) {
      const overLeft = cur.x < left;
      shed(level, overLeft ? cur.x : right, cur.w - slab.w, overLeft ? -1 : 1);
    }
    if (level % GOLD_EVERY === 0) {
      // Nine lives: a fresh full-width box, centred on the one that just landed.
      const mid = slab.x + slab.w / 2;
      slab = { x: clamp(mid - BASE_W / 2, EDGE, 1 - EDGE - BASE_W), w: BASE_W, gold: true };
    }
    stack.push(slab);
    draw(level, slab);
    hud();

    if (slab.gold) {
      cab.sfx('purr');
      cab.say(`Gold box. ${level} stacked, full width again.`);
    } else if (perfect) cab.sfx('beep', { pitch: 1.2, volume: 0.6 });
    else cab.sfx('click', { pitch: 1 + Math.min(level, 24) * 0.03 });
    spawn();
  };

  const frame = (now: number) => {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const max = 1 - EDGE - cur.w;
    cur.x += dir * speed * dt;
    if (cur.x <= EDGE) {
      cur.x = EDGE;
      dir = 1;
    } else if (cur.x >= max) {
      cur.x = max;
      dir = -1;
    }
    const el = node(stack.length);
    if (el) el.style.transform = at(cur.x, stack.length);
    raf = requestAnimationFrame(frame);
  };

  /** Shown behind the start overlay: a small tower with the owner already on it. */
  const poster = () => {
    stack = [
      { x: (1 - BASE_W) / 2, w: BASE_W, gold: false },
      { x: 0.31, w: 0.4, gold: false },
      { x: 0.33, w: 0.34, gold: false },
      { x: 0.33, w: 0.3, gold: false },
    ];
    layout();
    seatCat();
  };

  stage.addEventListener('pointerdown', (event) => {
    if (event.button === 0) drop();
  });
  new ResizeObserver(layout).observe(stage);
  poster();

  return {
    start() {
      clear();
      stack = [{ x: (1 - BASE_W) / 2, w: BASE_W, gold: false }];
      running = true;
      layout();
      hud();
      spawn();
      last = performance.now();
      raf = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
      window.clearTimeout(endTimer);
    },
    key(key, repeat) {
      if (key !== ' ' && key !== 'Enter' && key !== 'ArrowDown') return false;
      if (!repeat) drop();
      return true;
    },
  };
}
