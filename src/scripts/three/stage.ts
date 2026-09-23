/**
 * Shared WebGL plumbing for the hero and exploded-view scenes: renderer setup
 * (DPR caps), a livery-tinted studio environment, and a render loop that pauses
 * when the canvas is offscreen or the tab is hidden.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export function createRenderer(canvas: HTMLCanvasElement, lowPower: boolean): THREE.WebGLRenderer | null {
  try {
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower ? 1.25 : 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.setClearColor(0x000000, 0);
    return renderer;
  } catch {
    return null;
  }
}

/**
 * RoomEnvironment with extra livery-coloured softboxes, prefiltered with PMREM,
 * so the clearcoat picks up gold / saffron / maroon highlights. No HDR download.
 */
export function studioEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const room = new RoomEnvironment();
  const box = new THREE.BoxGeometry();
  const panel = (color: number, intensity: number, pos: THREE.Vector3Tuple, scale: THREE.Vector3Tuple) => {
    const m = new THREE.Mesh(box, new THREE.MeshLambertMaterial({ color: 0x000000, emissive: color, emissiveIntensity: intensity }));
    m.position.set(...pos);
    m.scale.set(...scale);
    room.add(m);
  };
  // narrow strips: they paint crisp coloured highlights into the clearcoat
  // without flooding diffuse surfaces with colour
  panel(0xffc52e, 14, [-13, 9, -4], [0.2, 0.9, 14]);
  panel(0xff6a13, 11, [13, 7, 5], [0.2, 0.7, 10]);
  panel(0xa0153e, 10, [0, 6, -13], [12, 0.6, 0.2]);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(room, 0.035).texture;
  pmrem.dispose();
  room.dispose();
  box.dispose();
  return env;
}

export interface Loop {
  /** Allow the loop to run (it still waits for visibility). */
  start(): void;
  stop(): void;
  /** Render one frame now, even when paused. */
  kick(): void;
  readonly visible: boolean;
  dispose(): void;
}

/**
 * rAF loop gated by IntersectionObserver + document visibility.
 * `frame(dt, time)` is called with seconds.
 */
export function createLoop(target: Element, frame: (dt: number, time: number) => void, rootMargin = '10% 0px'): Loop {
  let enabled = false;
  let visible = false;
  let raf = 0;
  let last = 0;
  let time = 0;

  const tick = (now: number) => {
    raf = 0;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
    last = now;
    time += dt;
    frame(dt, time);
    schedule();
  };
  const schedule = () => {
    if (raf || !enabled || !visible || document.hidden) {
      if (!raf) last = 0;
      return;
    }
    raf = requestAnimationFrame(tick);
  };
  const halt = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    last = 0;
  };

  const io = new IntersectionObserver(
    (entries) => {
      visible = entries.some((e) => e.isIntersecting);
      if (visible) schedule();
      else halt();
    },
    { rootMargin },
  );
  io.observe(target);
  const onVis = () => (document.hidden ? halt() : schedule());
  document.addEventListener('visibilitychange', onVis);

  return {
    start() {
      enabled = true;
      schedule();
    },
    stop() {
      enabled = false;
      halt();
    },
    kick() {
      frame(0, time);
    },
    get visible() {
      return visible;
    },
    dispose() {
      halt();
      enabled = false;
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
    },
  };
}

/** Frees everything hanging off a scene graph (geometries, materials, textures). */
export function disposeObject(root: THREE.Object3D): void {
  const mats = new Set<THREE.Material>();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => mats.add(x));
  });
  mats.forEach((m) => {
    for (const v of Object.values(m)) if (v instanceof THREE.Texture) v.dispose();
    m.dispose();
  });
}

/** Yield to the browser so heavy set-up steps don't block the intro animation. */
export const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeIn = (t: number) => t * t * t;
/** Progress of `p` through the window [a, b], clamped 0–1. */
export const span = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
