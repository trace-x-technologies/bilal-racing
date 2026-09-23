/**
 * A styled hello for anyone who opens DevTools.
 */
import { driver, team } from '@/data/lore';
import { KNOWN_EGGS } from './tracker';

function token(name: string, fallback: string): string {
  try {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  } catch {
    return fallback;
  }
}

export function greet(): void {
  const gold = token('--c-gold', 'gold');
  const onGold = token('--c-on-gold', 'black');
  const chalk = token('--c-chalk', 'white');
  const graphite = token('--c-graphite', '#222');
  const mute = token('--c-mute', 'gray');
  const red = token('--c-red', 'red');

  const art = [
    '        /\\_/\\ ',
    '   ____/ o o \\        ' + `${team.name.toUpperCase()}  ·  #${driver.number} ${driver.code}`,
    ' /~____  =ø= /        ' + team.motto,
    '(______)__m_m)        ' + `${team.car} · ${team.engine}`,
  ].join('\n');

  console.log(`%c${art}`, `color:${gold};font:600 12px/1.35 ui-monospace,Menlo,Consolas,monospace`);
  console.log(
    '%c PIT CREW WANTED %c Bring snacks. ',
    `background:${gold};color:${onGold};font-weight:800;padding:4px 8px;border-radius:3px 0 0 3px;letter-spacing:.08em`,
    `background:${graphite};color:${chalk};padding:4px 8px;border-radius:0 3px 3px 0`,
  );
  console.log(
    `%cRace control notice:%c at least ${KNOWN_EGGS.length} easter eggs are hidden on this page.\n` +
      '  · a cheat code older than the driver\n' +
      '  · the word cats say\n' +
      '  · the thing cats sit in (say it twice on the radio)\n' +
      '  · the letter that comes after K\n' +
      '  · nine lives, spent on the emblem\n' +
      '  · rev the engine until you run out of lives\n' +
      '  · doing absolutely nothing for one minute',
    `color:${red};font-weight:700`,
    `color:${mute}`,
  );
}
