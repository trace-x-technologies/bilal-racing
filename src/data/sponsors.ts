/**
 * Parody partners and the (permanently sold-out) Paddock Shop.
 * All names are original parodies — no real brands, no real logos. Each
 * sponsor's typographic badge is drawn in SVG by Sponsors.astro, keyed by `id`.
 */

export type Accent = 'gold' | 'saffron' | 'teal' | 'purple' | 'red' | 'maroon' | 'chalk';

export interface Sponsor {
  id: 'purrelli' | 'whisker' | 'catnip' | 'litterbox' | 'nap' | 'laser' | 'machan' | 'tea';
  name: string;
  category: string;
  line: string;
  accent: Accent;
  /** Optional approved Sinhala word key from lore.sinhala. */
  si?: 'machan';
}

export const sponsors: Sponsor[] = [
  {
    id: 'purrelli',
    name: 'Purrelli',
    category: 'Official tyre supplier',
    line: 'P Zero Paw. Grip on every surface except the vet’s table.',
    accent: 'gold',
  },
  {
    id: 'whisker',
    name: 'Whisker Energy',
    category: 'Official energy drink',
    line: 'Gives you whiskers. Side effects include 3 a.m. zoomies.',
    accent: 'teal',
  },
  {
    id: 'catnip',
    name: 'Catnip Capital',
    category: 'Official investment partner',
    line: 'Past purr-formance is no guarantee of future naps.',
    accent: 'teal',
  },
  {
    id: 'litterbox',
    name: 'Litter-Box Logistics',
    category: 'Official logistics partner',
    line: 'We deliver. We bury. We don’t talk about it.',
    accent: 'saffron',
  },
  {
    id: 'nap',
    name: 'Nap Airlines',
    category: 'Official airline',
    line: 'Every seat reclines. Every flight is a red-eye.',
    accent: 'purple',
  },
  {
    id: 'laser',
    name: 'Laser Pointer Labs',
    category: 'Official technology partner',
    line: 'Innovation you can chase but never catch. Banned from all braking zones.',
    accent: 'red',
  },
  {
    id: 'machan',
    name: 'Machan Motors',
    category: 'Official safety car (a tuk-tuk)',
    line: 'Top speed: whenever it feels like it. Deploys with a horn, not lights.',
    accent: 'maroon',
    si: 'machan',
  },
  {
    id: 'tea',
    name: 'Ceylon Tea-mperature Control',
    category: 'Official cooling partner',
    line: 'Keeps the brakes at 85 °C. And the tea. Same kettle.',
    accent: 'gold',
  },
];

export const titleSponsor = {
  label: 'Title sponsor',
  status: 'Still sleeping on it',
  pitch: 'Your name on the only car that stops for sunbeams. Seen by dozens. Napped on by one.',
  cta: 'Apply to sponsor',
  toast: 'Application received. He’s sleeping on it.',
} as const;

export interface MerchItem {
  id: 'cap' | 'box' | 'hoodie' | 'tee' | 'freshener' | 'laser';
  name: string;
  /** Price in Sri Lankan rupees. */
  price: number;
  blurb: string;
  tag?: string;
  accent: Accent;
  /** Short alt-style description of the product illustration. */
  art: string;
}

export const merch: MerchItem[] = [
  {
    id: 'cap',
    name: 'Cat-Ear Team Cap',
    price: 4990,
    blurb: 'Ears pre-installed. Fits any head with two ears or fewer.',
    tag: 'Bestseller',
    accent: 'gold',
    art: 'Black team cap with two pointed cat ears and a gold #9 badge',
  },
  {
    id: 'box',
    name: '“Box Box” Limited Edition Box',
    price: 12500,
    blurb: 'Genuine cardboard. Ships empty, arrives with a driver in it.',
    tag: 'Limited',
    accent: 'saffron',
    art: 'An open cardboard box stamped BOX BOX, with two cat ears and glowing eyes peeking out',
  },
  {
    id: 'hoodie',
    name: '#9 Nine Lives Hoodie',
    price: 9999,
    blurb: 'Nine lives, one hood. Front pocket sized for exactly one treat.',
    tag: 'New',
    accent: 'maroon',
    art: 'Maroon hoodie with cat-ear hood and a big gold number nine',
  },
  {
    id: 'tee',
    name: '“RAT” Timing-Screen Tee',
    price: 3900,
    blurb: 'His timing code is RAT. He is a cat. We do not discuss it.',
    accent: 'purple',
    art: 'White T-shirt printed with a timing tower showing RAT in first place',
  },
  {
    id: 'freshener',
    name: 'Tuna-Scented Air Freshener',
    price: 990,
    blurb: 'New-car smell, but make it fish. Driver-approved. Passenger-disputed.',
    tag: 'Smells',
    accent: 'teal',
    art: 'A fish-shaped car air freshener labelled TUNA hanging from a string',
  },
  {
    id: 'laser',
    name: 'Laser Pointer (Stewards’ Edition)',
    price: 1500,
    blurb: 'Sealed in an evidence bag after the Kandy braking-zone incident.',
    tag: 'Confiscated',
    accent: 'red',
    art: 'A laser pointer sealed inside a plastic evidence bag',
  },
];

export const soldOutToast = 'Sold out. The driver is sleeping in the stock.';

/** "LKR 12,500" — grouped the Sri Lankan way (same as en-US for these amounts). */
export function formatLKR(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}
