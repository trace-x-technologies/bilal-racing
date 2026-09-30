/**
 * The crew — friends who make up Bilal Racing (roles assigned for fun; the owner
 * can reshuffle them here). `person: null` = seat still open (render a funny
 * "vacancy" card, never an empty hole). Photos are face-cropped 480×480 avatars in
 * src/assets/photos/crew/.
 *
 * Open seats (the `garage` group) can be claimed on the site: a friend picks the
 * role, types a name and uploads a face photo. Those claims live in the database
 * (worker/index.ts reads this file to know which role ids are open). To make a
 * claim permanent, fill in `person` here and add the photo to the repo.
 *
 * `slot` places the member in the top-down pit-stop formation (see Crew section):
 * coordinates are % of the formation stage, car pointing up (nose at top).
 */
export type CrewGroup = 'pitwall' | 'pitcrew' | 'garage';

export interface CrewPerson {
  name: string;
  nickname?: string;
  /** File name inside src/assets/photos/crew/ (optional). */
  photo?: string;
  /** Short three-letter code for tokens/labels (optional). */
  code?: string;
}

export interface CrewRole {
  id: string;
  group: CrewGroup;
  role: string;
  /** Joke job description. */
  duty: string;
  /** Formation position in % (pit crew only). */
  slot?: { x: number; y: number };
  person: CrewPerson | null;
}

export const crew: CrewRole[] = [
  // ---------------- Pit wall ----------------
  {
    id: 'principal',
    group: 'pitwall',
    role: 'Team Principal',
    duty: 'Owns the team. Owns the pit wall. Owns every cardboard box in the garage. Signs every cheque with a paw print.',
    person: { name: 'Nirod Rathnaweera', nickname: 'පූසා · Poosa', photo: 'nirod-rathnaweera.jpg', code: 'RAT' },
  },
  {
    id: 'engineer',
    group: 'pitwall',
    role: 'Race Engineer',
    duty: 'Talks both drivers to the front on the radio. Every call lands, in stereo.',
    person: { name: 'Sámídul Iddamalgoda', photo: 'samidul-iddamalgoda.jpg', code: 'IDD' },
  },
  {
    id: 'strategist',
    group: 'pitwall',
    role: 'Head of Strategy',
    duty: 'Plan A: win. Plan B: win, with fish. Both plans work.',
    person: { name: 'Hashan Rahubaddha', photo: 'hashan-rahubaddha.jpg', code: 'RAH' },
  },
  {
    id: 'catering',
    group: 'pitwall',
    role: 'Head of Catering',
    duty: 'Keeps the tea and tuna supply chain running. Most important person on the team.',
    person: { name: 'Monte Buultjens', photo: 'monte-buultjens.jpg', code: 'BUU' },
  },
  // ---------------- Pit crew (formation around the car) ----------------
  {
    id: 'lollipop',
    group: 'pitcrew',
    role: 'Release Controller',
    duty: 'Holds the lollipop. Perfect release, every single stop.',
    slot: { x: 50, y: 6 },
    person: { name: 'Nisal Matharage', photo: 'nisal-matharage.jpg', code: 'MAT' },
  },
  {
    id: 'front-jack',
    group: 'pitcrew',
    role: 'Front Jack',
    duty: 'Lifts the car. Also lifts spirits. Both in under a second.',
    slot: { x: 50, y: 20 },
    person: { name: 'Charith Premakumara', photo: 'charith-premakumara.jpg', code: 'PRE' },
  },
  {
    id: 'gun-fl',
    group: 'pitcrew',
    role: 'Wheel Gun · Front Left',
    duty: 'Fastest hands in the pit lane. The wheel is off before the car has stopped.',
    slot: { x: 22, y: 30 },
    person: { name: 'Damindu Lakmal', photo: 'damindu-lakmal.jpg', code: 'LAK' },
  },
  {
    id: 'gun-fr',
    group: 'pitcrew',
    role: 'Wheel Gun · Front Right',
    duty: 'Tightens wheel nuts to “firm but loving”.',
    slot: { x: 78, y: 30 },
    person: { name: 'Sudheera Eranga', photo: 'sudheera-eranga.jpg', code: 'ERA' },
  },
  {
    id: 'stabiliser',
    group: 'pitcrew',
    role: 'Side Stabiliser',
    duty: 'Holds the car steady while the driver stretches.',
    slot: { x: 16, y: 52 },
    person: { name: 'Mahela Manamperi', photo: 'mahela-manamperi.jpg', code: 'MAN' },
  },
  {
    id: 'gun-rl',
    group: 'pitcrew',
    role: 'Wheel Gun · Rear Left',
    duty: 'Changed a tyre in 1.8 s. A team record, still standing.',
    slot: { x: 22, y: 74 },
    person: { name: 'Chamod Srimal', photo: 'chamod-srimal.jpg', code: 'SRI' },
  },
  {
    id: 'gun-rr',
    group: 'pitcrew',
    role: 'Wheel Gun · Rear Right',
    duty: 'Brings the wheel gun and the snacks. Never drops either.',
    slot: { x: 78, y: 74 },
    person: { name: 'Melan Kalana', photo: 'melan-kalana.jpg', code: 'KAL' },
  },
  {
    id: 'rear-jack',
    group: 'pitcrew',
    role: 'Rear Jack',
    duty: 'Guards the tail — the car’s and the owner’s. Both come home safe, every time.',
    slot: { x: 50, y: 92 },
    person: { name: 'Isuru Perera', nickname: 'IsuruT', photo: 'isuru-perera.jpg', code: 'PER' },
  },
  // ---------------- Garage (open seats: claimed on the site) ----------------
  {
    id: 'tyre-blankets',
    group: 'garage',
    role: 'Tyre Blanket Warmer',
    duty: 'Keeps the Purrelli softs toasty. The owner tests every blanket in person.',
    person: null,
  },
  {
    id: 'laser',
    group: 'garage',
    role: 'Laser Pointer Operator',
    duty: 'Runs the owner’s reflex training. One red dot, perfect aim.',
    person: null,
  },
  {
    id: 'tuna',
    group: 'garage',
    role: 'Chief Tuna Officer',
    duty: 'Opens the can on exactly the right lap. The whole garage hears it.',
    person: null,
  },
  {
    id: 'box-inspector',
    group: 'garage',
    role: 'Cardboard Box Inspector',
    duty: 'Checks every delivery box for comfort before the owner moves in.',
    person: null,
  },
  {
    id: 'pit-board',
    group: 'garage',
    role: 'Pit Board Holder',
    duty: 'Hangs the board over the wall. It always says P1.',
    person: null,
  },
  {
    id: 'zoomies',
    group: 'garage',
    role: 'Head of Zoomies',
    duty: 'Leads the warm-up laps of the garage. Morale: maximum.',
    person: null,
  },
  {
    id: 'telemetry',
    group: 'garage',
    role: 'Whisker Telemetry',
    duty: 'Reads the data and the whiskers. Both say fast.',
    person: null,
  },
  {
    id: 'fan-zone',
    group: 'garage',
    role: 'Fan Zone Marshal',
    duty: 'Starts the grandstand chant. Loud, proud and right on time.',
    person: null,
  },
];
