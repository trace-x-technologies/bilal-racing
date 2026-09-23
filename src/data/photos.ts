/**
 * Photo manifest. Real photos live in src/assets/photos/<folder>/ and are
 * optimised by astro:assets (AVIF/WebP, resized, EXIF/GPS stripped).
 *
 * Entries whose file doesn't exist yet render a styled placeholder, so the
 * site works before the photos arrive. To add a photo: drop the file in the
 * folder and set `file` on the matching entry (or add a new entry).
 */
import type { ImageMetadata } from 'astro';

const files = import.meta.glob<{ default: ImageMetadata }>(
  '/src/assets/photos/**/*.{jpg,jpeg,png,webp,avif,JPG,JPEG,PNG}',
  { eager: true },
);

export type PhotoFolder = 'driver' | 'together' | 'crew' | 'misc';

export interface PhotoEntry {
  id: string;
  folder: PhotoFolder;
  /** File name inside the folder, e.g. "nirod-helmet.jpg". */
  file?: string;
  alt: string;
  /** Funny caption shown in the gallery/lightbox. */
  caption: string;
  /** CSS object-position focal point, e.g. "50% 30%". */
  focal?: string;
  /** Short label shown on the placeholder while the photo is missing. */
  placeholder?: string;
}

export interface ResolvedPhoto extends PhotoEntry {
  src: ImageMetadata | null;
}

export function resolvePhoto(entry: PhotoEntry): ResolvedPhoto {
  const key = entry.file ? `/src/assets/photos/${entry.folder}/${entry.file}` : '';
  return { ...entry, src: key && files[key] ? files[key].default : null };
}

/** Portrait of the driver used in Hero/Driver sections. */
export const driverPortrait: PhotoEntry = {
  id: 'driver-portrait',
  folder: 'driver',
  file: undefined, // TODO(owner): e.g. 'nirod-portrait.jpg'
  alt: 'Nirod “Poosa” Rathnaweera, driver #9 for Bilal Racing',
  caption: 'Official driver portrait. He asked for his good side. Both sides were asleep.',
  focal: '50% 30%',
  placeholder: 'Driver portrait',
};

/** Paddock gallery — the owner will swap placeholders for real photos. */
export const gallery: PhotoEntry[] = [
  { id: 'g1', folder: 'driver', alt: 'Nirod’s mid-race face', caption: 'Qualifying face. Also his “what’s for lunch” face.', placeholder: 'Qualifying face' },
  { id: 'g2', folder: 'together', alt: 'The team together', caption: 'Team photo. Driver present, spiritually.', placeholder: 'Team photo' },
  { id: 'g3', folder: 'driver', alt: 'Nirod relaxing', caption: 'Pre-race preparation (nap, lap 1 of 3).', placeholder: 'Pre-race prep' },
  { id: 'g4', folder: 'together', alt: 'Friends at an event', caption: 'Wedding GP 2021. P1 at the buffet.', placeholder: 'Wedding GP' },
  { id: 'g5', folder: 'together', alt: 'Road trip', caption: 'Balangoda GP recon lap. Essential services only.', placeholder: 'Balangoda recon' },
  { id: 'g6', folder: 'driver', alt: 'Nirod smiling', caption: 'Podium smile, rehearsed daily in the mirror.', placeholder: 'Podium smile' },
  { id: 'g7', folder: 'together', alt: 'Night out', caption: 'Night race. Nobody remembers who won.', placeholder: 'Night race' },
  { id: 'g8', folder: 'misc', alt: 'A cat, for reference', caption: 'Reference image supplied to the livery designers.', placeholder: 'Livery reference' },
];
