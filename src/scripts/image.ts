/**
 * Shrink a photo in the browser before it is uploaded: decode, scale to a
 * longest edge (or centre-crop to a square for crew faces), re-encode as WebP
 * (JPEG where the browser can't write WebP), and step the quality down until it
 * fits the byte budget.
 *
 * Re-encoding through a canvas writes pixels only, so EXIF (GPS position,
 * camera, date) never leaves the phone. The server checks that too.
 */
export interface PreparedImage {
  blob: Blob;
  width: number;
  height: number;
}

export interface PrepareOptions {
  /** Longest edge in px (the side length when `square`). */
  maxEdge: number;
  /** Upper bound for the encoded file. */
  maxBytes: number;
  /** Crop to a square around the upper-middle of the photo (faces). */
  square?: boolean;
}

/** Bigger source files than this aren't worth decoding on a phone. */
const MAX_SOURCE_BYTES = 40_000_000;

export class ImageError extends Error {}

async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if ('createImageBitmap' in window) {
    try {
      // `from-image` applies the EXIF rotation, so portrait phone shots stay upright.
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch {
      /* fall through to <img> (older Safari, odd formats) */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    throw new ImageError('That file is not a photo this browser can open. Try a JPEG or PNG.');
  }
}

const toBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

export async function prepareImage(file: File, { maxEdge, maxBytes, square = false }: PrepareOptions): Promise<PreparedImage> {
  if (!file.type.startsWith('image/')) throw new ImageError('Pick a photo (JPEG, PNG or WebP).');
  if (file.size > MAX_SOURCE_BYTES) throw new ImageError('That file is enormous. Pick a smaller photo.');

  const { source, width: sw, height: sh, close } = await decode(file);
  try {
    if (!sw || !sh) throw new ImageError('That photo came out empty. Try another one.');

    // Source rectangle: the whole photo, or a square biased upwards (heads sit high in a portrait).
    const side = Math.min(sw, sh);
    const sx = square ? (sw - side) / 2 : 0;
    const sy = square ? (sh - side) * 0.3 : 0;
    const cw = square ? side : sw;
    const ch = square ? side : sh;

    let scale = Math.min(1, maxEdge / Math.max(cw, ch));
    // A crew face is always exactly maxEdge square (small photos are scaled up a little).
    if (square) scale = maxEdge / side;
    let quality = 0.84;
    let type = 'image/webp';

    const canvas = document.createElement('canvas');
    for (let attempt = 0; attempt < 9; attempt++) {
      const width = Math.max(1, Math.round(cw * scale));
      const height = Math.max(1, Math.round(ch * scale));
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new ImageError('This browser cannot resize photos.');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(source, sx, sy, cw, ch, 0, 0, width, height);

      let blob = await toBlob(canvas, type, quality);
      // Browsers that can't encode WebP hand back a PNG instead: switch to JPEG for good.
      if (blob && type === 'image/webp' && blob.type !== 'image/webp') {
        type = 'image/jpeg';
        blob = await toBlob(canvas, type, quality);
      }
      if (!blob) throw new ImageError('This browser could not save the photo. Try another one.');
      if (blob.size <= maxBytes) return { blob, width, height };

      // Too heavy: lower the quality first, then the size (a face keeps its size).
      if (quality > 0.55) quality -= 0.1;
      else if (!square) scale *= 0.85;
      else quality = Math.max(0.3, quality - 0.08);
    }
    throw new ImageError('That photo would not shrink enough. Try a different one.');
  } finally {
    close();
  }
}
