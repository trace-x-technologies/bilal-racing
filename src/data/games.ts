/**
 * Score rules for every game on the shared leaderboard. The browser
 * (scripts/games/board.ts, the Lights Out leaderboard) and the Worker
 * (worker/index.ts) both read this, so they agree on what a valid score is and
 * on which way round a table is sorted.
 */
export type ScoreGame = 'lights' | 'box' | 'pit' | 'laser' | 'tuna';

export interface ScoreRule {
  /** 'low' = a time in ms, fastest wins. 'high' = a count, biggest wins. */
  dir: 'low' | 'high';
  /** A score outside min..max never reaches the board. */
  min: number;
  max: number;
}

export const SCORE_RULES: Record<ScoreGame, ScoreRule> = {
  // Lights Out: under 100 ms is anticipation (the game doesn't count it), over 6 s is no launch.
  lights: { dir: 'low', min: 100, max: 6000 },
  // Box, Box, Box: boxes stacked.
  box: { dir: 'high', min: 1, max: 500 },
  // Pit Stop Paws: four lit nuts can't be hit in under 0.6 s.
  pit: { dir: 'low', min: 600, max: 20_000 },
  // Laser Pounce: nine catches can't be landed in under 1.8 s.
  laser: { dir: 'low', min: 1800, max: 60_000 },
  // Tuna Run: a perfect 45-second stint of nothing but gold cans stays under 400.
  tuna: { dir: 'high', min: 1, max: 400 },
};

export const GAME_LABELS: Record<ScoreGame, string> = {
  lights: 'Lights Out',
  box: 'Box, Box, Box',
  pit: 'Pit Stop Paws',
  laser: 'Laser Pounce',
  tuna: 'Tuna Run',
};

export const SCORE_GAMES = Object.keys(SCORE_RULES) as ScoreGame[];

export const isScoreGame = (v: unknown): v is ScoreGame => typeof v === 'string' && Object.hasOwn(SCORE_RULES, v);

/** F1 points for P1…P10 on each game's table; the championship adds them up. */
export const POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1] as const;
