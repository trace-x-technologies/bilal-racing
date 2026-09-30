/**
 * Hero studio: the BR-09 on a turntable in a dark reflective garage, livery rim
 * lights, drifting dust, pointer parallax, drag-to-rotate, click-to-rev, and a
 * scroll-scrubbed exit where the car launches out of frame.
 *
 * Loaded via dynamic import() from Hero.astro so the headline paints first.
 */
import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { buildCar, type CarLivery } from './car';
import * as TX from './textures';
import { clamp01, nextFrame, createLoop, createRenderer, disposeObject, easeIn, easeInOut, lerp, span, studioEnvironment } from './stage';

export interface HeroSceneOptions {
  canvas: HTMLCanvasElement;
  /** Hero section — visibility + pointer parallax. */
  host: HTMLElement;
  /** The car is framed to fit this element's box. */
  stage: HTMLElement;
  /** Race number + timing code painted on this car (the hero car is #13 DHA). */
  livery: CarLivery;
  reduced: boolean;
  lowPower: boolean;
  onFirstFrame?: () => void;
  /** Visitor clicked/tapped the car itself. */
  onCarClick?: () => void;
}

export interface HeroScene {
  startEngine(): void;
  /** Scroll exit progress 0–1. */
  setExit(p: number): void;
  /** Konami "Zoomies mode": the turntable spins like a cat at 3 a.m. */
  setZoomies(on: boolean): void;
  dispose(): void;
}

const IDLE_YAW = 0.95; // 3/4 front, nose to screen-right
const DRIVE_YAW = 1.32;
const TARGET = new THREE.Vector3(0, 0.5, 0);
const TAU = Math.PI * 2;
const easeOutQuad = (t: number) => 1 - (1 - t) * (1 - t);

const FloorShader = {
  name: 'BilalGarageFloor',
  uniforms: {
    color: { value: null },
    tDiffuse: { value: null },
    textureMatrix: { value: null },
    strength: { value: 0.5 },
    radius: { value: new THREE.Vector2(1.2, 7.5) },
  },
  vertexShader: /* glsl */ `
    uniform mat4 textureMatrix;
    varying vec4 vUv;
    varying vec2 vPos;
    #include <common>
    #include <logdepthbuf_pars_vertex>
    void main() {
      vUv = textureMatrix * vec4(position, 1.0);
      vPos = position.xy;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      #include <logdepthbuf_vertex>
    }`,
  fragmentShader: /* glsl */ `
    uniform vec3 color;
    uniform sampler2D tDiffuse;
    uniform float strength;
    uniform vec2 radius;
    varying vec4 vUv;
    varying vec2 vPos;
    #include <logdepthbuf_pars_fragment>
    void main() {
      #include <logdepthbuf_fragment>
      vec2 uv = vUv.xy / vUv.w;
      float px = 0.0035;
      vec4 base = texture2D(tDiffuse, uv) * 0.36
        + (texture2D(tDiffuse, uv + vec2(px, 0.0)) + texture2D(tDiffuse, uv - vec2(px, 0.0))
        + texture2D(tDiffuse, uv + vec2(0.0, px)) + texture2D(tDiffuse, uv - vec2(0.0, px))) * 0.16;
      float fade = 1.0 - smoothstep(radius.x, radius.y, length(vPos));
      // dark glossy floor: a tinted base plus the blurred reflection
      vec3 floorTint = vec3(0.012, 0.011, 0.016);
      gl_FragColor = vec4(floorTint + base.rgb * color * 0.55, fade * strength);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
};

export async function createHeroScene(o: HeroSceneOptions): Promise<HeroScene | null> {
  const renderer = createRenderer(o.canvas, o.lowPower);
  if (!renderer) return null;
  await TX.fontsReady();
  await nextFrame();

  const scene = new THREE.Scene();
  const envTex = studioEnvironment(renderer);
  scene.environment = envTex;
  scene.environmentIntensity = 0.55;
  scene.fog = new THREE.Fog(0x07070b, 18, 40);

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 90);
  await nextFrame();
  const car = buildCar({ livery: o.livery, anisotropy: renderer.capabilities.getMaxAnisotropy(), lowPower: o.lowPower });
  scene.add(car.root);

  /* ---------- lights ---------- */
  scene.add(new THREE.HemisphereLight(0x8a8070, 0x07070b, 0.35));
  const key = new THREE.DirectionalLight(0xfff0d8, 2.4);
  key.position.set(2, 7, 5);
  const rimGold = new THREE.DirectionalLight(0xffc52e, 3.4);
  rimGold.position.set(-6, 3, -5);
  const rimSaffron = new THREE.DirectionalLight(0xff6a13, 2.8);
  rimSaffron.position.set(6, 2.5, -4);
  const fill = new THREE.DirectionalLight(0xa0153e, 1.1);
  fill.position.set(-5, 1, 6);
  scene.add(key, rimGold, rimSaffron, fill);
  const exhaustLight = new THREE.PointLight(0xff6a13, 0, 5, 2);
  exhaustLight.position.set(0, 0.5, -2.5);
  car.root.add(exhaustLight);

  /* ---------- garage floor ---------- */
  const turntable = new THREE.Group();
  scene.add(turntable);
  let reflector: Reflector | null = null;
  if (!o.lowPower && !o.reduced) {
    reflector = new Reflector(new THREE.CircleGeometry(9, 64), {
      textureWidth: 512,
      textureHeight: 512,
      clipBias: 0.003,
      color: 0xffffff,
      shader: FloorShader,
    });
    reflector.rotation.x = -Math.PI / 2;
    reflector.position.y = -0.001;
    const rm = reflector.material as THREE.ShaderMaterial;
    rm.transparent = true;
    rm.depthWrite = false;
    scene.add(reflector);
  } else {
    // cheap stand-in: a dark satin disc
    const tex = TX.dotTexture();
    const disc = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 16).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x000000, map: tex, transparent: true, opacity: 0.7, depthWrite: false }),
    );
    disc.position.y = -0.002;
    scene.add(disc);
  }
  // warm light pool
  const pool = new THREE.Mesh(
    new THREE.PlaneGeometry(11, 11).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: TX.dotTexture(), color: 0xffb347, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  pool.position.y = 0.002;
  scene.add(pool);
  // pit-box markings on the turntable
  const marks = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 12).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: TX.pitBoxTexture(), transparent: true, opacity: 0.38, depthWrite: false }),
  );
  marks.position.y = 0.004;
  turntable.add(marks);
  // turntable ring with tick marks
  {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(4.02, 4.07, 160).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xffc52e, transparent: true, opacity: 0.32, depthWrite: false }),
    );
    ring.position.y = 0.006;
    turntable.add(ring);
    const ticks: number[] = [];
    for (let i = 0; i < 90; i++) {
      const a = (i / 90) * TAU;
      const r0 = 4.12;
      const r1 = i % 9 === 0 ? 4.45 : 4.24;
      ticks.push(Math.cos(a) * r0, 0.006, Math.sin(a) * r0, Math.cos(a) * r1, 0.006, Math.sin(a) * r1);
    }
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.Float32BufferAttribute(ticks, 3));
    turntable.add(new THREE.LineSegments(tg, new THREE.LineBasicMaterial({ color: 0xffc52e, transparent: true, opacity: 0.25 })));
  }
  // contact shadow rides with the car
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 6.4).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: TX.shadowTexture(), transparent: true, depthWrite: false, opacity: 0.95 }),
  );
  shadow.position.y = 0.008;
  shadow.renderOrder = 2;
  car.root.add(shadow);

  // rev shockwave: a ring of light that races out across the floor
  const waveMat = new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  waveMat.toneMapped = false;
  const wave = new THREE.Mesh(new THREE.RingGeometry(0.94, 1, 96).rotateX(-Math.PI / 2), waveMat);
  wave.position.y = 0.012;
  wave.visible = false;
  scene.add(wave);
  let waveT = -1;

  /* ---------- dust ---------- */
  const DUST = o.lowPower ? 80 : 220;
  const dustPos = new Float32Array(DUST * 3);
  const dustSpeed = new Float32Array(DUST);
  for (let i = 0; i < DUST; i++) {
    const r = 1.5 + Math.random() * 7;
    const a = Math.random() * TAU;
    dustPos.set([Math.cos(a) * r, Math.random() * 4, Math.sin(a) * r - 1], i * 3);
    dustSpeed[i] = 0.05 + Math.random() * 0.18;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(
    dustGeo,
    new THREE.PointsMaterial({
      size: 0.05,
      map: TX.dotTexture(),
      color: 0xffd98a,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    }),
  );
  scene.add(dust);

  /* ---------- exhaust sparks ---------- */
  const SPARKS = 70;
  const sparkPos = new Float32Array(SPARKS * 3);
  const sparkVel = new Float32Array(SPARKS * 3);
  const sparkLife = new Float32Array(SPARKS);
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  const sparks = new THREE.Points(
    sparkGeo,
    new THREE.PointsMaterial({
      size: 0.07,
      map: TX.dotTexture(),
      color: 0xff8a2a,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  sparks.frustumCulled = false;
  scene.add(sparks);
  const exhaustLocal = new THREE.Vector3(0, 0.47, -2.2);
  const emitSparks = () => {
    const origin = car.root.localToWorld(exhaustLocal.clone());
    const back = new THREE.Vector3(0, 0, -1).applyQuaternion(car.root.quaternion);
    for (let i = 0; i < SPARKS; i++) {
      sparkPos.set([origin.x, origin.y, origin.z], i * 3);
      const s = 1.5 + Math.random() * 3;
      sparkVel.set([back.x * s + (Math.random() - 0.5) * 1.2, 0.4 + Math.random() * 1.4, back.z * s + (Math.random() - 0.5) * 1.2], i * 3);
      sparkLife[i] = 0.4 + Math.random() * 0.7;
    }
    sparkGeo.attributes.position.needsUpdate = true;
  };

  /* ---------- framing ---------- */
  let baseDist = 12;
  const resize = () => {
    const cw = o.canvas.clientWidth;
    const ch = o.canvas.clientHeight;
    if (!cw || !ch) return;
    renderer.setSize(cw, ch, false);
    camera.aspect = cw / ch;
    camera.fov = cw < 700 ? 36 : 28;
    const c = o.canvas.getBoundingClientRect();
    const r = o.stage.getBoundingClientRect();
    const sw = Math.max(80, r.width);
    const sh = Math.max(80, r.height);
    const cx = r.left - c.left + r.width / 2;
    const cy = r.top - c.top + r.height / 2;
    const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const tanH = tanV * camera.aspect;
    const dW = (cw < 700 ? 3.35 : 3.0) / (tanH * (sw / cw));
    const dH = 1.25 / (tanV * (sh / ch));
    baseDist = THREE.MathUtils.clamp(Math.max(dW, dH), 7, 32);
    camera.setViewOffset(cw, ch, -(cx - cw / 2), -(cy - ch / 2), cw, ch);
    camera.updateProjectionMatrix();
    if (reflector) {
      const pr = renderer.getPixelRatio();
      reflector.getRenderTarget().setSize(Math.round(cw * pr * 0.5), Math.round(ch * pr * 0.5));
    }
  };

  /* ---------- interaction state ---------- */
  let userYaw = 0;
  let yawVel = 0;
  let dragging = false;
  let pointerId = -1;
  let downX = 0;
  let downY = 0;
  let lastX = 0;
  let downT = 0;
  let px = 0;
  let py = 0;
  let pxS = 0;
  let pyS = 0;
  let exitTarget = 0;
  let exit = 0;
  let engine = -1;
  let wheelSpeed = 0;
  let prevDrive = 0;
  let hover: { x: number; y: number } | null = null;
  let zoomies = false;
  let zoomYaw = 0;
  let firstFrame = false;

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const hitCar = (clientX: number, clientY: number) => {
    const rect = o.canvas.getBoundingClientRect();
    ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    return raycaster.intersectObjects(car.meshes, false).length > 0;
  };

  const onPointerMove = (e: PointerEvent) => {
    const rect = o.host.getBoundingClientRect();
    px = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    py = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    if (dragging && e.pointerId === pointerId) {
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      userYaw += dx * 0.009;
      yawVel = dx * 0.009 * 60;
      if (o.reduced) still();
    } else if (e.pointerType === 'mouse') {
      hover = { x: e.clientX, y: e.clientY };
      if (o.reduced) updateHover();
    }
  };
  const onDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    dragging = true;
    pointerId = e.pointerId;
    downX = lastX = e.clientX;
    downY = e.clientY;
    downT = performance.now();
    yawVel = 0;
    o.canvas.classList.add('is-dragging');
  };
  const onUp = (e: PointerEvent) => {
    if (!dragging || e.pointerId !== pointerId) return;
    dragging = false;
    o.canvas.classList.remove('is-dragging');
    if (e.type === 'pointercancel') return; // the browser took over (e.g. vertical scroll)
    const moved = Math.hypot(e.clientX - downX, e.clientY - downY);
    if (moved < 8 && performance.now() - downT < 500 && hitCar(e.clientX, e.clientY)) o.onCarClick?.();
  };
  const updateHover = () => {
    if (!hover) return;
    o.canvas.classList.toggle('is-over-car', hitCar(hover.x, hover.y));
    hover = null;
  };
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  o.canvas.addEventListener('pointerdown', onDown);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);

  /* ---------- per-frame ---------- */
  const forward = new THREE.Vector3();
  const update = (dt: number, time: number) => {
    const k = 1 - Math.pow(0.0008, dt);
    exit += (exitTarget - exit) * Math.min(1, dt * 7);
    pxS += (px - pxS) * k * 0.35;
    pyS += (py - pyS) * k * 0.35;

    if (!dragging) {
      userYaw += yawVel * dt;
      yawVel *= Math.pow(0.03, dt);
    }
    if (zoomies) zoomYaw += dt * 4.5;
    const idle = IDLE_YAW + Math.sin(time * 0.21) * 0.55 + userYaw + zoomYaw;
    const blend = easeInOut(span(exit, 0, 0.22));
    const driveTarget = DRIVE_YAW + TAU * Math.round((idle - DRIVE_YAW) / TAU);
    const yaw = lerp(idle, driveTarget, blend);
    car.root.rotation.y = yaw;
    turntable.rotation.y = yaw;

    // drive off
    const drive = easeIn(span(exit, 0.04, 0.5)) * 24;
    forward.set(Math.sin(yaw), 0, Math.cos(yaw));
    car.root.position.copy(forward).multiplyScalar(drive);
    const dDrive = drive - prevDrive;
    prevDrive = drive;

    // engine start: shake, wheelspin, heat
    let env = 0;
    if (engine >= 0) {
      engine += dt;
      env = Math.exp(-engine * 1.8) * clamp01(engine * 12);
      if (engine > 3.5) engine = -1;
    }
    const shake = o.reduced ? 0 : env;
    car.body.position.set(
      (Math.random() - 0.5) * 0.018 * shake,
      Math.sin(time * 26) * 0.0015 + Math.abs(Math.random() - 0.5) * 0.014 * shake,
      (Math.random() - 0.5) * 0.01 * shake,
    );
    car.body.rotation.set(Math.sin(time * 41) * 0.004 * shake, 0, Math.sin(time * 57) * 0.008 * shake);
    wheelSpeed = Math.max(wheelSpeed * Math.pow(0.35, dt), env * 28, zoomies ? 30 : 0);
    car.spinWheels(wheelSpeed * dt + dDrive / 0.35);
    const heat = Math.max(env, clamp01(exit * 5) * 0.8);
    car.setGlow(heat);
    exhaustLight.intensity = heat * 9;
    (pool.material as THREE.MeshBasicMaterial).opacity = 0.16 + env * 0.22;
    if (waveT >= 0) {
      waveT += dt;
      const t = waveT / 1.1;
      wave.visible = t < 1;
      wave.position.set(car.root.position.x, 0.012, car.root.position.z);
      wave.scale.setScalar(2.4 + easeOutQuad(t) * 7);
      waveMat.opacity = (1 - t) * 0.85;
      if (t >= 1) waveT = -1;
    }
    car.update(time);

    // sparks
    const sm = sparks.material as THREE.PointsMaterial;
    if (sm.opacity > 0.001 || env > 0.2) {
      let alive = 0;
      for (let i = 0; i < SPARKS; i++) {
        if (sparkLife[i] <= 0) continue;
        sparkLife[i] -= dt;
        alive++;
        sparkVel[i * 3 + 1] -= 3.2 * dt;
        sparkPos[i * 3] += sparkVel[i * 3] * dt;
        sparkPos[i * 3 + 1] = Math.max(0.02, sparkPos[i * 3 + 1] + sparkVel[i * 3 + 1] * dt);
        sparkPos[i * 3 + 2] += sparkVel[i * 3 + 2] * dt;
      }
      sparkGeo.attributes.position.needsUpdate = true;
      sm.opacity = alive ? Math.min(1, env * 1.6) : 0;
    }

    // dust drifts up through the light
    for (let i = 0; i < DUST; i++) {
      let y = dustPos[i * 3 + 1] + dustSpeed[i] * dt * (1 + exit * 6);
      if (y > 4) y -= 4;
      dustPos[i * 3 + 1] = y;
      dustPos[i * 3] += Math.sin(time * 0.6 + i) * 0.03 * dt;
    }
    dustGeo.attributes.position.needsUpdate = true;

    // camera: parallax + exit sweep
    const az = pxS * 0.14 - blend * 0.5;
    const el = 0.17 - pyS * 0.05 - blend * 0.1 + span(exit, 0.4, 1) * 0.04;
    const dist = baseDist * (1 - 0.1 * blend) * (1 - shake * 0.035);
    camera.position.set(
      TARGET.x + Math.sin(az) * Math.cos(el) * dist,
      TARGET.y + Math.sin(el) * dist,
      TARGET.z + Math.cos(az) * Math.cos(el) * dist,
    );
    camera.lookAt(TARGET);
    if (hover && !dragging) updateHover();
  };

  const render = () => {
    renderer.render(scene, camera);
    if (!firstFrame) {
      firstFrame = true;
      o.onFirstFrame?.();
    }
  };

  /** Reduced motion: re-compose the single still frame (e.g. after a drag). */
  const still = () => {
    update(0, 1.2);
    render();
  };

  const loop = createLoop(o.host, (dt, time) => {
    update(dt, time);
    render();
  });

  const ro = new ResizeObserver(() => {
    resize();
    if (o.reduced) still();
  });
  ro.observe(o.canvas);
  ro.observe(o.stage);
  resize();
  await nextFrame();
  // parallel shader compile where supported, so the page stays responsive
  if (renderer.extensions.has('KHR_parallel_shader_compile')) await renderer.compileAsync(scene, camera).catch(() => undefined);
  else renderer.compile(scene, camera);

  if (o.reduced) {
    // One composed still frame.
    still();
  } else {
    loop.start();
  }

  let glowTimer = 0;
  return {
    startEngine() {
      engine = 0;
      if (!o.reduced) waveT = 0;
      emitSparks();
      if (o.reduced) {
        car.setGlow(1);
        exhaustLight.intensity = 9;
        render();
        window.clearTimeout(glowTimer);
        glowTimer = window.setTimeout(() => {
          car.setGlow(0);
          exhaustLight.intensity = 0;
          engine = -1;
          render();
        }, 1400);
      }
    },
    setExit(p) {
      if (!o.reduced) exitTarget = clamp01(p);
    },
    setZoomies(on) {
      if (o.reduced) return;
      zoomies = on;
      if (on) emitSparks();
    },
    dispose() {
      loop.dispose();
      ro.disconnect();
      window.clearTimeout(glowTimer);
      window.removeEventListener('pointermove', onPointerMove);
      o.canvas.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      car.dispose();
      reflector?.dispose();
      disposeObject(scene);
      envTex.dispose();
      renderer.dispose();
    },
  };
}
