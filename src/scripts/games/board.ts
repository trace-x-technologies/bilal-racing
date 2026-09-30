/**
 * Arcade scores and the timing tower's data.
 *
 * Two layers:
 *  - This device (localStorage): every player's best per game. Always written,
 *    so a round counts at once, offline too, and friends can pass one phone round.
 *  - The shared tower (site API, worker/index.ts): one best per name per game for
 *    the whole crew, Lights Out included. A new best is posted once the player
 *    has a name and this device holds a paddock pass.
 *
 * When the API is away (plain `astro preview`, no signal) the tower simply shows
 * this device's scores. The championship is F1 points for each table's order.
 *
 * Browser only (it listens on window): Astro frontmatter reads data/games.ts instead.
 */
import { ApiError, api, getMe, getStatus, openPassGate, postJson, setMe, withPass, type PassRole } from '@/scripts/api';
import { on, store } from '@/scripts/bus';
import { GAME_LABELS, POINTS, SCORE_GAMES, SCORE_RULES, type ScoreGame } from '@/data/games';

/** The four arcade games. Lights Out (on the Race page) shares the tower but has no cabinet here. */
export type GameId = Exclude<ScoreGame, 'lights'>;
export type { ScoreGame };

export interface GameDef {
  id: GameId;
  label: string;
  /** 'low' = a time in ms, fastest wins. 'high' = a count, biggest wins. */
  dir: 'low' | 'high';
  min: number;
  max: number;
  /** The boast in a shared result: "I <brag> on Bilal Racing's arcade." */
  brag: (score: string) => string;
}

export const GAMES: Record<GameId, GameDef> = {
  box: { id: 'box', label: GAME_LABELS.box, ...SCORE_RULES.box, brag: (s) => `stacked ${s}` },
  pit: { id: 'pit', label: GAME_LABELS.pit, ...SCORE_RULES.pit, brag: (s) => `changed four wheels in ${s}` },
  laser: { id: 'laser', label: GAME_LABELS.laser, ...SCORE_RULES.laser, brag: (s) => `landed nine pounces in ${s}` },
  tuna: { id: 'tuna', label: GAME_LABELS.tuna, ...SCORE_RULES.tuna, brag: (s) => `collected ${s} in one stint` },
};

export const GAME_IDS = Object.keys(GAMES) as GameId[];
/** Every table on the tower, Lights Out first. */
export const TOWER_GAMES = SCORE_GAMES;
export const LABELS = GAME_LABELS;
/** Word after a count; "box" / "boxes" is the only one that changes. */
const UNITS: Partial<Record<ScoreGame, [one: string, many: string]>> = { box: ['box', 'boxes'], tuna: ['tuna', 'tuna'] };

export { POINTS };

export const isGameId = (v: unknown): v is GameId => typeof v === 'string' && Object.hasOwn(GAMES, v);

export function formatScore(game: ScoreGame, value: number): string {
  if (SCORE_RULES[game].dir === 'low') return `${(value / 1000).toFixed(3)} s`;
  const unit = UNITS[game];
  return unit ? `${value} ${value === 1 ? unit[0] : unit[1]}` : String(value);
}

const better = (game: ScoreGame, a: number, b: number) => (SCORE_RULES[game].dir === 'low' ? a < b : a > b);

/* ------------------------------------------------------------------ who is playing */

export const NAME_LEN = 24;
/** Scores set before anyone typed a name. Typing one claims them. */
export const GUEST = 'Guest';
const BOARD_KEY = 'arcade-board';

/** Trim, collapse whitespace, drop control and bidi-override characters, cap the length. */
export function cleanName(value: unknown): string {
  if (typeof value !== 'string') return '';
  const flat = value
    .normalize('NFC')
    .replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩﻿]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return [...flat].slice(0, NAME_LEN).join('').trim();
}

const keyOf = (name: string) => name.toLowerCase();

/** The name scores are filed under right now: the site-wide one (api.ts getMe), or Guest. */
export function getName(): string {
  return cleanName(getMe()) || GUEST;
}

/** True once the visitor has typed a name of their own. */
export const hasName = (): boolean => getName() !== GUEST;

export function setName(value: string): string {
  const next = cleanName(value);
  const prev = getName();
  setMe(next);
  // First real name on this device: the Guest scores were theirs all along.
  if (next && prev === GUEST && keyOf(next) !== keyOf(GUEST)) adopt(GUEST, next);
  notify(null);
  return next || GUEST;
}

/* ------------------------------------------------------------------ this device */

export interface Row {
  /** Row id on the shared tower (stewards remove by it). Device rows have none. */
  id?: number;
  name: string;
  value: number;
  tries: number;
  /** When the best was set (ms since epoch); earlier wins a tie. */
  at: number;
}

type Boards = Record<GameId, Row[]>;

function sortRows(game: ScoreGame, rows: Row[]): Row[] {
  const sign = SCORE_RULES[game].dir === 'low' ? 1 : -1;
  return rows.sort((a, b) => sign * (a.value - b.value) || a.at - b.at);
}

function isRow(game: ScoreGame, r: unknown): r is Row {
  if (typeof r !== 'object' || r == null) return false;
  const { name, value, tries, at } = r as Record<string, unknown>;
  const rule = SCORE_RULES[game];
  return (
    typeof name === 'string' &&
    name !== '' &&
    cleanName(name) === name &&
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= rule.min &&
    value <= rule.max &&
    typeof tries === 'number' &&
    typeof at === 'number'
  );
}

function readLocal(): Boards {
  const raw = store.get<unknown>(BOARD_KEY, null);
  const saved = (typeof raw === 'object' && raw != null ? raw : {}) as Record<string, unknown>;
  const boards = {} as Boards;
  for (const game of GAME_IDS) {
    const rows = Array.isArray(saved[game]) ? (saved[game] as unknown[]) : [];
    boards[game] = sortRows(
      game,
      rows.filter((r): r is Row => isRow(game, r)),
    );
  }
  return boards;
}

const writeLocal = (boards: Boards) => store.set(BOARD_KEY, boards);

/** Move one player's rows to another name, keeping the better score where both have one. */
function adopt(from: string, to: string): void {
  const boards = readLocal();
  let moved = false;
  for (const game of GAME_IDS) {
    const rows = boards[game];
    const old = rows.find((r) => keyOf(r.name) === keyOf(from));
    if (!old) continue;
    moved = true;
    const mine = rows.find((r) => keyOf(r.name) === keyOf(to));
    if (!mine) {
      old.name = to;
      continue;
    }
    if (better(game, old.value, mine.value)) {
      mine.value = old.value;
      mine.at = old.at;
    }
    mine.tries += old.tries;
    rows.splice(rows.indexOf(old), 1);
  }
  if (moved) writeLocal(boards);
}

/** Wipe every arcade score on this device (the shared tower is untouched). */
export function clearDevice(): void {
  store.set(BOARD_KEY, null);
  notify(null);
}

/* ------------------------------------------------------------------ change events */

type Listener = (game: ScoreGame | null) => void;
const listeners = new Set<Listener>();

/** Called after a score lands (with its game), and after a name change, a refresh or a clear (with null). */
export function onBoardChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(game: ScoreGame | null): void {
  listeners.forEach((l) => l(game));
}

/* ------------------------------------------------------------------ the shared tower */

/** Last copy of the shared tables; null until the API has answered once. */
let shared: Record<ScoreGame, Row[]> | null = null;
let role: PassRole = 'none';

/** True when the tower shows the whole crew's scores, false when it shows this device's. */
export const isShared = (): boolean => shared != null;
/** 'admin' = a steward is signed in on this device and may remove rows. */
export const passRole = (): PassRole => role;

on('bilal:pass', (detail) => {
  role = detail?.role ?? 'none';
  notify(null);
});

/** Fetch every table from the API. Resolves false when it can't be reached (the last copy is kept). */
export async function refreshBoards(): Promise<boolean> {
  try {
    const data = await api<{ boards?: Partial<Record<ScoreGame, unknown>> }>('leaderboard?game=all');
    const next = {} as Record<ScoreGame, Row[]>;
    for (const game of TOWER_GAMES) {
      const rows = data.boards?.[game];
      next[game] = Array.isArray(rows) ? rows.filter((r): r is Row => isRow(game, r)) : [];
    }
    shared = next;
    role = await getStatus()
      .then((s) => s.pass)
      .catch(() => role);
    notify(null);
    return true;
  } catch {
    return false;
  }
}

/** One game's table, best first. */
export function boardRows(game: ScoreGame): Row[] {
  if (shared) return shared[game];
  return game === 'lights' ? [] : readLocal()[game];
}

export interface Standing {
  name: string;
  points: number;
  wins: number;
  /** Finishing position in each game played. */
  places: Partial<Record<ScoreGame, number>>;
}

/** The championship: points from every table, most first; wins break a tie. */
export function standings(): Standing[] {
  const table = new Map<string, Standing>();
  for (const game of TOWER_GAMES) {
    boardRows(game).forEach((row, i) => {
      const key = keyOf(row.name);
      const entry = table.get(key) ?? { name: row.name, points: 0, wins: 0, places: {} };
      entry.points += POINTS[i] ?? 0;
      if (i === 0) entry.wins += 1;
      entry.places[game] = i + 1;
      table.set(key, entry);
    });
  }
  return [...table.values()].sort((a, b) => b.points - a.points || b.wins - a.wins || a.name.localeCompare(b.name));
}

const find = (rows: Row[], name: string) => rows.find((r) => keyOf(r.name) === keyOf(name));

/** The player's best: this device's, or the shared tower's if that one is better (set on another phone). */
export function bestOf(game: GameId, name = getName()): number | null {
  const here = find(readLocal()[game], name)?.value ?? null;
  const there = shared ? (find(shared[game], name)?.value ?? null) : null;
  if (here == null || there == null) return here ?? there;
  return better(game, there, here) ? there : here;
}

/** Position on the table the tower is showing, 1 = top; null when the player isn't on it. */
export function rankOf(game: ScoreGame, name = getName()): number | null {
  const i = boardRows(game).findIndex((r) => keyOf(r.name) === keyOf(name));
  return i < 0 ? null : i + 1;
}

/** Steward only: take a row off the shared tower. */
export async function removeRow(id: number): Promise<void> {
  await api(`leaderboard/${id}`, { method: 'DELETE' });
  await refreshBoards();
}

/* ------------------------------------------------------------------ posting */

const WHY = 'The timing tower is for the crew.';

interface Posted {
  best: number;
  rank: number;
}

const post = (game: GameId, name: string, value: number) =>
  withPass(() => postJson<Posted>('leaderboard', { game, name, value }), WHY);

/** True when this device may post: the API answers and a paddock pass is held. Never asks for one. */
async function holdsPass(): Promise<boolean> {
  const status = await getStatus().catch(() => null);
  role = status?.pass ?? role;
  return status != null && status.pass !== 'none';
}

/** Post every best this device has for the player that the shared tower doesn't have yet. */
async function syncBests(name: string): Promise<void> {
  const local = readLocal();
  const jobs = GAME_IDS.flatMap((game) => {
    const mine = find(local[game], name);
    const theirs = shared ? find(shared[game], name) : undefined;
    return mine && (!theirs || better(game, mine.value, theirs.value)) ? [post(game, name, mine.value)] : [];
  });
  if (!jobs.length) return;
  await Promise.allSettled(jobs);
  await refreshBoards();
}

/** On arrival: a named player who already holds a pass gets any unsent bests posted, quietly. */
export async function syncIfJoined(): Promise<void> {
  if (hasName() && (await holdsPass())) await syncBests(getName());
}

export type JoinResult = 'shared' | 'declined' | 'device';

/**
 * The player just put a name down: get them onto the shared tower. Asks for the
 * team passcode if this device has no pass yet.
 *  'shared'   = on the tower, earlier bests posted
 *  'declined' = the passcode dialog was closed: scores stay on this device
 *  'device'   = no API to talk to (or no passcode set up yet)
 */
export async function joinTower(): Promise<JoinResult> {
  if (!hasName()) return 'device';
  const status = await getStatus().catch(() => null);
  if (!status?.configured) return 'device';
  if (status.pass === 'none' && (await openPassGate(WHY)) === 'none') return 'declined';
  await syncBests(getName());
  return 'shared';
}

export interface SubmitResult {
  name: string;
  /** The player's best after this round. */
  best: number;
  /** This round is the new best (or the first one). */
  improved: boolean;
  /** No earlier score from this player in this game, on this device. */
  first: boolean;
  /** The round went up on the shared tower. */
  shared: boolean;
  /** Position on the table the tower is showing, 1 = top. */
  rank: number | null;
  /** Why a new best did not reach the shared tower, in the API's own words. */
  problem: string | null;
}

/** File a finished round. Resolves null when the score is out of the game's range. */
export async function submitScore(game: GameId, name: string, value: number): Promise<SubmitResult | null> {
  const rule = SCORE_RULES[game];
  const who = cleanName(name) || GUEST;
  if (!Number.isInteger(value) || value < rule.min || value > rule.max) return null;

  const boards = readLocal();
  const rows = boards[game];
  const row = find(rows, who);
  const first = !row;
  const improved = !row || better(game, value, row.value);
  if (!row) rows.push({ name: who, value, tries: 1, at: Date.now() });
  else {
    row.tries += 1;
    if (improved) {
      row.value = value;
      row.at = Date.now();
    }
  }
  sortRows(game, rows);
  writeLocal(boards);

  const result: SubmitResult = { name: who, best: find(rows, who)?.value ?? value, improved, first, shared: false, rank: null, problem: null };
  if (improved && who !== GUEST && (await holdsPass())) {
    try {
      const posted = await post(game, who, value);
      result.shared = true;
      result.best = posted.best;
      result.rank = posted.rank;
      await refreshBoards();
    } catch (err) {
      // The round still counts on this device; syncIfJoined() sends it on a later visit.
      if (err instanceof ApiError && err.status !== 0) result.problem = err.message;
    }
  }
  result.rank ??= rankOf(game, who);
  notify(game);
  return result;
}
