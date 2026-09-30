/**
 * Site map. The site is five pages; each page holds a few sections. Nav, the
 * phone tab bar, the pit-lane menu, the home hub and the footer all read this,
 * so a section only has to be listed once. `hrefFor('crew')` → "/team/#crew".
 */
import { drivers, owner } from './lore';

export type PageId = 'home' | 'team' | 'car' | 'paddock' | 'race';
/** Tab-bar pictogram (drawn in chrome/TabBar.astro). */
export type PageIcon = 'flag' | 'helmet' | 'car' | 'camera' | 'lights';

export interface SiteSection {
  /** The section's element id on its page. */
  id: string;
  label: string;
  /** One-line joke shown in the pit-lane menu and the hub. */
  sub: string;
}

export interface SitePage {
  id: PageId;
  href: string;
  label: string;
  icon: PageIcon;
  /** <title> and the page's <h1>. */
  title: string;
  /** Shown under the <h1>, in the hub card and in the pit-lane menu. */
  sub: string;
  description: string;
  sections: SiteSection[];
}

const carNumbers = drivers.map((d) => `#${d.number}`).join(' & ');

export const pages: SitePage[] = [
  {
    id: 'home',
    href: '/',
    label: 'Home',
    icon: 'flag',
    title: 'Bilal Racing',
    sub: 'The pit lane. Everything starts here.',
    description: '',
    sections: [
      { id: 'hub', label: 'Garage map', sub: 'Pick a sector' },
      { id: 'sponsors', label: 'Partners', sub: 'Imaginary. Grateful.' },
    ],
  },
  {
    id: 'team',
    href: '/team/',
    label: 'Team',
    icon: 'helmet',
    title: 'The team',
    sub: `${carNumbers}, the cat in charge, and the fastest crew in the pit lane.`,
    description: `Meet Bilal Racing: drivers ${carNumbers}, the cat who owns the team, nine lives of history and the record-setting pit crew.`,
    sections: [
      { id: 'driver', label: 'Line-up', sub: `${carNumbers}. The boss is a cat.` },
      { id: 'career', label: 'History', sub: 'Nine lives, abridged' },
      { id: 'crew', label: 'Crew', sub: 'Pit wall, pit crew, open seats' },
    ],
  },
  {
    id: 'car',
    href: '/car/',
    label: 'Car',
    icon: 'car',
    title: 'The car',
    sub: 'The BR-09, taken apart, and the rulebook it was built around.',
    description: 'The Bilal Racing BR-09: every part exploded in 3D, plus the technical regulations as the cat wrote them.',
    sections: [
      { id: 'car', label: 'BR-09', sub: 'The car, in pieces' },
      { id: 'tech', label: 'Tech regs', sub: 'The rulebook' },
    ],
  },
  {
    id: 'paddock',
    href: '/paddock/',
    label: 'Paddock',
    icon: 'camera',
    title: 'The paddock',
    sub: 'Photos from the gang. Add your own to the wall.',
    description: 'The Bilal Racing paddock: the official photo wall, and the fan wall where the crew pins up its own shots.',
    sections: [
      { id: 'paddock', label: 'Photos', sub: 'Evidence, laminated' },
      { id: 'fan-wall', label: 'Your shots', sub: 'Pin yours to the wall' },
    ],
  },
  {
    id: 'race',
    href: '/race/',
    label: 'Race',
    icon: 'lights',
    title: 'Race weekend',
    sub: 'Beat the lights, climb the live leaderboard, tune in to the radio.',
    description: 'Race weekend at Bilal Racing: the Lights Out reaction test with a live leaderboard, the nine-round calendar and team radio.',
    sections: [
      { id: 'lights-out', label: 'Lights Out', sub: 'Out-pounce the whole grid' },
      { id: 'leaderboard', label: 'Leaderboard', sub: 'Live. Fastest paws first.' },
      { id: 'calendar', label: 'Calendar', sub: 'Nine rounds. Nine wins.' },
      { id: 'radio', label: 'Radio', sub: `${owner.callsign} has the mic. Plan B: fish.` },
    ],
  },
];

export const pageById = (id: PageId): SitePage => pages.find((p) => p.id === id) ?? pages[0]!;

/** Link to a section from anywhere on the site. */
export function hrefFor(sectionId: string): string {
  const page = pages.find((p) => p.sections.some((s) => s.id === sectionId));
  return page ? `${page.href}#${sectionId}` : `/#${sectionId}`;
}
