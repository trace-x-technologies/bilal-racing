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

export type PhotoFolder = 'driver' | 'team' | 'together' | 'crew' | 'misc';

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

/** Team Principal & Owner portrait (full photo). */
export const ownerPortrait: PhotoEntry = {
  id: 'owner-portrait',
  folder: 'team',
  file: 'nirod-rathnaweera.jpg',
  alt: 'Nirod “Poosa” Rathnaweera, Team Principal and Owner of Bilal Racing, in sunglasses',
  caption: 'The owner. Sunglasses on, strategy off, nap pending.',
  focal: '50% 45%',
  placeholder: 'Owner portrait',
};

/** Driver portraits, keyed by driver id from lore.ts. */
export const driverPortraits: Record<'dha' | 'dee', PhotoEntry> = {
  dha: {
    id: 'driver-dha',
    folder: 'driver',
    file: 'isuru-dharmadasa.jpg',
    alt: 'Isuru Dharmadasa, driver #13, in sunglasses at the beach',
    caption: 'Car #13. Qualifying in sunglasses since forever.',
    focal: '40% 35%',
    placeholder: 'Driver #13',
  },
  dee: {
    id: 'driver-dee',
    folder: 'driver',
    file: 'yasas-deegala.jpg',
    alt: 'Yasas Deegala, driver #17, taking a selfie among ferns and mossy rocks in the jungle',
    caption: 'Car #17. Pre-season altitude training, waterfall edition.',
    focal: '47% 45%',
    placeholder: 'Driver #17',
  },
};

/**
 * Paddock gallery — real photos of the gang. Captions don't name anyone
 * (group shots); keep it that way. Ordered roughly by how much they slap.
 */
export const gallery: PhotoEntry[] = [
  { id: 'team-pool', folder: 'together', file: 'team-pool.jpg', alt: 'The whole crew lined up beside a pool under palm trees', caption: 'Official team photo. Pre-season testing, poolside division.', focal: '50% 88%' },
  { id: 'helmets', folder: 'together', file: 'helmets.jpg', alt: 'Two friends in motorbike helmets taking a selfie', caption: 'Helmet check. Visors optional. Seriousness off.', focal: '50% 40%' },
  { id: 'night-celebration', folder: 'together', file: 'night-celebration.jpg', alt: 'A crowd of friends cheering at night with raised glasses', caption: 'Championship celebrations. The season hasn’t started yet.', focal: '50% 45%' },
  { id: 'wedding-suits', folder: 'together', file: 'wedding-suits.jpg', alt: 'Friends in suits taking a group selfie at a wedding', caption: 'Black-tie grid walk. Suits pressed, tyres warmed, snacks located.', focal: '50% 40%' },
  { id: 'road-trip', folder: 'together', file: 'road-trip.jpg', alt: 'A group of friends posing on a road beside a car', caption: 'Recon lap. Nobody knows who has the car keys.', focal: '50% 50%' },
  { id: 'pool-strategy', folder: 'together', file: 'pool-strategy.jpg', alt: 'Five friends sitting at the edge of a pool, seen from behind, facing palm trees', caption: 'Strategy meeting. Nobody is taking notes.', focal: '50% 60%' },
  { id: 'garage-five', folder: 'together', file: 'garage-five.jpg', alt: 'Five friends standing arm in arm under a carport', caption: 'Garage photo. Five crew, zero cars, full confidence.', focal: '50% 45%' },
  { id: 'wedding-street', folder: 'together', file: 'wedding-street.jpg', alt: 'Three friends in wedding outfits taking a street selfie', caption: 'Formation lap to the ceremony.', focal: '50% 35%' },
  { id: 'cycling', folder: 'together', file: 'cycling.jpg', alt: 'Four friends with bicycles and helmets on a road', caption: 'Fitness programme. Pedal-assisted, snack-powered.', focal: '50% 50%' },
  { id: 'wedding-hotel', folder: 'together', file: 'wedding-hotel.jpg', alt: 'Friends dressed up for a wedding outside a hotel', caption: 'Team kit launch. Dress code: podium.', focal: '50% 40%' },
  { id: 'parc-ferme', folder: 'together', file: 'parc-ferme.jpg', alt: 'Two friends slumped on the steps outside a bank', caption: 'Parc fermé. Cars impounded, everyone exhausted.', focal: '50% 60%' },
  { id: 'hospitality', folder: 'together', file: 'hospitality.jpg', alt: 'Three friends standing by a dining table with drinks and ice cream', caption: 'Hospitality suite. Ice-cream budget: unlimited.', focal: '50% 45%' },
  { id: 'wedding-laughs', folder: 'together', file: 'wedding-laughs.jpg', alt: 'Three friends laughing and holding up a printed wedding photo', caption: 'Photo of a photo. Peak engineering.', focal: '50% 40%' },
  { id: 'shed-selfie', folder: 'together', file: 'shed-selfie.jpg', alt: 'Friends in caps and hats taking a selfie under a shelter', caption: 'Rain delay. Morale: suspiciously high.', focal: '50% 45%' },
  { id: 'wedding-bouquet', folder: 'together', file: 'wedding-bouquet.jpg', alt: 'Two friends in wedding clothes taking a selfie with a bouquet', caption: 'Someone caught the bouquet. Race control has been informed.', focal: '50% 40%' },
];
