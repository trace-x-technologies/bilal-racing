/**
 * Exploded view of the BR-09 for the #car section. A scroll progress value (0–1)
 * drives a choreographed teardown: rotate to 3/4 → parts fly apart (staggered) →
 * guided tour with HTML callouts pinned to projected 3D anchors → DRS opens →
 * everything snaps back together.
 */
import * as THREE from 'three';
import { buildCar, type CarPart } from './car';
import * as TX from './textures';
import { clamp01, nextFrame, createLoop, createRenderer, disposeObject, easeInOut, lerp, span, studioEnvironment } from './stage';

export interface ExplodedSceneOptions {
  canvas: HTMLCanvasElement;
  /** Visible stage (loop runs only while it is on screen). */
  host: HTMLElement;
  /** Car is framed into this element's box (area not covered by panels). */
  frame: HTMLElement;
  /** Callout elements in PART_INFO order. */
  labels: HTMLElement[];
  /** Leader lines + anchor dots, same order. */
  lines: SVGLineElement[];
  dots: SVGCircleElement[];
  reduced: boolean;
  lowPower: boolean;
  onFirstFrame?: () => void;
  /** Guided-tour part changed (−1 = none). */
  onActive?: (index: number) => void;
}

export interface ExplodedScene {
  setProgress(p: number): void;
  /** Force one frame at a given progress (reduced motion / static render). */
  renderAt(p: number): void;
  dispose(): void;
}

const N = 12;
/** Phones and portrait tablets: numbered markers on the car (see CarExploded.astro). */
const COMPACT_QUERY = '(max-width: 759px), (max-width: 1099px) and (orientation: portrait)';
/** Minimum centre distance between compact markers (24 px discs, active one scaled up). */
const MARKER_GAP = 26;
const TOUR_START = 0.3;
const TOUR_END = 0.86;

export interface ExplodeState {
  az: number;
  el: number;
  zoom: number;
  explode: number[];
  drs: number;
  lift: number;
  active: number;
  labels: number;
  /** 0 = side-on, 1 = high 3/4 view (needs more room). */
  quarter: number;
}

/** The choreography, as a pure function of scroll progress. */
export function stateAt(p: number, portrait = false): ExplodeState {
  const explode: number[] = [];
  let sum = 0;
  for (let i = 0; i < N; i++) {
    const out = easeInOut(span(p, 0.07 + i * 0.017, 0.07 + i * 0.017 + 0.11));
    const back = easeInOut(span(p, 0.865 + (N - 1 - i) * 0.0045, 0.865 + (N - 1 - i) * 0.0045 + 0.05));
    const v = out * (1 - back);
    explode.push(v);
    sum += v;
  }
  const e = sum / N;
  const toQuarter = easeInOut(span(p, 0, 0.12));
  const tour = easeInOut(span(p, TOUR_START - 0.05, TOUR_END));
  const outro = easeInOut(span(p, 0.86, 0.98));
  // orbit front-left → around the side to the rear → rewind to a hero 3/4 as it rebuilds.
  // Portrait screens look down the car's length from higher up so it fills a tall frame.
  const az = portrait
    ? lerp(lerp(lerp(-1.05, -0.4, toQuarter), -1.0, tour), -0.8, outro)
    : lerp(lerp(lerp(-Math.PI / 2, -0.72, toQuarter), -2.35, tour), -0.95, outro);
  const el = portrait
    ? lerp(lerp(0.3, 0.78, toQuarter), 0.36, outro) + Math.sin(tour * Math.PI) * 0.14
    : lerp(lerp(0.06, 0.4, toQuarter), 0.16, outro) + Math.sin(tour * Math.PI) * 0.06;
  const drs = easeInOut(span(p, 0.78, 0.83)) * (1 - easeInOut(span(p, 0.9, 0.95)));
  let active = -1;
  if (p >= TOUR_START && p < TOUR_END) active = Math.min(N - 1, Math.floor(((p - TOUR_START) / (TOUR_END - TOUR_START)) * N));
  return {
    az,
    el,
    zoom: e,
    explode,
    drs,
    lift: e * 0.85,
    active,
    quarter: toQuarter * (1 - outro * 0.5),
    labels: clamp01(1 - span(p, 0.86, 0.9)),
  };
}

export async function createExplodedScene(o: ExplodedSceneOptions): Promise<ExplodedScene | null> {
  const renderer = createRenderer(o.canvas, o.lowPower);
  if (!renderer) return null;
  await TX.fontsReady();
  await nextFrame();

  const scene = new THREE.Scene();
  const envTex = studioEnvironment(renderer);
  scene.environment = envTex;
  scene.environmentIntensity = 0.6;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  await nextFrame();
  const car = buildCar({ anisotropy: renderer.capabilities.getMaxAnisotropy(), lowPower: o.lowPower });
  scene.add(car.root);

  /* ---------- lights ---------- */
  scene.add(new THREE.HemisphereLight(0xb8c4d8, 0x07070b, 0.5));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(-3, 8, 4);
  const rimA = new THREE.DirectionalLight(0xffc52e, 2);
  rimA.position.set(5, 5, -6);
  const rimB = new THREE.DirectionalLight(0x14d5b4, 1.2);
  rimB.position.set(-6, 2, -3);
  const rimC = new THREE.DirectionalLight(0xff6a13, 1.6);
  rimC.position.set(4, 1, 6);
  scene.add(key, rimA, rimB, rimC);

  /* ---------- blueprint floor ---------- */
  const grid = new THREE.Mesh(
    new THREE.PlaneGeometry(22, 22).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: TX.gridTexture(), transparent: true, opacity: 0.55, depthWrite: false }),
  );
  scene.add(grid);
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 6.4).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: TX.shadowTexture(), transparent: true, depthWrite: false }),
  );
  shadow.position.y = 0.006;
  car.root.add(shadow);
  // scanner ring under the car (pulses while exploded)
  const scanMat = new THREE.MeshBasicMaterial({ color: 0xffc52e, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  scanMat.toneMapped = false;
  const scan = new THREE.Mesh(new THREE.RingGeometry(3.6, 3.66, 128).rotateX(-Math.PI / 2), scanMat);
  scan.position.y = 0.01;
  scene.add(scan);

  /* ---------- auto-fit samples: box corners of every moving piece ---------- */
  interface Sample {
    obj: THREE.Object3D;
    base: THREE.Vector3;
    pts: THREE.Vector3[];
  }
  const samples: Sample[] = [];
  {
    car.root.updateMatrixWorld(true);
    const box = new THREE.Box3();
    for (const part of car.parts) {
      for (const m of part.movers) {
        box.setFromObject(m.obj);
        if (box.isEmpty()) continue;
        const { min, max } = box;
        const pts: THREE.Vector3[] = [];
        for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) pts.push(new THREE.Vector3(x, y, z));
        samples.push({ obj: m.obj, base: m.obj.position.clone(), pts });
      }
    }
  }
  const fitPts: THREE.Vector3[] = samples.flatMap((sm) => sm.pts.map(() => new THREE.Vector3()));
  const fitBox = new THREE.Box3();
  const fwd = new THREE.Vector3();
  const right = new THREE.Vector3();
  const camUp = new THREE.Vector3();
  const WORLD_UP = new THREE.Vector3(0, 1, 0);
  const off = new THREE.Vector3();
  const fit = (az: number, el: number, outTarget: THREE.Vector3): number => {
    let k = 0;
    fitBox.makeEmpty();
    for (const sm of samples) {
      off.copy(sm.obj.position).sub(sm.base).add(car.body.position);
      for (const pt of sm.pts) {
        fitPts[k].copy(pt).add(off);
        fitBox.expandByPoint(fitPts[k]);
        k++;
      }
    }
    fitBox.getCenter(outTarget);
    fwd.set(-Math.sin(az) * Math.cos(el), -Math.sin(el), -Math.cos(az) * Math.cos(el));
    right.crossVectors(fwd, WORLD_UP).normalize();
    camUp.crossVectors(right, fwd);
    const tv = tanV();
    const th = tv * camera.aspect;
    let d = 0;
    for (let i = 0; i < k; i++) {
      off.copy(fitPts[i]).sub(outTarget);
      const f = off.dot(fwd);
      d = Math.max(d, Math.abs(off.dot(right)) / (th * fitW * 0.94) - f, Math.abs(off.dot(camUp)) / (tv * fitH * 0.92) - f);
    }
    return d;
  };

  /* ---------- framing ---------- */
  let cw = 1;
  let ch = 1;
  let fitW = 6;
  let fitH = 3;
  let fx0 = 0;
  let fx1 = 1;
  const tanV = () => Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const resize = () => {
    cw = o.canvas.clientWidth;
    ch = o.canvas.clientHeight;
    if (!cw || !ch) return;
    renderer.setSize(cw, ch, false);
    camera.aspect = cw / ch;
    camera.fov = cw < 700 ? 34 : 28;
    const c = o.canvas.getBoundingClientRect();
    const r = o.frame.getBoundingClientRect();
    const cx = r.left - c.left + r.width / 2;
    const cy = r.top - c.top + r.height / 2;
    fitW = Math.max(0.2, r.width / cw);
    fitH = Math.max(0.2, r.height / ch);
    fx0 = Math.max(0, r.left - c.left);
    fx1 = Math.min(cw, r.right - c.left);
    camera.setViewOffset(cw, ch, -(cx - cw / 2), -(cy - ch / 2), cw, ch);
    camera.updateProjectionMatrix();
    labelSizes = o.labels.map((l) => [l.offsetWidth, l.offsetHeight]);
  };

  /* ---------- callouts ---------- */
  let labelSizes: Array<[number, number]> = o.labels.map(() => [0, 0]);
  const ro = new ResizeObserver(() => {
    labelSizes = o.labels.map((l) => [l.offsetWidth, l.offsetHeight]);
  });
  o.labels.forEach((l) => ro.observe(l));
  // Numbered markers + bench card. Must be identical to the phone @media query in
  // CarExploded.astro so JS marker mode and CSS marker styling always agree.
  const compactMQ = window.matchMedia(COMPACT_QUERY);
  const compact = () => compactMQ.matches;
  const v = new THREE.Vector3();
  const centerV = new THREE.Vector3();
  interface Placed {
    i: number;
    ax: number;
    ay: number;
    x: number;
    y: number;
    w: number;
    h: number;
    side: number;
    alpha: number;
  }
  let sizedActive = -2;
  const placeLabels = (st: ExplodeState, target: THREE.Vector3) => {
    const small = compact();
    if (st.active !== sizedActive) {
      // The active callout grows (joke text). Measure it now: the ResizeObserver
      // would only report the new size a frame late, so the de-overlap below would
      // place it with its old, smaller box for one frame. One layout read per switch.
      sizedActive = st.active;
      o.labels.forEach((el, i) => el.classList.toggle('is-active', i === st.active));
      labelSizes = o.labels.map((l) => [l.offsetWidth, l.offsetHeight]);
    }
    centerV.copy(target).project(camera);
    const ccx = ((centerV.x + 1) / 2) * cw;
    const ccy = ((1 - centerV.y) / 2) * ch;
    const placed: Placed[] = [];
    car.parts.forEach((part: CarPart, i) => {
      car.anchorWorld(part, v).project(camera);
      const ax = ((v.x + 1) / 2) * cw;
      const ay = ((1 - v.y) / 2) * ch;
      const alpha = st.labels * clamp01((st.explode[i] - 0.5) / 0.35);
      const [w, h] = labelSizes[i];
      const dx = ax - ccx;
      const dy = ay - ccy;
      const side = dx >= 0 ? 1 : -1;
      const len = Math.hypot(dx, dy) || 1;
      const reach = small ? 0 : 44 + (i === st.active ? 22 : 0);
      placed.push({ i, ax, ay, x: ax + (dx / len) * reach + side * (small ? 0 : 18), y: ay + (dy / len) * reach, w, h, side, alpha });
    });
    if (!small) {
      // de-overlap each column vertically
      for (const side of [-1, 1]) {
        const col = placed.filter((p) => p.side === side && p.alpha > 0.02).sort((a, b) => a.y - b.y);
        for (let k = 1; k < col.length; k++) {
          const prev = col[k - 1];
          const cur = col[k];
          const min = prev.y + prev.h / 2 + cur.h / 2 + 6;
          if (cur.y < min) cur.y = min;
        }
        const last = col[col.length - 1];
        if (last && last.y + last.h / 2 > ch - 10) {
          const shift = last.y + last.h / 2 - (ch - 10);
          col.forEach((p) => (p.y -= shift));
        }
        col.forEach((p) => (p.y = Math.max(p.h / 2 + 10, p.y)));
      }
    } else {
      // Markers sit on their anchors; nudge apart any that would hide each other.
      const vis = placed.filter((p) => p.alpha > 0.02);
      for (let it = 0; it < 3; it++) {
        for (let a = 0; a < vis.length; a++) {
          for (let b = a + 1; b < vis.length; b++) {
            const A = vis[a];
            const B = vis[b];
            let dx = B.x - A.x;
            let dy = B.y - A.y;
            let d = Math.hypot(dx, dy);
            if (d >= MARKER_GAP) continue;
            if (d < 0.5) {
              // coincident: split them along the ray from the car centre
              dx = A.x - ccx;
              dy = A.y - ccy;
              d = Math.hypot(dx, dy);
              if (d < 0.5) {
                dx = 1;
                dy = 0;
                d = 1;
              }
              const k = MARKER_GAP / 2 / d;
              A.x -= dx * k;
              A.y -= dy * k;
              B.x += dx * k;
              B.y += dy * k;
              continue;
            }
            const k = (MARKER_GAP - d) / 2 / d;
            A.x -= dx * k;
            A.y -= dy * k;
            B.x += dx * k;
            B.y += dy * k;
          }
        }
      }
      for (const p of vis) {
        p.x = Math.min(Math.max(p.x, p.w / 2 + 2), cw - p.w / 2 - 2);
        p.y = Math.min(Math.max(p.y, p.h / 2 + 2), ch - p.h / 2 - 2);
      }
    }
    for (const p of placed) {
      const el = o.labels[p.i];
      const line = o.lines[p.i];
      const dot = o.dots[p.i];
      const visible = p.alpha > 0.01;
      el.style.visibility = visible ? 'visible' : 'hidden';
      el.style.opacity = p.alpha.toFixed(3);
      el.classList.toggle('is-active', p.i === st.active);
      el.classList.toggle('is-left', p.side < 0);
      let lx = p.x;
      if (!small) lx = Math.min(Math.max(p.x, fx0 + (p.side > 0 ? 8 : p.w + 8)), fx1 - (p.side > 0 ? p.w + 8 : 8));
      const tx = small ? p.x - p.w / 2 : p.side > 0 ? lx : lx - p.w;
      const ty = p.y - p.h / 2;
      el.style.transform = `translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, 0)`;
      line.setAttribute('x1', p.ax.toFixed(1));
      line.setAttribute('y1', p.ay.toFixed(1));
      line.setAttribute('x2', (small ? p.ax : lx).toFixed(1));
      line.setAttribute('y2', (small ? p.ay : p.y).toFixed(1));
      line.style.opacity = small ? '0' : (p.alpha * (p.i === st.active ? 1 : 0.6)).toFixed(3);
      dot.setAttribute('cx', p.ax.toFixed(1));
      dot.setAttribute('cy', p.ay.toFixed(1));
      dot.style.opacity = small ? '0' : p.alpha.toFixed(3);
      line.classList.toggle('is-active', p.i === st.active);
      dot.classList.toggle('is-active', p.i === st.active);
    }
  };

  /* ---------- apply state ---------- */
  let target = 0;
  let current = 0;
  let lastActive = -2;
  let firstFrame = false;
  const look = new THREE.Vector3();
  const fitTarget = new THREE.Vector3();
  const apply = (p: number, time: number) => {
    const st = stateAt(p, cw < ch * 0.9);
    // static render: every part labelled, no guided tour
    if (o.reduced) st.active = -1;
    car.parts.forEach((part, i) => car.setPartExplode(part.id, st.explode[i]));
    car.body.position.y = st.lift;
    // frame the car before the tour bob so the camera doesn't wobble with it
    const dist = fit(st.az, st.el, fitTarget);
    // the part on tour bobs gently so the eye finds it
    if (st.active >= 0 && !o.reduced) {
      const part = car.parts[st.active];
      const bob = Math.sin(time * 3.2) * 0.035 * st.explode[st.active];
      for (const m of part.movers) m.obj.position.y += bob;
    }
    car.setDRS(st.drs);
    car.setGlow(st.active === 10 ? 0.8 : st.zoom * 0.3);
    car.update(time);
    (shadow.material as THREE.MeshBasicMaterial).opacity = 0.9 - st.lift * 0.5;
    scanMat.opacity = st.zoom * (0.16 + Math.sin(time * 2.4) * 0.08);
    scan.scale.setScalar(1 + st.zoom * 0.35);

    // camera: orbit, auto-fitting whatever is currently flying around into the frame.
    // Progress is already eased, so the fit follows it directly (no lag = no clipping).
    look.copy(fitTarget);
    camera.position.set(
      look.x + Math.sin(st.az) * Math.cos(st.el) * dist,
      look.y + Math.sin(st.el) * dist,
      look.z + Math.cos(st.az) * Math.cos(st.el) * dist,
    );
    camera.lookAt(look);
    camera.updateMatrixWorld();
    placeLabels(st, look);
    if (st.active !== lastActive) {
      lastActive = st.active;
      o.onActive?.(st.active);
    }
  };

  const render = () => {
    renderer.render(scene, camera);
    if (!firstFrame) {
      firstFrame = true;
      o.onFirstFrame?.();
    }
  };

  const loop = createLoop(o.host, (dt, time) => {
    current += (target - current) * (1 - Math.pow(0.0015, dt));
    if (Math.abs(target - current) < 0.0004) current = target;
    apply(current, time);
    render();
  });

  resize();
  const rs = new ResizeObserver(() => {
    resize();
    if (o.reduced) {
      apply(current, 1);
      render();
    }
  });
  rs.observe(o.canvas);
  rs.observe(o.frame);
  await nextFrame();
  // parallel shader compile where supported, so the page stays responsive
  if (renderer.extensions.has('KHR_parallel_shader_compile')) await renderer.compileAsync(scene, camera).catch(() => undefined);
  else renderer.compile(scene, camera);

  if (o.reduced) {
    current = target = 0.5;
    apply(current, 1);
    render();
  } else {
    loop.start();
  }

  return {
    setProgress(p) {
      target = clamp01(p);
    },
    renderAt(p) {
      current = target = clamp01(p);
      apply(current, 1);
      render();
    },
    dispose() {
      loop.dispose();
      ro.disconnect();
      rs.disconnect();
      car.dispose();
      disposeObject(scene);
      envTex.dispose();
      renderer.dispose();
    },
  };
}

