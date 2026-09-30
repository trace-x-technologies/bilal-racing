/**
 * A styled hello for anyone who opens DevTools: the line-up (the cat owns the
 * team, two drivers do the actual racing), the crew roll-call and egg hints.
 */
import { crew } from '@/data/crew';
import { drivers, owner, team } from '@/data/lore';
import { KNOWN_EGGS } from './tracker';

function token(name: string, fallback: string): string {
  try {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  } catch {
    return fallback;
  }
}

/** Width of the ASCII cat column, so the text beside it lines up. */
const ART_W = 22;
const CAT = ['        /\\_/\\', '   ____/ o o \\', ' /~____  =ø= /', '(______)__m_m)', ''];

export function greet(): void {
  const gold = token('--c-gold', 'gold');
  const onGold = token('--c-on-gold', 'black');
  const chalk = token('--c-chalk', 'white');
  const graphite = token('--c-graphite', '#222');
  const mute = token('--c-mute', 'gray');
  const red = token('--c-red', 'red');

  const lineup = drivers.map((d) => `#${d.number} ${d.code} ${d.fullName}`).join('  ·  ');
  const text = [
    `${team.name.toUpperCase()}  ·  lucky #${team.luckyNumber} (nine lives)  ·  est. ${team.founded}`,
    `Owner & Team Principal: ${owner.firstName} “${owner.nicknameLatin}” ${owner.lastName}  ·  pit-wall callsign ${owner.callsign}`,
    `Drivers: ${lineup}`,
    `${team.car} · ${team.engine}`,
    `${team.motto} The cat owns the team; the drivers win for it.`,
  ];
  const art = CAT.map((line, i) => line.padEnd(ART_W) + (text[i] ?? '')).join('\n');

  console.log(`%c${art}`, `color:${gold};font:600 12px/1.35 ui-monospace,Menlo,Consolas,monospace`);

  // The owner has his own line above; this is the rest of the crew.
  const roster = crew.filter((r) => r.id !== 'principal');
  const open = roster.filter((r) => !r.person);
  const aboard = roster.length - open.length;
  const [tag, note] = open.length
    ? [
        ' PIT CREW WANTED ',
        ` ${aboard} friends aboard, ${open.length} seat${open.length === 1 ? '' : 's'} open (${open
          .map((r) => r.role)
          .join(', ')}). Bring snacks. `,
      ]
    : [' PIT CREW: FULL ', ` ${aboard} friends aboard, zero open seats. Bring snacks anyway. `];
  console.log(
    `%c${tag}%c${note}`,
    `background:${gold};color:${onGold};font-weight:800;padding:4px 8px;border-radius:3px 0 0 3px;letter-spacing:.08em`,
    `background:${graphite};color:${chalk};padding:4px 8px;border-radius:0 3px 3px 0`,
  );
  console.log(
    `%cRace control notice:%c at least ${KNOWN_EGGS.length} easter eggs are hidden on this page.\n` +
      '  · a cheat code older than the team\n' +
      '  · the word cats say (the owner answers)\n' +
      '  · the thing cats sit in (say it twice on the radio)\n' +
      '  · the letter that comes after K\n' +
      '  · the owner’s nine lives, counted on the emblem\n' +
      '  · rev the engine nine times\n' +
      '  · doing absolutely nothing for one minute (a champion’s rest)',
    `color:${red};font-weight:700`,
    `color:${mute}`,
  );
}
