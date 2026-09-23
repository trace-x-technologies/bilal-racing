/**
 * Easter-egg tracker. Every egg emits('bilal:egg', { id, label }); found ids
 * persist in localStorage ("bilal:eggs"). Other sections may emit their own
 * ids — unknown ids are counted too and grow the total.
 */
import { on, store, type BilalEvents } from '@/scripts/bus';
import { toast } from './util';

export const KNOWN_EGGS = ['konami', 'nine-lives', 'meow', 'box', 'laser', 'nap'] as const;

type EggDetail = BilalEvents['bilal:egg'];

export function initTracker(): (detail: EggDetail | undefined) => void {
  const saved = store.get<unknown>('eggs', []);
  const found = new Set<string>(
    Array.isArray(saved) ? saved.filter((id): id is string => typeof id === 'string').slice(0, 64) : [],
  );

  function record(detail: EggDetail | undefined): void {
    const id = typeof detail?.id === 'string' ? detail.id.slice(0, 40) : '';
    if (!id || found.has(id)) return;
    found.add(id);
    store.set('eggs', [...found]);

    const total = new Set<string>([...KNOWN_EGGS, ...found]).size;
    const count = found.size;
    const label = typeof detail?.label === 'string' ? detail.label.slice(0, 60) : '';
    const message =
      count >= total
        ? `All ${total} easter eggs found. You are now legally a cat.`
        : `Easter egg ${count}/${total} found${label ? ` · ${label}` : ''}`;
    // Let the egg's own toast land first.
    window.setTimeout(() => toast(message, 'gold'), 900);
  }

  on('bilal:egg', record);
  return record;
}
