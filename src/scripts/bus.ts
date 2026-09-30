/**
 * Tiny typed event bus on window CustomEvents, so sections can react to each
 * other (sound toggle, Zoomies mode, loader finished) without importing each other.
 */
export interface BilalEvents {
  /** Intro lights sequence finished; the page is interactive. */
  'bilal:ready': undefined;
  /** Sound toggled by the visitor. */
  'bilal:sound': { enabled: boolean };
  /** Konami-code "Zoomies mode" switched on/off. */
  'bilal:zoomies': { on: boolean };
  /** An easter egg was found (for the hidden counter / toast). */
  'bilal:egg': { id: string; label: string };
  /** Show a transient toast message. */
  'bilal:toast': { message: string; tone?: 'info' | 'gold' | 'red' };
}

export function emit<K extends keyof BilalEvents>(name: K, detail?: BilalEvents[K]): void {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

export function on<K extends keyof BilalEvents>(
  name: K,
  handler: (detail: BilalEvents[K]) => void,
): () => void {
  const listener = (event: Event) => handler((event as CustomEvent<BilalEvents[K]>).detail);
  window.addEventListener(name, listener);
  return () => window.removeEventListener(name, listener);
}

/** Safe localStorage wrapper — storage can throw (private mode, blocked cookies). */
export const store = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = window.localStorage.getItem(`bilal:${key}`);
      return raw == null ? fallback : (JSON.parse(raw) as T);
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown): void {
    try {
      window.localStorage.setItem(`bilal:${key}`, JSON.stringify(value));
    } catch {
      /* storage unavailable — ignore */
    }
  },
};

/**
 * Intro handshake. The Loader calls markReady() when the lights go out (or
 * immediately when the intro is skipped); sections that choreograph an entrance
 * use whenReady() so it works whether they load before or after that moment.
 */
export function markReady(): void {
  if (document.documentElement.dataset.ready === 'true') return;
  document.documentElement.dataset.ready = 'true';
  emit('bilal:ready');
}

export function whenReady(callback: () => void): void {
  if (document.documentElement.dataset.ready === 'true') {
    callback();
    return;
  }
  const off = on('bilal:ready', () => {
    off();
    callback();
  });
}
