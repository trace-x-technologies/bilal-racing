/**
 * The shell every arcade game runs in (markup: components/games/Cabinet.astro).
 * It owns the round: start overlay → playing → result overlay, the HUD, the
 * keyboard, filing the score on the board, and stopping the game when the tab
 * is hidden or the cabinet scrolls out of view. A game only has to implement
 * start() / stop() and call cab.finish(value, line) when the round is over.
 */
import { sound, type PlayOptions, type SfxName } from '@/scripts/audio';
import { emit } from '@/scripts/bus';
import { prefersReducedMotion } from '@/scripts/motion';
import { GAMES, bestOf, formatScore, getName, hasName, isGameId, isShared, onBoardChange, rankOf, submitScore, type GameId } from './board';

export interface Cabinet {
  readonly id: GameId;
  /** The play area. Games query their own markup inside it. */
  readonly stage: HTMLElement;
  /** Main HUD readout (the score or the running time). */
  score(text: string): void;
  /** Second HUD readout (time left, "6 / 9", a streak). */
  aux(text: string): void;
  /** Screen-reader announcement. */
  say(text: string): void;
  sfx(name: SfxName, opts?: PlayOptions): void;
  reduced(): boolean;
  /** The round is over: `value` is the score, `line` the sentence shown under it. */
  finish(value: number, line: string): void;
}

export interface Game {
  start(): void;
  /** Stop timers and animation frames. Must be safe to call twice. */
  stop(): void;
  /** A key was pressed during a round. Return true if the game used it. */
  key?(key: string, repeat: boolean): boolean;
}

export type GameFactory = (cab: Cabinet) => Game;

export interface CabinetHandle {
  /** The visitor switched to another game. */
  leave(): void;
}

type State = 'idle' | 'playing' | 'done';

/** A finished round ignores taps this long, so a late tap doesn't restart it. */
const RESULT_LOCK_MS = 650;

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

export function mountCabinet(root: HTMLElement, make: GameFactory): CabinetHandle | null {
  const q = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel);
  const found = { id: root.dataset.cab, stage: q('[data-cab-stage]'), goBtn: q<HTMLButtonElement>('[data-cab-go]') };
  if (!isGameId(found.id) || !found.stage || !found.goBtn) return null;
  // Plain consts, so the checks above still hold inside the functions below.
  const id: GameId = found.id;
  const stage: HTMLElement = found.stage;
  const goBtn: HTMLButtonElement = found.goBtn;

  const goLabel = q('[data-cab-go-label]');
  const shareBtn = q<HTMLButtonElement>('[data-cab-share]');
  const verdictEl = q('[data-cab-verdict]');
  const subEl = q('[data-cab-sub]');
  const badgeEl = q('[data-cab-badge]');
  const scoreEl = q('[data-cab-score]');
  const auxEl = q('[data-cab-aux]');
  const bestEl = q('[data-cab-best]');
  const liveEl = q('[data-cab-live]');

  const def = GAMES[id];
  let state: State = 'idle';
  let lockedUntil = 0;
  let inView = true;
  let lastValue: number | null = null;
  let rounds = 0;

  const setState = (next: State) => {
    state = next;
    root.dataset.state = next;
  };

  const say = (text: string) => {
    if (!liveEl) return;
    liveEl.textContent = '';
    // A changed node is what screen readers announce; the same text twice would be silent.
    window.setTimeout(() => (liveEl.textContent = text), 40);
  };

  const refreshBest = () => {
    const best = bestOf(id);
    if (!bestEl) return;
    bestEl.textContent = best == null ? '—' : formatScore(id, best);
    bestEl.toggleAttribute('data-empty', best == null);
  };

  const cab: Cabinet = {
    id,
    stage,
    score: (text) => {
      if (scoreEl) scoreEl.textContent = text;
    },
    aux: (text) => {
      if (auxEl) auxEl.textContent = text;
    },
    say,
    sfx: (name, opts) => sound.play(name, opts),
    reduced: prefersReducedMotion,
    finish: (value, line) => void finish(value, line),
  };

  const game = make(cab);

  const begin = () => {
    if (state === 'playing' || performance.now() < lockedUntil) return;
    rounds += 1;
    setState('playing');
    if (badgeEl) badgeEl.hidden = true;
    sound.play('click');
    // Keys go to the game from here on, and Space no longer presses a focused button.
    stage.focus({ preventScroll: true });
    game.start();
  };

  /** Stop a round that can't go on (tab hidden, scrolled away, another game picked). */
  const abort = (why: string) => {
    if (state !== 'playing') return;
    game.stop();
    setState('idle');
    if (verdictEl) verdictEl.textContent = def.label;
    if (subEl) subEl.textContent = why;
    if (goLabel) goLabel.textContent = 'Go again';
    if (shareBtn) shareBtn.hidden = true;
  };

  async function finish(raw: number, line: string): Promise<void> {
    if (state !== 'playing') return;
    game.stop();
    setState('done');
    lockedUntil = performance.now() + RESULT_LOCK_MS;
    const value = Math.round(raw);
    // A timed score outside the board's range (a guess, or no pounce at all) shows the game's name, not a number.
    const shown = def.dir === 'high' || (value >= def.min && value <= def.max) ? formatScore(id, value) : def.label;
    if (verdictEl) verdictEl.textContent = shown;
    if (goLabel) goLabel.textContent = 'Go again';

    // The verdict shows at once; where the score landed follows when the tower has answered.
    const text = def.dir === 'low' && value < def.min ? 'Quicker than the timing beam can see. Go again for an official time.' : line;
    if (subEl) subEl.textContent = text;
    if (shareBtn) shareBtn.hidden = true;

    const round = ++rounds;
    const result = await submitScore(id, getName(), value);
    // The tower can take a moment; if the next round has already started, this one is history.
    if (round !== rounds) return;
    lastValue = result ? value : null;
    if (shareBtn) shareBtn.hidden = !result;

    let note = '';
    if (result) {
      const place = result.rank ? `P${result.rank} on the ${isShared() ? 'timing tower' : 'tower on this device'}` : '';
      if (!result.improved) note = `Your best stays ${formatScore(id, result.best)}${place ? `, ${place}` : ''}.`;
      else if (result.shared) note = `${place}.`;
      else if (result.problem) note = result.problem;
      else if (!isShared()) note = `${place}.`;
      else if (!hasName()) note = 'Add your name above to put it on the timing tower.';
      else note = 'Saved on this device. Save your name again to join the timing tower.';
      if (badgeEl) {
        badgeEl.textContent = result.shared && rankOf(id) === 1 ? 'P1' : 'New best';
        badgeEl.hidden = !result.improved;
      }
      sound.play(result.improved ? 'revMeow' : 'meow');
    }
    if (subEl && note) subEl.textContent = `${text} ${note}`;
    say(`${shown}. ${text} ${result?.improved ? 'New best. ' : ''}${note}`);

    window.setTimeout(() => {
      // Hand focus back so Enter plays again, unless the visitor has moved on.
      const active = document.activeElement;
      if (state === 'done' && !root.hidden && (active === stage || active === document.body)) {
        goBtn.focus({ preventScroll: true });
      }
    }, RESULT_LOCK_MS);
  }

  goBtn.addEventListener('click', begin);

  shareBtn?.addEventListener('click', async () => {
    if (lastValue == null) return;
    sound.play('click');
    const url = `${location.origin}${location.pathname}#${id}`;
    const text = `I ${def.brag(formatScore(id, lastValue))} on Bilal Racing's arcade. Beat that, machan 🐾`;
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: `Bilal Racing — ${def.label}`, text, url });
        emit('bilal:toast', { message: 'Result sent. The group chat will be impressed.', tone: 'gold' });
        return;
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      emit('bilal:toast', { message: 'Copied! Paste it in the group chat, machan.', tone: 'gold' });
    } catch {
      emit('bilal:toast', { message: 'Screenshot it and share the glory.', tone: 'gold' });
    }
  });

  window.addEventListener('keydown', (event) => {
    if (root.hidden || !inView || event.defaultPrevented || event.isComposing) return;
    if (event.ctrlKey || event.metaKey || event.altKey || isTyping(event.target)) return;
    if (state === 'playing') {
      if (event.key === 'Escape') abort('Round stopped. Start again when you are ready.');
      else if (game.key?.(event.key, event.repeat)) event.preventDefault();
      return;
    }
    if (event.repeat || (event.key !== ' ' && event.key !== 'Enter')) return;
    // Only when nothing else has focus: a focused button or link keeps its own Space / Enter.
    const t = event.target;
    if (t !== document.body && t !== document.documentElement && t !== stage) return;
    event.preventDefault();
    begin();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) abort('Welcome back. Start again when you are ready.');
  });

  new IntersectionObserver(([entry]) => {
    inView = entry?.isIntersecting ?? true;
    if (!inView) abort('Round stopped. Start again when you are ready.');
  }).observe(stage);

  onBoardChange(refreshBest);
  refreshBest();

  return { leave: () => abort(`${def.label} is ready when you are.`) };
}
