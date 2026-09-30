/**
 * Self-imposed budget for everything friends can write. The Cloudflare account is
 * shared with other projects and sits on the free plan (R2: 10 GB stored and
 * 1M writes a month; D1: 100k rows written a day; Workers: 100k requests a day),
 * so these caps sit far below the real limits. When one is hit, uploads close
 * and the site says so instead of failing.
 */
export const LIMITS = {
  /** One gallery photo, after the browser has resized it. */
  photoBytes: 1_500_000,
  /** Longest edge of a gallery photo, in pixels. */
  photoEdge: 2000,
  /** One crew face (square crop). */
  faceBytes: 300_000,
  faceEdge: 480,
  /** Everything stored in the bucket, photos + faces. */
  totalBytes: 1_000_000_000,
  totalPhotos: 400,
  /** Uploads per day: whole site / one device. */
  uploadsPerDay: 120,
  uploadsPerDevicePerDay: 20,
  /** Scores posted per day, every game together: whole site / one device. (Valid ranges: src/data/games.ts.) */
  scoresPerDay: 3000,
  scoresPerDevicePerDay: 300,
  /** Wrong passcodes per device per day. */
  passTriesPerDay: 20,
  /** Rows shown on each game's table. */
  boardRows: 25,
  /** Text lengths. */
  nameLen: 24,
  captionLen: 120,
} as const;
