/**
 * "Meow engine" sound system — every sound is synthesised with the Web Audio API
 * (no audio files). Muted by default; the visitor opts in via the nav toggle.
 *
 * Public API (stable — other sections call this):
 *   import { sound } from '@/scripts/audio';
 *   sound.play('revMeow');         // no-op while muted
 *   sound.enabled / sound.setEnabled(true) / sound.toggle()
 *
 * Extras (additive, optional):
 *   sound.blip({ pitch: 440, vowel: 'a', radio: true })  // one "cat-speak" syllable
 *   sound.getAnalyser()                                  // AnalyserNode on the master bus, or null
 *   sound.running                                        // true once the AudioContext is live
 *
 * Graph:  voice → (radio bus) → master gain → compressor → analyser → speakers
 *
 * The AudioContext is created lazily on the first user gesture after sound is
 * enabled (browsers block audio before that). Every method is exception-safe:
 * a sound effect must never break the page.
 */
import { emit, store } from './bus';

export type SfxName =
  | 'rev' // short V6-ish engine blip
  | 'meow' // formant-filtered meow
  | 'revMeow' // engine rev that morphs into a meow (signature sound)
  | 'purr' // low rumble loop-let (~1s)
  | 'hiss' // noise burst (errors / jump start)
  | 'click' // UI tick
  | 'beep' // start-light beep
  | 'go' // lights-out tone
  | 'radio' // team-radio squelch in/out
  | 'whoosh'; // pass-by doppler

export interface PlayOptions {
  /** 0–1, multiplied with master volume. */
  volume?: number;
  /** Pitch multiplier, 1 = normal. */
  pitch?: number;
}

export type Vowel = 'a' | 'e' | 'i' | 'o' | 'u';

export interface BlipOptions {
  /** Fundamental in Hz (default 320). */
  pitch?: number;
  vowel?: Vowel;
  /** 0–1 (default 0.55). */
  volume?: number;
  /** Seconds (default 0.085). */
  duration?: number;
  /** End-of-syllable pitch multiplier: >1 rises (questions), <1 falls. */
  glide?: number;
  /** Route through the band-limited team-radio bus. */
  radio?: boolean;
}

/* ------------------------------------------------------------------ helpers */

type Point = readonly [time: number, value: number];

const MASTER_LEVEL = 0.72;
const MAX_VOICES = 28;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);

/** Schedule a breakpoint envelope on an AudioParam, relative to `t`. */
function automate(param: AudioParam, t: number, points: readonly Point[], exp = false): void {
  points.forEach(([dt, value], i) => {
    const time = t + dt;
    if (i === 0) param.setValueAtTime(value, time);
    else if (exp) param.exponentialRampToValueAtTime(Math.max(value, 0.0001), time);
    else param.linearRampToValueAtTime(value, time);
  });
}

/** Scale the value column of a breakpoint list. */
const scale = (points: readonly Point[], k: number): Point[] => points.map(([t, v]) => [t, v * k] as const);

/** Formant tables (Hz) — human vowels nudged up ~15% for a smaller, catty vocal tract. */
const FORMANTS: Record<Vowel | 'm', readonly [number, number, number]> = {
  m: [300, 1500, 2700],
  i: [360, 2650, 3450],
  e: [520, 2150, 3000],
  a: [920, 1580, 2950],
  o: [620, 1050, 2750],
  u: [420, 860, 2500],
};

interface Voice {
  ctx: AudioContext;
  /** Scheduled start time. */
  t: number;
  /** Voice output (volume already applied). */
  out: GainNode;
  /** Pitch multiplier. */
  p: number;
  /** Start `node` at t+start, stop at t+stop; the voice cleans itself up when all sources end. */
  run(node: AudioScheduledSourceNode, start: number, stop: number): void;
}

type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext };
type ActivationNavigator = Navigator & { userActivation?: { hasBeenActive: boolean } };

/* ------------------------------------------------------------------- system */

class SoundSystem {
  private _enabled = false;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private radioBus: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private glottal: PeriodicWave | null = null;
  private curves = new Map<number, Float32Array<ArrayBuffer>>();
  private active = 0;
  private suspendTimer = 0;

  constructor() {
    if (typeof window === 'undefined') return;
    this._enabled = store.get<unknown>('sound', false) === true;

    // Unlock / resume on any gesture while enabled (autoplay policy).
    const unlock = () => {
      if (this._enabled) this.ensure();
    };
    for (const type of ['pointerdown', 'keydown', 'touchend', 'click'] as const) {
      window.addEventListener(type, unlock, { capture: true, passive: true });
    }

    // Don't hum in a background tab.
    document.addEventListener('visibilitychange', () => {
      const ctx = this.ctx;
      if (!ctx) return;
      if (document.hidden) void ctx.suspend().catch(() => {});
      else if (this._enabled) void ctx.resume().catch(() => {});
    });
  }

  get enabled(): boolean {
    return this._enabled;
  }

  /** True when audio can actually be heard (enabled + context running). */
  get running(): boolean {
    return this._enabled && this.ctx?.state === 'running';
  }

  setEnabled(value: boolean): void {
    this._enabled = Boolean(value);
    store.set('sound', this._enabled);
    try {
      window.clearTimeout(this.suspendTimer);
      if (this._enabled) {
        const ctx = this.ensure();
        if (ctx && this.master) this.master.gain.setTargetAtTime(MASTER_LEVEL, ctx.currentTime, 0.02);
      } else if (this.ctx && this.master) {
        const ctx = this.ctx;
        this.master.gain.setTargetAtTime(0, ctx.currentTime, 0.03);
        this.suspendTimer = window.setTimeout(() => {
          if (!this._enabled) void ctx.suspend().catch(() => {});
        }, 400);
      }
    } catch {
      /* never let audio break the page */
    }
    emit('bilal:sound', { enabled: this._enabled });
  }

  toggle(): boolean {
    this.setEnabled(!this._enabled);
    return this._enabled;
  }

  /** Master-bus analyser for visualisers (null until audio has started). */
  getAnalyser(): AnalyserNode | null {
    return this._enabled ? this.analyser : null;
  }

  play(name: SfxName, opts: PlayOptions = {}): void {
    if (!this._enabled) return;
    try {
      const v = this.voice(opts);
      if (!v) return;
      switch (name) {
        case 'rev':
          this.rev(v);
          break;
        case 'meow':
          this.meow(v);
          break;
        case 'revMeow':
          this.revMeow(v);
          break;
        case 'purr':
          this.purr(v);
          break;
        case 'hiss':
          this.hiss(v);
          break;
        case 'click':
          this.click(v);
          break;
        case 'beep':
          this.beep(v);
          break;
        case 'go':
          this.go(v);
          break;
        case 'radio':
          this.radio(v);
          break;
        case 'whoosh':
          this.whoosh(v);
          break;
        default:
          v.run(this.silence(v), 0, 0.01);
      }
    } catch {
      /* swallow — a missing meow is not worth a crash */
    }
  }

  /** One syllable of garbled "cat-speak" (used by Team Radio). */
  blip(opts: BlipOptions = {}): void {
    if (!this._enabled) return;
    try {
      const v = this.voice({ volume: opts.volume ?? 0.55 }, opts.radio ? this.radioBus : null);
      if (!v) return;
      const { ctx, t, out } = v;
      const f = clamp(opts.pitch ?? 320, 60, 1400);
      const dur = clamp(opts.duration ?? 0.085, 0.03, 0.4);
      const glide = opts.glide ?? 0.94;
      const [f1, f2, f3] = FORMANTS[opts.vowel ?? 'a'];

      const src = this.source(ctx);
      automate(src.frequency, t, [
        [0, f * 0.9],
        [dur * 0.3, f * 1.06],
        [dur, f * glide],
      ]);
      const sum = ctx.createGain();
      sum.gain.value = 1;
      ([
        [f1, 5, 1],
        [f2, 8, 0.6],
        [f3, 10, 0.25],
      ] as const).forEach(([freq, q, g]) => this.formant(ctx, src, sum, freq, q, g));
      const env = ctx.createGain();
      automate(env.gain, t, [
        [0, 0],
        [0.008, 1],
        [dur * 0.55, 0.75],
        [dur, 0],
      ]);
      sum.connect(env).connect(out);
      v.run(src, 0, dur + 0.02);
    } catch {
      /* ignore */
    }
  }

  /* --------------------------------------------------------------- plumbing */

  /** Create or resume the AudioContext. Returns null when audio isn't possible yet. */
  private ensure(): AudioContext | null {
    if (!this._enabled || typeof window === 'undefined') return null;
    try {
      if (!this.ctx) {
        // Creating a context before any gesture just yields a blocked, suspended one.
        const nav = navigator as ActivationNavigator;
        if (nav.userActivation && !nav.userActivation.hasBeenActive) return null;
        const Ctor = window.AudioContext ?? (window as WebkitWindow).webkitAudioContext;
        if (!Ctor) return null;
        const ctx = new Ctor({ latencyHint: 'interactive' });

        const master = ctx.createGain();
        master.gain.value = MASTER_LEVEL;
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -16;
        comp.knee.value = 10;
        comp.ratio.value = 5;
        comp.attack.value = 0.003;
        comp.release.value = 0.18;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.55;
        master.connect(comp).connect(analyser).connect(ctx.destination);

        // Team-radio bus: telephone band, a little grit, a presence bump.
        const radioIn = ctx.createGain();
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 420;
        hp.Q.value = 0.8;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 3300;
        lp.Q.value = 0.9;
        const grit = ctx.createWaveShaper();
        grit.curve = this.curve(2.2);
        const presence = ctx.createBiquadFilter();
        presence.type = 'peaking';
        presence.frequency.value = 1800;
        presence.Q.value = 1.2;
        presence.gain.value = 5;
        const radioOut = ctx.createGain();
        radioOut.gain.value = 0.8;
        radioIn.connect(hp).connect(lp).connect(grit).connect(presence).connect(radioOut).connect(master);

        // 2 s of white noise, shared by every noisy voice.
        const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

        // Glottal-ish source: harmonics falling at ~1/n^1.6 — softer than a raw saw.
        const n = 48;
        const real = new Float32Array(n);
        const imag = new Float32Array(n);
        for (let k = 1; k < n; k++) imag[k] = (k % 2 ? 1 : 0.82) / Math.pow(k, 1.6);

        this.glottal = ctx.createPeriodicWave(real, imag);
        this.noiseBuf = buf;
        this.master = master;
        this.analyser = analyser;
        this.radioBus = radioIn;
        this.ctx = ctx;
      }
      const state = this.ctx.state as string;
      if (state === 'suspended' || state === 'interrupted') void this.ctx.resume().catch(() => {});
      return this.ctx;
    } catch {
      return null;
    }
  }

  private voice(opts: PlayOptions, dest: AudioNode | null = null): Voice | null {
    const ctx = this.ensure();
    if (!ctx || !this.master || this.active >= MAX_VOICES) return null;
    const out = ctx.createGain();
    out.gain.value = clamp(opts.volume ?? 1, 0, 1.5);
    out.connect(dest ?? this.master);
    const t = ctx.currentTime + 0.012;
    let pending = 0;
    this.active++;
    const done = () => {
      pending--;
      if (pending > 0) return;
      this.active = Math.max(0, this.active - 1);
      try {
        out.disconnect();
      } catch {
        /* already gone */
      }
    };
    return {
      ctx,
      t,
      out,
      p: clamp(opts.pitch ?? 1, 0.25, 4),
      run: (node, start, stop) => {
        pending++;
        node.onended = done;
        if (node instanceof AudioBufferSourceNode) node.start(t + start, rand(0, 1.5));
        else node.start(t + start);
        node.stop(t + stop);
      },
    };
  }

  private noise(ctx: AudioContext): AudioBufferSourceNode {
    const n = ctx.createBufferSource();
    n.buffer = this.noiseBuf;
    n.loop = true;
    return n;
  }

  private source(ctx: AudioContext): OscillatorNode {
    const o = ctx.createOscillator();
    if (this.glottal) o.setPeriodicWave(this.glottal);
    else o.type = 'sawtooth';
    return o;
  }

  private silence(v: Voice): OscillatorNode {
    const o = v.ctx.createOscillator();
    const g = v.ctx.createGain();
    g.gain.value = 0;
    o.connect(g).connect(v.out);
    return o;
  }

  /** Soft-clip transfer curve (tanh), cached per drive amount. */
  private curve(drive: number): Float32Array<ArrayBuffer> {
    const hit = this.curves.get(drive);
    if (hit) return hit;
    const n = 1024;
    const c = new Float32Array(n);
    const norm = Math.tanh(drive);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      c[i] = Math.tanh(x * drive) / norm;
    }
    this.curves.set(drive, c);
    return c;
  }

  private filter(ctx: AudioContext, type: BiquadFilterType, freq: number, q = 0.7): BiquadFilterNode {
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    return f;
  }

  /** src → band-pass(freq, q) → gain → dest; returns the band-pass for automation. */
  private formant(ctx: AudioContext, src: AudioNode, dest: AudioNode, freq: number, q: number, gain: number) {
    const bp = this.filter(ctx, 'bandpass', freq, q);
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(bp).connect(g).connect(dest);
    return bp;
  }

  /* ----------------------------------------------------------------- voices */

  /**
   * Engine: sawtooth + sub-octave square → soft-clip → resonant low-pass that
   * tracks rpm, with a firing-order tremolo for V6 burble and intake noise.
   * `rpm` is the fundamental in Hz; `level` the amplitude envelope.
   */
  private engine(v: Voice, rpm: readonly Point[], level: readonly Point[], dur: number, dest: AudioNode = v.out) {
    const { ctx, t } = v;
    const f = scale(rpm, v.p);

    const saw = ctx.createOscillator();
    saw.type = 'sawtooth';
    const sq = ctx.createOscillator();
    sq.type = 'square';
    sq.detune.value = 9;
    automate(saw.frequency, t, f);
    automate(sq.frequency, t, scale(f, 0.5));

    const mixSaw = ctx.createGain();
    mixSaw.gain.value = 0.42;
    const mixSq = ctx.createGain();
    mixSq.gain.value = 0.3;

    const shaper = ctx.createWaveShaper();
    shaper.curve = this.curve(3.2);
    shaper.oversample = '2x';

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 5;
    automate(
      lp.frequency,
      t,
      f.map(([tt, hz]) => [tt, clamp(hz * 6.5 + 250, 200, 14000)] as const),
    );

    // Firing-order tremolo: gain wobbles at a third of the fundamental.
    const trem = ctx.createGain();
    trem.gain.value = 0.72;
    const tremOsc = ctx.createOscillator();
    automate(tremOsc.frequency, t, scale(f, 1 / 3));
    const tremDepth = ctx.createGain();
    tremDepth.gain.value = 0.28;
    tremOsc.connect(tremDepth).connect(trem.gain);

    // Intake roar: band-passed noise riding the same envelope.
    const air = this.noise(ctx);
    const airBp = this.filter(ctx, 'bandpass', 900, 0.9);
    automate(
      airBp.frequency,
      t,
      f.map(([tt, hz]) => [tt, clamp(hz * 4, 300, 6000)] as const),
    );
    const airGain = ctx.createGain();
    airGain.gain.value = 0.12;

    const env = ctx.createGain();
    automate(env.gain, t, level);

    saw.connect(mixSaw).connect(shaper);
    sq.connect(mixSq).connect(shaper);
    shaper.connect(lp).connect(trem).connect(env);
    air.connect(airBp).connect(airGain).connect(env);
    env.connect(dest);

    for (const node of [saw, sq, tremOsc, air]) v.run(node, 0, dur);
  }

  /**
   * Meow: glottal source through three band-pass formants gliding m→ee→a→ow,
   * a "lips" low-pass opening then closing, delayed vibrato and a pitch arc.
   */
  private meowVoice(v: Voice, start: number, dur: number, f0: readonly Point[], level: number, dest: AudioNode = v.out) {
    const { ctx } = v;
    const t = v.t + start;
    const src = this.source(ctx);
    automate(src.frequency, t, scale(f0, v.p));

    // Vibrato that blooms in the second half, like a real yowl.
    const vib = ctx.createOscillator();
    vib.frequency.value = 5.8;
    const vibDepth = ctx.createGain();
    automate(vibDepth.gain, t, [
      [0, 0],
      [dur * 0.35, 6],
      [dur * 0.8, 32],
      [dur, 18],
    ]);
    vib.connect(vibDepth).connect(src.detune);

    // Breath: a little air in the voice.
    const breath = this.noise(ctx);
    const breathBp = this.filter(ctx, 'bandpass', 2600, 0.7);
    const breathGain = ctx.createGain();
    breathGain.gain.value = 0.05;

    const pre = ctx.createGain();
    pre.gain.value = 0.9;
    src.connect(pre);
    breath.connect(breathBp).connect(breathGain).connect(pre);

    const sum = ctx.createGain();
    const keys: Array<[number, Vowel | 'm']> = [
      [0, 'm'],
      [0.13, 'i'],
      [0.42, 'a'],
      [0.72, 'o'],
      [0.97, 'u'],
    ];
    const gains = [1, 0.62, 0.3];
    const qs = [6, 9, 12];
    for (let k = 0; k < 3; k++) {
      const bp = this.formant(ctx, pre, sum, FORMANTS.m[k], qs[k], gains[k]);
      automate(
        bp.frequency,
        t,
        keys.map(([frac, vowel]) => [dur * frac, FORMANTS[vowel][k]] as const),
      );
    }
    // A thin direct path keeps the fundamental present (body of the meow).
    const body = ctx.createGain();
    body.gain.value = 0.07;
    pre.connect(body).connect(sum);

    // Lips: closed on "m", wide on "a", rounding shut on "ow".
    const lips = this.filter(ctx, 'lowpass', 700, 0.9);
    automate(lips.frequency, t, [
      [0, 650],
      [dur * 0.14, 4200],
      [dur * 0.45, 6500],
      [dur * 0.75, 3200],
      [dur, 1100],
    ]);

    const env = ctx.createGain();
    automate(env.gain, t, [
      [0, 0],
      [dur * 0.05, level * 0.12],
      [dur * 0.16, level],
      [dur * 0.6, level * 0.92],
      [dur * 0.86, level * 0.6],
      [dur, 0],
    ]);

    sum.connect(lips).connect(env).connect(dest);
    for (const node of [src, vib, breath]) v.run(node, start, start + dur + 0.02);
  }

  private rev(v: Voice) {
    this.engine(
      v,
      [
        [0, 72],
        [0.06, 78],
        [0.24, 330],
        [0.36, 352],
        [0.62, 120],
        [0.9, 76],
      ],
      [
        [0, 0],
        [0.03, 0.42],
        [0.22, 0.72],
        [0.36, 0.66],
        [0.62, 0.32],
        [0.9, 0],
      ],
      0.92,
    );
  }

  private meow(v: Voice) {
    const d = 0.86;
    this.meowVoice(
      v,
      0,
      d,
      [
        [0, 470],
        [d * 0.18, 610],
        [d * 0.42, 760],
        [d * 0.62, 700],
        [d * 0.88, 480],
        [d, 400],
      ],
      0.9,
    );
  }

  /** The signature: idle → rev → two upshifts → the engine note bends into a MEOW. */
  private revMeow(v: Voice) {
    // Engine rpm with two gear-shift blips (quick drop + torque cut).
    const rpm: Point[] = [
      [0, 70],
      [0.12, 76],
      [0.5, 255],
      [0.535, 178], // shift 1
      [0.94, 332],
      [0.975, 246], // shift 2
      [1.3, 430],
      [1.48, 560], // bends up into the meow's pitch while fading
      [1.62, 640],
    ];
    const level: Point[] = [
      [0, 0],
      [0.05, 0.36],
      [0.12, 0.42],
      [0.5, 0.74],
      [0.515, 0.22], // torque cut
      [0.56, 0.74],
      [0.94, 0.78],
      [0.955, 0.24],
      [1.0, 0.8],
      [1.22, 0.8],
      [1.5, 0.12], // crossfade out
      [1.62, 0],
    ];
    this.engine(v, rpm, level, 1.66);

    // The meow starts under the engine at the same pitch, then takes over.
    const d = 1.02;
    this.meowVoice(
      v,
      1.2,
      d,
      [
        [0, 455],
        [d * 0.2, 600],
        [d * 0.44, 780],
        [d * 0.62, 720],
        [d * 0.88, 470],
        [d, 380],
      ],
      1,
    );
  }

  private purr(v: Voice) {
    const { ctx, t, p } = v;
    const dur = 1.3;
    // Two breaths: exhale (stronger, ~27 Hz) and inhale (softer, ~23 Hz).
    const rumble = this.noise(ctx);
    const lp = this.filter(ctx, 'lowpass', 520 * p, 1.1);
    automate(lp.frequency, t, [
      [0, 480 * p],
      [0.6, 560 * p],
      [0.7, 700 * p],
      [dur, 620 * p],
    ]);
    const am = ctx.createGain();
    am.gain.value = 0.5;
    const pulse = ctx.createOscillator();
    pulse.type = 'triangle';
    automate(pulse.frequency, t, [
      [0, 27 * p],
      [0.62, 26 * p],
      [0.66, 23 * p],
      [dur, 22 * p],
    ]);
    const pulseDepth = ctx.createGain();
    pulseDepth.gain.value = 0.5;
    pulse.connect(pulseDepth).connect(am.gain);

    // Chesty tone under the noise.
    const tone = ctx.createOscillator();
    tone.type = 'sawtooth';
    automate(tone.frequency, t, [
      [0, 54 * p],
      [0.62, 52 * p],
      [0.66, 46 * p],
      [dur, 44 * p],
    ]);
    const toneLp = this.filter(ctx, 'lowpass', 240 * p, 0.8);
    const toneGain = ctx.createGain();
    toneGain.gain.value = 0.35;

    const env = ctx.createGain();
    automate(env.gain, t, [
      [0, 0],
      [0.12, 0.9],
      [0.5, 0.8],
      [0.63, 0.12],
      [0.74, 0.55],
      [1.12, 0.45],
      [dur, 0],
    ]);
    rumble.connect(lp).connect(am);
    tone.connect(toneLp).connect(toneGain).connect(am);
    am.connect(env).connect(v.out);
    for (const node of [rumble, pulse, tone]) v.run(node, 0, dur + 0.02);
  }

  private hiss(v: Voice) {
    const { ctx, t, p } = v;
    const dur = 0.75;
    const n = this.noise(ctx);
    const hp = this.filter(ctx, 'highpass', 1700 * p, 0.7);
    const bp = this.filter(ctx, 'bandpass', 5200 * p, 0.8);
    automate(bp.frequency, t, [
      [0, 3600 * p],
      [0.06, 5600 * p],
      [dur, 4400 * p],
    ]);
    // Throaty flutter.
    const flutter = ctx.createGain();
    flutter.gain.value = 0.82;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 19;
    const depth = ctx.createGain();
    depth.gain.value = 0.18;
    lfo.connect(depth).connect(flutter.gain);
    const env = ctx.createGain();
    automate(env.gain, t, [
      [0, 0],
      [0.012, 1],
      [0.09, 0.62],
      [0.45, 0.5],
      [dur, 0],
    ]);
    n.connect(hp).connect(bp).connect(flutter).connect(env).connect(v.out);
    // Low "kh" spit at the front.
    const spit = this.noise(ctx);
    const spitBp = this.filter(ctx, 'bandpass', 1300 * p, 1.4);
    const spitEnv = ctx.createGain();
    automate(spitEnv.gain, t, [
      [0, 0.8],
      [0.08, 0.0001],
    ], true);
    spit.connect(spitBp).connect(spitEnv).connect(v.out);
    v.run(n, 0, dur + 0.02);
    v.run(lfo, 0, dur + 0.02);
    v.run(spit, 0, 0.1);
  }

  private click(v: Voice) {
    const { ctx, t, p } = v;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    automate(o.frequency, t, [
      [0, 2300 * p],
      [0.035, 1100 * p],
    ], true);
    const g = ctx.createGain();
    automate(g.gain, t, [
      [0, 0.0001],
      [0.002, 0.3],
      [0.05, 0.0001],
    ], true);
    o.connect(g).connect(v.out);
    const n = this.noise(ctx);
    const bp = this.filter(ctx, 'bandpass', 4200 * p, 1.4);
    const ng = ctx.createGain();
    automate(ng.gain, t, [
      [0, 0.35],
      [0.014, 0.0001],
    ], true);
    n.connect(bp).connect(ng).connect(v.out);
    v.run(o, 0, 0.06);
    v.run(n, 0, 0.02);
  }

  private beep(v: Voice) {
    const { ctx, t, p } = v;
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = 988 * p;
    const lp = this.filter(ctx, 'lowpass', 3200, 0.7);
    const g = ctx.createGain();
    automate(g.gain, t, [
      [0, 0],
      [0.006, 0.2],
      [0.14, 0.18],
      [0.17, 0],
    ]);
    const s = ctx.createOscillator();
    s.frequency.value = 1976 * p;
    const sg = ctx.createGain();
    sg.gain.value = 0.18;
    s.connect(sg).connect(g);
    o.connect(lp).connect(g).connect(v.out);
    v.run(o, 0, 0.18);
    v.run(s, 0, 0.18);
  }

  private go(v: Voice) {
    const { ctx, t, p } = v;
    // Bright rising chirp into a two-note chord.
    const chord = [1568, 2093];
    chord.forEach((hz, i) => {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      automate(o.frequency, t, [
        [0, hz * 0.6 * p],
        [0.05, hz * p],
      ], true);
      const g = ctx.createGain();
      automate(g.gain, t, [
        [0, 0.0001],
        [0.012, i ? 0.22 : 0.32],
        [0.16, i ? 0.14 : 0.2],
        [0.5, 0.0001],
      ], true);
      o.connect(g).connect(v.out);
      v.run(o, 0, 0.52);
    });
    // Sub thump — the launch.
    const sub = ctx.createOscillator();
    automate(sub.frequency, t, [
      [0, 150 * p],
      [0.18, 42 * p],
    ], true);
    const sg = ctx.createGain();
    automate(sg.gain, t, [
      [0, 0.0001],
      [0.01, 0.7],
      [0.26, 0.0001],
    ], true);
    sub.connect(sg).connect(v.out);
    v.run(sub, 0, 0.28);
  }

  /** Team-radio squelch: chirp + band-limited crackle. pitch < 1 sounds like "out". */
  private radio(v: Voice) {
    const { ctx, t, p } = v;
    const dur = 0.22;
    const chirp = ctx.createOscillator();
    chirp.type = 'sine';
    automate(chirp.frequency, t, [
      [0, 2700 * p],
      [0.05, 1900 * p],
    ], true);
    const cg = ctx.createGain();
    automate(cg.gain, t, [
      [0, 0.0001],
      [0.004, 0.22],
      [0.06, 0.0001],
    ], true);
    chirp.connect(cg).connect(v.out);

    const n = this.noise(ctx);
    const bp = this.filter(ctx, 'bandpass', 1500 * p, 0.55);
    const hp = this.filter(ctx, 'highpass', 450, 0.7);
    const grit = ctx.createWaveShaper();
    grit.curve = this.curve(4);
    const g = ctx.createGain();
    // Crackle: random gain steps.
    g.gain.setValueAtTime(0, t);
    for (let x = 0.03; x < dur; x += 0.011) g.gain.setValueAtTime(rand(0.05, 0.42) * (1 - x / dur), t + x);
    g.gain.setValueAtTime(0, t + dur);
    n.connect(bp).connect(hp).connect(grit).connect(g).connect(v.out);
    v.run(chirp, 0, 0.07);
    v.run(n, 0, dur + 0.01);
  }

  /** Doppler pass-by: approach high, pass, recede low, panned left → right. */
  private whoosh(v: Voice) {
    const { ctx, t } = v;
    const dur = 1.5;
    let dest: AudioNode = v.out;
    if (typeof ctx.createStereoPanner === 'function') {
      const pan = ctx.createStereoPanner();
      automate(pan.pan, t, [
        [0, -0.9],
        [0.7, 0],
        [dur, 0.9],
      ]);
      pan.connect(v.out);
      dest = pan;
    }
    const passGain = ctx.createGain();
    automate(passGain.gain, t, [
      [0, 0],
      [0.4, 0.22],
      [0.68, 1],
      [0.86, 0.55],
      [dur, 0],
    ]);
    passGain.connect(dest);
    // f · c/(c∓v) with v ≈ 80 m/s → ×1.3 approaching, ×0.81 receding.
    this.engine(
      v,
      [
        [0, 380],
        [0.62, 366],
        [0.8, 250],
        [dur, 236],
      ],
      [
        [0, 0.7],
        [dur, 0.7],
      ],
      dur,
      passGain,
    );
    const air = this.noise(ctx);
    const bp = this.filter(ctx, 'bandpass', 1400, 0.8);
    automate(bp.frequency, t, [
      [0, 1800],
      [0.7, 3200],
      [dur, 700],
    ]);
    const ag = ctx.createGain();
    ag.gain.value = 0.35;
    air.connect(bp).connect(ag).connect(passGain);
    v.run(air, 0, dur);
  }
}

export const sound = new SoundSystem();
