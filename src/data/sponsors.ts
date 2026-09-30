/**
 * Parody partners and the (permanently sold-out, that popular) Paddock Shop.
 * All names are original parodies — no real brands, no real logos. Each
 * sponsor's typographic badge is drawn in SVG by Sponsors.astro, keyed by `id`.
 *
 * Line-up: the owner (Poosa, callsign RAT) runs the shop; the drivers are
 * #13 and #17; #9 is the team's lucky number. No gendered pronouns for drivers.
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
    line: 'P Zero Paw. Grip on every surface, in every weather.',
    accent: 'gold',
  },
  {
    id: 'whisker',
    name: 'Whisker Energy',
    category: 'Official energy drink',
    line: 'Gives you whiskers. Powers the 3 a.m. zoomies.',
    accent: 'teal',
  },
  {
    id: 'catnip',
    name: 'Catnip Capital',
    category: 'Official investment partner',
    line: 'Past purr-formance: excellent. Future purr-formance: even better.',
    accent: 'teal',
  },
  {
    id: 'litterbox',
    name: 'Litter-Box Logistics',
    category: 'Official logistics partner',
    line: 'We deliver. On time, every time, in a very nice box.',
    accent: 'saffron',
  },
  {
    id: 'nap',
    name: 'Nap Airlines',
    category: 'Official airline',
    line: 'Every seat reclines. Every flight lands on the podium.',
    accent: 'purple',
  },
  {
    id: 'laser',
    name: 'Laser Pointer Labs',
    category: 'Official technology partner',
    line: 'Innovation worth chasing. Precision down to a single red dot.',
    accent: 'red',
  },
  {
    id: 'machan',
    name: 'Machan Motors',
    category: 'Official safety car (a tuk-tuk)',
    line: 'The friendliest safety car in motorsport. Deploys with a horn, not lights.',
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
  status: 'Reserved for the best',
  pitch: 'Your name on cars #13 and #17, and on the owner’s favourite box. Seen by champions. Loved by one cat.',
  cta: 'Apply to sponsor',
  toast: 'Application received. The owner is delighted.',
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
    blurb: 'Ears pre-installed, lucky #9 on the front. Fits any head with two ears or fewer.',
    tag: 'Bestseller',
    accent: 'gold',
    art: 'Black team cap with two pointed cat ears and a gold badge showing the team’s lucky number nine',
  },
  {
    id: 'box',
    name: '“Box Box” Limited Edition Box',
    price: 12500,
    blurb: 'Genuine cardboard. Ships empty, arrives with the team owner in it.',
    tag: 'Limited',
    accent: 'saffron',
    art: 'An open cardboard box stamped BOX BOX, with two cat ears and glowing eyes peeking out',
  },
  {
    id: 'hoodie',
    name: '#13 & #17 Driver Hoodies',
    price: 13017,
    blurb: 'Sold as a pair, because this team has two number one drivers.',
    tag: 'Pair',
    accent: 'maroon',
    art: 'Two cat-ear driver hoodies side by side: a maroon one with a gold number 13 and a jungle-green one with a gold number 17',
  },
  {
    id: 'tee',
    name: '“RAT” Callsign Tee',
    price: 3900,
    blurb: 'RAT is the owner’s pit-wall callsign. He is a cat. We love it.',
    accent: 'purple',
    art: 'White T-shirt printed with a pit-wall screen headed RAT: cars 13 and 17 are told to box, RAT is already sitting in the box, and the result reads one-two',
  },
  {
    id: 'freshener',
    name: 'Tuna-Scented Air Freshener',
    price: 990,
    blurb: 'New-car smell, but make it fish. Owner-approved. The smell of victory.',
    tag: 'Fresh',
    accent: 'teal',
    art: 'A fish-shaped car air freshener labelled TUNA hanging from a string',
  },
  {
    id: 'laser',
    name: 'Laser Pointer (Champions’ Edition)',
    price: 1500,
    blurb: 'The owner’s favourite training tool. Sealed in a collector’s bag and signed with a paw print.',
    tag: 'Collector',
    accent: 'red',
    art: 'A laser pointer sealed inside a clear collector’s bag',
  },
];

export const soldOutToast = 'Sold out. Champions’ merch goes fast.';

/** "LKR 12,500" — grouped the Sri Lankan way (same as en-US for these amounts). */
export function formatLKR(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}
