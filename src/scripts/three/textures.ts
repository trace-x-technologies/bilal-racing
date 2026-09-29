/**
 * Procedural CanvasTextures for the BR-09: livery paint, decals, Purrelli tyres,
 * paw-print wheel covers, carbon weave, studio floor marks and particle sprites.
 * No image downloads — everything is painted with the 2D canvas API.
 */
import * as THREE from 'three';

export const LIVERY = {
  carbon: '#0b0b10',
  weaveA: '#101016',
  weaveB: '#17171f',
  gold: '#ffc52e',
  saffron: '#ff6a13',
  maroon: '#a0153e',
  chalk: '#f4f1ea',
  teal: '#14d5b4',
} as const;

const DISPLAY_FONT = '"Saira Variable", "Arial Narrow", system-ui, sans-serif';
const MONO_FONT = '"JetBrains Mono Variable", ui-monospace, monospace';

let maxAnisotropy = 4;
export function setMaxAnisotropy(value: number): void {
  maxAnisotropy = Math.max(1, Math.min(8, value));
}

/** Resolves once the display font can be used on a canvas (or after a timeout). */
export async function fontsReady(timeout = 1500): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  const load = Promise.all([
    document.fonts.load(`900 64px ${DISPLAY_FONT}`),
    document.fonts.load(`700 32px ${MONO_FONT}`),
  ]).catch(() => undefined);
  await Promise.race([load, new Promise((r) => setTimeout(r, timeout))]);
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  return [c, ctx];
}

function toTexture(canvas: HTMLCanvasElement, opts: { srgb?: boolean; repeat?: boolean } = {}): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  if (opts.srgb !== false) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  if (opts.repeat) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
  }
  tex.needsUpdate = true;
  return tex;
}

/** Condensed, heavy display face (Saira variable width axis). */
function displayFont(ctx: CanvasRenderingContext2D, size: number, weight = 900, stretch: CanvasFontStretch = 'extra-condensed'): void {
  ctx.font = `${weight} ${size}px ${DISPLAY_FONT}`;
  if ('fontStretch' in ctx) ctx.fontStretch = stretch;
}

function liveryGradient(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number): CanvasGradient {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, LIVERY.maroon);
  g.addColorStop(0.5, LIVERY.saffron);
  g.addColorStop(1, LIVERY.gold);
  return g;
}

function weave(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, cell = 6): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  for (let yy = y; yy < y + h; yy += cell) {
    for (let xx = x; xx < x + w; xx += cell) {
      const k = (Math.floor(xx / cell) + Math.floor(yy / cell)) % 2;
      ctx.fillStyle = k ? LIVERY.weaveA : LIVERY.weaveB;
      ctx.fillRect(xx, yy, cell, cell);
    }
  }
  ctx.restore();
}

/** Paw print centred on (0,0), fits roughly in a `s`-sized box, toes pointing to −y. */
export function drawPaw(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, rot = 0): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();
  // main pad — soft rounded triangle
  ctx.moveTo(0, -0.04 * s);
  ctx.bezierCurveTo(0.26 * s, -0.06 * s, 0.4 * s, 0.26 * s, 0.26 * s, 0.38 * s);
  ctx.bezierCurveTo(0.14 * s, 0.48 * s, 0.06 * s, 0.36 * s, 0, 0.36 * s);
  ctx.bezierCurveTo(-0.06 * s, 0.36 * s, -0.14 * s, 0.48 * s, -0.26 * s, 0.38 * s);
  ctx.bezierCurveTo(-0.4 * s, 0.26 * s, -0.26 * s, -0.06 * s, 0, -0.04 * s);
  ctx.fill();
  const toes: Array<[number, number, number]> = [
    [-0.36, -0.12, -0.5],
    [-0.13, -0.33, -0.15],
    [0.13, -0.33, 0.15],
    [0.36, -0.12, 0.5],
  ];
  for (const [tx, ty, tr] of toes) {
    ctx.beginPath();
    ctx.ellipse(tx * s, ty * s, 0.1 * s, 0.135 * s, tr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Livery paint for lofted bodywork.                                   */
/* Canvas x = perimeter (0 bottom-centre → 0.25 right → 0.5 top →      */
/* 0.75 left), canvas y = length (top of canvas = front of the part).  */
/* ------------------------------------------------------------------ */
export type LiveryKind = 'nose' | 'tub' | 'sidepod' | 'cover' | 'airbox' | 'plain';

export function liveryTexture(kind: LiveryKind): THREE.CanvasTexture {
  const W = 512;
  const H = 512;
  const [c, ctx] = makeCanvas(W, H);
  ctx.fillStyle = LIVERY.carbon;
  ctx.fillRect(0, 0, W, H);
  // exposed carbon weave on the underside
  weave(ctx, 0, 0, W * 0.13, H);
  weave(ctx, W * 0.87, 0, W * 0.13, H);

  const mid = W / 2;
  const band = (u0: number, u1: number, fill: string | CanvasGradient, y0 = 0, y1 = H) => {
    ctx.fillStyle = fill;
    ctx.fillRect(u0 * W, y0, (u1 - u0) * W, y1 - y0);
    ctx.fillRect((1 - u1) * W, y0, (u1 - u0) * W, y1 - y0);
  };

  if (kind === 'nose') {
    // tapering gold centre stripe (wide at the cockpit, needle at the tip)
    ctx.fillStyle = LIVERY.gold;
    ctx.beginPath();
    ctx.moveTo(mid - 0.055 * W, H);
    ctx.lineTo(mid - 0.012 * W, 0);
    ctx.lineTo(mid + 0.012 * W, 0);
    ctx.lineTo(mid + 0.055 * W, H);
    ctx.fill();
    ctx.fillStyle = LIVERY.maroon;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(mid + s * 0.075 * W, H);
      ctx.lineTo(mid + s * 0.022 * W, 0);
      ctx.lineTo(mid + s * 0.03 * W, 0);
      ctx.lineTo(mid + s * 0.09 * W, H);
      ctx.fill();
    }
    // saffron flashes on the flanks fading towards the tip
    const g = ctx.createLinearGradient(0, H, 0, H * 0.25);
    g.addColorStop(0, LIVERY.saffron);
    g.addColorStop(1, 'rgba(255,106,19,0)');
    band(0.26, 0.3, g, 0, H);
  } else if (kind === 'tub') {
    band(0.44, 0.445, LIVERY.maroon);
    ctx.fillStyle = LIVERY.gold;
    ctx.fillRect(mid - 0.055 * W, 0, 0.11 * W, H);
    band(0.26, 0.3, LIVERY.saffron);
    band(0.2, 0.215, LIVERY.maroon);
  } else if (kind === 'sidepod') {
    // livery sweep: maroon → saffron → gold climbing towards the rear
    const g = liveryGradient(ctx, 0, H, 0, 0);
    for (const s of [0, 1]) {
      ctx.save();
      if (s) {
        ctx.translate(W, 0);
        ctx.scale(-1, 1);
      }
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0.16 * W, H);
      ctx.lineTo(0.16 * W, H * 0.62);
      ctx.bezierCurveTo(0.2 * W, H * 0.42, 0.3 * W, H * 0.3, 0.42 * W, H * 0.22);
      ctx.lineTo(0.42 * W, H * 0.3);
      ctx.bezierCurveTo(0.34 * W, H * 0.38, 0.26 * W, H * 0.55, 0.23 * W, H);
      ctx.fill();
      ctx.fillStyle = LIVERY.gold;
      ctx.fillRect(0.46 * W, 0, 0.012 * W, H);
      ctx.restore();
    }
  } else if (kind === 'cover') {
    ctx.fillStyle = LIVERY.gold;
    ctx.fillRect(mid - 0.018 * W, 0, 0.036 * W, H);
    band(0.455, 0.465, LIVERY.maroon);
    // cat-eye almond on each flank
    for (const s of [0, 1]) {
      ctx.save();
      if (s) {
        ctx.translate(W, 0);
        ctx.scale(-1, 1);
      }
      const cx = 0.31 * W;
      const cy = H * 0.42;
      const g = liveryGradient(ctx, cx, cy + 150, cx, cy - 150);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 170);
      ctx.quadraticCurveTo(cx + 62, cy, cx, cy + 170);
      ctx.quadraticCurveTo(cx - 62, cy, cx, cy - 170);
      ctx.fill();
      ctx.fillStyle = LIVERY.carbon;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 9, 110, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  } else if (kind === 'airbox') {
    ctx.fillStyle = LIVERY.gold;
    ctx.fillRect(mid - 0.02 * W, 0, 0.04 * W, H);
    band(0.3, 0.36, LIVERY.maroon);
  }
  return toTexture(c);
}

/* ------------------------------------------------------------------ */
/* Decals (transparent)                                                */
/* ------------------------------------------------------------------ */
/**
 * Livery race number with a maroon drop shadow. One digit paints on a square
 * canvas; two digits get a wider one (see `numberDecalAspect`) so they keep
 * their proportions instead of being squeezed. `outline` adds a carbon keyline so
 * the number still reads on the nose's gold centre stripe.
 */
export function numberDecal(text: string, opts: { outline?: boolean } = {}): THREE.CanvasTexture {
  const H = 256;
  const W = Math.round(H * numberDecalAspect(text));
  const [c, ctx] = makeCanvas(W, H);
  displayFont(ctx, 250, 900, 'condensed');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.save();
  ctx.translate(W / 2, 136);
  ctx.transform(1, 0, -0.16, 1, 0, 0);
  ctx.lineJoin = 'round';
  ctx.lineWidth = 16;
  // leave room for the skew, the stroke(s) and the drop shadow
  const fit = W - (opts.outline ? 64 : 44);
  if (opts.outline) {
    ctx.lineWidth = 30;
    ctx.strokeStyle = LIVERY.carbon;
    ctx.strokeText(text, 0, 0, fit);
    ctx.strokeText(text, 6, 6, fit);
    ctx.lineWidth = 16;
  }
  ctx.strokeStyle = LIVERY.maroon;
  ctx.strokeText(text, 6, 6, fit);
  ctx.fillStyle = LIVERY.maroon;
  ctx.fillText(text, 6, 6, fit);
  ctx.fillStyle = liveryGradient(ctx, 0, 110, 0, -110);
  ctx.fillText(text, 0, 0, fit);
  ctx.restore();
  return toTexture(c);
}

/** Width / height of the canvas `numberDecal(text)` paints on. */
export function numberDecalAspect(text: string): number {
  return text.length > 1 ? 1.45 : 1;
}

export function wordDecal(text: string, opts: { w?: number; h?: number; sub?: string; gradient?: boolean } = {}): THREE.CanvasTexture {
  const W = opts.w ?? 1024;
  const H = opts.h ?? 256;
  const [c, ctx] = makeCanvas(W, H);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const size = opts.sub ? H * 0.72 : H * 0.86;
  displayFont(ctx, size, 900, 'extra-condensed');
  ctx.save();
  ctx.translate(W / 2, opts.sub ? H * 0.4 : H * 0.52);
  ctx.transform(1, 0, -0.18, 1, 0, 0);
  ctx.lineJoin = 'round';
  ctx.lineWidth = H * 0.06;
  ctx.strokeStyle = LIVERY.maroon;
  ctx.strokeText(text, H * 0.03, H * 0.03, W * 0.94);
  ctx.fillStyle = opts.gradient === false ? LIVERY.gold : liveryGradient(ctx, -W * 0.35, 0, W * 0.35, 0);
  ctx.fillText(text, 0, 0, W * 0.94);
  ctx.restore();
  if (opts.sub) {
    ctx.font = `700 ${H * 0.15}px ${MONO_FONT}`;
    ctx.fillStyle = LIVERY.chalk;
    ctx.fillText(opts.sub, W / 2, H * 0.86, W * 0.9);
  }
  return toTexture(c);
}

/** Driver's three-letter timing-screen chip ("DHA", "DEE"). */
export function codeDecal(code: string): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(512, 192);
  ctx.beginPath();
  ctx.moveTo(40, 16);
  ctx.lineTo(500, 16);
  ctx.lineTo(472, 176);
  ctx.lineTo(12, 176);
  ctx.closePath();
  // carbon keyline: the chip sits on the gold nose stripe
  ctx.lineJoin = 'round';
  ctx.lineWidth = 18;
  ctx.strokeStyle = LIVERY.carbon;
  ctx.stroke();
  ctx.fillStyle = LIVERY.gold;
  ctx.fill();
  ctx.fillStyle = LIVERY.carbon;
  displayFont(ctx, 150, 900, 'condensed');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(code, 256, 104);
  return toTexture(c);
}

/* ------------------------------------------------------------------ */
/* Tyres                                                               */
/* ------------------------------------------------------------------ */
/**
 * Tyre texture. x = around the tyre, y = across the profile.
 * `side` = fraction of the profile that is sidewall on each side.
 */
export function tyreTexture(side: number): THREE.CanvasTexture {
  const W = 2048;
  const H = 512;
  const [c, ctx] = makeCanvas(W, H);
  ctx.fillStyle = '#111114';
  ctx.fillRect(0, 0, W, H);
  const sidePx = side * H;
  // tread: staggered paw prints, slightly lighter rubber
  ctx.fillStyle = '#19191e';
  const rows = 2;
  const perRow = 28;
  const treadTop = sidePx;
  const treadH = H - 2 * sidePx;
  for (let r = 0; r < rows; r++) {
    for (let i = 0; i < perRow; i++) {
      const x = ((i + (r % 2) * 0.5) / perRow) * W;
      const y = treadTop + treadH * (0.3 + r * 0.4);
      drawPaw(ctx, x, y, treadH * 0.3, Math.PI / 2);
    }
  }
  // sidewalls: compound ring + lettering
  const drawSide = (flip: boolean) => {
    ctx.save();
    if (flip) {
      ctx.translate(W, H);
      ctx.rotate(Math.PI);
    }
    // this side occupies canvas y ∈ [H - sidePx, H]; outer (tread) edge is at H - sidePx
    const y0 = H - sidePx;
    ctx.fillStyle = LIVERY.gold;
    ctx.fillRect(0, y0 + sidePx * 0.12, W, sidePx * 0.07);
    ctx.fillStyle = LIVERY.chalk;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    displayFont(ctx, sidePx * 0.34, 800, 'semi-expanded');
    for (let i = 0; i < 3; i++) {
      const x = ((i + 0.25) / 3) * W;
      ctx.fillText('PURRELLI', x, y0 + sidePx * 0.42);
      ctx.save();
      ctx.font = `700 ${sidePx * 0.16}px ${MONO_FONT}`;
      ctx.fillStyle = LIVERY.gold;
      ctx.fillText('P ZERO · PAW', x + W / 6, y0 + sidePx * 0.4);
      ctx.restore();
    }
    ctx.restore();
  };
  drawSide(false);
  drawSide(true);
  return toTexture(c);
}

/** Wheel cover: carbon disc, gold ring with lettering, giant paw print. */
export function wheelCoverTexture(): THREE.CanvasTexture {
  const S = 512;
  const [c, ctx] = makeCanvas(S, S);
  const r = S / 2;
  const g = ctx.createRadialGradient(r, r, 10, r, r, r);
  g.addColorStop(0, '#1c1c24');
  g.addColorStop(1, '#08080c');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  // outer ring
  ctx.strokeStyle = LIVERY.gold;
  ctx.lineWidth = 34;
  ctx.beginPath();
  ctx.arc(r, r, r - 20, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = LIVERY.maroon;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(r, r, r - 44, 0, Math.PI * 2);
  ctx.stroke();
  // lettering on the ring
  ctx.fillStyle = LIVERY.carbon;
  ctx.font = `800 22px ${MONO_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const text = 'PURRELLI · P ZERO PAW · PURRELLI · P ZERO PAW · ';
  const chars = [...text];
  chars.forEach((ch, i) => {
    const a = (i / chars.length) * Math.PI * 2;
    ctx.save();
    ctx.translate(r + Math.cos(a) * (r - 20), r + Math.sin(a) * (r - 20));
    ctx.rotate(a + Math.PI / 2);
    ctx.fillText(ch, 0, 1);
    ctx.restore();
  });
  // paw
  ctx.fillStyle = LIVERY.gold;
  drawPaw(ctx, r, r + 8, S * 0.5);
  ctx.fillStyle = LIVERY.saffron;
  ctx.beginPath();
  ctx.arc(r, r + 8, 18, 0, Math.PI * 2);
  ctx.fill();
  return toTexture(c);
}

/* ------------------------------------------------------------------ */
/* Misc surfaces                                                       */
/* ------------------------------------------------------------------ */
export function carbonTexture(): THREE.CanvasTexture {
  const S = 64;
  const [c, ctx] = makeCanvas(S, S);
  const cell = 8;
  for (let y = 0; y < S; y += cell) {
    for (let x = 0; x < S; x += cell) {
      const twill = (x / cell + y / cell) % 4 < 2;
      const g = twill ? ctx.createLinearGradient(x, y, x + cell, y) : ctx.createLinearGradient(x, y, x, y + cell);
      g.addColorStop(0, '#15151c');
      g.addColorStop(0.5, '#262631');
      g.addColorStop(1, '#15151c');
      ctx.fillStyle = g;
      ctx.fillRect(x, y, cell, cell);
    }
  }
  const t = toTexture(c, { repeat: true });
  t.repeat.set(5, 5);
  return t;
}

/** Rear-wing endplate art: livery sweep + big outlined 9. */
export function endplateTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(512, 512);
  ctx.fillStyle = LIVERY.carbon;
  ctx.fillRect(0, 0, 512, 512);
  weave(ctx, 0, 0, 512, 512, 8);
  ctx.fillStyle = liveryGradient(ctx, 0, 512, 512, 0);
  ctx.beginPath();
  ctx.moveTo(0, 512);
  ctx.lineTo(0, 330);
  ctx.bezierCurveTo(160, 300, 330, 190, 512, 40);
  ctx.lineTo(512, 190);
  ctx.bezierCurveTo(360, 330, 200, 420, 110, 512);
  ctx.fill();
  ctx.fillStyle = LIVERY.gold;
  drawPaw(ctx, 350, 330, 150, 0.35);
  return toTexture(c);
}

/** Tabby tail stripes, u along the tail. */
export function tailTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(512, 32);
  ctx.fillStyle = LIVERY.carbon;
  ctx.fillRect(0, 0, 512, 32);
  for (let i = 0; i < 7; i++) {
    ctx.fillStyle = i % 2 ? LIVERY.saffron : LIVERY.gold;
    ctx.fillRect(40 + i * 56, 0, 18, 32);
  }
  ctx.fillStyle = LIVERY.gold;
  ctx.fillRect(440, 0, 72, 32);
  return toTexture(c);
}

/** Soft round sprite for dust / sparks. */
export function dotTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(64, 64);
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return toTexture(c);
}

/** Horizontal light streak. */
export function streakTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(256, 32);
  const g = ctx.createLinearGradient(0, 0, 256, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.75, 'rgba(255,255,255,0.9)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 32);
  ctx.globalCompositeOperation = 'destination-in';
  const v = ctx.createLinearGradient(0, 0, 0, 32);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(0.5, 'rgba(0,0,0,1)');
  v.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, 256, 32);
  return toTexture(c);
}

/**
 * Blurred contact shadow, top view. Canvas maps to a plane of `span` = [width, length]
 * units centred on the car; x → car x, y → car z (top of canvas = nose).
 */
export function shadowTexture(): THREE.CanvasTexture {
  const W = 256;
  const H = 512;
  const [c, ctx] = makeCanvas(W, H);
  // plane is 3.2 × 6.4 units → 80 px/unit
  const px = (x: number) => W / 2 + x * 80;
  const pz = (z: number) => H / 2 + z * 80; // plane is laid flat with canvas-down = +z
  ctx.filter = 'blur(14px)';
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.beginPath();
  ctx.ellipse(px(0), pz(-0.2), 0.8 * 80, 2.5 * 80, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.filter = 'blur(6px)';
  ctx.fillStyle = 'rgba(0,0,0,0.95)';
  for (const [x, z, w, l] of [
    [0.83, 1.9, 0.3, 0.5],
    [-0.83, 1.9, 0.3, 0.5],
    [0.8, -1.5, 0.38, 0.55],
    [-0.8, -1.5, 0.38, 0.55],
  ] as const) {
    ctx.fillRect(px(x) - (w * 80) / 2, pz(z) - (l * 80) / 2, w * 80, l * 80);
  }
  ctx.filter = 'none';
  return toTexture(c, { srgb: false });
}

/**
 * Painted pit-box floor markings ("Box, box? I love a box."). Box 09 is the
 * team's lucky number; the owner treats it as his personal nap spot.
 */
export function pitBoxTexture(): THREE.CanvasTexture {
  const S = 1024;
  const [c, ctx] = makeCanvas(S, S);
  const gold = 'rgba(255,197,46,0.9)';
  ctx.strokeStyle = gold;
  ctx.fillStyle = gold;
  ctx.lineWidth = 7;
  // box outline (3 × 6.6 units on a 12-unit plane)
  const u = S / 12;
  const bx = S / 2 - 1.5 * u;
  const by = S / 2 - 3.3 * u;
  const bw = 3 * u;
  const bh = 6.6 * u;
  ctx.setLineDash([u * 0.5, u * 0.22]);
  ctx.strokeRect(bx, by, bw, bh);
  ctx.setLineDash([]);
  // corner brackets
  ctx.lineWidth = 12;
  const L = u * 0.5;
  for (const [x, y, sx, sy] of [
    [bx, by, 1, 1],
    [bx + bw, by, -1, 1],
    [bx, by + bh, 1, -1],
    [bx + bw, by + bh, -1, -1],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(x, y + sy * L);
    ctx.lineTo(x, y);
    ctx.lineTo(x + sx * L, y);
    ctx.stroke();
  }
  // The plane is laid flat so canvas-down = +z (towards the nose): the front of
  // the box is the bottom of the canvas, and text reads upright from the front.
  const fy = by + bh;
  ctx.save();
  ctx.beginPath();
  ctx.rect(bx, fy + u * 0.3, bw, u * 0.6);
  ctx.clip();
  ctx.lineWidth = 10;
  for (let x = bx - u; x < bx + bw + u; x += u * 0.3) {
    ctx.beginPath();
    ctx.moveTo(x, fy + u * 0.9);
    ctx.lineTo(x + u * 0.6, fy + u * 0.3);
    ctx.stroke();
  }
  ctx.restore();
  displayFont(ctx, u * 0.9, 900, 'condensed');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('BOX 09', S / 2, fy + u * 1.5);
  ctx.font = `700 ${u * 0.2}px ${MONO_FONT}`;
  ctx.fillStyle = 'rgba(244,241,234,0.75)';
  ctx.fillText('BILAL RACING · THE OWNER’S NAP BOX', S / 2, by - u * 0.4);
  // radial fade so the plane edge never shows
  ctx.globalCompositeOperation = 'destination-in';
  const g = ctx.createRadialGradient(S / 2, S / 2, S * 0.3, S / 2, S / 2, S * 0.5);
  g.addColorStop(0, 'rgba(0,0,0,1)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  return toTexture(c);
}

/** Blueprint grid for the exploded-view floor. */
export function gridTexture(): THREE.CanvasTexture {
  const S = 1024;
  const [c, ctx] = makeCanvas(S, S);
  const step = S / 20;
  for (let i = 0; i <= 20; i++) {
    const major = i % 5 === 0;
    ctx.strokeStyle = major ? 'rgba(255,197,46,0.55)' : 'rgba(244,241,234,0.16)';
    ctx.lineWidth = major ? 2.5 : 1.2;
    ctx.beginPath();
    ctx.moveTo(i * step, 0);
    ctx.lineTo(i * step, S);
    ctx.moveTo(0, i * step);
    ctx.lineTo(S, i * step);
    ctx.stroke();
  }
  ctx.globalCompositeOperation = 'destination-in';
  const g = ctx.createRadialGradient(S / 2, S / 2, S * 0.1, S / 2, S / 2, S * 0.5);
  g.addColorStop(0, 'rgba(0,0,0,1)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  return toTexture(c);
}
