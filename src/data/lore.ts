/**
 * Single source of truth for who the driver is and what the jokes are.
 * Sections pull facts from here so the story stays consistent.
 *
 * PRIVACY RULES (non-negotiable):
 *  - Never publish ID numbers, phone numbers, addresses, employers' client
 *    names or exact birth dates. Only the facts below are cleared for the site.
 *  - Real-world lore below was approved by the site owner.
 */

export const team = {
  name: 'Bilal Racing',
  /** Pun: "Bilala" ≈ cat in Sinhala, and the driver's nickname පූසා means cat. */
  tagline: 'Nine lives. Zero pit-stop discipline.',
  motto: 'Lights out, ears up.',
  founded: 2026,
  base: 'Malabe, Sri Lanka',
  car: 'BR-09 “Purrari”',
  engine: 'Meowcedes-ish V6 Purr-brid',
  tyres: 'Purrelli P-Zero Paw',
  championships: 'All of them (in his dreams)',
} as const;

export const driver = {
  fullName: 'Nirod Punsara Rathnaweera',
  firstName: 'Nirod',
  middleName: 'Punsara',
  lastName: 'Rathnaweera',
  /** Timing-screen code = first 3 letters of surname. A cat whose code is RAT. */
  code: 'RAT',
  nickname: 'පූසා',
  nicknameLatin: 'Poosa',
  nicknameMeaning: 'cat',
  number: 9, // nine lives
  nationality: 'Sri Lanka',
  flag: '🇱🇰',
  role: 'Race Driver · Chief Napping Officer',
  helmet: 'Carbon lid with factory-fitted ear bumps',
  superLicence: 'Essential-services letter to Sri Lanka Police (2021)',
  favouriteTrack: 'The warm bonnet after a long drive',
  signatureMove: 'The 3 a.m. Zoomies',
  weakness: 'Laser pointers in braking zones',
  radioCatchphrase: 'Box, box? Say less. I love a box.',
} as const;

/** Fictional stats — deliberately absurd. */
export const stats = [
  { label: 'Lives remaining', value: 9, suffix: '/9', note: 'Unconfirmed. Stewards investigating.' },
  { label: 'Naps per race weekend', value: 14, suffix: '', note: 'Including one during the anthem.' },
  { label: 'Top speed', value: 312, suffix: ' km/h', note: 'Only recorded when a tuna can opens.' },
  { label: 'Pole positions', value: 0, suffix: '', note: 'Prefers boxes to poles.' },
  { label: 'Reaction time to food', value: 0.09, suffix: ' s', decimals: 2, note: 'To alarm clocks: 9 minutes.' },
  { label: 'Fastest laps', value: 99, suffix: '', note: 'Around the living room.' },
] as const;

/**
 * Career timeline. The 2021 entries are real (owner-approved), told as racing lore.
 * Everything else is fiction.
 */
export const timeline = [
  {
    year: 'Kitten era',
    title: 'Karting on cement floors',
    body: 'Learned car control drifting across freshly mopped floors. Never once landed on his feet. Claimed he did.',
    tag: 'Junior formula',
  },
  {
    year: 'Jul 2021',
    title: 'The Balangoda Grand Prix',
    body: 'Mid-lockdown, Malabe → Balangoda. Hired as official driver for an engineering site visit, cleared by an essential-services letter to Sri Lanka Police. The only driver on the grid with a police-approved pass.',
    tag: 'Real story',
  },
  {
    year: 'Nov 2021',
    title: 'Wedding GP',
    body: 'Qualified P15 on the official “attending boys” list at the Team Principal’s wedding. Converted it to P1 at the buffet.',
    tag: 'Real story',
  },
  {
    year: '2026',
    title: 'Bilal Racing is born',
    body: 'One driver. One car. Zero budget. A team named after a cat, driven by a cat, run by people who should know better.',
    tag: 'Team launch',
  },
  {
    year: '2027',
    title: 'Target: the World Championship',
    body: 'Of napping. Pre-season testing is going well. Too well. He hasn’t woken up.',
    tag: 'Prediction',
  },
] as const;

export const radioMessages = [
  { from: 'Engineer', text: 'Nirod, box, box.' },
  { from: 'Poosa', text: 'Say less. I love a box.' },
  { from: 'Engineer', text: 'Mate, you stopped on the racing line.' },
  { from: 'Poosa', text: 'The sun is exactly here. I’m not moving.' },
  { from: 'Engineer', text: 'Plan B. Plan B.' },
  { from: 'Poosa', text: 'Is Plan B fish?' },
  { from: 'Engineer', text: 'Gap to the car behind is 0.4.' },
  { from: 'Poosa', text: 'I pushed it off the table.' },
  { from: 'Engineer', text: 'We are checking.' },
  { from: 'Poosa', text: 'You are always checking. Nobody checks on ME.' },
] as const;

/**
 * Sinhala words cleared for use. DO NOT invent other Sinhala — a wrong word is
 * worse than none. Pair with the transliteration where helpful.
 */
export const sinhala = {
  poosa: { si: 'පූසා', latin: 'poosa', en: 'cat (his nickname)' },
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
