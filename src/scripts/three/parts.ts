/**
 * BR-09 "Purrari" parts manifest — plain data (no Three.js import) so Astro can
 * render the callout labels / parts list at build time and car.ts can attach the
 * same metadata to the 3D groups.
 *
 * Coordinates are car-local: ground at y = 0, nose towards +z, x = lateral.
 * `explode` is the offset a part travels in the exploded view (units ≈ metres);
 * for mirrored parts (sidepods, wheels) x is applied outwards on each side.
 * `anchor` is where the callout leader line attaches, before exploding.
 * Order = the order of the guided tour in the exploded view (front → back).
 */
export type PartId =
  | 'frontwing'
  | 'wheels'
  | 'suspension'
  | 'halo'
  | 'cockpit'
  | 'monocoque'
  | 'sidepods'
  | 'floor'
  | 'airbox'
  | 'enginecover'
  | 'powerunit'
  | 'rearwing';

export interface PartInfo {
  id: PartId;
  /** Marketing name shown on the callout. */
  label: string;
  /** What it actually is, for people who know cars. */
  real: string;
  /** Joke spec line. */
  joke: string;
  explode: readonly [number, number, number];
  anchor: readonly [number, number, number];
}

export const PART_INFO: readonly PartInfo[] = [
  {
    id: 'frontwing',
    label: 'Whisker-Array Front Wing',
    real: 'Nose + 4-element front wing',
    joke: 'Four whisker flaps measure every gap before the car commits. Real whiskers fitted as standard.',
    explode: [0, 0.2, 1.55],
    anchor: [-0.66, 0.26, 2.6],
  },
  {
    id: 'wheels',
    label: 'Purrelli Paw Tyres',
    real: '18″ wheels, covers & rubber',
    joke: 'P-Zero Paw compound. Leaves paw prints on every apex. Allergic to wet grass.',
    explode: [0.85, 0, 0.3],
    anchor: [-0.98, 0.5, 1.9],
  },
  {
    id: 'suspension',
    label: 'Knead-Action Suspension',
    real: 'Double wishbones + push/pull rods',
    joke: 'Kneads the track like a blanket for three laps before finally lying on it.',
    explode: [0, -0.35, 0],
    anchor: [-0.42, 0.45, -1.4],
  },
  {
    id: 'halo',
    label: 'Nine-Lives Halo',
    real: 'Titanium cockpit protection',
    joke: 'Protects the driver’s head. Doubles as the owner’s chin-scratcher. Gold because the owner said so, from inside a box.',
    explode: [0, 1.45, 0.35],
    anchor: [-0.24, 0.88, 0.25],
  },
  {
    id: 'cockpit',
    label: 'Nap-Pod Cockpit',
    real: 'Helmet, seat & steering wheel',
    joke: 'Owner-approved seat; the drivers only borrow it, and must wear his cat-ear helmet cover. NAP button on the wheel. Most-used button: NAP.',
    explode: [0, 0.95, 0.15],
    anchor: [-0.06, 0.93, 0.1],
  },
  {
    id: 'monocoque',
    label: 'Carbon Litter-Tray Monocoque',
    real: 'Carbon survival cell',
    joke: 'Survival cell rated for the team’s nine lives. Officially all nine are intact. The kitchen counter disagrees.',
    explode: [0, 0, 0],
    anchor: [-0.34, 0.55, 0.75],
  },
  {
    id: 'sidepods',
    label: 'Hairball Intakes',
    real: 'Sidepods & radiator inlets',
    joke: 'Cooling inlets. Occasionally cough up a hairball at 300 km/h. Stewards are aware.',
    explode: [0.95, 0.12, 0],
    anchor: [-0.79, 0.45, 0.1],
  },
  {
    id: 'floor',
    label: 'Belly-Rub Floor',
    real: 'Ground-effect floor & diffuser',
    joke: 'Ground effect so strong it demands belly rubs. Then bites you for giving them.',
    explode: [0, -0.8, 0],
    anchor: [-0.74, 0.07, -0.3],
  },
  {
    id: 'airbox',
    label: 'Twin-Ear Airbox',
    real: 'Roll hoop & engine air intake',
    joke: 'Ears up = full power. Ears flat = the car has spotted the vet’s van in the paddock.',
    explode: [0, 1.25, -0.2],
    anchor: [-0.1, 1.04, -0.3],
  },
  {
    id: 'enginecover',
    label: 'Tail-Fin Engine Cover',
    real: 'Engine cover, shark fin & antenna',
    joke: 'The shark fin wears the team’s lucky 9. The curled-tail antenna picks up the owner’s radio calls and tuna cans opening 3 km away.',
    explode: [0, 1.05, -0.75],
    anchor: [-0.2, 0.62, -1.0],
  },
  {
    id: 'powerunit',
    label: 'Purr-brid V6',
    real: '1.6 L V6 turbo hybrid + gearbox',
    joke: '1,000 hp. Idles at a purr of 25 Hz. The MGU-K harvests energy from knocked-over glasses.',
    explode: [0, 0.3, -0.35],
    anchor: [-0.2, 0.5, -0.85],
  },
  {
    id: 'rearwing',
    label: 'Tail-Flap DRS',
    real: 'Rear wing, beam wing & crash structure',
    joke: 'Opens on the straights. Also opens whenever the owner is bored on the pit wall. Mostly that.',
    explode: [0, 0.55, -1.35],
    anchor: [-0.5, 0.95, -2.15],
  },
] as const;

/** Car spec sheet rows (values that aren't from lore.ts live here). */
export const SPEC_JOKES = {
  power: '1,000 hp + the team’s 9 lives',
  weight: '798 kg incl. cat hair',
  zeroToHundred: 'Depends on snack placement',
  gearbox: '8-speed + N (for Nap)',
  brakes: 'Carbon-carbon. Also claws.',
  fuel: '100% sustainable catnip',
} as const;
