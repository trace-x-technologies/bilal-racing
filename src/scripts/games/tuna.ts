/**
 * Tuna Run — a 45-second stint on a three-lane road. Catering has dropped the
 * tuna on the racing line: drive over every can. Gold cans count three. Nine
 * cans in a row earn a nine-lives bonus. A puddle only ends the row you were
 * on (cats and water); nothing is ever taken away, and the stint always
 * finishes.
 *
 * Distances are fractions of the road height, so the round survives a resize.
 * Touch / mouse: tap a lane. Keyboard: ← →.
 */
import type { Cabinet, Game } from './cabinet';

const STINT_S = 45;
const LANES = 3;
/** Road heights per second at the start and at the end of the stint. */
const SPEED_FROM = 0.55;
const SPEED_TO = 1.05;
/** Distance between rows of items. */
const ROW_GAP = 0.3;
/** Where the car sits, and how close an item must be to count. */
const CAR_Y = 0.84;
const REACH = 0.07;
const STREAK_BONUS = 9;

type Kind = 'tuna' | 'gold' | 'puddle';

interface Item {
  el: HTMLElement;
  lane: number;
  y: number;
  kind: Kind;
  live: boolean;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function verdict(score: number): string {
  if (score === 0) return 'Stint complete. The tuna is still out there, and the owner is still peckish.';
  if (score >= 120) return 'The catering truck is empty. The owner is full.';
  if (score >= 70) return 'A tuna haul fit for champions. The owner saved you a box.';
  return 'Stint complete. Every can goes straight to the owner.';
}

export default function tunaRun(cab: Cabinet): Game {
  const stage = cab.stage;
  const road = stage.querySelector<HTMLElement>('[data-tn-road]');
  const lines = stage.querySelector<HTMLElement>('[data-tn-lines]');
  const car = stage.querySelector<HTMLElement>('[data-tn-car]');
  const pop = stage.querySelector<HTMLElement>('[data-tn-pop]');
  const items: Item[] = [...stage.querySelectorAll<HTMLElement>('[data-tn-item]')].map((el) => ({
    el,
    lane: 0,
    y: 0,
    kind: 'tuna',
    live: false,
  }));
  if (!road || !car || items.length < 12) return { start() {}, stop() {} };

  let roadW = 0;
  let roadH = 0;
  let laneW = 0;
  /** The lane dashes repeat every 3rem (see .tn-lines). */
  let dashPx = 48;
  let lane = 1;
  let score = 0;
  let streak = 0;
  let elapsed = 0;
  let travel = 0;
  let nextRow = 0;
  let shownLeft = -1;
  let running = false;
  let raf = 0;
  let last = 0;
  let popAnim: Animation | null = null;

  const place = (el: HTMLElement, atLane: number, y: number) => {
    el.style.transform = `translate3d(${atLane * laneW}px, ${y * roadH - laneW / 2}px, 0)`;
  };

  const layout = () => {
    roadW = road.clientWidth;
    roadH = road.clientHeight;
    laneW = roadW / LANES;
    dashPx = parseFloat(getComputedStyle(document.documentElement).fontSize) * 3 || 48;
    place(car, lane, CAR_Y);
    items.forEach((it) => it.live && place(it.el, it.lane, it.y));
  };

  const setLane = (next: number) => {
    lane = clamp(next, 0, LANES - 1);
    place(car, lane, CAR_Y);
  };

  const put = (atLane: number, y: number, kind: Kind) => {
    const it = items.find((i) => !i.live);
    if (!it) return;
    it.lane = atLane;
    it.y = y;
    it.kind = kind;
    it.live = true;
    it.el.dataset.kind = kind;
    it.el.hidden = false;
    place(it.el, atLane, y);
  };

  const retire = (it: Item) => {
    it.live = false;
    it.el.hidden = true;
  };

  /** A row always has a can, so a perfect stint is possible; sometimes a puddle sits beside it. */
  const spawnRow = () => {
    const tunaLane = Math.floor(Math.random() * LANES);
    put(tunaLane, -0.1, Math.random() < 0.07 ? 'gold' : 'tuna');
    if (Math.random() < 0.4) {
      const other = (tunaLane + 1 + Math.floor(Math.random() * (LANES - 1))) % LANES;
      put(other, -0.1, 'puddle');
    }
  };

  const flash = (text: string) => {
    if (!pop) return;
    pop.textContent = text;
    pop.hidden = false;
    place(pop, lane, CAR_Y - 0.12);
    // cancel() skips onfinish, so an older flash can't hide the newer one.
    popAnim?.cancel();
    popAnim = pop.animate(
      cab.reduced() ? [{ opacity: 1 }, { opacity: 1 }] : [{ opacity: 1, translate: '0 0' }, { opacity: 0, translate: '0 -2.5rem' }],
      { duration: 650, easing: 'ease-out' },
    );
    popAnim.onfinish = () => (pop.hidden = true);
  };

  const collect = (it: Item) => {
    retire(it);
    if (it.kind === 'puddle') {
      streak = 0;
      cab.sfx('whoosh', { volume: 0.5 });
      flash('Splash');
      return;
    }
    let gain = it.kind === 'gold' ? 3 : 1;
    streak += 1;
    if (streak % STREAK_BONUS === 0) {
      gain += 3;
      cab.sfx('purr');
      flash(`9 in a row +${gain}`);
    } else {
      cab.sfx('click', { pitch: 1 + (streak % STREAK_BONUS) * 0.06 });
      flash(`+${gain}`);
    }
    score += gain;
    cab.score(String(score));
  };

  const frame = (now: number) => {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    elapsed += dt;
    const left = STINT_S - elapsed;
    if (left <= 0) {
      running = false;
      cab.aux('0 s');
      cab.finish(score, verdict(score));
      return;
    }
    const step = (SPEED_FROM + (SPEED_TO - SPEED_FROM) * (elapsed / STINT_S)) * dt;
    travel += step;
    while (travel >= nextRow) {
      spawnRow();
      nextRow += ROW_GAP;
    }
    for (const it of items) {
      if (!it.live) continue;
      it.y += step;
      if (it.lane === lane && Math.abs(it.y - CAR_Y) < REACH) collect(it);
      else if (it.y > 1.15) retire(it);
      else place(it.el, it.lane, it.y);
    }
    if (lines && !cab.reduced()) lines.style.transform = `translate3d(0, ${(travel * roadH) % dashPx}px, 0)`;
    const whole = Math.ceil(left);
    if (whole !== shownLeft) {
      shownLeft = whole;
      cab.aux(`${whole} s`);
      if (whole === 10) cab.say('Ten seconds left.');
    }
    raf = requestAnimationFrame(frame);
  };

  /** Shown behind the start overlay: the car lined up behind a few cans. */
  const poster = () => {
    items.forEach(retire);
    lane = 1;
    layout();
    put(1, 0.5, 'tuna');
    put(0, 0.3, 'gold');
    put(2, 0.36, 'puddle');
    put(1, 0.12, 'tuna');
  };

  stage.addEventListener('pointerdown', (event) => {
    if (!running || event.button !== 0 || laneW === 0) return;
    const x = event.clientX - road.getBoundingClientRect().left;
    setLane(Math.floor(x / laneW));
  });
  new ResizeObserver(layout).observe(road);
  poster();

  return {
    start() {
      items.forEach(retire);
      score = 0;
      streak = 0;
      elapsed = 0;
      travel = 0;
      nextRow = 0;
      shownLeft = -1;
      lane = 1;
      layout();
      cab.score('0');
      cab.aux(`${STINT_S} s`);
      cab.say('Stint started. Left and right arrows change lane.');
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
    },
    key(key, repeat) {
      if (key === 'ArrowLeft' || key === 'ArrowRight') {
        if (!repeat) setLane(lane + (key === 'ArrowLeft' ? -1 : 1));
        return true;
      }
      // Up / Down / Space would scroll the page mid-stint.
      return key === 'ArrowUp' || key === 'ArrowDown' || key === ' ';
    },
  };
}
