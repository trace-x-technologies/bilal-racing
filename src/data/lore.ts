/**
 * Single source of truth for who is who at Bilal Racing and what the jokes are.
 * Sections pull facts from here so the story stays consistent.
 *
 * LINE-UP (owner-confirmed):
 *  - Team Principal & Owner: Nirod Punsara Rathnaweera, nickname පූසා (Poosa) = "cat".
 *    The cat owns the team. #9 (nine lives) is the TEAM's lucky number; RAT is his
 *    pit-wall callsign (first 3 letters of the surname — a cat whose callsign is RAT).
 *  - Drivers: Isuru Dharmadasa #13 (DHA) and Yasas Deegala #17 (DEE).
 *
 * PRIVACY RULES (non-negotiable):
 *  - Never publish ID numbers, phone numbers, addresses, employers' client
 *    names or exact birth dates. Only the facts below are cleared for the site.
 *  - Real-world lore below was approved by the site owner.
 *  - Don't identify people in group photos by name; only the named portraits.
 */

export const team = {
  name: 'Bilal Racing',
  /** Pun: "Bilala" ≈ cat in Sinhala, and the owner's nickname පූසා means cat. */
  tagline: 'Nine lives. Zero pit-stop discipline.',
  motto: 'Lights out, ears up.',
  founded: 2026,
  base: 'Malabe, Sri Lanka',
  car: 'BR-09 “Purrari”',
  engine: 'Meowcedes-ish V6 Purr-brid',
  tyres: 'Purrelli P-Zero Paw',
  /** The team's lucky number — nine lives. Painted on the shark fin of both cars. */
  luckyNumber: 9,
  championships: 'All of them (in the owner’s dreams)',
} as const;

/** Team Principal & Owner — the cat who owns the team. */
export const owner = {
  fullName: 'Nirod Punsara Rathnaweera',
  firstName: 'Nirod',
  middleName: 'Punsara',
  lastName: 'Rathnaweera',
  nickname: 'පූසා',
  nicknameLatin: 'Poosa',
  nicknameMeaning: 'cat',
  role: 'Team Principal & Owner',
  /** Pit-wall callsign = first 3 letters of surname. A cat whose callsign is RAT. */
  callsign: 'RAT',
  photo: 'nirod-rathnaweera.jpg', // src/assets/photos/team/
  nationality: 'Sri Lanka',
  flag: '🇱🇰',
  /** His racing past (real, owner-approved): the 2021 lockdown run. */
  superLicence: 'Essential-services letter to Sri Lanka Police (2021)',
  managementStyle: 'Knocks the strategy off the desk, then naps on it',
  office: 'Any cardboard box on the pit wall',
  signatureMove: 'The 3 a.m. Zoomies',
  weakness: 'Laser pointers in braking zones',
  radioCatchphrase: 'Box, box? Say less. I love a box.',
} as const;

/** Owner stats — deliberately absurd. */
export const ownerStats = [
  { label: 'Lives remaining', value: 9, suffix: '/9', note: 'Unconfirmed. Stewards investigating.' },
  { label: 'Naps per race weekend', value: 14, suffix: '', note: 'Including one during the anthem.' },
  { label: 'Boxes sat in', value: 99, suffix: '', note: 'Every time someone says “box, box”.' },
  { label: 'Reaction time to food', value: 0.09, suffix: ' s', decimals: 2, note: 'To team emails: 9 business days.' },
] as const;

export interface DriverStat {
  label: string;
  value: number;
  suffix: string;
  decimals?: number;
  note: string;
}

export interface Driver {
  id: 'dha' | 'dee';
  fullName: string;
  firstName: string;
  lastName: string;
  /** Timing-screen code = first 3 letters of surname (F1 rule). */
  code: string;
  number: number;
  numberJoke: string;
  photo: string; // src/assets/photos/driver/
  focal: string; // object-position for the portrait
  nationality: string;
  flag: string;
  role: string;
  bio: string;
  helmet: string;
  signatureMove: string;
  weakness: string;
  radioCatchphrase: string;
  stats: DriverStat[];
}

/** Race drivers — fiction beyond name, number and code. */
export const drivers: Driver[] = [
  {
    id: 'dha',
    fullName: 'Isuru Dharmadasa',
    firstName: 'Isuru',
    lastName: 'Dharmadasa',
    code: 'DHA',
    number: 13,
    numberJoke: 'Unlucky — for everyone behind him.',
    photo: 'isuru-dharmadasa.jpg',
    focal: '40% 35%',
    nationality: 'Sri Lanka',
    flag: '🇱🇰',
    role: 'Race Driver · Car #13',
    bio: 'Built this entire website instead of doing a single practice lap. Claims the aero numbers are “in the code somewhere”. Races in sunglasses because the future is bright and so is the beach.',
    helmet: 'Matte carbon, mirrored visor, permanent sunglasses underneath',
    signatureMove: 'The late-braking git push',
    weakness: 'Refactoring mid-corner',
    radioCatchphrase: 'Copy. Deploying the overtake.',
    stats: [
      { label: 'Websites built instead of practising', value: 1, suffix: '', note: 'You are looking at it.' },
      { label: 'Top speed', value: 313, suffix: ' km/h', note: 'Downhill. Tailwind. Allegedly.' },
      { label: 'Reaction time', value: 0.13, suffix: ' s', decimals: 2, note: 'Number-matched on purpose.' },
      { label: 'Team orders ignored', value: 13, suffix: '', note: 'This season. It’s September.' },
    ],
  },
  {
    id: 'dee',
    fullName: 'Yasas Deegala',
    firstName: 'Yasas',
    lastName: 'Deegala',
    code: 'DEE',
    number: 17,
    numberJoke: 'Seventeen — the number of snacks per stint.',
    photo: 'yasas-deegala.jpg',
    focal: '47% 45%',
    nationality: 'Sri Lanka',
    flag: '🇱🇰',
    role: 'Race Driver · Car #17',
    bio: 'Does pre-season training beside waterfalls with no phone signal, which is also where the race engineer finds him on race day. Calm, fast and suspiciously well-hydrated.',
    helmet: 'Jungle-green lid with a waterproof visor (tested at 17 waterfalls)',
    signatureMove: 'The switchback overtake',
    weakness: 'Stopping to take scenic photos on the out-lap',
    radioCatchphrase: 'No signal. Going flat out anyway.',
    stats: [
      { label: 'Waterfalls visited in pre-season', value: 17, suffix: '', note: 'Engineers visited zero.' },
      { label: 'Top speed', value: 311, suffix: ' km/h', note: 'He says 313. Telemetry disagrees.' },
      { label: 'Reaction time', value: 0.17, suffix: ' s', decimals: 2, note: 'Also number-matched. Coincidence.' },
      { label: 'Overtakes on his teammate', value: 0, suffix: '', note: 'Officially. Unofficially: classified.' },
    ],
  },
];

/**
 * Team history. The 2021 entries are real (owner-approved), told as racing lore —
 * they're from the owner's own driving days. Everything else is fiction.
 */
export const timeline = [
  {
    year: 'Kitten era',
    title: 'Karting on cement floors',
    body: 'Young Poosa learns car control drifting across freshly mopped floors. Never once lands on his feet. Claims he did.',
    tag: 'Junior formula',
  },
  {
    year: 'Jul 2021',
    title: 'The Balangoda Grand Prix',
    body: 'Mid-lockdown, Malabe → Balangoda. Poosa, still a driver back then, is hired for an engineering site visit, cleared by an essential-services letter to Sri Lanka Police. The only driver on the grid with a police-approved pass.',
    tag: 'Real story',
  },
  {
    year: 'Nov 2021',
    title: 'Wedding GP',
    body: 'At driver Isuru’s wedding, Poosa qualifies P15 on the official “attending boys” list — then converts it to P1 at the buffet.',
    tag: 'Real story',
  },
  {
    year: '2026',
    title: 'The cat buys the team',
    body: 'Poosa retires from driving, founds Bilal Racing and signs #13 Isuru Dharmadasa and #17 Yasas Deegala. Contract clause 1: the owner gets the warm seat.',
    tag: 'Team launch',
  },
  {
    year: '2027',
    title: 'Target: the World Championship',
    body: 'Both drivers want the title. The owner wants a nap. Early projections favour the nap.',
    tag: 'Prediction',
  },
] as const;

export type RadioSpeaker = 'Poosa' | 'Isuru' | 'Yasas';

/** Team radio — the owner on the pit wall talking to both drivers. */
export const radioMessages: { from: RadioSpeaker; text: string }[] = [
  { from: 'Poosa', text: 'Isuru, box, box.' },
  { from: 'Isuru', text: 'Copy. What’s the problem?' },
  { from: 'Poosa', text: 'No problem. I want to sit in the box.' },
  { from: 'Yasas', text: 'Gap to Isuru?' },
  { from: 'Poosa', text: 'Irrelevant. It’s feeding time.' },
  { from: 'Isuru', text: 'Is Plan B ready?' },
  { from: 'Poosa', text: 'Plan B is fish. Plan B was always fish.' },
  { from: 'Yasas', text: 'I’ve lost radio signal near the waterfall.' },
  { from: 'Poosa', text: 'Then how are you— never mind. Push.' },
  { from: 'Isuru', text: 'Why did the car stop on the racing line?' },
  { from: 'Poosa', text: 'The sun was exactly there. I made an executive decision.' },
  { from: 'Yasas', text: 'We are checking.' },
  { from: 'Poosa', text: 'You are always checking. Nobody checks on ME.' },
];

/**
 * Sinhala words cleared for use. DO NOT invent other Sinhala — a wrong word is
 * worse than none. Pair with the transliteration where helpful.
 */
export const sinhala = {
  poosa: { si: 'පූසා', latin: 'poosa', en: 'cat (the owner’s nickname)' },
  balala: { si: 'බළලා', latin: 'balala', en: 'cat (formal)' },
  ayubowan: { si: 'ආයුබෝවන්', latin: 'ayubowan', en: 'welcome / may you live long' },
  machan: { si: 'මචං', latin: 'machan', en: 'mate, buddy' },
  hari: { si: 'හරි', latin: 'hari', en: 'okay / right' },
  jayaWewa: { si: 'ජය වේවා', latin: 'jaya wewa', en: 'victory to you' },
  subaGaman: { si: 'සුබ ගමන්', latin: 'suba gaman', en: 'have a good journey' },
  ikmanata: { si: 'ඉක්මනට', latin: 'ikmanata', en: 'quickly!' },
  ammo: { si: 'අම්මෝ', latin: 'ammo', en: 'whoa! / oh my' },
  vegaya: { si: 'වේගය', latin: 'vegaya', en: 'speed' },
  kaema: { si: 'කෑම', latin: 'kæma', en: 'food' },
  ninda: { si: 'නින්ද', latin: 'ninda', en: 'sleep' },
} as const;

/* ------------------------------------------------------------------------ */
/* DEPRECATED — temporary shims for the line-up migration. The site used to  */
/* treat Nirod as the driver. Migrate every usage to `owner` / `drivers` /   */
/* `ownerStats`; these exports are deleted once nothing imports them.        */
/* ------------------------------------------------------------------------ */
/** @deprecated use `owner` (Team Principal) or `drivers` */
export const driver = {
  ...owner,
  code: owner.callsign,
  number: team.luckyNumber,
  helmet: 'Carbon lid with factory-fitted ear bumps',
  favouriteTrack: 'The warm bonnet after a long drive',
} as const;
/** @deprecated use `ownerStats` or `drivers[i].stats` */
export const stats = [
  { label: 'Lives remaining', value: 9, suffix: '/9', note: 'Unconfirmed. Stewards investigating.' },
  { label: 'Naps per race weekend', value: 14, suffix: '', note: 'Including one during the anthem.' },
  { label: 'Top speed', value: 312, suffix: ' km/h', note: 'Only recorded when a tuna can opens.' },
  { label: 'Pole positions', value: 0, suffix: '', note: 'Prefers boxes to poles.' },
  { label: 'Reaction time to food', value: 0.09, suffix: ' s', decimals: 2, note: 'To alarm clocks: 9 minutes.' },
  { label: 'Fastest laps', value: 99, suffix: '', note: 'Around the living room.' },
] as const;
