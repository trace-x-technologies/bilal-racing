/**
 * SVG side-view "blueprint poster" of the BR-09, generated from the same world
 * coordinates as the 3D model. Shown while Three.js loads, and as the fallback
 * for no-WebGL. Pure string → safe to use at build time with `set:html`.
 *
 * It wears the same livery as the 3D car it stands in for: the driver's number on
 * the nose, "#number CODE" on the sidepod, and the team's lucky 9 on the shark fin.
 */
export interface PosterLivery {
  number: number;
  code: string;
}

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const esc = (v: string) => v.replace(/[&<>"]/g, (ch) => ESCAPES[ch] ?? ch);
const X = (z: number) => +(60 + (z + 2.7) * 185).toFixed(1);
const Y = (y: number) => +(292 - y * 185).toFixed(1);
const P = (pts: Array<[number, number]>) => pts.map(([z, y], i) => `${i ? 'L' : 'M'}${X(z)} ${Y(y)}`).join(' ');

function wheel(z: number, r: number, id: string): string {
  const cx = X(z);
  const cy = Y(r);
  const R = r * 185;
  const rim = 0.232 * 185;
  return `
    <g class="bp-wheel" transform="translate(${cx} ${cy})">
      <circle r="${R}" fill="#111116" stroke="#2a2a37" stroke-width="2"/>
      <circle r="${R - 6}" fill="none" stroke="#1d1d25" stroke-width="6" stroke-dasharray="3 9"/>
      <circle r="${rim}" fill="url(#${id}-disc)" stroke="#ffc52e" stroke-width="5"/>
      <g fill="#ffc52e" transform="scale(${(rim / 60).toFixed(3)})">
        <path d="M0 -4 C16 -6 26 16 16 24 C9 30 4 22 0 22 C-4 22 -9 30 -16 24 C-26 16 -16 -6 0 -4 Z"/>
        <ellipse cx="-22" cy="-8" rx="6" ry="8" transform="rotate(-28 -22 -8)"/>
        <ellipse cx="-8" cy="-21" rx="6" ry="8" transform="rotate(-8 -8 -21)"/>
        <ellipse cx="8" cy="-21" rx="6" ry="8" transform="rotate(8 8 -21)"/>
        <ellipse cx="22" cy="-8" rx="6" ry="8" transform="rotate(28 22 -8)"/>
      </g>
    </g>`;
}

export function carPosterSVG(id: string, livery: PosterLivery): string {
  const num = esc(String(livery.number));
  const code = esc(livery.code.toUpperCase());
  const body = P([
    [-2.62, 0.3],
    [-2.62, 0.38],
    [-2.05, 0.5],
    [-1.6, 0.6],
    [-1.1, 0.7],
    [-0.66, 0.8],
    [-0.62, 0.88],
    [-0.38, 0.935],
    [-0.08, 0.945],
    [-0.06, 0.74],
    [0.55, 0.685],
    [0.95, 0.66],
    [1.5, 0.575],
    [2.05, 0.465],
    [2.55, 0.365],
    [2.9, 0.29],
    [2.93, 0.24],
    [2.55, 0.2],
    [2.05, 0.225],
    [1.3, 0.22],
    [0.95, 0.23],
    [0.6, 0.1],
    [-1.2, 0.1],
    [-2.2, 0.26],
    [-2.62, 0.3],
  ]);
  const pod = P([
    [0.55, 0.61],
    [0.15, 0.61],
    [-0.45, 0.55],
    [-1.1, 0.42],
    [-1.55, 0.32],
    [-1.4, 0.2],
    [-0.45, 0.13],
    [0.15, 0.11],
    [0.55, 0.22],
  ]);
  const sweep = P([
    [-1.5, 0.3],
    [-0.9, 0.49],
    [-0.2, 0.58],
    [-0.15, 0.5],
    [-0.8, 0.36],
    [-1.35, 0.22],
  ]);
  const fin = P([
    [-0.45, 0.8],
    [-1.5, 0.875],
    [-1.66, 0.82],
    [-1.92, 0.48],
    [-1.1, 0.64],
  ]);
  const tail = `M${X(-1.52)} ${Y(0.86)} C${X(-1.64)} ${Y(1.0)} ${X(-1.62)} ${Y(1.2)} ${X(-1.48)} ${Y(1.235)} C${X(-1.36)} ${Y(1.25)} ${X(-1.32)} ${Y(1.13)} ${X(-1.42)} ${Y(1.11)}`;
  const halo = `M${X(-0.28)} ${Y(0.66)} C${X(-0.2)} ${Y(0.86)} ${X(0.2)} ${Y(0.9)} ${X(0.45)} ${Y(0.9)} C${X(0.55)} ${Y(0.86)} ${X(0.62)} ${Y(0.74)} ${X(0.66)} ${Y(0.67)}`;
  const ear = (z: number) => P([
    [z - 0.065, 0.925],
    [z - 0.01, 1.07],
    [z + 0.06, 0.925],
  ]);
  const rearWing = P([
    [-1.8, 0.34],
    [-1.8, 0.86],
    [-2.0, 1.01],
    [-2.38, 1.01],
    [-2.46, 0.93],
    [-2.46, 0.55],
    [-2.26, 0.34],
  ]);
  const fwPlate = P([
    [3.0, 0.03],
    [3.0, 0.14],
    [2.8, 0.29],
    [2.4, 0.3],
    [2.4, 0.08],
    [2.52, 0.03],
  ]);
  const flaps = [
    ['#a0153e', 2.72, 0.12, 0.15, 0.24],
    ['#ff6a13', 2.6, 0.155, 0.125, 0.4],
    ['#ffc52e', 2.5, 0.19, 0.105, 0.56],
  ]
    .map(([c, le, y, ch, a]) => {
      const L = le as number;
      const Yy = y as number;
      const C = ch as number;
      const A = a as number;
      return `<path d="${P([
        [L, Yy],
        [L - C * Math.cos(A), Yy + C * Math.sin(A)],
      ])}" stroke="${c}" stroke-width="7" stroke-linecap="round"/>`;
    })
    .join('');
  const whiskers = [-0.05, 0.02, 0.09]
    .map(
      (d, i) =>
        `<path d="M${X(2.66)} ${Y(0.31 + i * 0.01)} q60 ${-20 + d * 300} 150 ${-34 + d * 520}" stroke="#f4f1ea" stroke-width="1.6" fill="none" stroke-linecap="round" opacity="0.8"/>`,
    )
    .join('');

  return `<svg class="car-poster-svg" viewBox="0 0 1160 330" role="img" aria-label="Side view of the BR-09 Purrari in car #${num} livery: a black and gold Formula 1 car with cat ears on the airbox, whiskers on the nose, a curled tail antenna and paw-print wheel covers" preserveAspectRatio="xMidYMid meet">
    <defs>
      <linearGradient id="${id}-body" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#2a2a37"/><stop offset="0.55" stop-color="#101017"/><stop offset="1" stop-color="#07070b"/>
      </linearGradient>
      <linearGradient id="${id}-livery" x1="0" y1="1" x2="1" y2="0">
        <stop offset="0" stop-color="#a0153e"/><stop offset="0.5" stop-color="#ff6a13"/><stop offset="1" stop-color="#ffc52e"/>
      </linearGradient>
      <radialGradient id="${id}-disc"><stop offset="0" stop-color="#1c1c24"/><stop offset="1" stop-color="#07070b"/></radialGradient>
      <radialGradient id="${id}-shadow"><stop offset="0" stop-color="#000" stop-opacity="0.8"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
    </defs>
    <ellipse cx="${X(0.2)}" cy="${Y(0) + 4}" rx="560" ry="22" fill="url(#${id}-shadow)"/>
    <path d="${rearWing}" fill="#101017" stroke="#ffc52e" stroke-width="3" stroke-linejoin="round"/>
    <path d="${P([[-1.9, 0.79], [-2.2, 0.85]])} ${P([[-2.14, 0.86], [-2.32, 0.985]])}" stroke="#ffc52e" stroke-width="8" stroke-linecap="round"/>
    <path d="${tail}" fill="none" stroke="#ffc52e" stroke-width="7" stroke-linecap="round" stroke-dasharray="14 7"/>
    <path d="${fin}" fill="#07070b" stroke="#ffc52e" stroke-width="2.5" stroke-linejoin="round"/>
    <text x="${X(-1.22)}" y="${Y(0.7)}" font-family="Saira Variable, Arial Narrow, sans-serif" font-weight="900" font-size="30" fill="#ffc52e" text-anchor="middle">9</text>
    <path d="${body}" fill="url(#${id}-body)" stroke="#ffc52e" stroke-width="3" stroke-linejoin="round"/>
    <path d="${P([[-2.05, 0.505], [-0.6, 0.79], [0.95, 0.67], [2.9, 0.3]])}" fill="none" stroke="#ffc52e" stroke-width="3" opacity="0.9"/>
    <path d="${pod}" fill="#0c0c12" stroke="#ffc52e" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="${sweep}" fill="url(#${id}-livery)"/>
    <text x="${X(0.02)}" y="${Y(0.36)}" font-family="Saira Variable, Arial Narrow, sans-serif" font-weight="900" font-size="40" font-stretch="62%" fill="#ffc52e" text-anchor="middle" transform="skewX(-10)" transform-origin="${X(0.02)} ${Y(0.36)}">BILAL</text>
    <text x="${X(0.02)}" y="${Y(0.27)}" font-family="JetBrains Mono Variable, ui-monospace, monospace" font-weight="700" font-size="12" letter-spacing="1.5" fill="#f4f1ea" text-anchor="middle">RACING · #${num} ${code}</text>
    <path d="${ear(-0.3)}" fill="#07070b" stroke="#ffc52e" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="${P([[-0.34, 0.94], [-0.31, 1.02], [-0.27, 0.94]])}" fill="#e0457b"/>
    <circle cx="${X(0.1)}" cy="${Y(0.79)}" r="${0.125 * 185}" fill="#0d0d12" stroke="#ffc52e" stroke-width="2.5"/>
    <path d="M${X(0.1) + 4} ${Y(0.82)} a${0.125 * 185} ${0.125 * 185} 0 0 1 ${0.12 * 185} 16 l-2 18 h-${0.12 * 185 - 8} z" fill="#ffc52e"/>
    <path d="${P([[0.05, 0.9], [0.08, 0.97], [0.12, 0.9]])}" fill="#07070b" stroke="#ffc52e" stroke-width="2"/>
    <path d="${halo}" fill="none" stroke="#ffc52e" stroke-width="9" stroke-linecap="round"/>
    <text x="${X(1.2)}" y="${Y(0.3)}" font-family="Saira Variable, Arial Narrow, sans-serif" font-weight="900" font-size="46" font-stretch="75%" fill="#ffc52e" text-anchor="middle">${num}</text>
    <ellipse cx="${X(2.92)}" cy="${Y(0.262)}" rx="9" ry="6" fill="#e0457b"/>
    ${whiskers}
    <path d="${P([[2.98, 0.08], [2.68, 0.1]])}" stroke="#2a2a37" stroke-width="9" stroke-linecap="round"/>
    ${flaps}
    <path d="${fwPlate}" fill="#101017" stroke="#ffc52e" stroke-width="3" stroke-linejoin="round"/>
    <rect x="${X(-2.2)}" y="${Y(0.078)}" width="${X(1.3) - X(-2.2)}" height="6" fill="#ffc52e"/>
    ${wheel(-1.5, 0.37, id)}
    ${wheel(1.9, 0.35, id)}
  </svg>`;
}
