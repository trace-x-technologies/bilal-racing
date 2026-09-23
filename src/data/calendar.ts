/**
 * 2026/27 Bilal Racing season calendar. Every Grand Prix is fictional; the
 * Balangoda GP is an homage to the (real, owner-approved) 2021 lockdown run
 * in `lore.ts`.
 *
 * Circuit outlines are hand-drawn SVG paths in a 200 × 120 viewBox. The first
 * point of each path is the start/finish line; `decor` is non-racing scenery
 * (bridge arches, a fish eye…) drawn faintly under the track.
 */

export type WeatherIcon = 'sun' | 'moon' | 'wind' | 'rain' | 'cold' | 'mist' | 'hot' | 'wave';

export type RaceAccent = 'gold' | 'saffron' | 'teal' | 'purple' | 'red' | 'maroon';

export interface Race {
  round: number;
  id: string;
  /** Short venue name for the huge card title. */
  venue: string;
  /** Official event name. */
  name: string;
  /** Circuit + region line. */
  circuit: string;
  /** Lights out, ISO 8601 with Sri Lanka offset (+05:30). */
  start: string;
  /** Weekend label shown on the card, e.g. "16–18 Oct". */
  weekend: string;
  /** Display string so we can have "24 h" or "1 ↑". */
  laps: string;
  lengthKm: number;
  weather: { icon: WeatherIcon; text: string };
  joke: string;
  tag: string;
  accent: RaceAccent;
  /** Circuit outline, viewBox 0 0 200 120. */
  path: string;
  /** Point-to-point (not a loop): a finish flag is drawn at the path's last point. */
  open?: boolean;
  decor?: string;
  /** Pun name for turn 1 — shown under the map. */
  turn1: string;
  /** Fictional result, revealed once the race is over. */
  result: string;
  /** Endurance races run for 24 h instead of ~2 h. */
  endurance?: boolean;
}

/** Typical race length, used to decide "live now" vs "finished". */
export const RACE_DURATION_MS = 2 * 60 * 60 * 1000;
export const ENDURANCE_DURATION_MS = 24 * 60 * 60 * 1000;

/** Nine little bridge arches for Ella (generated, because nobody hand-types nine arches). */
function nineArches(x0: number, x1: number, deck: number, base: number): string {
  const w = (x1 - x0) / 9;
  const r = w / 2 - 1.2;
  const spring = deck + r + 4;
  let d = '';
  for (let i = 0; i < 9; i++) {
    const a = x0 + i * w + 1.2;
    const b = a + r * 2;
    d += `M${a.toFixed(1)} ${base} L${a.toFixed(1)} ${spring.toFixed(1)} A${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${b.toFixed(1)} ${spring.toFixed(1)} L${b.toFixed(1)} ${base} `;
  }
  return d.trim();
}

export const races: Race[] = [
  {
    round: 1,
    id: 'malabe',
    venue: 'Malabe',
    name: 'Malabe Grand Prix',
    circuit: 'Malabe Street Circuit · Western Province',
    start: '2026-10-18T15:00:00+05:30',
    weekend: '16–18 Oct',
    laps: '58',
    lengthKm: 3.9,
    weather: { icon: 'sun', text: 'Sunny with a chance of naps' },
    joke: 'Home race. Team HQ is on the doorstep and he will still be late to the grid.',
    tag: 'Home race',
    accent: 'gold',
    // A cat head. The "ω" at the bottom is the Whisker Chicane; the infield has eyes.
    path: 'M122 106 L146 106 Q170 106 172 82 L175 56 L168 12 L139 34 Q100 26 61 34 L32 12 L25 56 L28 82 Q30 106 54 106 L86 106 Q93 95 100 106 Q107 95 114 106 Z',
    decor: 'M66 66 Q78 55 90 66 Q78 77 66 66 Z M110 66 Q122 55 134 66 Q122 77 110 66 Z M78 60 V72 M122 60 V72',
    turn1: 'T1 · Whisker Kink',
    result: 'P9 — stopped at HQ for a snack on lap 2',
  },
  {
    round: 2,
    id: 'galle',
    venue: 'Galle Fort',
    name: 'Galle Fort Sprint',
    circuit: 'Rampart Ring · Southern Province',
    start: '2026-11-08T15:00:00+05:30',
    weekend: '06–08 Nov',
    laps: '17',
    lengthKm: 2.4,
    weather: { icon: 'wind', text: 'Sea breeze. Ideal for sunbathing on the ramparts' },
    joke: 'A sprint race. He will sprint for three seconds, then lie down on a warm wall.',
    tag: 'Sprint',
    accent: 'saffron',
    // Star-fort bastions.
    path: 'M52 104 L40 92 L28 72 L44 62 L38 38 L62 42 L72 20 L92 32 L110 16 L124 34 L152 26 L152 50 L174 58 L160 76 L170 98 L146 98 L134 110 L116 100 L90 108 L76 96 Z',
    turn1: 'T1 · Bastion Bed',
    result: 'DNF — found a warm rampart on lap 3',
  },
  {
    round: 3,
    id: 'kandy',
    venue: 'Kandy Lake',
    name: 'Kandy Lake Night Race',
    circuit: 'Lakeside Loop · Central Province',
    start: '2026-11-29T20:00:00+05:30',
    weekend: '27–29 Nov',
    laps: '61',
    lengthKm: 3.4,
    weather: { icon: 'moon', text: 'Clear night, full moon. Maximum zoomies' },
    joke: 'Under the floodlights his pupils go full size. So does his confidence.',
    tag: 'Night race',
    accent: 'purple',
    path: 'M28 70 C26 44 58 36 88 42 C114 47 124 28 152 30 C178 32 184 58 170 74 C156 90 122 80 100 88 C76 97 30 98 28 70 Z',
    decor: 'M150 54 m-7 0 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0',
    turn1: 'T1 · Moonbeam',
    result: 'P1 in the dark. Stewards blame the pupils',
  },
  {
    round: 4,
    id: 'colombo',
    venue: 'Port City',
    name: 'Colombo Port City Grand Prix',
    circuit: 'Reclaimed Land Circuit · Colombo',
    start: '2026-12-20T15:00:00+05:30',
    weekend: '18–20 Dec',
    laps: '50',
    lengthKm: 5.1,
    weather: { icon: 'hot', text: 'Hot, with a 100% chance of traffic on the way in' },
    joke: 'Brand-new circuit. He has already claimed one corner as his bed.',
    tag: 'Festive round',
    accent: 'teal',
    path: 'M30 94 L30 42 L58 42 L58 20 L150 20 Q170 20 170 40 L170 58 L118 58 L118 72 L170 72 L170 94 Q170 106 158 106 L42 106 Q30 106 30 94 Z',
    turn1: 'T1 · The Reclaimed Cushion',
    result: 'P9 — stuck in traffic on the way to the grid',
  },
  {
    round: 5,
    id: 'nuwara-eliya',
    venue: 'Nuwara Eliya',
    name: 'Nuwara Eliya Hill Climb',
    circuit: 'Little England Ascent · Central Highlands',
    start: '2027-01-17T10:00:00+05:30',
    weekend: '15–17 Jan',
    laps: '1 ↑',
    lengthKm: 6.8,
    weather: { icon: 'cold', text: '12 °C and misty. Bring a jumper' },
    joke: 'Uphill, all the way. He has formally asked to be carried.',
    tag: 'Hill climb',
    accent: 'teal',
    path: 'M18 108 L72 104 Q92 101 80 92 L40 85 Q22 80 40 72 L112 64 Q132 61 118 52 L60 45 Q42 41 60 33 L148 25 Q168 22 182 10',
    open: true,
    turn1: 'T1 · Jumper Bend',
    result: 'DNS — refused to leave the heated garage',
  },
  {
    round: 6,
    id: 'ella',
    venue: 'Ella',
    name: 'Ella Nine Arches Special',
    circuit: 'Nine Arches Bridge Loop · Uva Province',
    start: '2027-02-07T15:00:00+05:30',
    weekend: '05–07 Feb',
    laps: '9',
    lengthKm: 4.9,
    weather: { icon: 'mist', text: 'Misty mornings, scattered tea pluckers' },
    joke: 'Nine arches. Nine laps. Nine lives. The stewards have questions.',
    tag: 'Nine!',
    accent: 'gold',
    path: 'M100 70 L22 70 C18 40 50 22 80 34 C100 42 112 18 142 20 C172 22 186 44 180 70 Z',
    decor: nineArches(22, 180, 70, 110),
    turn1: 'T1 · Tea Break',
    result: 'P9. Obviously.',
  },
  {
    round: 7,
    id: 'negombo',
    venue: 'Negombo',
    name: 'Negombo Beach Drift',
    circuit: 'Lagoon Fish Circuit · Western Province',
    start: '2027-02-28T16:00:00+05:30',
    weekend: '26–28 Feb',
    laps: '44',
    lengthKm: 3.3,
    weather: { icon: 'wave', text: 'Low tide, high vibes. Sand in everything' },
    joke: 'The circuit is shaped like a fish and the run-off is one giant litter box. Best weekend of his life.',
    tag: 'Drift',
    accent: 'saffron',
    // A fish, swimming left.
    path: 'M36 60 C58 28 112 24 142 50 L174 26 L166 60 L174 94 L142 70 C112 96 58 92 36 60 Z',
    decor: 'M60 54 m-4 0 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0 M82 42 Q90 60 82 78',
    turn1: 'T1 · The Gills',
    result: 'DSQ — tried to eat the circuit',
  },
  {
    round: 8,
    id: 'balangoda',
    venue: 'Balangoda',
    name: 'Balangoda Grand Prix',
    circuit: 'Essential Services Circuit · Sabaragamuwa',
    start: '2027-03-21T15:00:00+05:30',
    weekend: '19–21 Mar',
    laps: '21',
    lengthKm: 5.2,
    weather: { icon: 'rain', text: 'Monsoon showers. Police pass required' },
    joke: 'Homage to the 2021 lockdown run. Every police checkpoint counts as a pit stop.',
    tag: 'Heritage',
    accent: 'maroon',
    path: 'M30 100 L58 100 C80 100 80 80 100 80 C120 80 120 100 142 100 L166 100 Q180 100 179 86 L176 42 Q174 24 158 26 L122 32 C102 36 96 14 76 16 L40 20 Q22 22 22 40 L22 90 Q22 100 30 100 Z',
    decor: 'M172 64 h12 M16 58 h12 M100 17 v12',
    turn1: 'T1 · Checkpoint Charlie',
    result: 'P1 — only car with a valid police pass',
  },
  {
    round: 9,
    id: 'jaffna',
    venue: 'Jaffna',
    name: '24 Hours of Jaffna',
    circuit: 'Peninsula Endurance Circuit · Northern Province',
    start: '2027-04-10T15:00:00+05:30',
    weekend: '09–11 Apr',
    laps: '24 h',
    lengthKm: 13.6,
    weather: { icon: 'hot', text: '35 °C. Mandatory nap every 40 minutes' },
    joke: 'Twenty-four hours of racing. He has trained by sleeping for twenty-four hours.',
    tag: 'Season finale',
    accent: 'red',
    path: 'M70 93 L120 96 Q150 98 168 80 L184 50 Q188 40 176 40 L112 48 Q96 50 90 40 L80 22 Q74 13 65 20 L24 60 Q12 73 22 90 Z',
    turn1: 'T1 · Hour Nine',
    result: 'Slept 23 h 59 min. Still classified.',
    endurance: true,
  },
];

/** Epoch ms when a race is considered finished. */
export function raceEnd(race: Race): number {
  return Date.parse(race.start) + (race.endurance ? ENDURANCE_DURATION_MS : RACE_DURATION_MS);
}

/** First point of a path ("M x y") — the start/finish line. */
export function pathStart(d: string): [number, number] {
  const m = d.match(/M\s*(-?[\d.]+)[\s,]+(-?[\d.]+)/);
  return m ? [Number(m[1]), Number(m[2])] : [0, 0];
}

/** Last coordinate pair of a path — the finish flag for point-to-point stages. */
export function pathEnd(d: string): [number, number] {
  const nums = d.match(/-?[\d.]+/g) ?? [];
  const n = nums.length;
  return n >= 2 ? [Number(nums[n - 2]), Number(nums[n - 1])] : [0, 0];
}
