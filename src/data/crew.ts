/**
 * The crew — friends who make up Bilal Racing. Data-driven so the owner can
 * drop in names/photos later. `person: null` = seat still open (render a
 * funny "vacancy" card, never an empty hole).
 *
 * `slot` places the member in the top-down pit-stop formation (see Crew section):
 * coordinates are % of the formation stage, car pointing up (nose at top).
 */
export type CrewGroup = 'pitwall' | 'pitcrew';

export interface CrewPerson {
  name: string;
  nickname?: string;
  /** File name inside src/assets/photos/crew/ (optional). */
  photo?: string;
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
    duty: 'Built this website instead of a car. Signs every cheque with “lol”.',
    person: { name: 'Isuru', nickname: 'The Boss' }, // TODO(owner): confirm
  },
  {
    id: 'engineer',
    group: 'pitwall',
    role: 'Race Engineer',
    duty: 'Talks to the driver on the radio. Has not been listened to once.',
    person: null,
  },
  {
    id: 'strategist',
    group: 'pitwall',
    role: 'Head of Strategy',
    duty: 'Plan A: win. Plan B: fish. There is no Plan C.',
    person: null,
  },
  {
    id: 'catering',
    group: 'pitwall',
    role: 'Head of Catering',
    duty: 'Keeps the tuna supply chain running. Most important person on the team.',
    person: null,
  },
  // ---------------- Pit crew (formation around the car) ----------------
  {
    id: 'lollipop',
    group: 'pitcrew',
    role: 'Release Controller',
    duty: 'Holds the lollipop. Frequently eats it.',
    slot: { x: 50, y: 6 },
    person: null,
  },
  {
    id: 'front-jack',
    group: 'pitcrew',
    role: 'Front Jack',
    duty: 'Lifts the car. Also lifts spirits. Mostly the car.',
    slot: { x: 50, y: 20 },
    person: null,
  },
  {
    id: 'gun-fl',
    group: 'pitcrew',
    role: 'Wheel Gun · Front Left',
    duty: 'Fastest hands on the team. Slowest to reply on WhatsApp.',
    slot: { x: 22, y: 30 },
    person: null,
  },
  {
    id: 'gun-fr',
    group: 'pitcrew',
    role: 'Wheel Gun · Front Right',
    duty: 'Tightens wheel nuts to “firm but loving”.',
    slot: { x: 78, y: 30 },
    person: null,
  },
  {
    id: 'stabiliser',
    group: 'pitcrew',
    role: 'Side Stabiliser',
    duty: 'Holds the car steady while the driver stretches.',
    slot: { x: 16, y: 52 },
    person: null,
  },
  {
    id: 'gun-rl',
    group: 'pitcrew',
    role: 'Wheel Gun · Rear Left',
    duty: 'Once changed a tyre in 1.8 s. Talks about it daily.',
    slot: { x: 22, y: 74 },
    person: null,
  },
  {
    id: 'gun-rr',
    group: 'pitcrew',
    role: 'Wheel Gun · Rear Right',
    duty: 'Brings the snacks. Also the wheel gun, sometimes.',
    slot: { x: 78, y: 74 },
    person: null,
  },
  {
    id: 'rear-jack',
    group: 'pitcrew',
    role: 'Rear Jack',
    duty: 'Guards the tail. The driver’s actual tail. Do not touch the tail.',
    slot: { x: 50, y: 92 },
    person: null,
  },
];
