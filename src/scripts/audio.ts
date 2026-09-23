/**
 * "Meow engine" sound system — every sound is synthesised with the Web Audio API
 * (no audio files). Muted by default; the visitor opts in via the nav toggle.
 *
 * Public API (stable — other sections call this):
 *   import { sound } from '@/scripts/audio';
 *   sound.play('revMeow');         // no-op while muted
 *   sound.enabled / sound.setEnabled(true) / sound.toggle()
 *
 * TODO(audio agent): implement the synth voices. The stub below keeps the API
 * shape so other sections can integrate before the voices exist.
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

class SoundSystem {
  private _enabled = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this._enabled = store.get('sound', false);
    }
  }

  get enabled(): boolean {
    return this._enabled;
  }

  setEnabled(value: boolean): void {
    this._enabled = value;
    store.set('sound', value);
    emit('bilal:sound', { enabled: value });
  }

  toggle(): boolean {
    this.setEnabled(!this._enabled);
    return this._enabled;
  }

  play(_name: SfxName, _opts: PlayOptions = {}): void {
    if (!this._enabled) return;
    // Stub: voices implemented by the audio agent.
  }
}

export const sound = new SoundSystem();
