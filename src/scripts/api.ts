/**
 * Client for the site's own API (worker/index.ts): leaderboard, photo wall,
 * crew seats. Reading is open; writing needs the shared team passcode, which
 * the PassGate dialog swaps for a cookie.
 *
 *   const { rows } = await api<{ rows: Row[] }>('leaderboard');
 *   if (await ensurePass()) await postJson('leaderboard', { name, ms });
 *
 * On a plain static preview (`astro preview`) there is no API: every call
 * rejects with an ApiError and the callers show their quiet "offline" state.
 */
import { emit, store } from './bus';

export type PassRole = 'none' | 'team' | 'admin';

export interface ApiStatus {
  pass: PassRole;
  /** False until the team passcode secret exists on the server. */
  configured: boolean;
  uploads: { open: boolean; reason: string | null; message: string | null };
  limits: {
    photoBytes: number;
    photoEdge: number;
    faceBytes: number;
    faceEdge: number;
    nameLen: number;
    captionLen: number;
  };
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/${path}`, {
      credentials: 'same-origin',
      ...init,
      headers: { accept: 'application/json', ...init.headers },
    });
  } catch {
    throw new ApiError(0, 'offline', 'No signal from race control. Check your connection and try again.');
  }
  const data = (await res.json().catch(() => null)) as (T & { error?: string; message?: string }) | null;
  if (!res.ok || data == null) {
    throw new ApiError(res.status, data?.error ?? 'service', data?.message ?? 'Race control lost the signal. Try again in a moment.');
  }
  return data;
}

export const postJson = <T>(path: string, body: unknown): Promise<T> =>
  api<T>(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

/* ---------------- status (who am I, are uploads open) ---------------- */

let statusPromise: Promise<ApiStatus> | null = null;

/** Cached for the page view; pass `fresh` after something changed (upload, passcode). */
export function getStatus(fresh = false): Promise<ApiStatus> {
  if (fresh || !statusPromise) {
    statusPromise = api<ApiStatus>('status').catch((err) => {
      statusPromise = null;
      throw err;
    });
  }
  return statusPromise;
}

/* ---------------- paddock pass ---------------- */

type Opener = (why?: string) => Promise<PassRole>;
let opener: Opener | null = null;

/** The PassGate component registers its dialog here. */
export function registerPassGate(open: Opener): void {
  opener = open;
}

/** Open the passcode dialog (e.g. a steward signing in). Resolves with the role held afterwards. */
export async function openPassGate(why?: string): Promise<PassRole> {
  return opener ? opener(why) : 'none';
}

/** Called by the PassGate once the server has accepted a passcode. */
export function passGranted(role: PassRole): void {
  statusPromise = null;
  emit('bilal:pass', { role });
}

/** True once this device holds a paddock pass, asking for the passcode if it doesn't yet. */
export async function ensurePass(why?: string): Promise<boolean> {
  const status = await getStatus().catch(() => null);
  if (status && status.pass !== 'none') return true;
  return (await openPassGate(why)) !== 'none';
}

/**
 * Run a write. If the server says the pass is missing (cookie expired, passcode
 * changed), ask for the passcode and try once more.
 */
export async function withPass<T>(run: () => Promise<T>, why?: string): Promise<T> {
  try {
    return await run();
  } catch (err) {
    if (!(err instanceof ApiError) || err.code !== 'pass') throw err;
    statusPromise = null;
    if ((await openPassGate(why)) === 'none') throw err;
    return run();
  }
}

/* ---------------- who is this (leaderboard name, photo credit) ---------------- */

export const getMe = (): string => {
  const v = store.get<unknown>('me', '');
  return typeof v === 'string' ? v : '';
};
export const setMe = (name: string): void => store.set('me', name.trim());
