/**
 * BR-09 "Purrari" — a stylised 2026-era F1 car built entirely from procedural
 * Three.js geometry (lofts, lathes, tubes, extrusions). No model files, no network.
 *
 * Car-local space: ground at y = 0, nose towards +z, x lateral. ≈5.6 × 2.0 × 0.95 units.
 * Every major part is its own named THREE.Group with exploded-view metadata (see parts.ts).
 *
 *   const car = buildCar({ anisotropy: renderer.capabilities.getMaxAnisotropy() });
 *   scene.add(car.root);
 *   car.spinWheels(0.2); car.setDRS(1); car.setPartExplode('rearwing', 0.5); car.dispose();
 */
import * as THREE from 'three';
import { DecalGeometry } from 'three/examples/jsm/geometries/DecalGeometry.js';
import { LoftGeometry } from 'three/examples/jsm/geometries/LoftGeometry.js';
import { PART_INFO, type PartId } from './parts';
import * as TX from './textures';

/* ================================================================== */
/* Public types                                                        */
/* ================================================================== */
export interface CarPartMeta {
  id: PartId;
  label: string;
  real: string;
  joke: string;
  /** Exploded-view offset (x mirrored outwards for paired parts). */
  explode: THREE.Vector3;
}

/** Parts list with exploded-view metadata (Vector3 offsets). */
export const CAR_PARTS: readonly CarPartMeta[] = PART_INFO.map((p) => ({
  id: p.id,
  label: p.label,
  real: p.real,
  joke: p.joke,
  explode: new THREE.Vector3(...p.explode),
}));

interface Mover {
  obj: THREE.Object3D;
  base: THREE.Vector3;
  offset: THREE.Vector3;
  baseRot: THREE.Euler;
  rot: THREE.Vector3;
}

export interface CarPart extends CarPartMeta {
  group: THREE.Group;
  /** Callout anchor in car-local space (before exploding). */
  anchor: THREE.Vector3;
  /** Current explode amount 0–1. */
  amount: number;
  movers: Mover[];
}

export interface Car {
  /** Place/rotate this in your scene. */
  root: THREE.Group;
  /** Inner group — shake / bob this without touching root. */
  body: THREE.Group;
  parts: CarPart[];
  part(id: PartId): CarPart;
  /** Every mesh (for raycasting). */
  meshes: THREE.Mesh[];
  /** Explode one part, 0 = assembled, 1 = fully exploded. */
  setPartExplode(id: PartId, t: number): void;
  /** Explode everything by the same amount. */
  setExplode(t: number): void;
  /** Roll all four wheels forward by `radians` of the front wheel. */
  spinWheels(radians: number): void;
  /** DRS flap: 0 = closed, 1 = fully open. */
  setDRS(open: number): void;
  /** Engine heat: exhaust, wheel-lip & power-unit glow, 0–1. */
  setGlow(level: number): void;
  /** Idle life: tail sway, ear twitches, purr pulse, blinking rain light. */
  update(time: number): void;
  /** World-space callout anchor for a part (follows explode + transforms). */
  anchorWorld(part: CarPart, target: THREE.Vector3): THREE.Vector3;
  dispose(): void;
}

export interface BuildCarOptions {
  anisotropy?: number;
  /** Fewer segments for phones. */
  lowPower?: boolean;
}

/* ================================================================== */
/* Geometry helpers                                                    */
/* ================================================================== */
interface Sec {
  z: number;
  y: number;
  w: number;
  top: number;
  bot: number;
  x?: number;
  /** Superellipse exponent, upper / lower half (2 = ellipse, higher = boxier). */
  n?: number;
  nb?: number;
  /** Width multiplier at the very top (tumblehome). */
  taper?: number;
}
type SecFull = Required<Sec>;
const SEC_FIELDS = ['y', 'w', 'top', 'bot', 'x', 'n', 'nb', 'taper'] as const;

const fullSec = (s: Sec): SecFull => ({ x: 0, n: 2.6, nb: 3, taper: 1, ...s });

function catmull(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

function sectionAt(keys: SecFull[], z: number): SecFull {
  const last = keys.length - 1;
  if (z <= keys[0].z) return { ...keys[0] };
  if (z >= keys[last].z) return { ...keys[last] };
  let i = 0;
  while (i < last - 1 && z > keys[i + 1].z) i++;
  const t = (z - keys[i].z) / (keys[i + 1].z - keys[i].z);
  const p0 = keys[Math.max(0, i - 1)];
  const p1 = keys[i];
  const p2 = keys[i + 1];
  const p3 = keys[Math.min(last, i + 2)];
  const out = { ...p1, z };
  for (const f of SEC_FIELDS) out[f] = catmull(p0[f], p1[f], p2[f], p3[f], t);
  out.w = Math.max(0.002, out.w);
  out.top = Math.max(0.002, out.top);
  out.bot = Math.max(0.002, out.bot);
  return out;
}

function ringPoint(s: SecFull, u: number, out: THREE.Vector3): THREE.Vector3 {
  const th = -Math.PI / 2 + u * Math.PI * 2;
  const c = Math.cos(th);
  const sn = Math.sin(th);
  const upper = sn >= 0;
  const e = 2 / (upper ? s.n : s.nb);
  const px = Math.sign(c) * Math.pow(Math.abs(c), e);
  const py = Math.sign(sn) * Math.pow(Math.abs(sn), e);
  const w = s.w * (upper ? 1 + (s.taper - 1) * sn : 1);
  return out.set(s.x + px * w, s.y + py * (upper ? s.top : s.bot), s.z);
}

/**
 * Superellipse loft along z. uv.x = around the section (0 = bottom centre,
 * 0.25 = +x side, 0.5 = top), uv.y = along z. Group 0 = skin, group 1 = caps.
 */
function loftGeometry(keysIn: Sec[], opts: { ring?: number; steps?: number; capStart?: boolean; capEnd?: boolean } = {}): THREE.BufferGeometry {
  const keys = keysIn.map(fullSec).sort((a, b) => a.z - b.z);
  const ring = opts.ring ?? 56;
  const steps = opts.steps ?? 40;
  const z0 = keys[0].z;
  const z1 = keys[keys.length - 1].z;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const v = new THREE.Vector3();
  const secs: SecFull[] = [];
  for (let i = 0; i <= steps; i++) {
    const s = sectionAt(keys, z0 + ((z1 - z0) * i) / steps);
    secs.push(s);
    for (let j = 0; j <= ring; j++) {
      ringPoint(s, j / ring, v);
      pos.push(v.x, v.y, v.z);
      uv.push(j / ring, i / steps);
    }
  }
  const row = ring + 1;
  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < ring; j++) {
      const a = i * row + j;
      const b = a + 1;
      const c = a + row;
      const d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  }
  const skinCount = idx.length;
  const cap = (s: SecFull, front: boolean) => {
    const base = pos.length / 3;
    pos.push(s.x, s.y, s.z);
    uv.push(0.5, 0.5);
    for (let j = 0; j <= ring; j++) {
      ringPoint(s, j / ring, v);
      pos.push(v.x, v.y, v.z);
      uv.push(0.5 + (v.x - s.x) / (2 * s.w), 0.5 + (v.y - s.y) / (s.top + s.bot));
    }
    for (let j = 0; j < ring; j++) {
      const p = base + 1 + j;
      if (front) idx.push(base, p, p + 1);
      else idx.push(base, p + 1, p);
    }
  };
  if (opts.capStart) cap(secs[0], false);
  if (opts.capEnd) cap(secs[steps], true);

  const geo = new THREE.BufferGeometry();
  geo.setIndex(idx);
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  // weld the seam normals (duplicated first/last column)
  const n = geo.getAttribute('normal') as THREE.BufferAttribute;
  for (let i = 0; i <= steps; i++) {
    const a = i * row;
    const b = a + ring;
    v.set(n.getX(a) + n.getX(b), n.getY(a) + n.getY(b), n.getZ(a) + n.getZ(b)).normalize();
    n.setXYZ(a, v.x, v.y, v.z);
    n.setXYZ(b, v.x, v.y, v.z);
  }
  geo.addGroup(0, skinCount, 0);
  if (idx.length > skinCount) geo.addGroup(skinCount, idx.length - skinCount, 1);
  return geo;
}

/** Airfoil in the (z, y) plane: LE at z = 0, chord runs towards −z. CCW from +x. */
function airfoilPoints(chord: number, thick: number, camber: number, n = 18): Array<[number, number]> {
  const p = 0.4;
  const upper: Array<[number, number]> = [];
  const lower: Array<[number, number]> = [];
  for (let i = 0; i <= n; i++) {
    const x = (1 - Math.cos((i / n) * Math.PI)) / 2;
    const yt = 5 * thick * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4);
    const yc = x < p ? (camber / (p * p)) * (2 * p * x - x * x) : (camber / (1 - p) ** 2) * (1 - 2 * p + 2 * p * x - x * x);
    upper.push([-x * chord, (yc + yt) * chord]);
    lower.push([-x * chord, (yc - yt) * chord]);
  }
  // LE → along the lower surface → TE → back along the upper surface
  return [...lower, ...upper.slice(1, -1).reverse()];
}

interface WingOpts {
  chord: number;
  span: number;
  le: number;
  y: number;
  aoa: number;
  thick?: number;
  camber?: number;
  bend?: number;
  sweep?: number;
  stations?: number;
  /** Shift the airfoil so its trailing edge sits at the origin (for pivoting flaps). */
  pivotTE?: boolean;
}

/** Swept wing element spanning x ∈ [−span/2, span/2]; bend/sweep curl the tips like whiskers. */
function wingGeometry(o: WingOpts): THREE.BufferGeometry {
  const foil = airfoilPoints(o.chord, o.thick ?? 0.1, o.camber ?? -0.05);
  const stations = o.stations ?? 20;
  const ca = Math.cos(o.aoa);
  const sa = Math.sin(o.aoa);
  const sections: THREE.Vector3[][] = [];
  for (let i = 0; i <= stations; i++) {
    const x = -o.span / 2 + (o.span * i) / stations;
    const k = (x / (o.span / 2)) ** 2;
    sections.push(
      foil.map(([fz, fy]) => {
        const lz = o.pivotTE ? fz + o.chord : fz;
        // rotate about x so the trailing edge lifts by aoa
        const ry = fy * ca - lz * sa;
        const rz = fy * sa + lz * ca;
        return new THREE.Vector3(x, o.y + ry + (o.bend ?? 0) * k, o.le + rz + (o.sweep ?? 0) * k);
      }),
    );
  }
  return new LoftGeometry(sections, { closed: true, capStart: true, capEnd: true });
}

/** Tube with a radius that tapers along its length (TubeGeometry post-processed). */
function taperedTube(curve: THREE.Curve<THREE.Vector3>, radius: number, taper: (t: number) => number, segs = 48, radial = 8): THREE.TubeGeometry {
  const geo = new THREE.TubeGeometry(curve, segs, radius, radial, false);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const c = new THREE.Vector3();
  const p = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    curve.getPointAt(i / segs, c);
    const s = taper(i / segs);
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j;
      p.fromBufferAttribute(pos, k).sub(c).multiplyScalar(s).add(c);
      pos.setXYZ(k, p.x, p.y, p.z);
    }
  }
  geo.computeVertexNormals();
  return geo;
}

const UP = new THREE.Vector3(0, 1, 0);
/** Cylinder strut between two points. */
function strut(a: THREE.Vector3Tuple, b: THREE.Vector3Tuple, r: number, mat: THREE.Material): THREE.Mesh {
  const va = new THREE.Vector3(...a);
  const vb = new THREE.Vector3(...b);
  const dir = vb.clone().sub(va);
  const len = dir.length();
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8, 1), mat);
  mesh.position.copy(va).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(UP, dir.normalize());
  return mesh;
}

/** Shape helper with quadratic curves: points are [x, y] or [cx, cy, x, y]. */
function curvyPlate(cmds: number[][], thickness: number): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  cmds.forEach((c, i) => {
    if (i === 0) shape.moveTo(c[0], c[1]);
    else if (c.length === 4) shape.quadraticCurveTo(c[0], c[1], c[2], c[3]);
    else shape.lineTo(c[0], c[1]);
  });
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 14 });
  geo.rotateY(Math.PI / 2);
  geo.translate(-thickness / 2, 0, 0);
  return geo;
}

/* ================================================================== */
/* Car layout constants                                                */
/* ================================================================== */
const FRONT_AXLE = 1.9;
const REAR_AXLE = -1.5;
const FRONT_WHEEL = { r: 0.35, w: 0.3, x: 0.83 };
const REAR_WHEEL = { r: 0.37, w: 0.38, x: 0.8 };
const RIM_R = 0.232;

const TUB: Sec[] = [
  { z: -0.45, y: 0.4, w: 0.4, top: 0.32, bot: 0.32, n: 3, nb: 6, taper: 0.82 },
  { z: 0.3, y: 0.4, w: 0.38, top: 0.29, bot: 0.31, n: 3, nb: 6, taper: 0.85 },
  { z: 0.95, y: 0.43, w: 0.3, top: 0.23, bot: 0.2, n: 2.8, nb: 5, taper: 0.9 },
];
const NOSE: Sec[] = [
  { z: 0.95, y: 0.43, w: 0.3, top: 0.23, bot: 0.2, n: 2.8, nb: 5, taper: 0.9 },
  { z: 1.5, y: 0.4, w: 0.225, top: 0.175, bot: 0.165, n: 2.7, nb: 4, taper: 0.9 },
  { z: 2.05, y: 0.345, w: 0.16, top: 0.12, bot: 0.12, n: 2.5, nb: 3.2 },
  { z: 2.55, y: 0.285, w: 0.105, top: 0.08, bot: 0.085, n: 2.3, nb: 2.8 },
  { z: 2.9, y: 0.25, w: 0.05, top: 0.04, bot: 0.045, n: 2.2, nb: 2.4 },
];
const POD: Sec[] = [
  { z: -1.55, x: 0.3, y: 0.26, w: 0.06, top: 0.06, bot: 0.1, n: 3, nb: 3 },
  { z: -1.1, x: 0.4, y: 0.3, w: 0.13, top: 0.12, bot: 0.18, n: 3.4, nb: 3 },
  { z: -0.45, x: 0.53, y: 0.36, w: 0.2, top: 0.19, bot: 0.25, n: 4, nb: 3, taper: 0.85 },
  { z: 0.15, x: 0.575, y: 0.41, w: 0.21, top: 0.2, bot: 0.3, n: 4, nb: 3.2, taper: 0.85 },
  { z: 0.55, x: 0.565, y: 0.44, w: 0.195, top: 0.16, bot: 0.22, n: 4.5, nb: 4, taper: 0.9 },
];
const COVER: Sec[] = [
  { z: -2.05, y: 0.45, w: 0.055, top: 0.05, bot: 0.05, n: 2.4, nb: 2.4 },
  { z: -1.6, y: 0.47, w: 0.13, top: 0.12, bot: 0.16, n: 2.6, nb: 3 },
  { z: -1.1, y: 0.49, w: 0.215, top: 0.21, bot: 0.3, n: 2.8, nb: 3.5, taper: 0.75 },
  { z: -0.6, y: 0.51, w: 0.27, top: 0.27, bot: 0.36, n: 3, nb: 4, taper: 0.7 },
  { z: -0.3, y: 0.51, w: 0.29, top: 0.25, bot: 0.38, n: 3, nb: 4, taper: 0.7 },
];
const AIRBOX: Sec[] = [
  { z: -0.66, y: 0.8, w: 0.1, top: 0.06, bot: 0.1, n: 2.6, nb: 3 },
  { z: -0.38, y: 0.83, w: 0.15, top: 0.1, bot: 0.13, n: 3, nb: 3.5, taper: 0.8 },
  { z: -0.14, y: 0.845, w: 0.155, top: 0.105, bot: 0.13, n: 3, nb: 3.5, taper: 0.8 },
  { z: -0.06, y: 0.845, w: 0.15, top: 0.1, bot: 0.125, n: 3, nb: 3.5, taper: 0.8 },
];
const GEARBOX: Sec[] = [
  { z: -2.05, y: 0.33, w: 0.07, top: 0.08, bot: 0.07, n: 3, nb: 3 },
  { z: -1.6, y: 0.33, w: 0.11, top: 0.12, bot: 0.12, n: 3, nb: 3 },
  { z: -1.15, y: 0.34, w: 0.15, top: 0.15, bot: 0.15, n: 3, nb: 3 },
];
const CRASH: Sec[] = [
  { z: -2.62, y: 0.335, w: 0.045, top: 0.05, bot: 0.05, n: 3, nb: 3 },
  { z: -2.0, y: 0.335, w: 0.075, top: 0.08, bot: 0.075, n: 3, nb: 3 },
];

/* ================================================================== */
/* buildCar                                                            */
/* ================================================================== */
export function buildCar(opts: BuildCarOptions = {}): Car {
  TX.setMaxAnisotropy(opts.anisotropy ?? 4);
  const low = Boolean(opts.lowPower);
  const RING = low ? 40 : 56;
  const STEPS = low ? 28 : 40;

  const textures: THREE.Texture[] = [];
  const tex = <T extends THREE.Texture>(t: T): T => {
    textures.push(t);
    return t;
  };

  /* ---------------- materials ---------------- */
  const paint = (map?: THREE.Texture, color = 0xffffff, metalness = 0.35, envMapIntensity = 1, clearcoat = 1) =>
    new THREE.MeshPhysicalMaterial({
      color: map ? 0xffffff : color,
      map: map ?? null,
      envMapIntensity,
      metalness,
      roughness: 0.3,
      clearcoat,
      clearcoatRoughness: 0.06,
    });
  const M = {
    black: paint(undefined, 0x0d0d12),
    gold: paint(undefined, 0xffc52e, 0.15, 0.5, 0.5),
    saffron: paint(undefined, 0xff6a13, 0.1, 0.45, 0.5),
    maroon: paint(undefined, 0xa0153e, 0.1, 0.45, 0.5),
    // satin paint for the whisker flaps so their colours don't wash out in reflections
    flapGold: new THREE.MeshPhysicalMaterial({ color: 0xffc52e, metalness: 0.05, roughness: 0.45, clearcoat: 0.2, clearcoatRoughness: 0.3, envMapIntensity: 0.35 }),
    flapSaffron: new THREE.MeshPhysicalMaterial({ color: 0xff6a13, metalness: 0.05, roughness: 0.45, clearcoat: 0.2, clearcoatRoughness: 0.3, envMapIntensity: 0.35 }),
    flapMaroon: new THREE.MeshPhysicalMaterial({ color: 0xa0153e, metalness: 0.05, roughness: 0.45, clearcoat: 0.2, clearcoatRoughness: 0.3, envMapIntensity: 0.35 }),
    goldMetal: new THREE.MeshPhysicalMaterial({ color: 0xffc52e, metalness: 0.9, roughness: 0.22, clearcoat: 0.5 }),
    carbon: new THREE.MeshPhysicalMaterial({ color: 0x4a4a52, map: tex(TX.carbonTexture()), metalness: 0, roughness: 0.8, specularIntensity: 0.1, envMapIntensity: 0.15 }),
    satin: new THREE.MeshStandardMaterial({ color: 0x16161d, metalness: 0.4, roughness: 0.5 }),
    engine: new THREE.MeshStandardMaterial({ color: 0x3b3b47, metalness: 0.85, roughness: 0.32 }),
    rim: new THREE.MeshStandardMaterial({ color: 0x24242c, metalness: 0.9, roughness: 0.28, side: THREE.DoubleSide }),
    intake: new THREE.MeshStandardMaterial({ color: 0x020203, metalness: 0, roughness: 1 }),
    visor: new THREE.MeshPhysicalMaterial({ color: 0xffc52e, metalness: 1, roughness: 0.08, clearcoat: 1 }),
    whisker: new THREE.MeshStandardMaterial({ color: 0xf4f1ea, emissive: 0x3a3630, roughness: 0.35 }),
    pink: paint(undefined, 0xe0457b),
    tail: new THREE.MeshPhysicalMaterial({ map: tex(TX.tailTexture()), metalness: 0.3, roughness: 0.35, clearcoat: 1 }),
    tyre: new THREE.MeshStandardMaterial({ map: null, roughness: 0.82, metalness: 0 }),
    cover: new THREE.MeshPhysicalMaterial({ map: tex(TX.wheelCoverTexture()), metalness: 0.4, roughness: 0.35, clearcoat: 1 }),
    glowRim: new THREE.MeshStandardMaterial({ color: 0xffc52e, metalness: 0.8, roughness: 0.25, emissive: 0xffc52e, emissiveIntensity: 0.15 }),
    glowExhaust: new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xff6a13, emissiveIntensity: 0.4 }),
    glowHot: new THREE.MeshStandardMaterial({ color: 0x2a0d00, emissive: 0xff6a13, emissiveIntensity: 0.8, metalness: 0.5, roughness: 0.4 }),
    glowCore: new THREE.MeshStandardMaterial({ color: 0x331f00, emissive: 0xffc52e, emissiveIntensity: 2 }),
    glowEye: new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffc52e, emissiveIntensity: 2.2 }),
    glowTeal: new THREE.MeshStandardMaterial({ color: 0x001a16, emissive: 0x14d5b4, emissiveIntensity: 1.4 }),
    glowRed: new THREE.MeshStandardMaterial({ color: 0x1a0000, emissive: 0xff2d3a, emissiveIntensity: 0.3 }),
  };
  const livery = {
    nose: paint(tex(TX.liveryTexture('nose'))),
    tub: paint(tex(TX.liveryTexture('tub'))),
    pod: paint(tex(TX.liveryTexture('sidepod'))),
    cover: paint(tex(TX.liveryTexture('cover'))),
    airbox: paint(tex(TX.liveryTexture('airbox'))),
  };
  const endplateTex = tex(TX.endplateTexture());
  const endplateMat = paint(endplateTex);

  /* ---------------- structure ---------------- */
  const root = new THREE.Group();
  root.name = 'BR-09';
  const body = new THREE.Group();
  body.name = 'body';
  root.add(body);

  const groups = {} as Record<PartId, THREE.Group>;
  for (const info of PART_INFO) {
    const g = new THREE.Group();
    g.name = info.id;
    groups[info.id] = g;
    body.add(g);
  }
  const add = (part: PartId, mesh: THREE.Object3D, parent?: THREE.Object3D) => {
    (parent ?? groups[part]).add(mesh);
    return mesh;
  };
  const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material | THREE.Material[]) => new THREE.Mesh(geo, mat);

  /* ---------------- monocoque ---------------- */
  const tub = mesh(loftGeometry(TUB, { ring: RING, steps: Math.round(STEPS * 0.6), capStart: true }), [livery.tub, M.satin]);
  add('monocoque', tub);
  // mirrors on stalks
  for (const s of [1, -1]) {
    add('monocoque', strut([s * 0.3, 0.62, 0.64], [s * 0.49, 0.74, 0.6], 0.011, M.satin));
    const housing = mesh(new THREE.SphereGeometry(1, 20, 12), M.black);
    housing.scale.set(0.085, 0.04, 0.032);
    housing.position.set(s * 0.5, 0.745, 0.6);
    add('monocoque', housing);
    const glass = mesh(new THREE.CircleGeometry(1, 20), M.visor);
    glass.scale.set(0.075, 0.032, 1);
    glass.rotation.y = Math.PI;
    glass.position.set(s * 0.5, 0.745, 0.567);
    add('monocoque', glass);
  }

  /* ---------------- nose + front wing (+ whiskers) ---------------- */
  const nose = mesh(loftGeometry(NOSE, { ring: RING, steps: STEPS, capEnd: true }), [livery.nose, livery.nose]);
  add('frontwing', nose);
  const catNose = mesh(new THREE.SphereGeometry(0.05, 18, 12), M.pink);
  catNose.scale.set(1, 0.62, 0.55);
  catNose.position.set(0, 0.262, 2.9);
  add('frontwing', catNose);
  const fwEls: Array<Partial<WingOpts> & { mat: THREE.Material }> = [
    { le: 2.98, chord: 0.3, y: 0.08, aoa: 0.04, bend: 0.025, sweep: 0.02, mat: M.black },
    { le: 2.72, chord: 0.15, y: 0.12, aoa: 0.24, bend: 0.05, sweep: 0.05, mat: M.flapMaroon },
    { le: 2.6, chord: 0.125, y: 0.155, aoa: 0.4, bend: 0.07, sweep: 0.07, mat: M.flapSaffron },
    { le: 2.5, chord: 0.105, y: 0.19, aoa: 0.56, bend: 0.09, sweep: 0.09, mat: M.flapGold },
  ];
  for (const el of fwEls) {
    add(
      'frontwing',
      mesh(
        wingGeometry({ span: 1.76, thick: 0.075, camber: -0.06, chord: el.chord!, le: el.le!, y: el.y!, aoa: el.aoa!, bend: el.bend, sweep: el.sweep, stations: low ? 14 : 22 }),
        el.mat,
      ),
    );
  }
  for (const s of [1, -1]) {
    const ep = mesh(
      curvyPlate(
        [
          [-3.0, 0.03],
          [-3.0, 0.14],
          [-2.92, 0.27, -2.66, 0.29],
          [-2.4, 0.3],
          [-2.4, 0.08],
          [-2.52, 0.03],
        ],
        0.02,
      ),
      [M.black, M.gold],
    );
    ep.position.x = s * 0.9;
    add('frontwing', ep);
  }
  // whiskers: three per side, fanned, tapering to a point
  for (const s of [1, -1]) {
    for (let k = 0; k < 3; k++) {
      const fan = k - 1;
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(s * 0.075, 0.3 + fan * 0.012, 2.62 - k * 0.04),
        new THREE.Vector3(s * 0.32, 0.33 + fan * 0.045, 2.66 - k * 0.05),
        new THREE.Vector3(s * 0.58, 0.35 + fan * 0.1, 2.6 - k * 0.09),
        new THREE.Vector3(s * 0.74, 0.34 + fan * 0.15, 2.48 - k * 0.12),
      ]);
      add('frontwing', mesh(taperedTube(curve, 0.0065, (t) => 1 - t * 0.85, 28, 5), M.whisker));
    }
  }

  /* ---------------- sidepods ---------------- */
  const podMeshes: THREE.Mesh[] = [];
  for (const s of [1, -1]) {
    const side = new THREE.Group();
    side.name = s > 0 ? 'sidepod-r' : 'sidepod-l';
    side.userData.side = s;
    groups.sidepods.add(side);
    const keys = POD.map((k) => ({ ...k, x: (k.x ?? 0) * s }));
    const pod = mesh(loftGeometry(keys, { ring: RING, steps: Math.round(STEPS * 0.8), capEnd: true, capStart: true }), [livery.pod, M.intake]);
    side.add(pod);
    podMeshes.push(pod);
    // gold lip around the radiator inlet
    const front = fullSec({ ...POD[POD.length - 1], x: (POD[POD.length - 1].x ?? 0) * s });
    const lip: THREE.Vector3[] = [];
    for (let j = 0; j < 32; j++) lip.push(ringPoint(front, j / 32, new THREE.Vector3()).setZ(front.z + 0.004));
    side.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(lip, true), 64, 0.012, 6, true), M.gold));
  }

  /* ---------------- floor & diffuser ---------------- */
  {
    const half: Array<[number, number]> = [
      [0.3, 1.3],
      [0.52, 1.1],
      [0.7, 0.7],
      [0.77, 0.3],
      [0.79, -0.5],
      [0.74, -0.95],
      [0.57, -1.08],
      [0.53, -1.25],
      [0.51, -2.12],
      [0.32, -2.2],
    ];
    const shape = new THREE.Shape();
    const pts = [...half, ...half.slice().reverse().map(([x, z]) => [-x, z] as [number, number])];
    pts.forEach(([x, z], i) => (i ? shape.lineTo(x, z) : shape.moveTo(x, z)));
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: false });
    geo.rotateX(Math.PI / 2); // shape y → z, extrusion → −y
    geo.translate(0, 0.078, 0);
    add('floor', mesh(geo, [M.carbon, M.gold]));
    // plank
    const plank = mesh(new THREE.BoxGeometry(0.3, 0.014, 3.1), M.maroon);
    plank.position.set(0, 0.041, -0.4);
    add('floor', plank);
    // diffuser roof (curved kick-up) + strakes
    const diff = curvyPlate(
      [
        [-(-1.15), 0.075],
        [-(-1.7), 0.09, -(-2.2), 0.28],
        [-(-2.2), 0.3],
        [-(-1.7), 0.115, -(-1.15), 0.1],
      ],
      1.0,
    );
    add('floor', mesh(diff, M.carbon));
    for (const x of [-0.46, -0.2, 0.2, 0.46]) {
      const strake = mesh(
        curvyPlate(
          [
            [1.45, 0.078],
            [1.8, 0.1, 2.18, 0.27],
            [2.18, 0.2],
            [1.9, 0.08],
          ],
          0.01,
        ),
        M.satin,
      );
      strake.position.x = x;
      add('floor', strake);
    }
  }

  /* ---------------- airbox with cat ears & eyes ---------------- */
  const earGroups: THREE.Group[] = [];
  {
    add('airbox', mesh(loftGeometry(AIRBOX, { ring: RING, steps: 18, capEnd: true, capStart: true }), [livery.airbox, M.intake]));
    const earShape = (scale: number) => {
      const sh = new THREE.Shape();
      sh.moveTo(-0.065 * scale, 0);
      sh.quadraticCurveTo(-0.04 * scale, 0.09 * scale, 0, 0.15 * scale);
      sh.quadraticCurveTo(0.04 * scale, 0.09 * scale, 0.065 * scale, 0);
      sh.closePath();
      return sh;
    };
    const outerGeo = new THREE.ExtrudeGeometry(earShape(1), { depth: 0.035, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2 });
    outerGeo.translate(0, 0, -0.0175);
    const innerGeo = new THREE.ShapeGeometry(earShape(0.62));
    for (const s of [1, -1]) {
      const ear = new THREE.Group();
      ear.position.set(s * 0.085, 0.925, -0.3);
      ear.rotation.set(-0.12, 0, -s * 0.3);
      const outer = mesh(outerGeo, M.black);
      const inner = mesh(innerGeo, M.pink);
      inner.position.set(0, 0.014, 0.028);
      ear.add(outer, inner);
      add('airbox', ear);
      earGroups.push(ear);
      // glowing slit-pupil eyes on the intake face
      const eye = mesh(new THREE.CircleGeometry(1, 24), M.glowEye);
      eye.scale.set(0.034, 0.024, 1);
      eye.position.set(s * 0.075, 0.888, -0.053);
      add('airbox', eye);
      const pupil = mesh(new THREE.CircleGeometry(1, 16), M.intake);
      pupil.scale.set(0.0075, 0.021, 1);
      pupil.position.set(s * 0.075, 0.888, -0.051);
      add('airbox', pupil);
    }
  }

  /* ---------------- engine cover, shark fin, curled-tail antenna ---------------- */
  const cover = mesh(loftGeometry(COVER, { ring: RING, steps: STEPS, capEnd: true }), [livery.cover, M.satin]);
  add('enginecover', cover);
  const fin = mesh(
    curvyPlate(
      [
        [0.45, 0.72],
        [0.45, 0.8],
        [1.5, 0.875],
        [1.64, 0.87, 1.67, 0.8],
        [1.92, 0.48],
        [1.6, 0.52],
        [1.1, 0.62],
      ],
      0.012,
    ),
    [M.black, M.gold],
  );
  add('enginecover', fin);
  const tailPivot = new THREE.Group();
  tailPivot.position.set(0, 0.86, -1.52);
  add('enginecover', tailPivot);
  {
    const b = tailPivot.position;
    const curve = new THREE.CatmullRomCurve3(
      [
        [0, 0.86, -1.52],
        [0, 0.98, -1.6],
        [0, 1.1, -1.62],
        [0, 1.2, -1.56],
        [0, 1.235, -1.46],
        [0, 1.2, -1.37],
        [0, 1.13, -1.37],
        [0, 1.105, -1.44],
      ].map(([x, y, z]) => new THREE.Vector3(x - b.x, y - b.y, z - b.z)),
    );
    tailPivot.add(mesh(taperedTube(curve, 0.024, (t) => 1 - t * 0.55, 72, 10), M.tail));
    const tip = mesh(new THREE.SphereGeometry(0.013, 12, 8), M.gold);
    curve.getPointAt(1, tip.position);
    tailPivot.add(tip);
  }

  /* ---------------- halo ---------------- */
  {
    const hoop = new THREE.CatmullRomCurve3(
      [
        [-0.29, 0.64, -0.3],
        [-0.305, 0.8, -0.14],
        [-0.27, 0.87, 0.1],
        [-0.17, 0.895, 0.33],
        [0, 0.9, 0.45],
        [0.17, 0.895, 0.33],
        [0.27, 0.87, 0.1],
        [0.305, 0.8, -0.14],
        [0.29, 0.64, -0.3],
      ].map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    );
    add('halo', mesh(new THREE.TubeGeometry(hoop, 96, 0.027, 12, false), M.goldMetal));
    const pillar = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.9, 0.45), new THREE.Vector3(0, 0.8, 0.57), new THREE.Vector3(0, 0.66, 0.68)]);
    add('halo', mesh(taperedTube(pillar, 0.028, (t) => 1 + t * 0.35, 16, 12), M.goldMetal));
  }

  /* ---------------- cockpit: opening, cat-ear helmet, steering wheel ---------------- */
  {
    tub.updateMatrixWorld(true);
    const ray = new THREE.Raycaster();
    const down = new THREE.Vector3(0, -1, 0);
    const o = new THREE.Vector3();
    const surfaceY = (x: number, z: number) => {
      ray.set(o.set(x, 2, z), down);
      const hit = ray.intersectObject(tub, false)[0];
      return hit ? hit.point.y : 0.7;
    };
    // dark opening conformed to the tub's top surface
    const hole = new THREE.RingGeometry(0.0001, 1, 40, 5);
    hole.rotateX(-Math.PI / 2);
    const hp = hole.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < hp.count; i++) {
      const x = hp.getX(i) * 0.235;
      const z = hp.getZ(i) * 0.4 + 0.16;
      hp.setXYZ(i, x, surfaceY(x, z) + 0.004, z);
    }
    hole.computeVertexNormals();
    add('cockpit', mesh(hole, M.intake));
    const rimPts: THREE.Vector3[] = [];
    for (let j = 0; j < 40; j++) {
      const a = (j / 40) * Math.PI * 2;
      const x = Math.cos(a) * 0.24;
      const z = Math.sin(a) * 0.41 + 0.16;
      rimPts.push(new THREE.Vector3(x, surfaceY(x, z) + 0.012, z));
    }
    add('cockpit', mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rimPts, true), 80, 0.02, 8, true), M.maroon));
    // headrest pads
    for (const s of [1, -1]) {
      const pad = mesh(new THREE.BoxGeometry(0.08, 0.07, 0.24), M.maroon);
      pad.position.set(s * 0.17, surfaceY(s * 0.17, 0.02) + 0.02, 0.02);
      add('cockpit', pad);
    }
    // helmet
    const helmet = new THREE.Group();
    helmet.position.set(0, 0.785, 0.1);
    add('cockpit', helmet);
    helmet.add(mesh(new THREE.SphereGeometry(0.125, 32, 24), M.black));
    const visor = mesh(new THREE.SphereGeometry(0.128, 32, 10, Math.PI / 2 - 0.95, 1.9, 1.22, 0.42), M.visor);
    helmet.add(visor);
    const stripe = mesh(new THREE.TorusGeometry(0.126, 0.012, 8, 40, Math.PI), M.gold);
    stripe.rotation.y = Math.PI / 2;
    helmet.add(stripe);
    for (const s of [1, -1]) {
      const ear = mesh(new THREE.ConeGeometry(0.042, 0.085, 3), M.black);
      ear.position.set(s * 0.066, 0.108, -0.01);
      ear.rotation.set(0, Math.PI / 6, -s * 0.38);
      helmet.add(ear);
      const inner = mesh(new THREE.ConeGeometry(0.022, 0.05, 3), M.pink);
      inner.position.set(s * 0.066, 0.104, 0.016);
      inner.rotation.copy(ear.rotation);
      helmet.add(inner);
    }
    // steering wheel with a NAP button
    const wheel = new THREE.Group();
    wheel.position.set(0, 0.67, 0.36);
    wheel.rotation.x = -0.55;
    add('cockpit', wheel);
    wheel.add(mesh(new THREE.BoxGeometry(0.2, 0.085, 0.03), M.satin));
    for (const s of [1, -1]) {
      const grip = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.1, 10), M.black);
      grip.position.set(s * 0.1, 0, 0);
      wheel.add(grip);
    }
    const screen = mesh(new THREE.PlaneGeometry(0.07, 0.035), M.glowTeal);
    screen.position.set(0, 0.012, -0.016);
    screen.rotation.y = Math.PI;
    wheel.add(screen);
    const nap = mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.01, 12), M.glowRed);
    nap.rotation.x = Math.PI / 2;
    nap.position.set(0.055, -0.022, -0.017);
    wheel.add(nap);
  }

  /* ---------------- power unit (+ gearbox) ---------------- */
  {
    const pu = groups.powerunit;
    const crank = mesh(new THREE.BoxGeometry(0.2, 0.16, 0.7), M.engine);
    crank.position.set(0, 0.27, -0.86);
    pu.add(crank);
    for (const s of [1, -1]) {
      const bank = new THREE.Group();
      bank.position.set(s * 0.06, 0.33, -0.86);
      bank.rotation.z = -s * 0.6;
      pu.add(bank);
      const block = mesh(new THREE.BoxGeometry(0.12, 0.17, 0.6), M.engine);
      block.position.y = 0.085;
      bank.add(block);
      for (let c = 0; c < 3; c++) {
        const head = mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.035, 16), M.goldMetal);
        head.position.set(0, 0.185, -0.19 + c * 0.19);
        bank.add(head);
        const spark = mesh(new THREE.TorusGeometry(0.03, 0.006, 6, 20), M.glowHot);
        spark.rotation.x = Math.PI / 2;
        spark.position.set(0, 0.205, -0.19 + c * 0.19);
        bank.add(spark);
      }
      // hot exhaust headers into the turbo
      const header = new THREE.CatmullRomCurve3([
        new THREE.Vector3(s * 0.16, 0.36, -0.7),
        new THREE.Vector3(s * 0.19, 0.3, -0.95),
        new THREE.Vector3(s * 0.12, 0.32, -1.2),
        new THREE.Vector3(s * 0.04, 0.37, -1.28),
      ]);
      pu.add(mesh(new THREE.TubeGeometry(header, 24, 0.018, 8, false), M.glowHot));
      // MGU-K / energy store glow strips
      const strip = mesh(new THREE.BoxGeometry(0.012, 0.03, 0.4), M.glowTeal);
      strip.position.set(s * 0.155, 0.13, -0.55);
      pu.add(strip);
    }
    const core = mesh(new THREE.IcosahedronGeometry(0.07, 2), M.glowCore);
    core.position.set(0, 0.47, -0.86);
    pu.add(core);
    const battery = mesh(new THREE.BoxGeometry(0.3, 0.07, 0.42), M.satin);
    battery.position.set(0, 0.12, -0.55);
    pu.add(battery);
    const turbo = mesh(new THREE.TorusGeometry(0.065, 0.034, 12, 28), M.goldMetal);
    turbo.position.set(0, 0.37, -1.3);
    pu.add(turbo);
    const turboCore = mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.06, 20), M.glowHot);
    turboCore.rotation.x = Math.PI / 2;
    turboCore.position.set(0, 0.37, -1.3);
    pu.add(turboCore);
    const mguk = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.16, 20), M.engine);
    mguk.rotation.x = Math.PI / 2;
    mguk.position.set(0.12, 0.2, -1.12);
    pu.add(mguk);
    pu.add(mesh(loftGeometry(GEARBOX, { ring: 32, steps: 16, capStart: true, capEnd: true }), [M.satin, M.satin]));
  }

  /* ---------------- rear wing, crash structure, exhaust, rain light ---------------- */
  let drsPivot: THREE.Group;
  const DRS_CLOSED = 0.62;
  {
    add('rearwing', mesh(wingGeometry({ chord: 0.3, span: 1.0, le: -1.9, y: 0.79, aoa: 0.18, thick: 0.1, camber: -0.07, stations: 10 }), M.black));
    drsPivot = new THREE.Group();
    drsPivot.position.set(0, 0.985, -2.32);
    drsPivot.rotation.x = DRS_CLOSED;
    add('rearwing', drsPivot);
    drsPivot.add(mesh(wingGeometry({ chord: 0.22, span: 0.99, le: 0, y: 0, aoa: 0, thick: 0.1, camber: -0.06, stations: 10, pivotTE: true }), M.gold));
    for (const s of [1, -1]) {
      const ep = mesh(
        curvyPlate(
          [
            [1.8, 0.34],
            [1.8, 0.86],
            [1.86, 1.0, 2.08, 1.01],
            [2.38, 1.01],
            [2.46, 1.0, 2.46, 0.93],
            [2.46, 0.55],
            [2.44, 0.4, 2.26, 0.34],
          ],
          0.022,
        ),
        [endplateMat, M.gold],
      );
      ep.position.x = s * 0.505;
      add('rearwing', ep);
      // twin swan-neck pylons
      const py = mesh(
        curvyPlate(
          [
            [2.02, 0.4],
            [2.1, 0.62, 2.0, 0.84],
            [2.12, 0.84],
            [2.2, 0.62, 2.22, 0.4],
          ],
          0.016,
        ),
        M.satin,
      );
      py.position.x = s * 0.075;
      add('rearwing', py);
    }
    // endplate UVs: shape coords → 0..1
    endplateTex.repeat.set(1 / 0.66, 1 / 0.67);
    endplateTex.offset.set(-1.8 / 0.66, -0.34 / 0.67);
    add('rearwing', mesh(loftGeometry(CRASH, { ring: 28, steps: 10, capStart: true }), [M.satin, M.satin]));
    const rain = mesh(new THREE.CircleGeometry(1, 24), M.glowRed);
    rain.scale.set(0.055, 0.03, 1);
    rain.rotation.y = Math.PI;
    rain.position.set(0, 0.335, -2.625);
    add('rearwing', rain);
    const slit = mesh(new THREE.CircleGeometry(1, 12), M.intake);
    slit.scale.set(0.008, 0.026, 1);
    slit.rotation.y = Math.PI;
    slit.position.set(0, 0.335, -2.628);
    add('rearwing', slit);
    const pipe = mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.2, 24, 1, true), M.rim);
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(0, 0.47, -2.08);
    add('rearwing', pipe);
    const flame = mesh(new THREE.CircleGeometry(0.044, 24), M.glowExhaust);
    flame.rotation.y = Math.PI;
    flame.position.set(0, 0.47, -2.17);
    add('rearwing', flame);
  }

  /* ---------------- suspension ---------------- */
  for (const s of [1, -1]) {
    const S = (x: number, y: number, z: number): THREE.Vector3Tuple => [s * x, y, z];
    const r = 0.013;
    const F = FRONT_AXLE;
    const R = REAR_AXLE;
    // front: upper & lower wishbones, pushrod, track rod
    add('suspension', strut(S(0.15, 0.46, F + 0.2), S(0.7, 0.5, F), r, M.satin));
    add('suspension', strut(S(0.17, 0.46, F - 0.25), S(0.7, 0.5, F), r, M.satin));
    add('suspension', strut(S(0.13, 0.25, F + 0.25), S(0.72, 0.2, F), r, M.satin));
    add('suspension', strut(S(0.17, 0.22, F - 0.3), S(0.72, 0.2, F), r, M.satin));
    add('suspension', strut(S(0.7, 0.23, F + 0.02), S(0.15, 0.56, F - 0.15), r * 0.9, M.gold));
    add('suspension', strut(S(0.14, 0.32, F - 0.1), S(0.7, 0.32, F - 0.1), r * 0.8, M.satin));
    // rear
    add('suspension', strut(S(0.12, 0.46, R + 0.25), S(0.64, 0.53, R), r, M.satin));
    add('suspension', strut(S(0.1, 0.46, R - 0.25), S(0.64, 0.53, R), r, M.satin));
    add('suspension', strut(S(0.13, 0.19, R + 0.32), S(0.64, 0.19, R), r, M.satin));
    add('suspension', strut(S(0.09, 0.19, R - 0.3), S(0.64, 0.19, R), r, M.satin));
    add('suspension', strut(S(0.62, 0.5, R + 0.02), S(0.12, 0.22, R + 0.15), r * 0.9, M.gold));
    add('suspension', strut(S(0.08, 0.36, R), S(0.62, 0.37, R), r * 1.5, M.engine));
    // uprights
    for (const [z, rr] of [
      [F, FRONT_WHEEL.r],
      [R, REAR_WHEEL.r],
    ] as const) {
      const up = mesh(new THREE.BoxGeometry(0.05, 0.3, 0.1), M.engine);
      up.position.set(s * 0.68, rr, z);
      add('suspension', up);
    }
  }

  /* ---------------- wheels ---------------- */
  interface WheelRef {
    mount: THREE.Group;
    spinner: THREE.Group;
    side: number;
    radius: number;
  }
  const wheels: WheelRef[] = [];
  const buildTyre = (R: number, W: number) => {
    // rounded-rectangle profile (radius, axial), resampled by arc length
    const raw: THREE.Vector2[] = [];
    const cr = 0.055;
    const inner = RIM_R + 0.004;
    raw.push(new THREE.Vector2(inner, -W / 2 + 0.02));
    raw.push(new THREE.Vector2((inner + R) / 2, -W / 2 - 0.008));
    for (let a = -Math.PI / 2; a <= 0.0001; a += Math.PI / 16) raw.push(new THREE.Vector2(R - cr + Math.cos(a) * cr, -W / 2 + cr + Math.sin(a) * cr));
    for (let a = 0; a <= Math.PI / 2 + 0.0001; a += Math.PI / 16) raw.push(new THREE.Vector2(R - cr + Math.cos(a) * cr, W / 2 - cr + Math.sin(a) * cr));
    raw.push(new THREE.Vector2((inner + R) / 2, W / 2 + 0.008));
    raw.push(new THREE.Vector2(inner, W / 2 - 0.02));
    const path = new THREE.SplineCurve(raw);
    const pts = path.getSpacedPoints(48);
    // sidewall fraction for the texture: arc length until the tread starts
    const lengths = path.getLengths(200);
    const total = lengths[lengths.length - 1];
    let sideLen = 0;
    for (let i = 0; i <= 200; i++) {
      const p = path.getPoint(i / 200);
      if (p.x >= R - cr * 0.6) {
        sideLen = lengths[i];
        break;
      }
    }
    const geo = new THREE.LatheGeometry(pts, low ? 48 : 72);
    geo.rotateZ(-Math.PI / 2); // axle → x, +W/2 side → +x (outer)
    return { geo, side: sideLen / total };
  };
  const front = buildTyre(FRONT_WHEEL.r, FRONT_WHEEL.w);
  const rear = buildTyre(REAR_WHEEL.r, REAR_WHEEL.w);
  const rubber = (map: THREE.Texture) =>
    new THREE.MeshPhysicalMaterial({ map, roughness: 0.7, metalness: 0, specularIntensity: 0.3, envMapIntensity: 0.3 });
  const tyreFront = rubber(tex(TX.tyreTexture(front.side)));
  const tyreRear = rubber(tex(TX.tyreTexture(rear.side)));
  M.tyre.dispose();
  const coverGeo = new THREE.CircleGeometry(RIM_R, 48);
  coverGeo.rotateY(Math.PI / 2);
  const innerGeo = new THREE.CircleGeometry(RIM_R, 32);
  innerGeo.rotateY(-Math.PI / 2);
  const lipGeo = new THREE.TorusGeometry(RIM_R, 0.011, 8, 64);
  lipGeo.rotateY(Math.PI / 2);
  const nutGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.04, 6);
  nutGeo.rotateZ(Math.PI / 2);
  for (const [spec, z, t, mat] of [
    [FRONT_WHEEL, FRONT_AXLE, front, tyreFront],
    [REAR_WHEEL, REAR_AXLE, rear, tyreRear],
  ] as const) {
    const barrel = new THREE.CylinderGeometry(RIM_R, RIM_R, spec.w - 0.05, 40, 1, true);
    barrel.rotateZ(Math.PI / 2);
    for (const s of [1, -1]) {
      const mount = new THREE.Group();
      mount.position.set(s * spec.x, spec.r, z);
      mount.rotation.y = s > 0 ? 0 : Math.PI;
      mount.userData.side = s;
      const spinner = new THREE.Group();
      mount.add(spinner);
      spinner.add(mesh(t.geo, mat));
      spinner.add(mesh(barrel, M.rim));
      const c = mesh(coverGeo, M.cover);
      c.position.x = spec.w / 2 - 0.035;
      spinner.add(c);
      const i = mesh(innerGeo, M.satin);
      i.position.x = -spec.w / 2 + 0.03;
      spinner.add(i);
      const lip = mesh(lipGeo, M.glowRim);
      lip.position.x = spec.w / 2 - 0.03;
      spinner.add(lip);
      const nut = mesh(nutGeo, M.saffron);
      nut.position.x = spec.w / 2 - 0.02;
      spinner.add(nut);
      groups.wheels.add(mount);
      wheels.push({ mount, spinner, side: s, radius: spec.r });
    }
  }

  /* ---------------- decals ---------------- */
  root.updateMatrixWorld(true);
  const decalMat = (t: THREE.Texture) =>
    new THREE.MeshPhysicalMaterial({
      map: tex(t),
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
      metalness: 0.3,
      roughness: 0.3,
      clearcoat: 1,
    });
  const decal = (part: PartId, target: THREE.Mesh, p: THREE.Vector3Tuple, e: THREE.Vector3Tuple, size: THREE.Vector3Tuple, mat: THREE.Material, parent?: THREE.Object3D) => {
    const geo = new DecalGeometry(target, new THREE.Vector3(...p), new THREE.Euler(...e), new THREE.Vector3(...size));
    const m = mesh(geo, mat);
    m.renderOrder = 1;
    add(part, m, parent);
  };
  const nine = decalMat(TX.numberDecal());
  const rat = decalMat(TX.codeDecal('RAT'));
  const bilal = decalMat(TX.wordDecal('BILAL', { sub: 'RACING · 09', gradient: false }));
  decal('frontwing', nose, [0, 0.47, 2.12], [-Math.PI / 2, 0, 0], [0.24, 0.24, 0.2], nine);
  decal('frontwing', nose, [0, 0.58, 1.52], [-Math.PI / 2, 0, 0], [0.27, 0.1, 0.16], rat);
  podMeshes.forEach((pod, i) => {
    const s = i === 0 ? 1 : -1;
    decal('sidepods', pod, [s * 0.78, 0.42, 0.02], [0, (s * Math.PI) / 2, 0], [0.56, 0.17, 0.16], bilal, pod.parent ?? undefined);
  });
  for (const s of [1, -1]) decal('enginecover', fin, [s * 0.006, 0.72, -1.2], [0, (s * Math.PI) / 2, 0], [0.24, 0.22, 0.004], nine);

  /* ---------------- parts + movers ---------------- */
  const moverOf = (obj: THREE.Object3D, offset: THREE.Vector3, rot = new THREE.Vector3()): Mover => ({
    obj,
    base: obj.position.clone(),
    offset,
    baseRot: obj.rotation.clone(),
    rot,
  });
  const parts: CarPart[] = PART_INFO.map((info) => {
    const explode = new THREE.Vector3(...info.explode);
    const group = groups[info.id];
    let movers: Mover[];
    if (info.id === 'wheels') {
      movers = wheels.map((w) =>
        moverOf(w.mount, new THREE.Vector3(w.side * explode.x, explode.y, w.mount.position.z > 0 ? explode.z : -explode.z), new THREE.Vector3(0, w.side * 0.35, 0)),
      );
    } else if (info.id === 'sidepods') {
      movers = group.children.map((c) => moverOf(c, new THREE.Vector3((c.userData.side as number) * explode.x, explode.y, explode.z), new THREE.Vector3(0, 0, (c.userData.side as number) * -0.12)));
    } else {
      const rot = new THREE.Vector3();
      if (info.id === 'rearwing') rot.set(-0.18, 0, 0);
      if (info.id === 'halo') rot.set(0.25, 0, 0);
      if (info.id === 'airbox') rot.set(0, 0.2, 0);
      if (info.id === 'frontwing') rot.set(0.08, 0, 0);
      movers = [moverOf(group, explode.clone(), rot)];
    }
    return {
      id: info.id,
      label: info.label,
      real: info.real,
      joke: info.joke,
      explode,
      anchor: new THREE.Vector3(...info.anchor),
      amount: 0,
      group,
      movers,
    };
  });
  const byId = new Map(parts.map((p) => [p.id, p] as const));

  const meshes: THREE.Mesh[] = [];
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      meshes.push(o as THREE.Mesh);
      o.castShadow = false;
    }
  });

  /* ---------------- API ---------------- */
  const setPartExplode = (id: PartId, t: number) => {
    const p = byId.get(id);
    if (!p) return;
    p.amount = t;
    for (const m of p.movers) {
      m.obj.position.copy(m.base).addScaledVector(m.offset, t);
      m.obj.rotation.set(m.baseRot.x + m.rot.x * t, m.baseRot.y + m.rot.y * t, m.baseRot.z + m.rot.z * t);
    }
  };

  let glow = 0;
  const setGlow = (level: number) => {
    glow = THREE.MathUtils.clamp(level, 0, 1);
    M.glowExhaust.emissiveIntensity = 0.4 + glow * 6;
    M.glowRim.emissiveIntensity = 0.15 + glow * 2.2;
    M.glowHot.emissiveIntensity = 0.8 + glow * 3;
  };

  const tmp = new THREE.Vector3();
  return {
    root,
    body,
    parts,
    part: (id) => byId.get(id)!,
    meshes,
    setPartExplode,
    setExplode(t) {
      for (const p of parts) setPartExplode(p.id, t);
    },
    spinWheels(radians) {
      for (const w of wheels) w.spinner.rotation.x += w.side * radians * (FRONT_WHEEL.r / w.radius);
    },
    setDRS(open) {
      drsPivot.rotation.x = DRS_CLOSED - THREE.MathUtils.clamp(open, 0, 1) * 0.72;
    },
    setGlow,
    update(time) {
      tailPivot.rotation.z = Math.sin(time * 1.7) * 0.14;
      tailPivot.rotation.x = Math.sin(time * 1.13) * 0.06;
      // ear twitch every few seconds (left, then right)
      earGroups.forEach((ear, i) => {
        const phase = (time + i * 1.9) % 4.3;
        const flick = phase < 0.35 ? Math.sin((phase / 0.35) * Math.PI) * 0.35 : 0;
        const s = i === 0 ? 1 : -1;
        ear.rotation.z = -s * (0.3 + flick);
      });
      M.glowCore.emissiveIntensity = 1.8 + Math.sin(time * 8) * 0.6 + glow * 2;
      M.glowEye.emissiveIntensity = 2 + glow * 2.5;
      M.glowRed.emissiveIntensity = time % 1.1 < 0.14 ? 4 : 0.25;
    },
    anchorWorld(part, target) {
      const a = part.anchor;
      tmp.copy(part.explode);
      if (part.id === 'wheels' || part.id === 'sidepods') tmp.x *= Math.sign(a.x) || 1;
      if (part.id === 'wheels') tmp.z *= a.z > 0 ? 1 : -1;
      target.copy(a).addScaledVector(tmp, part.amount);
      return body.localToWorld(target);
    },
    dispose() {
      const geos = new Set<THREE.BufferGeometry>();
      const mats = new Set<THREE.Material>();
      root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        geos.add(m.geometry);
        (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => mats.add(x));
      });
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
      root.removeFromParent();
    },
  };
}
