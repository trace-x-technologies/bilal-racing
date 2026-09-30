/**
 * Bilal Racing API. The site itself is static (Astro → ./dist, served as Workers
 * static assets); this Worker only runs for /api/* (see `run_worker_first` in
 * wrangler.jsonc) and gives friends three things to write to:
 *
 *   - the Lights Out leaderboard   (D1 table `scores`)
 *   - the paddock photo wall       (R2 bucket + D1 table `photos`)
 *   - the open crew seats          (R2 bucket + D1 table `seats`)
 *
 * Reading is open. Writing needs the shared team passcode (secret TEAM_PASSCODE),
 * deleting needs the steward passcode (secret ADMIN_PASSCODE). Both are exchanged
 * once for a signed, HttpOnly cookie. Every write goes through the budget in
 * limits.ts, so the site closes uploads itself long before Cloudflare would.
 */
import { crew } from '../src/data/crew';
import { sniffImage, type ImageInfo } from './image';
import { LIMITS, SCORE_MAX_MS, SCORE_MIN_MS } from './limits';

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  PHOTOS: R2Bucket;
  /** "false" closes uploads by hand (wrangler.jsonc `vars`). */
  UPLOADS_ENABLED?: string;
  /** Secrets: `wrangler secret put TEAM_PASSCODE` / `ADMIN_PASSCODE`. */
  TEAM_PASSCODE?: string;
  ADMIN_PASSCODE?: string;
}

type Role = 'none' | 'team' | 'admin';
type ClosedReason = 'off' | 'setup' | 'full' | 'daily' | 'device' | 'service';

/** Seats a friend can claim: every role in data/crew.ts that has nobody in it. */
const OPEN_ROLES = new Set(crew.filter((r) => !r.person).map((r) => r.id));

const COOKIE = 'bilal_pass';
const COOKIE_DAYS = 180;
const MEDIA_KEY = /^(photos|crew)\/[a-z0-9-]{8,80}\.(webp|jpg)$/;

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const BASE_HEADERS = {
  'cache-control': 'no-store',
  'x-robots-tag': 'noindex, nofollow',
  'x-content-type-options': 'nosniff',
};

function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...BASE_HEADERS, ...headers },
  });
}

/* ------------------------------------------------------------------ text */

/** Trim, collapse whitespace, drop control and bidi-override characters, cap the length. */
function cleanText(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  const flat = value
    .normalize('NFC')
    .replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩﻿]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return [...flat].slice(0, max).join('').trim();
}

const today = () => new Date().toISOString().slice(0, 10);

/* ------------------------------------------------------------------ crypto */

const encoder = new TextEncoder();
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

async function sha256(text: string): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256', encoder.encode(text)));
}

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, encoder.encode(message)));
}

/** Compare two strings without leaking where they differ (both are hashed first). */
async function same(a: string, b: string): Promise<boolean> {
  const [x, y] = await Promise.all([sha256(a), sha256(b)]);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}

/** Friends type the passcode on phones: ignore case and stray spaces. */
const normPass = (value: string) => value.trim().toLowerCase();

/** A stable id for "this device today" without storing the IP address itself. */
async function deviceOf(request: Request, env: Env): Promise<string> {
  const ip = request.headers.get('cf-connecting-ip') ?? 'local';
  return (await sha256(`${ip}|${env.TEAM_PASSCODE ?? ''}`)).slice(0, 16);
}

/* ------------------------------------------------------------------ passcode cookie */

const secretFor = (role: Role, env: Env) => (role === 'admin' ? env.ADMIN_PASSCODE : role === 'team' ? env.TEAM_PASSCODE : undefined);

async function issueCookie(role: Exclude<Role, 'none'>, env: Env, secure: boolean): Promise<string> {
  const secret = secretFor(role, env) ?? '';
  const expires = Math.floor(Date.now() / 1000) + COOKIE_DAYS * 86400;
  const body = `${role}.${expires}`;
  // Signed with the passcode itself: changing the passcode signs everyone out.
  const token = `${body}.${await hmac(normPass(secret), body)}`;
  return `${COOKIE}=${token}; Path=/; Max-Age=${COOKIE_DAYS * 86400}; HttpOnly; SameSite=Strict${secure ? '; Secure' : ''}`;
}

async function roleOf(request: Request, env: Env): Promise<Role> {
  const header = request.headers.get('cookie') ?? '';
  const match = header.split(/;\s*/).find((c) => c.startsWith(`${COOKIE}=`));
  if (!match) return 'none';
  const [role, expires, signature] = match.slice(COOKIE.length + 1).split('.');
  if ((role !== 'team' && role !== 'admin') || !expires || !signature) return 'none';
  const secret = secretFor(role, env);
  if (!secret || Number(expires) < Date.now() / 1000) return 'none';
  return (await same(signature, await hmac(normPass(secret), `${role}.${expires}`))) ? role : 'none';
}

function requireRole(have: Role, need: 'team' | 'admin'): void {
  if (have === 'admin' || (need === 'team' && have === 'team')) return;
  if (need === 'admin') throw new HttpError(403, 'steward', 'Stewards only.');
  throw new HttpError(401, 'pass', 'Paddock pass needed.');
}

/** Writes must come from our own pages (the cookie is SameSite=Strict as well). */
function requireSameOrigin(request: Request, url: URL): void {
  const origin = request.headers.get('origin');
  if (!origin) return;
  let host = '';
  try {
    host = new URL(origin).host;
  } catch {
    /* malformed Origin: treated as foreign */
  }
  if (host !== url.host) throw new HttpError(403, 'origin', 'Wrong paddock.');
}

/* ------------------------------------------------------------------ schema + counters */

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS counters (k TEXT PRIMARY KEY, v INTEGER NOT NULL) WITHOUT ROWID`,
  `CREATE TABLE IF NOT EXISTS scores (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     name TEXT NOT NULL,
     name_key TEXT NOT NULL UNIQUE,
     ms INTEGER NOT NULL,
     tries INTEGER NOT NULL DEFAULT 1,
     created_at INTEGER NOT NULL,
     updated_at INTEGER NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS scores_ms ON scores (ms, updated_at)`,
  `CREATE TABLE IF NOT EXISTS photos (
     id TEXT PRIMARY KEY,
     key TEXT NOT NULL,
     width INTEGER NOT NULL,
     height INTEGER NOT NULL,
     bytes INTEGER NOT NULL,
     caption TEXT NOT NULL DEFAULT '',
     author TEXT NOT NULL DEFAULT '',
     created_at INTEGER NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS photos_created ON photos (created_at)`,
  `CREATE TABLE IF NOT EXISTS seats (
     role_id TEXT PRIMARY KEY,
     name TEXT NOT NULL,
     key TEXT NOT NULL,
     bytes INTEGER NOT NULL,
     created_at INTEGER NOT NULL
   ) WITHOUT ROWID`,
];

/** Once per isolate: create the tables if this is a fresh database (no migration step to forget). */
let schemaReady: Promise<unknown> | null = null;
function ensureSchema(env: Env): Promise<unknown> {
  schemaReady ??= env.DB.batch(SCHEMA.map((sql) => env.DB.prepare(sql))).catch((err) => {
    schemaReady = null;
    throw err;
  });
  return schemaReady;
}

const bump = (env: Env, key: string, by = 1) =>
  env.DB.prepare('INSERT INTO counters (k, v) VALUES (?1, ?2) ON CONFLICT(k) DO UPDATE SET v = v + ?2').bind(key, by);

async function readCounters(env: Env, keys: string[]): Promise<Record<string, number>> {
  const marks = keys.map((_, i) => `?${i + 1}`).join(', ');
  const { results } = await env.DB.prepare(`SELECT k, v FROM counters WHERE k IN (${marks})`)
    .bind(...keys)
    .all<{ k: string; v: number }>();
  return Object.fromEntries(results.map((r) => [r.k, r.v]));
}

/** Daily counters are named `d:YYYY-MM-DD:…`; anything older than yesterday can go. */
function sweepOldDays(env: Env): Promise<unknown> {
  const cutoff = new Date(Date.now() - 2 * 86400_000).toISOString().slice(0, 10);
  return env.DB.prepare(`DELETE FROM counters WHERE k >= 'd:' AND k < ?1`).bind(`d:${cutoff}`).run();
}

/* ------------------------------------------------------------------ upload budget */

interface UploadState {
  open: boolean;
  reason: ClosedReason | null;
}

async function uploadState(env: Env, device: string): Promise<UploadState> {
  if (env.UPLOADS_ENABLED === 'false') return { open: false, reason: 'off' };
  if (!env.TEAM_PASSCODE) return { open: false, reason: 'setup' };
  const day = today();
  let c: Record<string, number>;
  try {
    c = await readCounters(env, ['t:bytes', 't:photos', `d:${day}:up`, `d:${day}:up:${device}`]);
  } catch {
    // D1 refusing queries (daily quota reached, outage): close rather than fail mid-upload.
    return { open: false, reason: 'service' };
  }
  if ((c['t:bytes'] ?? 0) >= LIMITS.totalBytes || (c['t:photos'] ?? 0) >= LIMITS.totalPhotos) return { open: false, reason: 'full' };
  if ((c[`d:${day}:up`] ?? 0) >= LIMITS.uploadsPerDay) return { open: false, reason: 'daily' };
  if ((c[`d:${day}:up:${device}`] ?? 0) >= LIMITS.uploadsPerDevicePerDay) return { open: false, reason: 'device' };
  return { open: true, reason: null };
}

const CLOSED_COPY: Record<ClosedReason, string> = {
  off: 'Uploads are parked for now.',
  setup: 'Uploads open once the team passcode is set.',
  full: 'The paddock wall is full. Race control is clearing space.',
  daily: 'The paddock wall is full for today. It reopens tomorrow.',
  device: 'That is your uploads for today. More tomorrow.',
  service: 'Uploads are in parc fermé for a moment. Try again later.',
};

/** Pull the image out of a multipart body, check its size, type and dimensions. */
async function readImage(
  request: Request,
  maxBytes: number,
  maxEdge: number,
): Promise<{ form: FormData; bytes: Uint8Array; info: ImageInfo }> {
  // A multipart envelope adds a little on top of the file itself.
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > maxBytes + 16_384) throw new HttpError(413, 'too-big', 'That photo is too big.');
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new HttpError(400, 'bad-form', 'That upload did not arrive in one piece.');
  }
  const file = form.get('file');
  if (!(file instanceof File)) throw new HttpError(400, 'no-file', 'No photo attached.');
  if (file.size > maxBytes) throw new HttpError(413, 'too-big', 'That photo is too big.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const sniffed = sniffImage(bytes);
  if (!sniffed.ok) {
    if (sniffed.why === 'metadata') throw new HttpError(422, 'metadata', 'That photo still carries location data. Upload it through the form.');
    throw new HttpError(415, 'type', 'Only JPEG or WebP photos, please.');
  }
  const { width, height } = sniffed.info;
  if (Math.max(width, height) > maxEdge + 48 || Math.min(width, height) < 64) {
    throw new HttpError(422, 'size', 'That photo is the wrong size.');
  }
  return { form, bytes, info: sniffed.info };
}

/* ------------------------------------------------------------------ handlers */

async function getStatus(request: Request, env: Env): Promise<Response> {
  const [role, device] = await Promise.all([roleOf(request, env), deviceOf(request, env)]);
  const uploads = await uploadState(env, device);
  return json({
    pass: role,
    configured: Boolean(env.TEAM_PASSCODE),
    uploads: { ...uploads, message: uploads.reason ? CLOSED_COPY[uploads.reason] : null },
    limits: {
      photoBytes: LIMITS.photoBytes,
      photoEdge: LIMITS.photoEdge,
      faceBytes: LIMITS.faceBytes,
      faceEdge: LIMITS.faceEdge,
      nameLen: LIMITS.nameLen,
      captionLen: LIMITS.captionLen,
    },
  });
}

async function postPass(request: Request, env: Env, url: URL): Promise<Response> {
  if (!env.TEAM_PASSCODE) throw new HttpError(503, 'setup', 'The team passcode is not set yet.');
  const body = (await request.json().catch(() => null)) as { code?: unknown } | null;
  const code = typeof body?.code === 'string' ? normPass(body.code).slice(0, 200) : '';
  if (!code) throw new HttpError(400, 'empty', 'Type the passcode first.');

  const device = await deviceOf(request, env);
  const key = `d:${today()}:pass:${device}`;
  const tries = (await readCounters(env, [key]))[key] ?? 0;
  if (tries >= LIMITS.passTriesPerDay) throw new HttpError(429, 'locked', 'Too many tries. The gate reopens tomorrow.');

  let role: Role = 'none';
  if (env.ADMIN_PASSCODE && (await same(code, normPass(env.ADMIN_PASSCODE)))) role = 'admin';
  else if (await same(code, normPass(env.TEAM_PASSCODE))) role = 'team';
  if (role === 'none') {
    await bump(env, key).run();
    throw new HttpError(401, 'wrong', 'Not the passcode. Ask the group chat.');
  }
  return json({ pass: role }, 200, { 'set-cookie': await issueCookie(role, env, url.protocol === 'https:') });
}

function deletePass(): Response {
  return json({ pass: 'none' }, 200, { 'set-cookie': `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict` });
}

/* ---- leaderboard ---- */

interface ScoreRow {
  id: number;
  name: string;
  ms: number;
  tries: number;
  updated_at: number;
}

async function getLeaderboard(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    'SELECT id, name, ms, tries, updated_at FROM scores ORDER BY ms ASC, updated_at ASC LIMIT ?1',
  )
    .bind(LIMITS.boardRows)
    .all<ScoreRow>();
  return json({ rows: results.map((r) => ({ id: r.id, name: r.name, ms: r.ms, tries: r.tries, at: r.updated_at })) });
}

async function postScore(request: Request, env: Env): Promise<Response> {
  const body = (await request.json().catch(() => null)) as { name?: unknown; ms?: unknown } | null;
  const name = cleanText(body?.name, LIMITS.nameLen);
  const ms = typeof body?.ms === 'number' ? Math.round(body.ms) : NaN;
  if (!name) throw new HttpError(400, 'name', 'The timing tower needs a name.');
  if (!Number.isFinite(ms) || ms < SCORE_MIN_MS || ms > SCORE_MAX_MS) throw new HttpError(422, 'time', 'That time cannot go on the board.');

  const device = await deviceOf(request, env);
  const day = today();
  const keys = [`d:${day}:lb`, `d:${day}:lb:${device}`];
  const c = await readCounters(env, keys);
  if ((c[keys[0]!] ?? 0) >= LIMITS.scoresPerDay || (c[keys[1]!] ?? 0) >= LIMITS.scoresPerDevicePerDay) {
    throw new HttpError(429, 'daily', 'The timing tower is full for today. Your time still counts on this device.');
  }

  const now = Date.now();
  const [upsert] = await env.DB.batch<{ ms: number }>([
    env.DB.prepare(
      `INSERT INTO scores (name, name_key, ms, tries, created_at, updated_at) VALUES (?1, ?2, ?3, 1, ?4, ?4)
       ON CONFLICT(name_key) DO UPDATE SET
         tries = tries + 1,
         updated_at = CASE WHEN excluded.ms < ms THEN excluded.updated_at ELSE updated_at END,
         ms = MIN(ms, excluded.ms)
       RETURNING ms`,
    ).bind(name, name.toLowerCase(), ms, now),
    bump(env, keys[0]!),
    bump(env, keys[1]!),
  ]);
  const best = upsert?.results[0]?.ms ?? ms;
  const ahead = await env.DB.prepare('SELECT COUNT(*) AS n FROM scores WHERE ms < ?1').bind(best).first<{ n: number }>();
  return json({ name, best, improved: best === ms, rank: (ahead?.n ?? 0) + 1 });
}

async function deleteScore(env: Env, id: string): Promise<Response> {
  await env.DB.prepare('DELETE FROM scores WHERE id = ?1').bind(Number(id)).run();
  return json({ ok: true });
}

/* ---- paddock photos ---- */

interface PhotoRow {
  id: string;
  key: string;
  width: number;
  height: number;
  bytes: number;
  caption: string;
  author: string;
  created_at: number;
}

const photoOut = (r: PhotoRow) => ({
  id: r.id,
  url: `/api/media/${r.key}`,
  width: r.width,
  height: r.height,
  caption: r.caption,
  by: r.author,
  at: r.created_at,
});

async function getPhotos(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    'SELECT id, key, width, height, bytes, caption, author, created_at FROM photos ORDER BY created_at DESC LIMIT ?1',
  )
    .bind(LIMITS.totalPhotos)
    .all<PhotoRow>();
  return json({ photos: results.map(photoOut) });
}

async function assertUploadsOpen(env: Env, device: string): Promise<void> {
  const state = await uploadState(env, device);
  if (state.open || !state.reason) return;
  const status = state.reason === 'daily' || state.reason === 'device' ? 429 : 503;
  throw new HttpError(status, `closed-${state.reason}`, CLOSED_COPY[state.reason]);
}

async function postPhoto(request: Request, env: Env): Promise<Response> {
  const device = await deviceOf(request, env);
  await assertUploadsOpen(env, device);
  const { form, bytes, info } = await readImage(request, LIMITS.photoBytes, LIMITS.photoEdge);

  const row: PhotoRow = {
    id: crypto.randomUUID(),
    key: '',
    width: info.width,
    height: info.height,
    bytes: bytes.byteLength,
    caption: cleanText(form.get('caption'), LIMITS.captionLen),
    author: cleanText(form.get('by'), LIMITS.nameLen),
    created_at: Date.now(),
  };
  row.key = `photos/${row.id}.${info.ext}`;

  try {
    await env.PHOTOS.put(row.key, bytes, { httpMetadata: { contentType: info.mime } });
  } catch {
    throw new HttpError(503, 'closed-service', CLOSED_COPY.service);
  }
  const day = today();
  try {
    await env.DB.batch([
      env.DB.prepare(
        'INSERT INTO photos (id, key, width, height, bytes, caption, author, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)',
      ).bind(row.id, row.key, row.width, row.height, row.bytes, row.caption, row.author, row.created_at),
      bump(env, 't:bytes', row.bytes),
      bump(env, 't:photos'),
      bump(env, `d:${day}:up`),
      bump(env, `d:${day}:up:${device}`),
    ]);
  } catch {
    await env.PHOTOS.delete(row.key).catch(() => {});
    throw new HttpError(503, 'closed-service', CLOSED_COPY.service);
  }
  return json({ photo: photoOut(row) }, 201);
}

async function deletePhoto(env: Env, id: string): Promise<Response> {
  const row = await env.DB.prepare('SELECT key, bytes FROM photos WHERE id = ?1').bind(id).first<{ key: string; bytes: number }>();
  if (!row) throw new HttpError(404, 'gone', 'Already gone.');
  await env.PHOTOS.delete(row.key);
  await env.DB.batch([env.DB.prepare('DELETE FROM photos WHERE id = ?1').bind(id), bump(env, 't:bytes', -row.bytes), bump(env, 't:photos', -1)]);
  return json({ ok: true });
}

/* ---- crew seats ---- */

interface SeatRow {
  role_id: string;
  name: string;
  key: string;
  bytes: number;
  created_at: number;
}

const seatOut = (r: SeatRow) => ({ role: r.role_id, name: r.name, photo: `/api/media/${r.key}`, at: r.created_at });

async function getSeats(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare('SELECT role_id, name, key, bytes, created_at FROM seats').all<SeatRow>();
  // A role that was later filled in data/crew.ts is no longer an open seat.
  return json({ seats: results.filter((r) => OPEN_ROLES.has(r.role_id)).map(seatOut) });
}

async function postSeat(request: Request, env: Env): Promise<Response> {
  const device = await deviceOf(request, env);
  await assertUploadsOpen(env, device);
  const { form, bytes, info } = await readImage(request, LIMITS.faceBytes, LIMITS.faceEdge);

  const role = cleanText(form.get('role'), 40);
  const name = cleanText(form.get('name'), LIMITS.nameLen);
  if (!OPEN_ROLES.has(role)) throw new HttpError(400, 'role', 'That seat is not on the list.');
  if (!name) throw new HttpError(400, 'name', 'The pass needs a name.');
  if (Math.abs(info.width - info.height) > 2) throw new HttpError(422, 'size', 'The crew photo has to be square.');

  const taken = await env.DB.prepare('SELECT 1 AS x FROM seats WHERE role_id = ?1').bind(role).first();
  if (taken) throw new HttpError(409, 'taken', 'Someone just took that seat. Pick another one.');

  const row: SeatRow = { role_id: role, name, key: `crew/${role}-${crypto.randomUUID()}.${info.ext}`, bytes: bytes.byteLength, created_at: Date.now() };
  try {
    await env.PHOTOS.put(row.key, bytes, { httpMetadata: { contentType: info.mime } });
  } catch {
    throw new HttpError(503, 'closed-service', CLOSED_COPY.service);
  }
  const day = today();
  try {
    await env.DB.batch([
      env.DB.prepare('INSERT INTO seats (role_id, name, key, bytes, created_at) VALUES (?1, ?2, ?3, ?4, ?5)').bind(
        row.role_id,
        row.name,
        row.key,
        row.bytes,
        row.created_at,
      ),
      bump(env, 't:bytes', row.bytes),
      bump(env, `d:${day}:up`),
      bump(env, `d:${day}:up:${device}`),
    ]);
  } catch (err) {
    await env.PHOTOS.delete(row.key).catch(() => {});
    // Two friends raced for the same seat: the primary key settles it.
    if (String(err).includes('UNIQUE')) throw new HttpError(409, 'taken', 'Someone just took that seat. Pick another one.');
    throw new HttpError(503, 'closed-service', CLOSED_COPY.service);
  }
  return json({ seat: seatOut(row) }, 201);
}

async function deleteSeat(env: Env, role: string): Promise<Response> {
  const row = await env.DB.prepare('SELECT key, bytes FROM seats WHERE role_id = ?1').bind(role).first<{ key: string; bytes: number }>();
  if (!row) throw new HttpError(404, 'gone', 'Already gone.');
  await env.PHOTOS.delete(row.key);
  await env.DB.batch([env.DB.prepare('DELETE FROM seats WHERE role_id = ?1').bind(role), bump(env, 't:bytes', -row.bytes)]);
  return json({ ok: true });
}

/* ---- uploaded images ---- */

async function getMedia(env: Env, key: string): Promise<Response> {
  if (!MEDIA_KEY.test(key)) throw new HttpError(404, 'not-found', 'No such photo.');
  const object = await env.PHOTOS.get(key);
  if (!object) throw new HttpError(404, 'not-found', 'No such photo.');
  return new Response(object.body, {
    headers: {
      'content-type': object.httpMetadata?.contentType ?? 'application/octet-stream',
      // Keys are unique per upload, so a browser never needs to ask twice.
      'cache-control': 'public, max-age=31536000, immutable',
      etag: object.httpEtag,
      'x-robots-tag': 'noindex, nofollow',
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'none'; sandbox",
    },
  });
}

/* ------------------------------------------------------------------ router */

async function route(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '');
  const method = request.method;
  const [, , resource = '', ...rest] = path.split('/');
  const id = rest.join('/');

  if (resource === 'media' && (method === 'GET' || method === 'HEAD')) return getMedia(env, decodeURIComponent(id));

  const write = method !== 'GET' && method !== 'HEAD';
  if (write) requireSameOrigin(request, url);
  if (resource === 'pass' && method === 'DELETE') return deletePass();

  await ensureSchema(env);
  if (resource === 'status' && method === 'GET') return getStatus(request, env);
  if (resource === 'pass' && method === 'POST') return postPass(request, env, url);
  if (resource === 'leaderboard' && method === 'GET') return getLeaderboard(env);
  if (resource === 'photos' && method === 'GET') return getPhotos(env);
  if (resource === 'crew' && method === 'GET') return getSeats(env);

  if (write) {
    const role = await roleOf(request, env);
    if (method === 'POST' && !id) {
      requireRole(role, 'team');
      // Old daily counters pile up slowly; clear them after the response has gone out.
      ctx.waitUntil(sweepOldDays(env).catch(() => {}));
      if (resource === 'leaderboard') return postScore(request, env);
      if (resource === 'photos') return postPhoto(request, env);
      if (resource === 'crew') return postSeat(request, env);
    }
    if (method === 'DELETE' && id) {
      requireRole(role, 'admin');
      if (resource === 'leaderboard') return deleteScore(env, id);
      if (resource === 'photos') return deletePhoto(env, id);
      if (resource === 'crew') return deleteSeat(env, id);
    }
  }
  throw new HttpError(404, 'not-found', 'Nothing on this part of the track.');
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    // Only /api/* is routed here first; anything else belongs to the static site.
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    try {
      return await route(request, env, ctx);
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.code, message: err.message }, err.status);
      console.error('api error', url.pathname, err);
      return json({ error: 'service', message: 'Race control lost the signal. Try again in a moment.' }, 503);
    }
  },
} satisfies ExportedHandler<Env>;
