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
  tagline: 'Nine lives. World champions.',
  motto: 'Lights out, ears up.',
  founded: 2026,
  base: 'Malabe, Sri Lanka',
  car: 'BR-09 “Purrari”',
  engine: 'Meowcedes-ish V6 Purr-brid',
  tyres: 'Purrelli P-Zero Paw',
  /** The team's lucky number — nine lives. Painted on the shark fin of both cars. */
  luckyNumber: 9,
  championships: 'All of them',
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
  managementStyle: 'Calls the winning strategy before the lights go out',
  office: 'Any cardboard box on the pit wall',
  signatureMove: 'The 3 a.m. Zoomies',
  superpower: 'Reads a race like a laser dot: always one pounce ahead',
  radioCatchphrase: 'Box, box? Say less. I love a box.',
} as const;

/** Owner stats — deliberately absurd, always flattering. */
export const ownerStats = [
  { label: 'Lives remaining', value: 9, suffix: '/9', note: 'All nine intact. All nine champions.' },
  { label: 'World titles', value: 2, suffix: '', note: 'Drivers’ and constructors’. At the first attempt.' },
  { label: 'Boxes sat in', value: 99, suffix: '', note: 'Every time someone says “box, box”.' },
  { label: 'Reaction time to food', value: 0.09, suffix: ' s', decimals: 2, note: 'Fastest reflexes in the paddock.' },
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
  superpower: string;
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
    numberJoke: 'Lucky 13. Ask the trophy cabinet.',
    photo: 'isuru-dharmadasa.jpg',
    focal: '40% 35%',
    nationality: 'Sri Lanka',
    flag: '🇱🇰',
    role: 'Race Driver · Car #13',
    bio: 'Built this entire website between pole laps. Writes the aero numbers straight into the code. Races in sunglasses because the future is bright and so is the beach.',
    helmet: 'Matte carbon, mirrored visor, permanent sunglasses underneath',
    signatureMove: 'The late-braking git push',
    superpower: 'Ships the overtake on the first try',
    radioCatchphrase: 'Copy. Deploying the overtake.',
    stats: [
      { label: 'Websites built between pole laps', value: 1, suffix: '', note: 'You are looking at it.' },
      { label: 'Top speed', value: 313, suffix: ' km/h', note: 'Fastest car on the grid.' },
      { label: 'Reaction time', value: 0.13, suffix: ' s', decimals: 2, note: 'Number-matched on purpose.' },
      { label: 'Podiums', value: 13, suffix: '', note: 'Every one celebrated with tuna.' },
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
    bio: 'Does pre-season training beside waterfalls and arrives on race day calm, fast and superbly hydrated. Finds grip where the map shows only jungle.',
    helmet: 'Jungle-green lid with a waterproof visor (tested at 17 waterfalls)',
    signatureMove: 'The switchback overtake',
    superpower: 'Finds the racing line on any mountain road',
    radioCatchphrase: 'No signal. Going flat out anyway.',
    stats: [
      { label: 'Waterfalls visited in pre-season', value: 17, suffix: '', note: 'Every one a training camp.' },
      { label: 'Top speed', value: 311, suffix: ' km/h', note: 'Flat out, everywhere.' },
      { label: 'Reaction time', value: 0.17, suffix: ' s', decimals: 2, note: 'Also number-matched. Coincidence.' },
      { label: 'Fastest laps', value: 17, suffix: '', note: 'One per waterfall.' },
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
    body: 'Young Poosa learns car control drifting across freshly mopped floors. Lands on his feet every single time.',
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
    title: 'Champions of the world',
    body: 'Both titles at the first attempt. #13 and #17 finish one-two, and the trophies live in the owner’s favourite box. Next season’s plan: win them again.',
    tag: 'World champions',
  },
] as const;

export type RadioSpeaker = 'Poosa' | 'Isuru' | 'Yasas';

/** Team radio — the owner on the pit wall talking to both drivers. */
export const radioMessages: { from: RadioSpeaker; text: string }[] = [
  { from: 'Poosa', text: 'Isuru, box, box.' },
  { from: 'Isuru', text: 'Copy. Fresh tyres?' },
  { from: 'Poosa', text: 'Fresh tyres. Fastest stop of the season. And I love this box.' },
  { from: 'Yasas', text: 'Gap to Isuru?' },
  { from: 'Poosa', text: 'One second. You are running one-two. Tuna for everyone.' },
  { from: 'Isuru', text: 'Is Plan B ready?' },
  { from: 'Poosa', text: 'Plan A is working. Plan B is fish. We win either way.' },
  { from: 'Yasas', text: 'No signal at the waterfall. Going flat out anyway.' },
  { from: 'Poosa', text: 'That is why you are the fastest. Push.' },
  { from: 'Isuru', text: 'Where do I find more time?' },
  { from: 'Poosa', text: 'Follow the sunny patch on the racing line. It is always the fastest way.' },
  { from: 'Yasas', text: 'P1 and P2. We did it.' },
  { from: 'Poosa', text: 'Champions of the world. Both of you. Bring me the trophy. It comes in a box.' },
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
