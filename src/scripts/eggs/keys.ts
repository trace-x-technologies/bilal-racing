/**
 * Keyboard eggs: Konami code, typed words ("meow", "box"), "l" for the laser.
 * Ignored while typing in form fields / editors, with modifiers held, during
 * IME composition, or when another handler already consumed the key.
 */
import { isTypingTarget } from './util';

const KONAMI = [
  'arrowup',
  'arrowup',
  'arrowdown',
  'arrowdown',
  'arrowleft',
  'arrowright',
  'arrowleft',
  'arrowright',
  'b',
  'a',
] as const;

export interface KeyHandlers {
  konami(): void;
  meow(): void;
  box(): void;
  laser(): void;
  escape(): void;
}

export function initKeys(handlers: KeyHandlers): void {
  const recent: string[] = [];
  let typed = '';

  window.addEventListener('keydown', (event) => {
    if (event.defaultPrevented || event.isComposing) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (isTypingTarget(event.target)) return;
    const key = typeof event.key === 'string' ? event.key.toLowerCase() : '';
    if (!key) return;

    if (key === 'escape') {
      handlers.escape();
      return;
    }
    if (event.repeat || key === 'shift') return;

    recent.push(key);
    if (recent.length > KONAMI.length) recent.shift();
    if (recent.length === KONAMI.length && recent.every((k, i) => k === KONAMI[i])) {
      recent.length = 0;
      typed = '';
      handlers.konami();
      return;
    }

    if (!/^[a-z]$/.test(key)) {
      typed = '';
      return;
    }
    typed = (typed + key).slice(-8);
    if (typed.endsWith('meow')) {
      typed = '';
      handlers.meow();
    } else if (typed.endsWith('box')) {
      typed = '';
      handlers.box();
    } else if (key === 'l') {
      handlers.laser();
    }
  });
}
